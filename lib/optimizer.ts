import { type CityGraph, type CityEdge, type LatLng, edgeTimeMin } from "./city"

export type Weights = {
  time: number // importance of travel time
  distance: number // importance of distance
  congestion: number // importance of avoiding traffic
}

export type RouteMode = "fastest" | "shortest" | "best"

export type Route = {
  mode: RouteMode
  nodeIds: string[]
  path: LatLng[]
  totalDistanceKm: number
  totalTimeMin: number
  avgCongestion: number
  score: number // lower is better (normalized blended cost)
  mlEtaMin?: number // ETA refined by the ONNX model (when available)
}

// Normalization references so blended costs are comparable across metrics.
function metricRanges(graph: CityGraph) {
  let maxDist = 0
  let maxTime = 0
  for (const e of graph.edges) {
    maxDist = Math.max(maxDist, e.distanceKm)
    maxTime = Math.max(maxTime, edgeTimeMin(e))
  }
  return { maxDist, maxTime }
}

function edgeCost(edge: CityEdge, mode: RouteMode, w: Weights, ref: { maxDist: number; maxTime: number }) {
  const t = edgeTimeMin(edge)
  if (mode === "fastest") return t
  if (mode === "shortest") return edge.distanceKm
  // best overall: weighted, normalized blend
  const timeN = t / ref.maxTime
  const distN = edge.distanceKm / ref.maxDist
  const congN = edge.congestion
  const wsum = w.time + w.distance + w.congestion || 1
  return (w.time * timeN + w.distance * distN + w.congestion * congN) / wsum
}

// Classic Dijkstra over the directed edge list.
function dijkstra(
  graph: CityGraph,
  start: string,
  goal: string,
  mode: RouteMode,
  w: Weights,
  ref: { maxDist: number; maxTime: number },
): string[] {
  const dist: Record<string, number> = {}
  const prev: Record<string, string | null> = {}
  const visited = new Set<string>()
  for (const id of Object.keys(graph.nodes)) {
    dist[id] = Infinity
    prev[id] = null
  }
  dist[start] = 0

  // simple priority selection (grid is small, so O(n^2) is fine)
  while (visited.size < Object.keys(graph.nodes).length) {
    let u: string | null = null
    let best = Infinity
    for (const id of Object.keys(dist)) {
      if (!visited.has(id) && dist[id] < best) {
        best = dist[id]
        u = id
      }
    }
    if (u === null) break
    if (u === goal) break
    visited.add(u)

    for (const edge of graph.adjacency[u] ?? []) {
      if (visited.has(edge.to)) continue
      const alt = dist[u] + edgeCost(edge, mode, w, ref)
      if (alt < dist[edge.to]) {
        dist[edge.to] = alt
        prev[edge.to] = u
      }
    }
  }

  const path: string[] = []
  let cur: string | null = goal
  while (cur) {
    path.unshift(cur)
    cur = prev[cur]
  }
  return path[0] === start ? path : []
}

function summarize(graph: CityGraph, nodeIds: string[], mode: RouteMode): Route {
  let totalDistanceKm = 0
  let totalTimeMin = 0
  let congSum = 0
  let segs = 0
  const path: LatLng[] = []

  for (let i = 0; i < nodeIds.length; i++) {
    const node = graph.nodes[nodeIds[i]]
    path.push({ lat: node.lat, lng: node.lng })
    if (i < nodeIds.length - 1) {
      const edge = (graph.adjacency[nodeIds[i]] ?? []).find((e) => e.to === nodeIds[i + 1])
      if (edge) {
        totalDistanceKm += edge.distanceKm
        totalTimeMin += edgeTimeMin(edge)
        congSum += edge.congestion
        segs++
      }
    }
  }

  return {
    mode,
    nodeIds,
    path,
    totalDistanceKm,
    totalTimeMin,
    avgCongestion: segs ? congSum / segs : 0,
    score: 0,
  }
}

/**
 * Compute the three candidate routes from an origin to the venue and return
 * them sorted so the recommended ("best") route is first.
 */
export function planRoutes(graph: CityGraph, origin: string, venue: string, weights: Weights): Route[] {
  const ref = metricRanges(graph)
  const modes: RouteMode[] = ["best", "fastest", "shortest"]
  const routes = modes
    .map((mode) => {
      const ids = dijkstra(graph, origin, venue, mode, weights, ref)
      if (ids.length === 0) return null
      return summarize(graph, ids, mode)
    })
    .filter((r): r is Route => r !== null)

  // score every route by the same blended metric so they are comparable
  const maxT = Math.max(...routes.map((r) => r.totalTimeMin), 1)
  const maxD = Math.max(...routes.map((r) => r.totalDistanceKm), 1)
  const wsum = weights.time + weights.distance + weights.congestion || 1
  for (const r of routes) {
    r.score =
      (weights.time * (r.totalTimeMin / maxT) +
        weights.distance * (r.totalDistanceKm / maxD) +
        weights.congestion * r.avgCongestion) /
      wsum
  }

  return routes
}
