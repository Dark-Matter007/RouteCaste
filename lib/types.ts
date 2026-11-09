<<<<<<< HEAD
/**
 * Shared TypeScript types for the RouteCast API layer.
 *
 * These types describe real-road responses (OSRM routing + ML intel).
 * Grid/synthetic-city types (CityNode, Route, EventPlan, Incident via nodeId,
 * CityMetrics, PollutionZone, ForecastPoint) have been removed with the
 * cleanup of the 8×8 grid system.
 */

// ---------------------------------------------------------------------------
// Event scheduler types (new — replaces the grid "EventPlan")
// ---------------------------------------------------------------------------

export type EventType =
  | "festival"
  | "sports"
  | "concert"
  | "protest"
  | "construction"
  | "vip_visit"
  | "public_gathering"
  | "other"

export type ScheduledEvent = {
  id: string
  name: string
  type: EventType
  lat: number
  lng: number
  locationName: string
  /** ISO 8601 datetime string */
  startTime: string
  /** ISO 8601 datetime string */
  endTime: string
  /** Expected number of attendees */
  attendance: number
  /** 0..1 — computed from attendance + area density */
  eventLoad: number
  /** Meters — affected radius around event location */
  impactRadiusMeters: number
}

// ---------------------------------------------------------------------------
// Event simulation response (from /api/event/simulate)
// ---------------------------------------------------------------------------

export type EventImpactRoute = {
  routeId: string
  label: string
  baseEtaMin: number
  eventEtaMin: number
  etaDeltaMin: number
  congestionBefore: number
  congestionDuring: number
  congestionClass: string
  affected: boolean
  recommended: boolean
  reason: string
  source: "model" | "heuristic"
}

export type EventSimulationResponse = {
  event: ScheduledEvent
  routes: EventImpactRoute[]
  /** Forecast of congestion across the simulation time window */
  forecast: { minutesFromStart: number; congestion: number; label: string }[]
  /** Most affected road area (approximate centroid) */
  hotspot: { lat: number; lng: number; severityLabel: string } | null
  /** ISO time of peak congestion */
  peakAt: string
  simulatedAt: string
  source: "model" | "heuristic"
  note: string
}

// ---------------------------------------------------------------------------
// Scenario / quick-sim types (for WhatIfPanel — real roads)
// ---------------------------------------------------------------------------

export type ScenarioType =
  | "none"
  | "closure"
  | "accident"
  | "traffic"
  | "rain"
  | "flood"

// ---------------------------------------------------------------------------
// City metrics — kept for dashboard and event impact displays.
// ---------------------------------------------------------------------------

export type CityMetrics = {
  avgSpeedKmh: number
  congestionIndex: number // 0..1
  activeIncidents: number
  aqi: number // air-quality index
  ambulanceResponseMin: number
  co2Kg: number
  fuelL: number
}

// ---------------------------------------------------------------------------
// Re-exports from the intel hook (avoids deep imports in components)
// ---------------------------------------------------------------------------

export type { Intel, IntelResponse, IntelScenarioType } from "@/hooks/use-route-intel"
=======
import type { CityNode } from "./city"
import type { Route } from "./optimizer"
import type { EventPlan, Invitee } from "./store"
import type { Scenario, Incident, CityMetrics, PollutionZone, ForecastPoint } from "./sim"

export type PlanResponse = {
  mode: "event" | "directions"
  event: EventPlan
  weights: { time: number; distance: number; congestion: number }
  scenario: Scenario
  graph: {
    nodes: CityNode[]
    edges: { from: string; to: string; congestion: number }[]
  }
  plans: {
    invitee: Invitee
    recommended: Route | null
    alternatives: Route[]
    etaSource: "model" | "heuristic"
    rerouted: boolean
  }[]
  incidents: Incident[]
  pollution: PollutionZone[]
  forecast: ForecastPoint[]
  forecastSource: "model" | "heuristic"
  // ML model status + the location/scenario context used for predictions
  ml: {
    eta: boolean
    congestion: boolean
    etaSource: "model" | "heuristic"
    reroutedCount: number
    context: {
      hour: number
      isWeekend: boolean
      areaDensity: number
      scenarioSeverity: number
      rain: number
    }
  }
  // current (scenario-applied) vs baseline (no scenario) for impact comparison
  metrics: CityMetrics
  avgTravelMin: number
  baseline: {
    metrics: CityMetrics
    avgTravelMin: number
  }
  serverTime: number
}

export type { CityNode, Route, EventPlan, Invitee }
export type { Scenario, ScenarioType, Incident, CityMetrics, PollutionZone, ForecastPoint } from "./sim"
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
