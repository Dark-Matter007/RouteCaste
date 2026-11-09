// ---------------------------------------------------------------------------
// Unit tests for buildCongestionFeatures() — pure function, no ONNX required.
//
// Verifies the exact 9-feature order and formulas matching ml/schema.py
// CONGESTION_FEATURES and ml/data.py build_congestion_features().
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest"
import { buildCongestionFeatures } from "@/lib/ml"

// ---- guard clauses ---------------------------------------------------------

describe("buildCongestionFeatures — invalid inputs", () => {
  const valid = {
    congestionProxy: 0.3,
    horizonMinutes: 10,
    roadCapacityProxy: 0.5,
    incidentLoad: 0,
    scenarioSeverity: 0,
    eventProximity: 0,
  }

  it("returns null when congestionProxy is NaN", () =>
    expect(buildCongestionFeatures({ ...valid, congestionProxy: NaN }, 12)).toBeNull())

  it("returns null when horizonMinutes is Infinity", () =>
    expect(buildCongestionFeatures({ ...valid, horizonMinutes: Infinity }, 12)).toBeNull())
})

// ---- known values ----------------------------------------------------------

describe("buildCongestionFeatures — known input", () => {
  //
  // Input: congestionProxy=0.3, horizonMinutes=30, roadCapacityProxy=0.7,
  //        incidentLoad=0.2, scenarioSeverity=0.4, eventProximity=0.1, hour=12
  //
  // Expected features (schema.py order):
  //  [0] current_congestion         = clamp(0.3)             = 0.3
  //  [1] step_over_6                = clamp(30/60)           = 0.5   ← /60 not /6
  //  [2] current_speed_normalized   = clamp(1-0.3)           = 0.7
  //  [3] road_capacity_normalized   = clamp(0.7)             = 0.7
  //  [4] hour_sin                   = sin(2π*12/24) = sin(π) ≈ 0
  //  [5] hour_cos                   = cos(π)                 = -1
  //  [6] incident_load              = 0.2
  //  [7] scenario_severity          = 0.4
  //  [8] event_proximity            = 0.1

  const input = {
    congestionProxy: 0.3,
    horizonMinutes: 30,
    roadCapacityProxy: 0.7,
    incidentLoad: 0.2,
    scenarioSeverity: 0.4,
    eventProximity: 0.1,
  }
  const hour = 12

  it("returns array of length 9", () =>
    expect(buildCongestionFeatures(input, hour)!.length).toBe(9))

  it("[0] current_congestion = 0.3", () =>
    expect(buildCongestionFeatures(input, hour)![0]).toBeCloseTo(0.3))

  it("[1] step_over_6 = horizonMinutes/60 = 0.5", () =>
    expect(buildCongestionFeatures(input, hour)![1]).toBeCloseTo(0.5))

  it("[2] current_speed_normalized = 1 - congestion = 0.7", () =>
    expect(buildCongestionFeatures(input, hour)![2]).toBeCloseTo(0.7))

  it("[3] road_capacity_normalized = 0.7", () =>
    expect(buildCongestionFeatures(input, hour)![3]).toBeCloseTo(0.7))

  it("[4] hour_sin ≈ 0 at hour 12 (sin(π))", () =>
    expect(buildCongestionFeatures(input, hour)![4]).toBeCloseTo(0, 5))

  it("[5] hour_cos = -1 at hour 12 (cos(π))", () =>
    expect(buildCongestionFeatures(input, hour)![5]).toBeCloseTo(-1, 5))

  it("[6] incident_load = 0.2", () =>
    expect(buildCongestionFeatures(input, hour)![6]).toBeCloseTo(0.2))

  it("[7] scenario_severity = 0.4", () =>
    expect(buildCongestionFeatures(input, hour)![7]).toBeCloseTo(0.4))

  it("[8] event_proximity = 0.1", () =>
    expect(buildCongestionFeatures(input, hour)![8]).toBeCloseTo(0.1))
})

// ---- horizon scaling -------------------------------------------------------

describe("buildCongestionFeatures — horizon scaling", () => {
  const base = {
    congestionProxy: 0,
    roadCapacityProxy: 0.5,
    incidentLoad: 0,
    scenarioSeverity: 0,
    eventProximity: 0,
  }

  it("horizonMinutes=60 → step_over_6=1.0", () => {
    const feats = buildCongestionFeatures({ ...base, horizonMinutes: 60 }, 0)!
    expect(feats[1]).toBeCloseTo(1.0)
  })

  it("horizonMinutes=120 → step_over_6 clamped to 1.0", () => {
    const feats = buildCongestionFeatures({ ...base, horizonMinutes: 120 }, 0)!
    expect(feats[1]).toBe(1.0)
  })

  it("horizonMinutes=0 → step_over_6=0.0", () => {
    const feats = buildCongestionFeatures({ ...base, horizonMinutes: 0 }, 0)!
    expect(feats[1]).toBeCloseTo(0.0)
  })

  it("horizonMinutes=10 → step_over_6=10/60≈0.167", () => {
    const feats = buildCongestionFeatures({ ...base, horizonMinutes: 10 }, 0)!
    expect(feats[1]).toBeCloseTo(10 / 60, 5)
  })
})
