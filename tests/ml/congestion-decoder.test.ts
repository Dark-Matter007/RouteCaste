// ---------------------------------------------------------------------------
// Unit tests for decodeCongestionOutput() — pure function, no ONNX required.
//
// Model output: 5-element raw logit array [free, light, moderate, heavy, severe]
// Decoding: numerically stable softmax → argmax → score = classIndex / 4
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest"
import { decodeCongestionOutput, CONGESTION_CLASSES } from "@/lib/ml"

// ---- guard clauses ---------------------------------------------------------

describe("decodeCongestionOutput — invalid shapes", () => {
  it("returns null for empty array", () =>
    expect(decodeCongestionOutput([])).toBeNull())

  it("returns null for 3-element array", () =>
    expect(decodeCongestionOutput([1, 2, 3])).toBeNull())

  it("returns null for 4-element array", () =>
    expect(decodeCongestionOutput([1, 2, 3, 4])).toBeNull())

  it("returns null for 6-element array", () =>
    expect(decodeCongestionOutput([1, 2, 3, 4, 5, 6])).toBeNull())

  it("returns null for array containing NaN", () =>
    expect(decodeCongestionOutput([NaN, 0, 0, 0, 0])).toBeNull())

  it("returns null for array containing Infinity", () =>
    expect(decodeCongestionOutput([0, 0, Infinity, 0, 0])).toBeNull())
})

// ---- argmax selection ------------------------------------------------------

describe("decodeCongestionOutput — class selection", () => {
  it("[10,0,0,0,0] → class 0 = free, score=0", () => {
    const r = decodeCongestionOutput([10, 0, 0, 0, 0])!
    expect(r.classIndex).toBe(0)
    expect(r.className).toBe("free")
    expect(r.score).toBeCloseTo(0)
    expect(r.source).toBe("model")
  })

  it("[0,10,0,0,0] → class 1 = light, score=0.25", () => {
    const r = decodeCongestionOutput([0, 10, 0, 0, 0])!
    expect(r.classIndex).toBe(1)
    expect(r.className).toBe("light")
    expect(r.score).toBeCloseTo(0.25)
  })

  it("[0,0,10,0,0] → class 2 = moderate, score=0.5", () => {
    const r = decodeCongestionOutput([0, 0, 10, 0, 0])!
    expect(r.classIndex).toBe(2)
    expect(r.className).toBe("moderate")
    expect(r.score).toBeCloseTo(0.5)
  })

  it("[0,0,0,10,0] → class 3 = heavy, score=0.75", () => {
    const r = decodeCongestionOutput([0, 0, 0, 10, 0])!
    expect(r.classIndex).toBe(3)
    expect(r.className).toBe("heavy")
    expect(r.score).toBeCloseTo(0.75)
  })

  it("[0,0,0,0,10] → class 4 = severe, score=1.0", () => {
    const r = decodeCongestionOutput([0, 0, 0, 0, 10])!
    expect(r.classIndex).toBe(4)
    expect(r.className).toBe("severe")
    expect(r.score).toBeCloseTo(1.0)
  })
})

// ---- ties ------------------------------------------------------------------

describe("decodeCongestionOutput — ties go to first (lowest) class", () => {
  it("[0,0,0,0,0] → class 0 = free (first max)", () => {
    const r = decodeCongestionOutput([0, 0, 0, 0, 0])!
    expect(r.classIndex).toBe(0)
    expect(r.className).toBe("free")
  })

  it("[5,5,0,0,0] → class 0 = free (first max)", () => {
    const r = decodeCongestionOutput([5, 5, 0, 0, 0])!
    expect(r.classIndex).toBe(0)
  })
})

// ---- score range -----------------------------------------------------------

describe("decodeCongestionOutput — score always in [0,1]", () => {
  const cases = [
    [10, 0, 0, 0, 0],
    [0, 10, 0, 0, 0],
    [0, 0, 10, 0, 0],
    [0, 0, 0, 10, 0],
    [0, 0, 0, 0, 10],
    [1.1, 2.3, -0.5, 0.2, 1.0],
  ]
  cases.forEach((logits) => {
    it(`score in [0,1] for logits ${JSON.stringify(logits)}`, () => {
      const r = decodeCongestionOutput(logits)!
      expect(r.score).toBeGreaterThanOrEqual(0)
      expect(r.score).toBeLessThanOrEqual(1)
    })
  })
})

// ---- CONGESTION_CLASSES constant -------------------------------------------

describe("CONGESTION_CLASSES", () => {
  it("has exactly 5 elements", () => expect(CONGESTION_CLASSES.length).toBe(5))
  it("first element is 'free'", () => expect(CONGESTION_CLASSES[0]).toBe("free"))
  it("last element is 'severe'", () => expect(CONGESTION_CLASSES[4]).toBe("severe"))
})
