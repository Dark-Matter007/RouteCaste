// ---------------------------------------------------------------------------
// Live ONNX integration tests — gated behind RUN_ONNX_TESTS=1.
//
// These tests load the real model files and exercise the full inference path.
// They require the .onnx binaries to be present in models/.
//
// Run with:
//   pnpm test:onnx
//   npm run test:onnx
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll } from "vitest"
import path from "path"
import fs from "fs"

const SKIP = process.env.RUN_ONNX_TESTS !== "1"
const skip = SKIP ? it.skip : it

const ETA_PATH = path.join(process.cwd(), "models", "eta.onnx")
const CONG_PATH = path.join(process.cwd(), "models", "congestion.onnx")

describe("ONNX model files present", () => {
  skip("eta.onnx exists on disk", () => {
    expect(fs.existsSync(ETA_PATH)).toBe(true)
  })
  skip("congestion.onnx exists on disk", () => {
    expect(fs.existsSync(CONG_PATH)).toBe(true)
  })
})

describe("ETA model — live inference", () => {
  skip("output shape is [1,1]", async () => {
    const ort = await import("onnxruntime-node")
    const session = await ort.InferenceSession.create(ETA_PATH)
    const input = new ort.Tensor("float32", Float32Array.from(new Array(9).fill(0.5)), [1, 9])
    const out = await session.run({ [session.inputNames[0]]: input })
    const data = out[session.outputNames[0]].data as Float32Array
    expect(data.length).toBe(1)
    expect(Number.isFinite(data[0])).toBe(true)
  })

  skip("output is a finite scalar (log-ratio in ~[-5,5])", async () => {
    const ort = await import("onnxruntime-node")
    const session = await ort.InferenceSession.create(ETA_PATH)
    const input = new ort.Tensor("float32", Float32Array.from(new Array(9).fill(0.5)), [1, 9])
    const out = await session.run({ [session.inputNames[0]]: input })
    const pred = (out[session.outputNames[0]].data as Float32Array)[0]
    expect(pred).toBeGreaterThan(-10)
    expect(pred).toBeLessThan(10)
  })
})

describe("Congestion model — live inference", () => {
  skip("output shape is [1,5]", async () => {
    const ort = await import("onnxruntime-node")
    const session = await ort.InferenceSession.create(CONG_PATH)
    const input = new ort.Tensor("float32", Float32Array.from(new Array(9).fill(0.5)), [1, 9])
    const out = await session.run({ [session.inputNames[0]]: input })
    const data = out[session.outputNames[0]].data as Float32Array
    expect(data.length).toBe(5)
    data.forEach((v) => expect(Number.isFinite(v)).toBe(true))
  })

  skip("decoded output gives a valid CongestionPrediction", async () => {
    const { buildCongestionFeatures, decodeCongestionOutput } = await import("@/lib/ml")
    const ort = await import("onnxruntime-node")
    const session = await ort.InferenceSession.create(CONG_PATH)

    const feats = buildCongestionFeatures(
      { congestionProxy: 0.5, horizonMinutes: 10, roadCapacityProxy: 0.5, incidentLoad: 0.1, scenarioSeverity: 0.2, eventProximity: 0 },
      9,
    )
    expect(feats).not.toBeNull()

    const input = new ort.Tensor("float32", Float32Array.from(feats!), [1, 9])
    const out = await session.run({ [session.inputNames[0]]: input })
    const logits = out[session.outputNames[0]].data as Float32Array

    const result = decodeCongestionOutput(logits)
    expect(result).not.toBeNull()
    expect(result!.classIndex).toBeGreaterThanOrEqual(0)
    expect(result!.classIndex).toBeLessThanOrEqual(4)
    expect(result!.score).toBeGreaterThanOrEqual(0)
    expect(result!.score).toBeLessThanOrEqual(1)
    expect(result!.source).toBe("model")
  })
})
