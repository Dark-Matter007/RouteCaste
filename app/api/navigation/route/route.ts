import { NextResponse } from "next/server"
import { routingEngine, labelRoutes, RoutingError, type TravelMode, type LonLat } from "@/lib/geo/routing"

const MODES: TravelMode[] = ["driving", "walking", "cycling"]

function coord(v: unknown): LonLat | null {
  const o = v as { lat?: unknown; lon?: unknown; lng?: unknown } | null
  if (!o) return null
  const lat = Number(o.lat)
  const lon = Number(o.lon ?? o.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { lat, lon }
}

/** POST /api/navigation/route — real routing via the configured engine. */
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
    alternatives?: boolean
  }

  const origin = coord(b.origin)
  const destination = coord(b.destination)
  if (!origin || !destination) {
    return NextResponse.json({ error: "origin and destination with valid lat/lon are required" }, { status: 400 })
  }

  const waypoints = Array.isArray(b.waypoints)
    ? b.waypoints.map(coord).filter((p): p is LonLat => p !== null)
    : []

  // Same point in/out has no route to compute.
  const sameSpot =
    Math.abs(origin.lat - destination.lat) < 1e-6 && Math.abs(origin.lon - destination.lon) < 1e-6
  if (sameSpot && waypoints.length === 0) {
    return NextResponse.json({ error: "origin and destination are the same location" }, { status: 400 })
  }

  const mode = (MODES as string[]).includes(String(b.mode)) ? (b.mode as TravelMode) : "driving"
  const alternatives = b.alternatives !== false

  try {
    const result = await routingEngine.route({ origin, destination, waypoints, mode, alternatives })
    const labeled = labelRoutes(result.routes)
    return NextResponse.json({
      engine: result.engine,
      mode: result.mode,
      origin,
      destination,
      waypoints,
      routes: labeled.map(({ route, label }) => ({
        id: route.id,
        label,
        distance_meters: route.distanceMeters,
        duration_seconds: route.durationSeconds,
        summary: route.summary,
        geometry: route.geometry,
        latLngs: route.latLngs,
        steps: route.steps,
        ai_score: route.aiScore,
      })),
      // Live traffic is not wired in yet — state it rather than implying it.
      traffic: {
        source: "none",
        note: result.durationEstimated
          ? `Road distance is real; ${mode} time is estimated from distance (engine has no ${mode} profile). Live traffic not integrated.`
          : "Durations are engine free-flow estimates; live traffic not yet integrated.",
      },
      duration_estimated: result.durationEstimated === true,
      serverTime: Date.now(),
    })
  } catch (err) {
    const e = err as RoutingError
    return NextResponse.json({ error: e.message || "routing failed" }, { status: e.status ?? 502 })
  }
}
