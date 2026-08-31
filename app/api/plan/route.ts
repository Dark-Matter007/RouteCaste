import { NextResponse } from "next/server"
import { getCityGraph, nearestNodeId } from "@/lib/city"
import { planRoutes, type Weights } from "@/lib/optimizer"
import { getEvent, buildEvent, type EventPlan } from "@/lib/store"
import {
  applyScenario,
  computeMetrics,
  pollutionZones,
  forecastCongestion,
  type Scenario,
  type ScenarioType,
} from "@/lib/sim"
import { rerankRoutesByEta, predictCongestion, modelStatus, type PredictContext } from "@/lib/ml"

const SCENARIO_TYPES: ScenarioType[] = ["none", "closure", "accident", "surge", "weather"]

// GET /api/plan?wTime=..&wDistance=..&wCongestion=..&scenario=..&intensity=..
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const weights: Weights = {
    time: clamp(Number(searchParams.get("wTime") ?? "0.5")),
    distance: clamp(Number(searchParams.get("wDistance") ?? "0.2")),
    congestion: clamp(Number(searchParams.get("wCongestion") ?? "0.3")),
  }

  const rawScenario = searchParams.get("scenario") ?? "none"
  const scenario: Scenario = {
    type: SCENARIO_TYPES.includes(rawScenario as ScenarioType) ? (rawScenario as ScenarioType) : "none",
    intensity: clamp(Number(searchParams.get("intensity") ?? "0.6")),
  }

  // Optional map center: relocates the whole road network to the selected
  // city/state/country. Falls back to the default (Manhattan) when absent.
  const latRaw = Number(searchParams.get("lat"))
  const lngRaw = Number(searchParams.get("lng"))
  const center =
    Number.isFinite(latRaw) && Number.isFinite(lngRaw) && (latRaw !== 0 || lngRaw !== 0)
      ? { lat: latRaw, lng: lngRaw }
      : undefined

  // Traffic shifts every minute so the demo feels live.
  const trafficSeed = Math.floor(Date.now() / 60000) % 1000
  const baseGraph = getCityGraph(trafficSeed, center)
  const { graph: scenGraph, incidents } = applyScenario(baseGraph, scenario)

  // Which "job" are we solving?
  //  - directions: a single point-A -> point-B trip (like Google Maps)
  //  - event: many invitees converging on one venue (auto-generated per city)
  const mode = searchParams.get("mode") === "directions" ? "directions" : "event"
  let event: EventPlan

  if (mode === "directions") {
    const fromLat = Number(searchParams.get("fromLat"))
    const fromLng = Number(searchParams.get("fromLng"))
    const toLat = Number(searchParams.get("toLat"))
    const toLng = Number(searchParams.get("toLng"))
    const hasPts = [fromLat, fromLng, toLat, toLng].every((v) => Number.isFinite(v))
    if (hasPts) {
      const startId = nearestNodeId(scenGraph, fromLat, fromLng)
      const endId = nearestNodeId(scenGraph, toLat, toLng)
      event = {
        id: "trip",
        name: "Point-to-point trip",
        venueNodeId: endId,
        invitees: [{ id: "trip", name: "Your route", originNodeId: startId }],
      }
    } else {
      // Not enough points chosen yet: return an empty trip.
      event = { id: "trip", name: "Point-to-point trip", venueNodeId: "n4_4", invitees: [] }
    }
  } else if (center) {
    // Auto-generate invitees seeded by the city so each place differs.
    const seed = Math.floor(Math.abs(center.lat * 1000) + Math.abs(center.lng * 1000))
    event = buildEvent(seed, 5)
  } else {
    event = getEvent()
  }

  const now = new Date()
  const hour = now.getHours()
  const incidentLoad = Math.min(1, incidents.length / 5)

  // Location + scenario context shared by both ML models.
  // areaDensity comes from the selected region (city dense, country sparse);
  // scenarioSeverity / rain are derived from the active scenario.
  const ctx: PredictContext = {
    hour,
    isWeekend: now.getDay() === 0 || now.getDay() === 6,
    areaDensity: clamp(Number(searchParams.get("density") ?? "0.7")),
    scenarioSeverity: scenarioSeverity(scenario),
    rain: scenario.type === "weather" ? scenario.intensity : 0,
  }

  // Routes are planned on the scenario-applied graph, then RE-RANKED by the
  // ML ETA so an accident/closure can promote a longer-but-faster detour.
  let etaSource: "model" | "heuristic" = "heuristic"
  let reroutedCount = 0
  const plans = await Promise.all(
    event.invitees.map(async (inv) => {
      const routes = planRoutes(scenGraph, inv.originNodeId, event.venueNodeId, weights)
      const ranked = await rerankRoutesByEta(routes, ctx)
      if (ranked.source === "model") etaSource = "model"
      if (ranked.rerouted) reroutedCount++
      return {
        invitee: inv,
        recommended: ranked.routes[0] ?? null,
        alternatives: ranked.routes.slice(1),
        etaSource: ranked.source,
        rerouted: ranked.rerouted,
      }
    }),
  )

  // Baseline plans (no scenario) so we can quantify the scenario's impact.
  const basePlans = event.invitees.map((inv) =>
    planRoutes(baseGraph, inv.originNodeId, event.venueNodeId, weights)[0] ?? null,
  )

  const avgTravelMin = round1(avg(plans.map((p) => p.recommended?.totalTimeMin ?? 0)))
  const baseAvgTravelMin = round1(avg(basePlans.map((r) => r?.totalTimeMin ?? 0)))

  const metrics = computeMetrics(scenGraph, incidents, sum(plans.map((p) => p.recommended?.totalTimeMin ?? 0)))
  const baseMetrics = computeMetrics(baseGraph, [], sum(basePlans.map((r) => r?.totalTimeMin ?? 0)))

  // Forecast: use the ML congestion model when present, else the heuristic.
  const models = modelStatus()
  let forecast = forecastCongestion(trafficSeed)
  let forecastSource: "model" | "heuristic" = "heuristic"
  if (models.congestion) {
    const steps = 6
    const mlForecast: { step: number; congestion: number }[] = []
    for (let step = 1; step <= steps; step++) {
      const pred = await predictCongestion(
        { current: metrics.congestionIndex, step, incidentLoad },
        { ...ctx, hour: hour + step / 60 },
        forecast[step - 1]?.congestion ?? metrics.congestionIndex,
      )
      mlForecast.push({ step, congestion: round2(pred.value) })
      if (pred.source === "model") forecastSource = "model"
    }
    forecast = mlForecast
  }

  return NextResponse.json({
    mode,
    event,
    weights,
    scenario,
    graph: {
      nodes: Object.values(scenGraph.nodes),
      edges: scenGraph.edges
        .filter((e) => e.from < e.to) // one direction for drawing
        .map((e) => ({ from: e.from, to: e.to, congestion: e.congestion })),
    },
    plans,
    incidents,
    pollution: pollutionZones(scenGraph),
    forecast,
    forecastSource,
    ml: {
      eta: models.eta,
      congestion: models.congestion,
      etaSource,
      reroutedCount,
      context: ctx,
    },
    metrics,
    avgTravelMin,
    baseline: { metrics: baseMetrics, avgTravelMin: baseAvgTravelMin },
    serverTime: Date.now(),
  })
}

function clamp(n: number) {
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(1, n))
}
function avg(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}
function sum(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0)
}
const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100

// Map a scenario to a 0..1 disruption severity the models were trained on.
function scenarioSeverity(s: Scenario): number {
  switch (s.type) {
    case "accident":
    case "closure":
      return s.intensity
    case "surge":
      return s.intensity * 0.6
    case "weather":
      return s.intensity * 0.5
    default:
      return 0
  }
}
