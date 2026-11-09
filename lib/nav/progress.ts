// Route-following math: snap a GPS fix onto the planned polyline, derive
// travelled/remaining distance, the active turn step, off-route deviation and
// arrival. Pure functions so they can be unit-tested and reused server-side.

export type LL = [number, number] // [lat, lng]

const R = 6_371_000 // earth radius (m)

export function haversineMeters(a: LL, b: LL): number {
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLon = ((b[1] - a[1]) * Math.PI) / 180
  const la1 = (a[0] * Math.PI) / 180
  const la2 = (b[0] * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Cumulative along-route distance at every vertex (metres). */
export function cumulativeDistances(line: LL[]): number[] {
  const cum = new Array<number>(line.length).fill(0)
  for (let i = 1; i < line.length; i++) cum[i] = cum[i - 1] + haversineMeters(line[i - 1], line[i])
  return cum
}

/**
 * Perpendicular projection of p onto segment a-b in a local planar frame
 * (accurate at street scale). Returns the closest point and its 0..1 position.
 */
function projectOnSegment(p: LL, a: LL, b: LL): { point: LL; t: number } {
  const kx = Math.cos((p[0] * Math.PI) / 180) // lng degrees shrink with latitude
  const ax = a[1] * kx
  const ay = a[0]
  const bx = b[1] * kx
  const by = b[0]
  const px = p[1] * kx
  const py = p[0]
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return { point: a, t: 0 }
  let t = ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return { point: [ay + t * dy, (ax + t * dx) / kx], t }
}

export type RouteMatch = {
  /** Index of the segment the fix snapped to. */
  segmentIndex: number
  snapped: LL
  /** Perpendicular distance from the route (metres) — the off-route measure. */
  deviationMeters: number
  traveledMeters: number
  remainingMeters: number
}

/** Snaps a position onto the route and measures progress along it. */
export function matchToRoute(pos: LL, line: LL[], cum?: number[]): RouteMatch | null {
  if (line.length < 2) return null
  const c = cum ?? cumulativeDistances(line)
  let best: RouteMatch | null = null
  for (let i = 0; i < line.length - 1; i++) {
    const { point, t } = projectOnSegment(pos, line[i], line[i + 1])
    const dev = haversineMeters(pos, point)
    if (best && dev >= best.deviationMeters) continue
    const segLen = c[i + 1] - c[i]
    const traveled = c[i] + segLen * t
    best = {
      segmentIndex: i,
      snapped: point,
      deviationMeters: dev,
      traveledMeters: traveled,
      remainingMeters: Math.max(0, c[c.length - 1] - traveled),
    }
  }
  return best
}

export type StepLike = { distanceMeters: number; durationSeconds: number }

export type NavProgress = {
  snapped: LL
  deviationMeters: number
  isOffRoute: boolean
  traveledMeters: number
  remainingMeters: number
  remainingSeconds: number
  /** 0..1 fraction of the route completed. */
  ratio: number
  stepIndex: number
  /** Distance until the current step's maneuver (metres). */
  distanceToManeuver: number
  arrived: boolean
}

/**
 * Full navigation progress for one fix. Step boundaries come from the engine's
 * own per-step distances, so the active maneuver is derived from real data.
 */
export function computeProgress(opts: {
  pos: LL
  line: LL[]
  cum?: number[]
  steps: StepLike[]
  totalMeters: number
  totalSeconds: number
  /** Deviation beyond which the driver is considered off-route. */
  offRouteMeters?: number
  /** Distance to destination that counts as arrival. */
  arrivalMeters?: number
}): NavProgress | null {
  const { pos, line, steps, totalMeters, totalSeconds } = opts
  const offRouteMeters = opts.offRouteMeters ?? 55
  const arrivalMeters = opts.arrivalMeters ?? 45

  const m = matchToRoute(pos, line, opts.cum)
  if (!m) return null

  // Walk step boundaries until the travelled distance falls inside one.
  let stepIndex = 0
  let stepStart = 0
  let acc = 0
  for (let i = 0; i < steps.length; i++) {
    const end = acc + Math.max(0, steps[i].distanceMeters)
    if (m.traveledMeters < end || i === steps.length - 1) {
      stepIndex = i
      stepStart = acc
      break
    }
    acc = end
  }
  const curStep = steps[stepIndex]
  const stepLen = Math.max(0, curStep?.distanceMeters ?? 0)
  const intoStep = Math.max(0, m.traveledMeters - stepStart)
  const distanceToManeuver = Math.max(0, stepLen - intoStep)

  // Remaining time = leftover of the current step + all later steps.
  let remainingSeconds = 0
  if (steps.length > 0) {
    const frac = stepLen > 0 ? Math.min(1, intoStep / stepLen) : 1
    remainingSeconds = (curStep?.durationSeconds ?? 0) * (1 - frac)
    for (let i = stepIndex + 1; i < steps.length; i++) remainingSeconds += steps[i].durationSeconds
  } else if (totalMeters > 0) {
    remainingSeconds = (m.remainingMeters / totalMeters) * totalSeconds
  }

  const toDest = haversineMeters(pos, line[line.length - 1])
  return {
    snapped: m.snapped,
    deviationMeters: m.deviationMeters,
    isOffRoute: m.deviationMeters > offRouteMeters,
    traveledMeters: m.traveledMeters,
    remainingMeters: m.remainingMeters,
    remainingSeconds: Math.round(remainingSeconds),
    ratio: totalMeters > 0 ? Math.min(1, m.traveledMeters / totalMeters) : 0,
    stepIndex,
    distanceToManeuver,
    arrived: toDest <= arrivalMeters || m.remainingMeters <= arrivalMeters,
  }
}

/** Compact distance for HUD display. */
export function fmtDistance(m: number): string {
  if (m < 1000) return `${Math.max(0, Math.round(m / 10) * 10)} m`
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`
}

/** Compact duration for HUD display. */
export function fmtDuration(s: number): string {
  const total = Math.max(0, Math.round(s / 60))
  if (total < 60) return `${total} min`
  return `${Math.floor(total / 60)} h ${total % 60} min`
}

/** Clock time of arrival, e.g. "18:42". */
export function etaClock(secondsFromNow: number): string {
  const d = new Date(Date.now() + Math.max(0, secondsFromNow) * 1000)
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}
