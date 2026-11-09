// ---------------------------------------------------------------------------
// Unit tests for decodeEtaOutput() — pure function, no ONNX required.
//
// The model outputs log(future_tt / current_tt).
// Inverse:  future_tt_sec = current_tt_sec × exp(pred)
//           etaMin        = future_tt_sec / 60
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest"
import { decodeEtaOutput } from "@/lib/ml"

describe("decodeEtaOutput — known log-ratio values", () => {
  it("pred=0 → travel time unchanged → currentTT / 60", () => {
    // exp(0) = 1 → 600 sec → 10 min
    expect(decodeEtaOutput(0, 600)).toBeCloseTo(10.0)
  })

  it("pred=log(2) → doubles travel time → currentTT*2 / 60", () => {
    // exp(log(2)) = 2 → 600*2 sec → 20 min
    expect(decodeEtaOutput(Math.log(2), 600)).toBeCloseTo(20.0)
  })

  it("pred=-log(2) → halves travel time → currentTT*0.5 / 60", () => {
    // exp(-log(2)) = 0.5 → 600*0.5 sec → 5 min
    expect(decodeEtaOutput(-Math.log(2), 600)).toBeCloseTo(5.0)
  })

  it("pred=1 hour source travel time", () => {
    // exp(0) * 3600 / 60 = 60 min
    expect(decodeEtaOutput(0, 3600)).toBeCloseTo(60.0)
  })
})

describe("decodeEtaOutput — minimum floor", () => {
  it("clamps result to 0.2 min minimum", () => {
    // Very large negative pred → near-zero travel time → floored at 0.2
    expect(decodeEtaOutput(-100, 600)).toBeCloseTo(0.2)
  })
})

describe("decodeEtaOutput — invalid inputs", () => {
  it("returns null for NaN pred", () =>
    expect(decodeEtaOutput(NaN, 600)).toBeNull())

  it("returns null for Infinity pred", () =>
    expect(decodeEtaOutput(Infinity, 600)).toBeNull())

  it("returns null when currentTravelTimeSec is 0", () =>
    expect(decodeEtaOutput(0, 0)).toBeNull())

  it("returns null when currentTravelTimeSec is negative", () =>
    expect(decodeEtaOutput(0, -60)).toBeNull())

  it("returns null when currentTravelTimeSec is NaN", () =>
    expect(decodeEtaOutput(0, NaN)).toBeNull())
})
