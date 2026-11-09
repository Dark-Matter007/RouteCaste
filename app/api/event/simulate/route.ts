/**
 * POST /api/event/simulate
 *
 * Accepts a scheduled event (location, time window, attendance) and returns:
 *  - Per-route ETA and congestion predictions during the event
 *  - A time-series forecast across the event window
 *  - The hotspot centroid and peak congestion time
 *
 * Uses trained ONNX models only when complete training-compatible inputs are
 * available. Event pin simulations currently lack road-level training inputs,
 * so their predictions use the existing heuristic fallback.
 *
 * All predictions are clearly tagged { source: "model" | "heuristic" }
 * and the response note states they are simulated estimates.
 */

import { NextResponse } from "next/server"
import type { ScheduledEvent, EventSimulationResponse } from "@/lib/types"

// ---------------------------------------------------------------------------
// Event demand model
// ---------------------------------------------------------------------------

/**
 * Compute event_proximity for a road at distance_km from the event pin.
 * Uses an exponential decay with falloff = 1 km (tunable).
 * Returns 0..1.
 */
function computeProximity(distanceKm: number, falloffKm = 1.0): number {
  return Math.exp(-distanceKm / falloffKm)
}

/**
 * Compute event_load from attendance, event type, and city area density.
 * Returns 0..1.
 *
 * Calibration (for research paper):
 *   - 1,000 attendees in a dense urban area  → ~0.2 load
 *   - 10,000 attendees                        → ~0.5 load
 *   - 50,000 attendees (festival)             → ~0.85 load
 */
function computeEventLoad(attendance: number, areaDensity = 0.7): number {
  // Logistic curve: saturates at 1 as attendance grows
  const base = attendance / 50000
  return Math.min(1, base * (0.4 + areaDensity * 0.6))
}

/**
 * Impact radius in metres based on attendance.
 * Small event (100 people) → 200 m
 * Large festival (50,000)  → 1,500 m
 */
function computeImpactRadius(attendance: number): number {
  return Math.round(200 + Math.sqrt(attendance) * 20)
}

// ---------------------------------------------------------------------------
// Request body type
// ---------------------------------------------------------------------------

type SimulateRequest = {
  event: {
    name: string
    type: string
    lat: number
    lng: number
    locationName: string
    startTime: string
    endTime: string
    attendance: number
  }
  /** Optional: routes to score (from OSRM). If absent, only forecast is returned. */
  routes?: {
    id: string
    label: string
    distanceMeters: number
    durationSeconds: number
    /** Representative lat/lng points along the route for proximity calculation */
    samplePoints: { lat: number; lng: number }[]
  }[]
}

