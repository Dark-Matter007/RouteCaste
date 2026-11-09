// ---------------------------------------------------------------------------
// Unit tests for buildEtaFeatures() — pure function, no ONNX required.
//
// Verifies the exact 9-feature order and formulas matching ml/schema.py
// ETA_FEATURES and ml/data.py build_eta_features().
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest"
import { buildEtaFeatures, clamp01, hourCyclical } from "@/lib/ml"

// ---- helpers ---------------------------------------------------------------

const TWO_PI_OVER_24 = (2 * Math.PI) / 24

function expectedHourCyclical(hour: number): [number, number] {
  const rad = TWO_PI_OVER_24 * hour
  return [Math.sin(rad), Math.cos(rad)]
}

// ---- clamp01 ---------------------------------------------------------------

describe("clamp01", () => {
  it("returns 0 for negative input", () => expect(clamp01(-5)).toBe(0))
  it("returns 1 for input > 1", () => expect(clamp01(99)).toBe(1))
  it("passes through values in [0,1]", () => expect(clamp01(0.42)).toBeCloseTo(0.42))
})

// ---- hourCyclical ----------------------------------------------------------

describe("hourCyclical", () => {
  it("hour=0 gives sin=0, cos=1", () => {
    const [s, c] = hourCyclical(0)
    expect(s).toBeCloseTo(0)
    expect(c).toBeCloseTo(1)
  })
  it("hour=6 gives sin=1, cos=0", () => {
    const [s, c] = hourCyclical(6)
    expect(s).toBeCloseTo(1)
    expect(c).toBeCloseTo(0)
  })
  it("hour=12 gives sin=0, cos=-1", () => {
    const [s, c] = hourCyclical(12)
    expect(s).toBeCloseTo(0)
    expect(c).toBeCloseTo(-1)
  })
  it("hour=18 gives sin=-1, cos=0", () => {
    const [s, c] = hourCyclical(18)
    expect(s).toBeCloseTo(-1)
    expect(c).toBeCloseTo(0)
  })
})

// ---- buildEtaFeatures — guard clauses --------------------------------------

describe("buildEtaFeatures — invalid inputs", () => {
  const validBase = {
    distanceKm: 5,
    currentTravelTimeSec: 600,
    congestionProxy: 0.4,
    eventProximity: 0,
    scenarioSeverity: 0,
    eventLoad: 0,
  }

  it("returns null when currentTravelTimeSec is 0", () =>
    expect(buildEtaFeatures({ ...validBase, currentTravelTimeSec: 0 }, 12)).toBeNull())

  it("returns null when currentTravelTimeSec is negative", () =>
    expect(buildEtaFeatures({ ...validBase, currentTravelTimeSec: -60 }, 12)).toBeNull())

  it("returns null when currentTravelTimeSec is NaN", () =>
    expect(buildEtaFeatures({ ...validBase, currentTravelTimeSec: NaN }, 12)).toBeNull())

  it("returns null when distanceKm is NaN", () =>
    expect(buildEtaFeatures({ ...validBase, distanceKm: NaN }, 12)).toBeNull())

  it("returns null when distanceKm is Infinity", () =>
    expect(buildEtaFeatures({ ...validBase, distanceKm: Infinity }, 12)).toBeNull())
})

// ---- buildEtaFeatures — feature order and formulas -------------------------

