// Routing engine abstraction. OSRM is the default implementation; the
// RoutingEngine interface lets GraphHopper/Valhalla be added later without
// changing API routes or the frontend.

const ROUTING_URL = process.env.ROUTING_URL || "https://router.project-osrm.org"

export type TravelMode = "driving" | "walking" | "cycling"

export type LonLat = { lat: number; lon: number }

export type RouteStep = {
  instruction: string
  maneuver: string
  modifier?: string
  name: string
  distanceMeters: number
  durationSeconds: number
}

export type EngineRoute = {
  id: string
  distanceMeters: number
  durationSeconds: number
  /** GeoJSON LineString coordinates, [lon, lat] pairs (engine-native order). */
  geometry: { type: "LineString"; coordinates: [number, number][] }
  /** Convenience: [lat, lng] pairs ready for Leaflet. */
  latLngs: [number, number][]
  steps: RouteStep[]
  summary: string
  /** Reserved for the AI/Digital-Twin scoring layer (populated in a later stage). */
  aiScore: number | null
}

export type RouteResult = {
  engine: string
  mode: TravelMode
  routes: EngineRoute[]
  /**
   * True when the engine had no dedicated profile for the requested mode
   * (the public OSRM demo server only hosts `driving`), so walking/cycling
   * durations were re-timed from the real road distance instead.
   */
  durationEstimated?: boolean
}

/** Typical door-to-door speeds (km/h) used only when a profile is missing. */
const MODE_SPEED_KMH: Record<TravelMode, number> = {
  driving: 0,
  walking: 4.8,
  cycling: 15,
}

export interface RoutingEngine {
  readonly name: string
  route(input: {
    origin: LonLat
    destination: LonLat
    waypoints?: LonLat[]
    mode: TravelMode
    alternatives?: boolean
  }): Promise<RouteResult>
}

export class RoutingError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message)
    this.name = "RoutingError"
  }
}

/** OSRM profile names for each supported travel mode. */
const OSRM_PROFILE: Record<TravelMode, string> = {
  driving: "driving",
  walking: "foot",
  cycling: "bike",
}

/** Decode an OSRM/Google encoded polyline (precision 5) into [lat, lng]. */
export function decodePolyline(str: string): [number, number][] {
  const out: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0
  while (index < str.length) {
    let result = 0
    let shift = 0
    let b: number
    do {
      b = str.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1
    result = 0
    shift = 0
    do {
      b = str.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lng += result & 1 ? ~(result >> 1) : result >> 1
    out.push([lat / 1e5, lng / 1e5])
  }
  return out
}

type OsrmStep = {
  distance: number
  duration: number
  name?: string
  maneuver?: { type?: string; modifier?: string; exit?: number }
  ref?: string
}

type OsrmRoute = {
  distance: number
  duration: number
  geometry: string
  legs?: { steps?: OsrmStep[]; summary?: string }[]
}

/** Build a readable turn instruction from OSRM maneuver data. */
function describeStep(s: OsrmStep, isLast: boolean): string {
  const type = s.maneuver?.type ?? "continue"
  const mod = s.maneuver?.modifier
  const road = s.name?.trim() || s.ref?.trim() || ""
  const on = road ? ` onto ${road}` : ""
  const along = road ? ` on ${road}` : ""
  switch (type) {
    case "depart":
      return `Start${mod ? ` heading ${mod}` : ""}${along}`
    case "arrive":
      return "Arrive at destination"
    case "turn":
      return `Turn ${mod ?? ""}${on}`.replace(/\s+/g, " ").trim()
    case "new name":
      return `Continue${along}`
    case "merge":
      return `Merge ${mod ?? ""}${on}`.replace(/\s+/g, " ").trim()
    case "on ramp":
      return `Take the ramp${mod ? ` ${mod}` : ""}${on}`
    case "off ramp":
      return `Take the exit${s.maneuver?.exit ? ` ${s.maneuver.exit}` : ""}${on}`
    case "fork":
      return `Keep ${mod ?? "straight"}${on}`
    case "roundabout":
    case "rotary":
      return `Enter the roundabout${s.maneuver?.exit ? ` and take exit ${s.maneuver.exit}` : ""}${on}`
    case "end of road":
      return `At the end of the road turn ${mod ?? ""}${on}`.replace(/\s+/g, " ").trim()
    case "continue":
      return isLast ? "Continue to destination" : `Continue ${mod ?? "straight"}${along}`.trim()
    default:
      return `${type}${mod ? ` ${mod}` : ""}${on}`.trim()
  }
}

async function fetchJson(url: string, timeoutMs = 12000): Promise<unknown> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } })
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      const code = (body as { code?: string; message?: string } | null)?.message
      throw new RoutingError(code || `routing engine responded ${res.status}`, res.status === 429 ? 429 : 502)
    }
    return body
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new RoutingError("routing engine timed out", 504)
    if (err instanceof RoutingError) throw err
    throw new RoutingError((err as Error).message || "routing engine unavailable")
  } finally {
    clearTimeout(timer)
  }
}

