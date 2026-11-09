// ---------------------------------------------------------------------------
// Digital-twin simulation layer.
// Applies "what-if" scenarios to the live city graph, derives city-wide
// metrics (speed, congestion, air quality, emergency response, emissions),
// pollution zones, and a short-horizon traffic forecast.
//
// NOTE: the forecast here is a transparent HEURISTIC built from the same
// deterministic traffic model used elsewhere. It is an honest capstone
// stand-in for a trained ML model, not a real neural network.
// ---------------------------------------------------------------------------

import { getCityGraph, type CityGraph, type CityEdge } from "./city"

export type ScenarioType = "none" | "closure" | "accident" | "surge" | "weather"

export type Scenario = {
  type: ScenarioType
  intensity: number // 0..1
}

export type Incident = {
  id: string
  nodeId: string
  kind: "closure" | "accident"
  label: string
}

export type CityMetrics = {
  avgSpeedKmh: number
  congestionIndex: number // 0..1
  activeIncidents: number
  aqi: number // air-quality index
  ambulanceResponseMin: number
  co2Kg: number
  fuelL: number
}

export type PollutionZone = { lat: number; lng: number; intensity: number }
export type ForecastPoint = { step: number; congestion: number }

// Where localized scenarios strike (kept fixed so the demo is deterministic).
const ACCIDENT_NODE = "n3_4"
const CLOSURE_NODE = "n4_5"

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}
const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100

function gridDist(g: CityGraph, aId: string, bId: string): number {
  const a = g.nodes[aId]
  const b = g.nodes[bId]
  if (!a || !b) return Infinity
  return Math.hypot(a.row - b.row, a.col - b.col)
}

function edgeNear(g: CityGraph, e: CityEdge, center: string, radius: number): boolean {
  return gridDist(g, e.from, center) <= radius || gridDist(g, e.to, center) <= radius
}

// Deep-clone edges/adjacency (nodes are immutable, so they are shared) so we
// never mutate the cached base graph when applying a scenario.
function cloneGraph(g: CityGraph): CityGraph {
  const edges = g.edges.map((e) => ({ ...e }))
  const adjacency: Record<string, CityEdge[]> = {}
  for (const e of edges) (adjacency[e.from] ||= []).push(e)
  return { nodes: g.nodes, edges, adjacency }
}

/**
 * Apply a what-if scenario to the base graph, returning a new routable graph
 * plus the incidents it generated.
 */
export function applyScenario(base: CityGraph, scenario: Scenario): { graph: CityGraph; incidents: Incident[] } {
  const g = cloneGraph(base)
  const incidents: Incident[] = []
  const k = Math.max(0, Math.min(1, scenario.intensity))

  switch (scenario.type) {
    case "surge":
      for (const e of g.edges) e.congestion = Math.min(0.98, e.congestion + 0.4 * k)
      break
    case "weather":
      for (const e of g.edges) {
        e.congestion = Math.min(0.98, e.congestion + 0.25 * k)
        e.speedKmh = e.speedKmh * (1 - 0.35 * k)
      }
      break
    case "accident":
      incidents.push({ id: "inc_acc", nodeId: ACCIDENT_NODE, kind: "accident", label: "Multi-vehicle accident" })
      for (const e of g.edges) {
        if (edgeNear(g, e, ACCIDENT_NODE, 1)) e.congestion = Math.min(0.98, e.congestion + 0.6 * k)
        else if (edgeNear(g, e, ACCIDENT_NODE, 2)) e.congestion = Math.min(0.98, e.congestion + 0.3 * k)
      }
      break
    case "closure":
      incidents.push({ id: "inc_clo", nodeId: CLOSURE_NODE, kind: "closure", label: "Road closure" })
      for (const e of g.edges) {
        if (edgeNear(g, e, CLOSURE_NODE, 1)) e.congestion = Math.min(0.99, e.congestion + 0.8 * k)
      }
      break
    case "none":
    default:
      break
  }

  return { graph: g, incidents }
}

/** City-wide metrics derived from graph state and total invitee travel time. */
export function computeMetrics(g: CityGraph, incidents: Incident[], totalTravelMin: number): CityMetrics {
  const congestion = mean(g.edges.map((e) => e.congestion))
  const avgSpeed = mean(g.edges.map((e) => e.speedKmh * (1 - e.congestion * 0.8)))
  return {
    avgSpeedKmh: round1(avgSpeed),
    congestionIndex: round2(congestion),
    activeIncidents: incidents.length,
    aqi: Math.round(40 + congestion * 140),
    ambulanceResponseMin: round1(4 + congestion * 12),
    co2Kg: Math.round(totalTravelMin * (1 + congestion) * 1.6),
    fuelL: Math.round(totalTravelMin * (1 + congestion) * 0.15),
  }
}

/** High-pollution zones derived from local congestion (for the map heat layer). */
export function pollutionZones(g: CityGraph, threshold = 0.55): PollutionZone[] {
  const zones: PollutionZone[] = []
  for (const id of Object.keys(g.nodes)) {
    const adj = g.adjacency[id] ?? []
    if (!adj.length) continue
    const c = mean(adj.map((e) => e.congestion))
    if (c >= threshold) zones.push({ lat: g.nodes[id].lat, lng: g.nodes[id].lng, intensity: round2(c) })
  }
  return zones
}

/**
 * Short-horizon congestion forecast (heuristic). Samples the deterministic
 * traffic model at future minute-seeds to project the next few intervals.
 */
export function forecastCongestion(baseSeed: number, steps = 6): ForecastPoint[] {
  const out: ForecastPoint[] = []
  for (let i = 1; i <= steps; i++) {
    const g = getCityGraph((baseSeed + i) % 1000)
    out.push({ step: i, congestion: round2(mean(g.edges.map((e) => e.congestion))) })
  }
  return out
}
