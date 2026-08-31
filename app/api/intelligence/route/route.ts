// ---------------------------------------------------------------------------
// POST /api/intelligence/route
//
// The decision layer. Given an origin/destination (plus optional stops and a
// what-if scenario) it:
//   1. asks the REAL routing engine for candidate routes,
//   2. fetches live weather along the corridor,
//   3. collects active incidents + any scenario-generated ones,
//   4. scores every candidate with the existing ML/heuristic stack,
//   5. if the scenario blocks the plan, asks the routing engine AGAIN for a
//      genuine detour around the closure — the alternative is never fabricated,
//   6. returns baseline vs scenario so the UI can show the impact.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server"
import { routingEngine, labelRoutes, RoutingError, type EngineRoute, type LonLat, type TravelMode } from "@/lib/geo/routing"
import { getWeatherIntel, sampleAlong, WEATHER_UNAVAILABLE } from "@/lib/intel/weather"
import {
  createIncident,
  clearSimulated,
  listIncidents,
  type Incident,
  type IncidentSeverity,
} from "@/lib/intel/incidents"
import { scoreRoutes, type IntelResult, type ScorableRoute } from "@/lib/intel/score"
import { haversineMeters, type LL } from "@/lib/nav/progress"

const MODES: TravelMode[] = ["driving", "walking", "cycling"]

export type ScenarioType = "none" | "closure" | "accident" | "traffic" | "rain" | "flood"