export class OsrmEngine implements RoutingEngine {
  readonly name = "osrm"
  constructor(private readonly baseUrl: string = ROUTING_URL) {}

  async route({
    origin,
    destination,
    waypoints = [],
    mode,
    alternatives = true,
  }: {
    origin: LonLat
    destination: LonLat
    waypoints?: LonLat[]
    mode: TravelMode
    alternatives?: boolean
  }): Promise<RouteResult> {
    const pts = [origin, ...waypoints, destination]
    for (const p of pts) {
      if (!Number.isFinite(p?.lat) || !Number.isFinite(p?.lon)) {
        throw new RoutingError("invalid coordinates", 400)
      }
      if (Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) {
        throw new RoutingError("coordinates out of range", 400)
      }
    }
    const coords = pts.map((p) => `${p.lon},${p.lat}`).join(";")
    // Alternatives are only supported for a plain A->B request.
    const wantAlts = alternatives && waypoints.length === 0
    const url =
      `${this.baseUrl}/route/v1/${OSRM_PROFILE[mode]}/${coords}` +
      `?overview=full&geometries=polyline&steps=true&annotations=false` +
      `&alternatives=${wantAlts ? "3" : "false"}`

    let body = (await fetchJson(url)) as { code?: string; routes?: OsrmRoute[]; message?: string }
    // The public demo server hosts only the driving profile. If a foot/bike
    // request fails, fall back to driving geometry and re-time it below.
    let estimated = false
    if (mode !== "driving" && (!body?.routes || body.routes.length === 0 || (body.code && body.code !== "Ok"))) {
      const drivingUrl = url.replace(`/route/v1/${OSRM_PROFILE[mode]}/`, "/route/v1/driving/")
      body = (await fetchJson(drivingUrl)) as typeof body
      estimated = true
    }
    if (body?.code && body.code !== "Ok") {
      const noRoute = body.code === "NoRoute"
      throw new RoutingError(noRoute ? "No route found between these points" : body.message || body.code, noRoute ? 404 : 502)
    }
    const routes = body?.routes ?? []
    if (routes.length === 0) throw new RoutingError("No route found between these points", 404)

    // Even when a foot/bike URL succeeds, the demo server may serve driving
    // timings. If the implied speed is far above human/bike pace, re-time it.
    if (mode !== "driving" && !estimated) {
      const r0 = routes[0]
      const kmh = r0.duration > 0 ? r0.distance / 1000 / (r0.duration / 3600) : 0
      if (kmh > MODE_SPEED_KMH[mode] * 1.8) estimated = true
    }
    const speed = MODE_SPEED_KMH[mode]
    const retime = (meters: number) => Math.round((meters / 1000 / speed) * 3600)

    return {
      engine: this.name,
      mode,
      durationEstimated: estimated,
      routes: routes.map((r, i) => {
        const latLngs = decodePolyline(r.geometry)
        const steps: RouteStep[] = (r.legs ?? []).flatMap((leg) => leg.steps ?? []).map((s, idx, arr) => ({
          instruction: describeStep(s, idx === arr.length - 1),
          maneuver: s.maneuver?.type ?? "continue",
          modifier: s.maneuver?.modifier,
          name: s.name?.trim() || "",
          distanceMeters: Math.round(s.distance ?? 0),
          durationSeconds: estimated ? retime(s.distance ?? 0) : Math.round(s.duration ?? 0),
        }))
        const named = steps.map((s) => s.name).filter(Boolean)
        const summary =
          (r.legs ?? []).map((l) => l.summary).filter(Boolean).join(", ") ||
          Array.from(new Set(named)).slice(0, 2).join(" / ")
        return {
          id: `route_${i + 1}`,
          distanceMeters: Math.round(r.distance ?? 0),
          durationSeconds: estimated ? retime(r.distance ?? 0) : Math.round(r.duration ?? 0),
          geometry: { type: "LineString", coordinates: latLngs.map(([la, ln]) => [ln, la] as [number, number]) },
          latLngs,
          steps,
          summary,
          aiScore: null,
        }
      }),
    }
  }
}

/** Active engine (swap here to change providers project-wide). */
export const routingEngine: RoutingEngine = new OsrmEngine()

/** Label routes by their real engine numbers: fastest / shortest / alternative. */
export function labelRoutes(routes: EngineRoute[]): { route: EngineRoute; label: string }[] {
  if (routes.length === 0) return []
  let fastest = routes[0]
  let shortest = routes[0]
  for (const r of routes) {
    if (r.durationSeconds < fastest.durationSeconds) fastest = r
    if (r.distanceMeters < shortest.distanceMeters) shortest = r
  }
  return routes.map((r) => ({
    route: r,
    label: r === fastest ? "Fastest" : r === shortest ? "Shortest" : "Alternative",
  }))
}
