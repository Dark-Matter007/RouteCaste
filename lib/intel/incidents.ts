// ---------------------------------------------------------------------------
// Incident / event model + geographic impact analysis.
//
// STORAGE: process-local (module singleton). There is no PostgreSQL/PostGIS in
// this project, so incidents live for the lifetime of the server process. The
// shape below mirrors a PostGIS table (point geometry + radius + severity), so
// swapping in a real spatial store later is a repository change only.
//
// The geometry maths here is real: incidents are matched against actual route
// polylines with point-to-segment distance, so an incident genuinely decides
// whether a route is affected.
// ---------------------------------------------------------------------------

import { haversineMeters, matchToRoute, type LL } from "@/lib/nav/progress"

export const INCIDENT_TYPES = [
  "accident",
  "closure",
  "construction",
  "flooding",
  "obstruction",
  "emergency",
  "weather",
] as const
export type IncidentType = (typeof INCIDENT_TYPES)[number]

export type IncidentSeverity = "low" | "medium" | "high" | "critical"
export type IncidentStatus = "active" | "cleared"
/** Where the record came from — never label a simulated event as observed. */
export type IncidentOrigin = "reported" | "simulated"

export type Incident = {
  id: string
  type: IncidentType
  lat: number
  lon: number
  severity: IncidentSeverity
  status: IncidentStatus
  origin: IncidentOrigin
  /** Impact radius in metres — the "affected area". */
  radiusMeters: number
  description: string
  createdAt: number
}

/** How much each severity slows traffic / raises risk (0..1). */
export const SEVERITY_WEIGHT: Record<IncidentSeverity, number> = {
  low: 0.2,
  medium: 0.45,
  high: 0.7,
  critical: 1,
}

/** Types that make a road impassable rather than merely slow. */
const BLOCKING: IncidentType[] = ["closure", "flooding"]

export function isBlocking(i: Incident): boolean {
  return BLOCKING.includes(i.type) || i.severity === "critical"
}

// ---- store -----------------------------------------------------------------

const store = new Map<string, Incident>()
let seq = 0

export type NewIncident = {
  type: IncidentType
  lat: number
  lon: number
  severity?: IncidentSeverity
  radiusMeters?: number
  description?: string
  origin?: IncidentOrigin
}

export function createIncident(input: NewIncident): Incident {
  const id = `inc_${Date.now().toString(36)}_${(seq++).toString(36)}`
  const inc: Incident = {
    id,
    type: input.type,
    lat: input.lat,
    lon: input.lon,
    severity: input.severity ?? "medium",
    status: "active",
    origin: input.origin ?? "reported",
    radiusMeters: Math.max(50, Math.min(20_000, input.radiusMeters ?? 400)),
    description: input.description?.trim() || defaultDescription(input.type),
    createdAt: Date.now(),
  }
  store.set(id, inc)
  return inc
}

function defaultDescription(t: IncidentType): string {
  const map: Record<IncidentType, string> = {
    accident: "Collision reported — lane blocked",
    closure: "Road closed to through traffic",
    construction: "Roadworks in progress",
    flooding: "Carriageway flooded — impassable",
    obstruction: "Obstruction on carriageway",
    emergency: "Emergency services on scene",
    weather: "Severe weather affecting road",
  }
  return map[t]
}

export function listIncidents(opts?: { activeOnly?: boolean }): Incident[] {
  const all = [...store.values()]
  const filtered = opts?.activeOnly ? all.filter((i) => i.status === "active") : all
  return filtered.sort((a, b) => b.createdAt - a.createdAt)
}

export function clearIncident(id: string): boolean {
  const i = store.get(id)
  if (!i) return false
  i.status = "cleared"
  return true
}

export function deleteIncident(id: string): boolean {
  return store.delete(id)
}

/** Drops every simulated incident — used when a what-if scenario is reset. */
export function clearSimulated(): number {
  let n = 0
  for (const [id, i] of store) {
    if (i.origin === "simulated") {
      store.delete(id)
      n++
    }
  }
  return n
}

/** Spatial query: active incidents whose affected area is within `radius`. */
export function incidentsNear(lat: number, lon: number, radiusMeters: number): Incident[] {
  return listIncidents({ activeOnly: true }).filter(
    (i) => haversineMeters([lat, lon], [i.lat, i.lon]) <= radiusMeters + i.radiusMeters,
  )
}

// ---- impact analysis -------------------------------------------------------

export type RouteImpact = {
  incident: Incident
  /** Closest approach between the incident and the route, in metres. */
  distanceMeters: number
  /** How far along the route the incident sits (metres from origin). */
  alongMeters: number
  /** Inside the affected radius. */
  affected: boolean
  /** Physically blocks this route. */
  blocks: boolean
  /** Estimated added delay in seconds. */
  delaySeconds: number
}

/**
 * Determines which incidents actually touch a route by measuring the incident
 * against the route polyline, then estimates the delay each one adds.
 */
export function analyseRoute(line: LL[], incidents: Incident[], durationSeconds: number): RouteImpact[] {
  if (line.length < 2) return []
  const out: RouteImpact[] = []

  for (const inc of incidents) {
    const m = matchToRoute([inc.lat, inc.lon], line)
    if (!m) continue
    const affected = m.deviationMeters <= inc.radiusMeters
    if (!affected) continue

    const w = SEVERITY_WEIGHT[inc.severity]
    // Closer to the centreline hurts more; a blocking incident is worst.
    const proximity = 1 - m.deviationMeters / inc.radiusMeters
    const base = isBlocking(inc) ? 0.6 : 0.28
    const delaySeconds = Math.round(durationSeconds * base * w * Math.max(0.25, proximity))

    out.push({
      incident: inc,
      distanceMeters: Math.round(m.deviationMeters),
      alongMeters: Math.round(m.traveledMeters),
      affected,
      blocks: isBlocking(inc),
      delaySeconds,
    })
  }

  return out.sort((a, b) => a.alongMeters - b.alongMeters)
}

/** True when any active incident makes this route impassable. */
export function isRouteBlocked(impacts: RouteImpact[]): boolean {
  return impacts.some((i) => i.blocks)
}