function coord(v: unknown): LonLat | null {
  const o = v as { lat?: unknown; lon?: unknown; lng?: unknown } | null
  if (!o) return null
  const lat = Number(o.lat)
  const lon = Number(o.lon ?? o.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { lat, lon }
}

function toScorable(routes: { route: EngineRoute; label: string }[]): ScorableRoute[] {
  return routes.map(({ route, label }) => ({
    id: route.id,
    label,
    distanceMeters: route.distanceMeters,
    durationSeconds: route.durationSeconds,
    latLngs: route.latLngs as LL[],
    stepCount: Math.max(1, route.steps.length),
  }))
}

function serialise(routes: { route: EngineRoute; label: string }[]) {
  return routes.map(({ route, label }) => ({
    id: route.id,
    label,
    distance_meters: route.distanceMeters,
    duration_seconds: route.durationSeconds,
    summary: route.summary,
    latLngs: route.latLngs,
    steps: route.steps,
    ai_score: route.aiScore,
  }))
}

/** Point roughly `frac` of the way along a polyline — where a scenario strikes. */
function pointAlong(line: LL[], frac: number): LL {
  if (line.length === 0) return [0, 0]
  const idx = Math.min(line.length - 1, Math.max(0, Math.round(frac * (line.length - 1))))
  return line[idx]
}

/**
 * Builds a detour waypoint offset perpendicular to the route at the blockage,
 * so the routing engine is forced to find a genuinely different path. The
 * engine still decides the actual roads.
 */
function detourWaypoint(line: LL[], at: LL, offsetMeters: number): LonLat {
  // Local heading around the blockage.
  let i = 0
  let best = Number.POSITIVE_INFINITY
  for (let k = 0; k < line.length; k++) {
    const d = haversineMeters(at, line[k])
    if (d < best) {
      best = d
      i = k
    }
  }
  const a = line[Math.max(0, i - 2)]
  const b = line[Math.min(line.length - 1, i + 2)]
  const dLat = b[0] - a[0]
  const dLon = b[1] - a[1]
  const len = Math.hypot(dLat, dLon) || 1e-6
  // Perpendicular unit vector, converted from metres to degrees.
  const mPerDegLat = 111_320
  const mPerDegLon = 111_320 * Math.cos((at[0] * Math.PI) / 180) || 1
  const perpLat = -dLon / len
  const perpLon = dLat / len
  return {
    lat: at[0] + (perpLat * offsetMeters) / mPerDegLat,
    lon: at[1] + (perpLon * offsetMeters) / mPerDegLon,
  }
}

const SCENARIO_SPEC: Record<
  Exclude<ScenarioType, "none">,
  { incident?: { type: Incident["type"]; severity: IncidentSeverity; radius: number }; surge: number; label: string }
> = {
  closure: { incident: { type: "closure", severity: "critical", radius: 700 }, surge: 0.1, label: "Road closure" },
  accident: { incident: { type: "accident", severity: "high", radius: 500 }, surge: 0.25, label: "Accident" },
  traffic: { surge: 1, label: "Traffic surge" },
  rain: { incident: { type: "weather", severity: "medium", radius: 6000 }, surge: 0.3, label: "Heavy rain" },
  flood: { incident: { type: "flooding", severity: "critical", radius: 1200 }, surge: 0.35, label: "Flood" },
}

export async function POST(req: Request) {
  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  const b = payload as {
    origin?: unknown
    destination?: unknown
    waypoints?: unknown[]
    mode?: string
    scenario?: { type?: string; intensity?: number; at?: unknown }
  }

  const origin = coord(b.origin)
  const destination = coord(b.destination)
  if (!origin || !destination) {
    return NextResponse.json({ error: "origin and destination with valid lat/lon are required" }, { status: 400 })
  }
  const waypoints = Array.isArray(b.waypoints) ? b.waypoints.map(coord).filter((p): p is LonLat => p !== null) : []
  const mode = (MODES as string[]).includes(String(b.mode)) ? (b.mode as TravelMode) : "driving"

  const rawType = String(b.scenario?.type ?? "none") as ScenarioType
  const scenarioType: ScenarioType = rawType in SCENARIO_SPEC || rawType === "none" ? rawType : "none"
  const intensity = Math.max(0, Math.min(1, Number(b.scenario?.intensity ?? 0.6) || 0.6))

  try {
    // ---- 1. real routing -------------------------------------------------
    const base = await routingEngine.route({ origin, destination, waypoints, mode, alternatives: true })
    if (base.routes.length === 0) {
      return NextResponse.json({ error: "no route found" }, { status: 404 })
    }
    const baseLabeled = labelRoutes(base.routes)
    const baseScorable = toScorable(baseLabeled)
    const primaryLine = baseScorable[0].latLngs

    // ---- 2. weather (optional — never blocks the response) ---------------
    const weather = await getWeatherIntel(sampleAlong(primaryLine, 3)).catch(() => WEATHER_UNAVAILABLE)

    // ---- 3. incidents ----------------------------------------------------
    // Reset previous simulated events so scenarios don't accumulate.
    clearSimulated()
    const reported = listIncidents({ activeOnly: true })

    // ---- 4. baseline intelligence (no scenario applied) ------------------
    const baseline = await scoreRoutes({ routes: baseScorable, incidents: reported, weather })

    if (scenarioType === "none") {
      return NextResponse.json({
        engine: base.engine,
        mode: base.mode,
        routes: serialise(baseLabeled),
        baseline,
        scenario: null,
        incidents: reported,
        duration_estimated: base.durationEstimated === true,
      })
    }

    // ---- 5. apply the scenario ------------------------------------------
    const spec = SCENARIO_SPEC[scenarioType as Exclude<ScenarioType, "none">]
    const strikeAt = coord(b.scenario?.at)
    const at: LL = strikeAt ? [strikeAt.lat, strikeAt.lon] : pointAlong(primaryLine, 0.45)

    const simulated: Incident[] = []
    if (spec.incident) {
      simulated.push(
        createIncident({
          type: spec.incident.type,
          lat: at[0],
          lon: at[1],
          severity: spec.incident.severity,
          radiusMeters: Math.round(spec.incident.radius * (0.6 + intensity * 0.8)),
          description: `SIMULATED ${spec.label.toLowerCase()} (what-if scenario)`,
          origin: "simulated",
        }),
      )
    }
    const allIncidents = [...reported, ...simulated]
    const surge = spec.surge * intensity

    let scenarioRoutes = baseLabeled
    let rerouted = false
    let detour: LonLat | null = null

    // Score the ORIGINAL routes under the scenario to see if the plan survives.
    let scenarioIntel: IntelResult = await scoreRoutes({
      routes: baseScorable,
      incidents: allIncidents,
      weather,
      trafficSurge: surge,
      scenarioSeverity: intensity,
    })

    const everyRouteBlocked = scenarioIntel.scores.length > 0 && scenarioIntel.scores.every((s) => s.blocked)
    if (everyRouteBlocked) {
      // Ask the ENGINE for a real alternative around the blockage. Two offset
      // distances are tried so a tight urban closure can still be escaped.
      for (const offset of [1200 * (1 + intensity), 3000 * (1 + intensity)]) {
        const wp = detourWaypoint(primaryLine, at, offset)
        try {
          const alt = await routingEngine.route({
            origin,
            destination,
            waypoints: [...waypoints, wp],
            mode,
            alternatives: true,
          })
          if (alt.routes.length === 0) continue
          const altLabeled = labelRoutes(alt.routes)
          const altIntel = await scoreRoutes({
            routes: toScorable(altLabeled),
            incidents: allIncidents,
            weather,
            trafficSurge: surge,
            scenarioSeverity: intensity,
          })
          // Accept the detour only if it actually clears the blockage AND is
          // physically plausible. A forced detour around a closure cannot be
          // meaningfully SHORTER than the direct route — if the engine returns
          // one, it found a shortcut the baseline missed rather than a real
          // way around, so reporting it would understate the disruption.
          const clears = altIntel.scores.some((s) => !s.blocked)
          const bestAlt = altIntel.scores.find((s) => !s.blocked)
          const baseDist = baseline.scores[0]?.distanceKm ?? 0
          const plausible = !bestAlt || !baseDist || bestAlt.distanceKm >= baseDist * 0.98
          if (clears && plausible) {
            scenarioRoutes = altLabeled
            // A detour physically cannot beat the undisrupted plan: it exists
            // only because the direct road is unusable. The detour escapes the
            // incident, so it sheds the baseline's risk/delay penalties and can
            // score BETTER than the baseline — which would tell the user a
            // closure improved their trip. Floor each detour at the baseline's
            // cost so the simulation never reports a disruption as a benefit.
            const baseTop = baseline.scores[0]
            scenarioIntel = baseTop
              ? {
                  ...altIntel,
                  scores: altIntel.scores.map((s) => ({
                    ...s,
                    adjustedEtaMin: Math.max(s.adjustedEtaMin, baseTop.adjustedEtaMin),
                    delayMin: Math.max(s.delayMin, baseTop.delayMin),
                    aiScore: Math.min(s.aiScore, baseTop.aiScore),
                    riskScore: Math.max(s.riskScore, baseTop.riskScore),
                    riskBand: s.riskScore >= baseTop.riskScore ? s.riskBand : baseTop.riskBand,
                    factors: [...s.factors, "Detour forced by simulated blockage"],
                  })),
                }
              : altIntel
            rerouted = true
            detour = wp
            break
          }
        } catch {
          // try the next offset
        }
      }
    }

    return NextResponse.json({
      engine: base.engine,
      mode: base.mode,
      routes: serialise(scenarioRoutes),
      baseline,
      scenario: {
        type: scenarioType,
        label: spec.label,
        intensity,
        /** Everything under this key is SIMULATED, not observed. */
        simulated: true,
        at: { lat: at[0], lon: at[1] },
        surge,
        rerouted,
        detour,
        /**
         * True when every candidate is still blocked and the engine could not
         * return a plausible way around — the honest answer is "no viable
         * route", not a fabricated alternative.
         */
        noViableRoute: scenarioIntel.scores.length > 0 && scenarioIntel.scores.every((s) => s.blocked),
        intel: scenarioIntel,
        note: `SIMULATED ${spec.label} at ${at[0].toFixed(4)}, ${at[1].toFixed(4)} — results are a what-if projection, not live conditions.`,
      },
      incidents: allIncidents,
      duration_estimated: base.durationEstimated === true,
    })
  } catch (err) {
    const e = err as RoutingError
    return NextResponse.json({ error: e.message || "intelligence failed" }, { status: e.status ?? 502 })
  }
}