describe("buildEtaFeatures — known input", () => {
  //
  // Input: distanceKm=5, currentTravelTimeSec=600, congestionProxy=0.4,
  //        eventProximity=0.75, scenarioSeverity=0.3, eventLoad=0.2, hour=6
  //
  // Expected features (schema.py order):
  //  [0] distance_km_over_10        = clamp(5/10, 0,1)               = 0.5
  //  [1] current_travel_time_log    = clamp(log1p(600)/log1p(3600))  ≈ 0.781
  //  [2] current_congestion         = clamp(0.4, 0,1)                = 0.4
  //  [3] current_speed_normalized   = clamp(1-0.4, 0,1)              = 0.6
  //  [4] hour_sin                   = sin(2π*6/24) = sin(π/2)        = 1.0
  //  [5] hour_cos                   = cos(2π*6/24) = cos(π/2)        ≈ 0.0
  //  [6] event_proximity                                              = 0.75
  //  [7] scenario_severity                                            = 0.3
  //  [8] event_load                                                   = 0.2

  const input = {
    distanceKm: 5,
    currentTravelTimeSec: 600,
    congestionProxy: 0.4,
    eventProximity: 0.75,
    scenarioSeverity: 0.3,
    eventLoad: 0.2,
  }
  let feats: number[] | null

  it("returns an array of length 9", () => {
    feats = buildEtaFeatures(input, 6)
    expect(feats).not.toBeNull()
    expect(feats!.length).toBe(9)
  })

  it("[0] distance_km_over_10 = 0.5", () => {
    feats = buildEtaFeatures(input, 6)!
    expect(feats[0]).toBeCloseTo(0.5)
  })

  it("[1] current_travel_time_log ≈ log1p(600)/log1p(3600)", () => {
    feats = buildEtaFeatures(input, 6)!
    const expected = Math.log1p(600) / Math.log1p(3600)
    expect(feats[1]).toBeCloseTo(expected, 5)
  })

  it("[2] current_congestion = 0.4", () => {
    feats = buildEtaFeatures(input, 6)!
    expect(feats[2]).toBeCloseTo(0.4)
  })

  it("[3] current_speed_normalized = 1 - congestion = 0.6", () => {
    feats = buildEtaFeatures(input, 6)!
    expect(feats[3]).toBeCloseTo(0.6)
  })

  it("[4] hour_sin = sin(π/2) = 1.0 at hour 6", () => {
    feats = buildEtaFeatures(input, 6)!
    expect(feats[4]).toBeCloseTo(1.0, 5)
  })

  it("[5] hour_cos = cos(π/2) ≈ 0 at hour 6", () => {
    feats = buildEtaFeatures(input, 6)!
    expect(feats[5]).toBeCloseTo(0.0, 5)
  })

  it("[6] event_proximity = 0.75", () => {
    feats = buildEtaFeatures(input, 6)!
    expect(feats[6]).toBeCloseTo(0.75)
  })

  it("[7] scenario_severity = 0.3", () => {
    feats = buildEtaFeatures(input, 6)!
    expect(feats[7]).toBeCloseTo(0.3)
  })

  it("[8] event_load = 0.2", () => {
    feats = buildEtaFeatures(input, 6)!
    expect(feats[8]).toBeCloseTo(0.2)
  })
})

// ---- clamping at extremes --------------------------------------------------

describe("buildEtaFeatures — clamping", () => {
  it("distance_km_over_10 clamped at 1 when distanceKm > 10", () => {
    const feats = buildEtaFeatures(
      { distanceKm: 500, currentTravelTimeSec: 600, congestionProxy: 0, eventProximity: 0, scenarioSeverity: 0, eventLoad: 0 },
      0,
    )!
    expect(feats[0]).toBe(1)
  })

  it("event_proximity clamped at 1", () => {
    const feats = buildEtaFeatures(
      { distanceKm: 1, currentTravelTimeSec: 60, congestionProxy: 0, eventProximity: 5, scenarioSeverity: 0, eventLoad: 0 },
      0,
    )!
    expect(feats[6]).toBe(1)
  })

  it("scenarioSeverity clamped at 1", () => {
    const feats = buildEtaFeatures(
      { distanceKm: 1, currentTravelTimeSec: 60, congestionProxy: 0, eventProximity: 0, scenarioSeverity: 99, eventLoad: 0 },
      0,
    )!
    expect(feats[7]).toBe(1)
  })

  it("all features in [0,1] for arbitrary valid input (except sin/cos which are [-1,1])", () => {
    const feats = buildEtaFeatures(
      { distanceKm: 3.7, currentTravelTimeSec: 420, congestionProxy: 0.65, eventProximity: 0, scenarioSeverity: 0.5, eventLoad: 0.1 },
      14,
    )!
    // Features 0–3 and 6–8 are clamped to [0,1]; features 4–5 are sin/cos ([-1,1])
    const clamped01Indices = [0, 1, 2, 3, 6, 7, 8]
    clamped01Indices.forEach((i) => {
      expect(feats[i], `feature[${i}] out of [0,1]`).toBeGreaterThanOrEqual(0)
      expect(feats[i], `feature[${i}] out of [0,1]`).toBeLessThanOrEqual(1)
    })
    // sin/cos are in [-1,1]
    expect(feats[4], "hour_sin out of [-1,1]").toBeGreaterThanOrEqual(-1)
    expect(feats[4], "hour_sin out of [-1,1]").toBeLessThanOrEqual(1)
    expect(feats[5], "hour_cos out of [-1,1]").toBeGreaterThanOrEqual(-1)
    expect(feats[5], "hour_cos out of [-1,1]").toBeLessThanOrEqual(1)
  })
})
