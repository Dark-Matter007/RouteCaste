// ---------------------------------------------------------------------------
// City road network model.
// A deterministic grid of intersections laid over REAL coordinates (downtown
// Manhattan) so the Leaflet/OSM tiles show real streets under our graph.
// Each edge carries a live-ish "congestion" value used by the optimizer.
// ---------------------------------------------------------------------------

export type LatLng = { lat: number; lng: number }

export type CityNode = LatLng & {
  id: string
  row: number
  col: number
}

export type CityEdge = {
  id: string
  from: string
  to: string
  distanceKm: number
  // 0 = free flowing, 1 = gridlocked
  congestion: number
  // free-flow speed in km/h for this road class
  speedKmh: number
}

export type CityGraph = {
  nodes: Record<string, CityNode>
  edges: CityEdge[]
  // adjacency: nodeId -> edges leaving it
  adjacency: Record<string, CityEdge[]>
}

// Grid config. The network is an 8x8 lattice laid over real coordinates so the
// map tiles show real streets underneath. The grid CENTER defaults to Lower
// Manhattan but can be relocated to any city/country the user selects.
const ROWS = 8
const COLS = 8
const STEP = 0.0055 // ~0.6km spacing
const DEFAULT_CENTER: LatLng = { lat: 40.712 + 3.5 * STEP, lng: -74.012 + 3.5 * STEP }

// Deterministic pseudo-random so every request/render is stable.
function seeded(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

let cached: CityGraph | null = null

/**
 * Build (and cache) the city graph. `trafficSeed` lets the traffic pattern
 * shift over time so the demo feels live; pass a value that changes per minute.
 * `center` relocates the whole road network to any city/country coordinates.
 */
export function getCityGraph(trafficSeed = 0, center: LatLng = DEFAULT_CENTER): CityGraph {
  const isDefaultCenter = center.lat === DEFAULT_CENTER.lat && center.lng === DEFAULT_CENTER.lng
  if (cached && trafficSeed === 0 && isDefaultCenter) return cached

  // Corner (row 0, col 0) so the grid is centered on the requested coordinates.
  // Longitude spacing widens toward the equator so the grid stays ~square.
  const lngStep = STEP / Math.max(0.2, Math.cos((center.lat * Math.PI) / 180))
  const baseLat = center.lat - ((ROWS - 1) / 2) * STEP
  const baseLng = center.lng - ((COLS - 1) / 2) * lngStep

  const nodes: Record<string, CityNode> = {}
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const id = `n${r}_${c}`
      nodes[id] = {
        id,
        row: r,
        col: c,
        lat: baseLat + r * STEP,
        lng: baseLng + c * lngStep,
      }
    }
  }

  // A couple of "congestion hotspots" (e.g. near a bridge / main avenue).
  const hotspots = [
    { row: 3, col: 4 },
    { row: 6, col: 2 },
  ]

  const edges: CityEdge[] = []
  const addEdge = (aId: string, bId: string) => {
    const a = nodes[aId]
    const b = nodes[bId]
    const distanceKm = haversineKm(a, b)
    const key = `${a.row + b.row}_${a.col + b.col}`
    const noise = seeded(a.row * 31 + a.col * 7 + b.row * 13 + b.col * 3 + trafficSeed)

    // distance to nearest hotspot lowers/raises congestion
    const midRow = (a.row + b.row) / 2
    const midCol = (a.col + b.col) / 2
    const nearHot = Math.min(
      ...hotspots.map((h) => Math.hypot(h.row - midRow, h.col - midCol)),
    )
    const hotFactor = Math.max(0, 1 - nearHot / 3) // 1 at hotspot -> 0 far away

    const congestion = Math.min(0.95, 0.15 + noise * 0.45 + hotFactor * 0.5)
    // main avenues (even columns) are faster roads
    const speedKmh = a.col % 2 === 0 || b.col % 2 === 0 ? 55 : 38

    // bidirectional
    edges.push({ id: `${aId}->${bId}`, from: aId, to: bId, distanceKm, congestion, speedKmh })
    edges.push({ id: `${bId}->${aId}`, from: bId, to: aId, distanceKm, congestion, speedKmh })
    void key
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const id = `n${r}_${c}`
      if (c + 1 < COLS) addEdge(id, `n${r}_${c + 1}`)
      if (r + 1 < ROWS) addEdge(id, `n${r + 1}_${c}`)
    }
  }

  const adjacency: Record<string, CityEdge[]> = {}
  for (const e of edges) {
    ;(adjacency[e.from] ||= []).push(e)
  }

  const graph: CityGraph = { nodes, edges, adjacency }
  if (trafficSeed === 0 && isDefaultCenter) cached = graph
  return graph
}

// travel time in minutes for an edge given its congestion
export function edgeTimeMin(edge: CityEdge): number {
  const effectiveSpeed = edge.speedKmh * (1 - edge.congestion * 0.8)
  return (edge.distanceKm / Math.max(3, effectiveSpeed)) * 60
}

/** Snap an arbitrary lat/lng (e.g. a map click) to the closest grid node. */
export function nearestNodeId(graph: CityGraph, lat: number, lng: number): string {
  let bestId = ""
  let bestD = Infinity
  for (const n of Object.values(graph.nodes)) {
    const d = (n.lat - lat) ** 2 + (n.lng - lng) ** 2
    if (d < bestD) {
      bestD = d
      bestId = n.id
    }
  }
  return bestId
}
