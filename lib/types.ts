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
