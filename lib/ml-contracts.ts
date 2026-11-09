/**
 * Typed input contracts for RouteCast ONNX models.
 *
 * Feature ordering matches ml/schema.py exactly.
 *
 * These inputs must come from source attributes or be derived with the exact
 * training formulas. If a caller lacks any required input, pass null to the
 * prediction function so it uses the heuristic fallback. Do not synthesize
 * neutral defaults or map unrelated context fields into these vectors.
 */

// ---------------------------------------------------------------------------
// ETA model — 9 features in schema.py ETA_FEATURES order
// ---------------------------------------------------------------------------

/**
 * Input for the ETA regression model.
 *
 * Training target: log(future_travel_time / current_travel_time)
 * Inverse decode:  future_eta_min = currentTravelTimeSec * exp(pred) / 60
 *
 * Feature order (must match ml/schema.py ETA_FEATURES):
 *   1  distance_km_over_10        clamp(distanceKm / 10, 0, 1)
 *   2  current_travel_time_log    clamp(log1p(tt_sec) / log1p(3600), 0, 1)
 *   3  current_congestion         clamp(congestionProxy, 0, 1)
 *   4  current_speed_normalized   clamp(1 - congestionProxy, 0, 1)
 *   5  hour_sin                   sin(2π·hour/24)
 *   6  hour_cos                   cos(2π·hour/24)
 *   7  event_proximity            clamp(eventProximity, 0, 1)
 *   8  scenario_severity          clamp(scenarioSeverity, 0, 1)
 *   9  event_load                 clamp(eventLoad, 0, 1)
 */
export type EtaModelInput = {
  /** Route or segment distance in km. */
  distanceKm: number

  /**
   * Current free-flow travel time in seconds.
   * Used for feature 2 (log-normalised) and for the inverse output transform.
   * Supply route.durationSeconds (engine ETA) or segment travel time.
   * Must be > 0; a non-positive value causes a heuristic fallback.
   */
  currentTravelTimeSec: number

  /**
   * Training congestion value (1 − current_speed / speed_limit), computed
   * from road-level speed and speed-limit source attributes. Features 3 and 4
   * are derived from this value:
   *   current_congestion        = congestionProxy
   *   current_speed_normalized  = 1 − congestionProxy
   */
  congestionProxy: number

  /**
   * Event proximity score 0..1 computed from the training distance rules.
   * Discrete scale matching training:
   *   1.00  ≤ 250 m from event venue
   *   0.75  250–500 m
   *   0.50  500–1000 m
   *   0.00  > 1000 m or no event
   * Use 0 in Directions mode (no event context).
   */
  eventProximity: number

  /** Scenario disruption severity 0..1. */
  scenarioSeverity: number

  /**
   * Event intensity 0..1.
   * Training formula: weighted blend of normalised attendance, size, duration,
   * arrival rate and departure rate.
   * Use 0 in Directions mode (no event context).
   */
  eventLoad: number
}

// ---------------------------------------------------------------------------
// Congestion model — 9 features in schema.py CONGESTION_FEATURES order
// ---------------------------------------------------------------------------

/**
 * Input for the 5-class congestion classifier.
 *
 * Output: 5 logits [free, light, moderate, heavy, severe].
 * Decode via softmax → argmax → classIndex / 4 for a 0..1 score.
 *
 * Feature order (must match ml/schema.py CONGESTION_FEATURES):
 *   1  current_congestion        clamp(congestionProxy, 0, 1)
 *   2  step_over_6               clamp(horizonMinutes / 60, 0, 1)  ← name misleading; formula is /60
 *   3  current_speed_normalized  clamp(1 - congestionProxy, 0, 1)
 *   4  road_capacity_normalized  clamp(roadCapacityProxy, 0, 1)
 *   5  hour_sin                  sin(2π·hour/24)
 *   6  hour_cos                  cos(2π·hour/24)
 *   7  incident_load             clamp(incidentLoad, 0, 1)
 *   8  scenario_severity         clamp(scenarioSeverity, 0, 1)
 *   9  event_proximity           clamp(eventProximity, 0, 1)
 */
export type CongestionModelInput = {
  /**
   * Training congestion value (1 − current_speed / speed_limit), computed
   * from road-level speed and speed-limit source attributes.
   * Also drives feature 3: current_speed_normalized = 1 − congestionProxy.
   */
  congestionProxy: number

  /**
   * Forecast horizon in minutes.
   * Encoded as clamp(horizonMinutes / 60, 0, 1).
   * For a 10-minute step-ahead forecast use 10; for 60 minutes use 60.
   */
  horizonMinutes: number

  /**
   * Training value: capacity / (7200 × lanes), computed from road capacity
   * and lane source attributes. Do not use a constant when either is missing.
   */
  roadCapacityProxy: number

  /** Trained event-load formula (attendance, size, duration, and rates). */
  incidentLoad: number

  /** Scenario disruption severity 0..1. */
  scenarioSeverity: number

  /**
   * Event proximity score 0..1 computed from the training distance rules.
   */
  eventProximity: number
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/** The five congestion classes as trained, index 0–4. */
export const CONGESTION_CLASSES = ["free", "light", "moderate", "heavy", "severe"] as const
export type CongestionClass = (typeof CONGESTION_CLASSES)[number]

export type EtaPrediction = {
  /** Predicted travel time in minutes (≥ 0.2). */
  etaMin: number
  source: "model" | "heuristic"
}

export type CongestionPrediction = {
  /** 0..1 score: classIndex / 4 (0 = free, 1 = severe). */
  score: number
  /** 0 = free · 1 = light · 2 = moderate · 3 = heavy · 4 = severe. */
  classIndex: number
  className: CongestionClass
  source: "model" | "heuristic"
}