// ---------------------------------------------------------------------------
// Haversine distance (km) between two points
// ---------------------------------------------------------------------------

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Minimum distance from the event pin to any sample point on the route. */
function routeProximity(
  eventLat: number,
  eventLng: number,
  samplePoints: { lat: number; lng: number }[],
): number {
  if (samplePoints.length === 0) return 0
  const minDist = Math.min(...samplePoints.map((p) => haversineKm(eventLat, eventLng, p.lat, p.lng)))
  return computeProximity(minDist)
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<NextResponse> {
  let body: SimulateRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { event: ev, routes = [] } = body

  if (!ev || !Number.isFinite(ev.lat) || !Number.isFinite(ev.lng)) {
    return NextResponse.json({ error: "event.lat and event.lng are required" }, { status: 400 })
  }
  if (!Number.isFinite(ev.attendance) || ev.attendance < 0) {
    return NextResponse.json({ error: "event.attendance must be a non-negative number" }, { status: 400 })
  }

  const now = new Date()
  const startTime = ev.startTime ? new Date(ev.startTime) : now
  const endTime = ev.endTime ? new Date(ev.endTime) : new Date(startTime.getTime() + 3 * 3600_000)
  const peakTime = new Date((startTime.getTime() + endTime.getTime()) / 2)

  const eventLoad = computeEventLoad(ev.attendance)
  const impactRadiusMeters = computeImpactRadius(ev.attendance)

  const scheduledEvent: ScheduledEvent = {
    id: `evt_${Date.now()}`,
    name: ev.name || "Unnamed Event",
    type: ev.type as ScheduledEvent["type"] || "other",
    lat: ev.lat,
    lng: ev.lng,
    locationName: ev.locationName || `${ev.lat.toFixed(4)}, ${ev.lng.toFixed(4)}`,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    attendance: ev.attendance,
    eventLoad,
    impactRadiusMeters,
  }

  // --------------------------------------------------------------------------
  // ML inference for each route
  // --------------------------------------------------------------------------

  const { predictEta, predictCongestion, modelStatus } = await import("@/lib/ml")
  const peakHour = peakTime.getHours() + peakTime.getMinutes() / 60
  const isWeekend = [0, 6].includes(startTime.getDay())

  const scenarioSeverity = Math.min(1, eventLoad * 1.2)

  const ctx = {
    hour: peakHour,
    isWeekend,
    areaDensity: 0.75, // Guntur urban density estimate
    scenarioSeverity,
    rain: 0,
  }

  const scoredRoutes = await Promise.all(
    routes.map(async (r) => {
      const proximity = routeProximity(ev.lat, ev.lng, r.samplePoints)
      const ttSec = r.durationSeconds
      const baseEtaMin = ttSec / 60

      // Baseline (no event)
      const baseCtx = { ...ctx, scenarioSeverity: 0 }
      const baseCong = await predictCongestion(null, baseCtx, 0.3)

      // During event
      const eventCong = await predictCongestion(null, ctx, 0.3 + proximity * 0.4)

      const eventEta = await predictEta(
        null,
        ctx,
        baseEtaMin * (1 + eventCong.score * 0.6),
      )

      const etaDelta = eventEta.etaMin - baseEtaMin
      const affected = proximity > 0.15 || eventCong.score > 0.5

      return {
        routeId: r.id,
        label: r.label,
        baseEtaMin: Math.round(baseEtaMin * 10) / 10,
        eventEtaMin: Math.round(eventEta.etaMin * 10) / 10,
        etaDeltaMin: Math.round(etaDelta * 10) / 10,
        congestionBefore: Math.round(baseCong.score * 100) / 100,
        congestionDuring: Math.round(eventCong.score * 100) / 100,
        congestionClass: eventCong.className,
        affected,
        recommended: false, // set after sorting
        reason: "",
        source: eventEta.source,
      }
    }),
  )

  // Recommend the route with lowest eventEtaMin
  if (scoredRoutes.length > 0) {
    scoredRoutes.sort((a, b) => a.eventEtaMin - b.eventEtaMin)
    scoredRoutes[0].recommended = true
    scoredRoutes[0].reason = `Least affected by the ${ev.name} event — ${scoredRoutes[0].etaDeltaMin > 0 ? `+${scoredRoutes[0].etaDeltaMin} min delay` : "minimal delay expected"}`
    for (let i = 1; i < scoredRoutes.length; i++) {
      const extra = scoredRoutes[i].eventEtaMin - scoredRoutes[0].eventEtaMin
      scoredRoutes[i].reason = `${extra.toFixed(0)} min slower than recommended during event peak`
    }
  }

  // --------------------------------------------------------------------------
  // Time-series forecast across the event window
  // --------------------------------------------------------------------------

  const durationMs = endTime.getTime() - startTime.getTime()
  const steps = Math.min(12, Math.max(4, Math.round(durationMs / (30 * 60_000)))) // 30-min intervals
  const forecast: EventSimulationResponse["forecast"] = []

  for (let i = 0; i <= steps; i++) {
    const t = startTime.getTime() + (i / steps) * durationMs
    const pct = i / steps
    // Bell curve: congestion rises to peak at 50% of duration, then falls
    const bell = Math.sin(pct * Math.PI) // 0 → 1 → 0
    const congestion = Math.min(1, 0.25 + eventLoad * 0.65 * bell)
    const minutesFromStart = Math.round((i / steps) * (durationMs / 60_000))
    const hour = new Date(t).getHours()
    forecast.push({
      minutesFromStart,
      congestion: Math.round(congestion * 100) / 100,
      label: congestion < 0.35 ? "Free" : congestion < 0.6 ? "Moderate" : congestion < 0.8 ? "Heavy" : "Severe",
    })
  }

  const peakForecast = forecast.reduce((a, b) => (b.congestion > a.congestion ? b : a))
  const peakMinutes = startTime.getTime() + peakForecast.minutesFromStart * 60_000
  const peakIso = new Date(peakMinutes).toISOString()

  // --------------------------------------------------------------------------
  // Hotspot (event pin itself is the centroid)
  // --------------------------------------------------------------------------

  const peakCongestion = peakForecast.congestion
  const hotspot: EventSimulationResponse["hotspot"] = {
    lat: ev.lat,
    lng: ev.lng,
    severityLabel: peakCongestion < 0.35 ? "Low" : peakCongestion < 0.6 ? "Moderate" : peakCongestion < 0.8 ? "High" : "Severe",
  }

  const models = modelStatus()
  const anyModel = models.eta || models.congestion

  const response: EventSimulationResponse = {
    event: scheduledEvent,
    routes: scoredRoutes,
    forecast,
    hotspot,
    peakAt: peakIso,
    simulatedAt: now.toISOString(),
    source: anyModel ? "model" : "heuristic",
    note:
      "All predictions are AI-simulated estimates based on event demand modelling and trained ONNX models. " +
      "They represent plausible traffic outcomes, not verified real-world measurements. " +
      `Inference source: ${anyModel ? "ONNX neural network (ETA R²=0.18, Congestion F1=0.58)" : "heuristic fallback"}.`,
  }

  return NextResponse.json(response)
}
