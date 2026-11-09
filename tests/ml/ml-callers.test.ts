import { beforeEach, describe, expect, it, vi } from "vitest"

const modelMock = vi.hoisted(() => ({
  failRun: false,
  etaOutput: 0.1,
  congestionOutput: new Float32Array([0, 0, 3, 0, 0]),
  inputs: [] as number[][],
}))

vi.mock("onnxruntime-node", () => {
  class Tensor {
    data: Float32Array
    constructor(_type: string, data: Float32Array, _dims: number[]) {
      this.data = data
    }
  }

  return {
    Tensor,
    InferenceSession: {
      create: vi.fn(async (modelPath: string) => ({
        inputNames: ["features"],
        outputNames: ["prediction"],
        run: vi.fn(async (feeds: Record<string, Tensor>) => {
          modelMock.inputs.push(Array.from(feeds.features.data))
          if (modelMock.failRun) throw new Error("simulated inference failure")
          return {
            prediction: {
              data: modelPath.includes("congestion")
                ? modelMock.congestionOutput
                : Float32Array.of(modelMock.etaOutput),
            },
          }
        }),
      })),
    },
  }
})

import {
  modelSessionStatus,
  modelStatus,
  predictCongestion,
  predictEta,
  rerankRoutesByEta,
  type CongestionModelInput,
  type EtaModelInput,
  type PredictContext,
} from "@/lib/ml"

type EtaRankingRoute = Parameters<typeof rerankRoutesByEta>[0][number]

const context: PredictContext = {
  hour: 9,
  isWeekend: false,
  areaDensity: 0.7,
  scenarioSeverity: 0.2,
  rain: 0,
}

const etaInput: EtaModelInput = {
  distanceKm: 4,
  currentTravelTimeSec: 480,
  congestionProxy: 0.25,
  eventProximity: 0.5,
  scenarioSeverity: 0.2,
  eventLoad: 0.4,
}

const congestionInput: CongestionModelInput = {
  congestionProxy: 0.25,
  horizonMinutes: 10,
  roadCapacityProxy: 0.6,
  incidentLoad: 0.4,
  scenarioSeverity: 0.2,
  eventProximity: 0.5,
}

function route(_id: string, totalTimeMin: number): EtaRankingRoute {
  return { totalDistanceKm: 4, totalTimeMin }
}

beforeEach(() => {
  modelMock.failRun = false
  modelMock.etaOutput = 0.1
  modelMock.congestionOutput = new Float32Array([0, 0, 3, 0, 0])
  modelMock.inputs.length = 0
})

describe("production caller input provenance and fallback", () => {
  it("routes with no road or event feature source stay on the heuristic path", async () => {
    const routes = [route("a", 8), route("b", 9)]
    const ranked = await rerankRoutesByEta(routes, context)

    expect(ranked.source).toBe("heuristic")
    expect(ranked.routes).toHaveLength(2)
    expect(modelMock.inputs).toHaveLength(0)
  })

  it("falls back after a session initializes but inference fails", async () => {
    modelMock.failRun = true
    const prediction = await predictEta(etaInput, context, 7)

    expect(prediction).toEqual({ etaMin: 7, source: "heuristic" })
    expect(modelSessionStatus().eta).toBe("ready")
    expect(modelStatus().eta).toBe(false)
  })

  it("uses a complete ETA feature contract when a caller provides one", async () => {
    const ranked = await rerankRoutesByEta([route("a", 8)], context, () => etaInput)

    expect(ranked.source).toBe("model")
    expect(modelMock.inputs).toHaveLength(1)
    expect(modelMock.inputs[0]).toHaveLength(9)
    expect(ranked.routes[0].mlEtaMin).toBeGreaterThan(0)
  })

  it("does not fabricate congestion features when a caller lacks them", async () => {
    const before = modelMock.inputs.length
    const prediction = await predictCongestion(null, context, 0.37)

    expect(prediction.source).toBe("heuristic")
    expect(prediction.score).toBeCloseTo(0.37)
    expect(modelMock.inputs).toHaveLength(before)
  })

  it("accepts a complete congestion input and decodes all five logits", async () => {
    const prediction = await predictCongestion(congestionInput, context, 0.1)

    expect(prediction.source).toBe("model")
    expect(prediction.classIndex).toBe(2)
    expect(prediction.className).toBe("moderate")
    expect(modelMock.inputs.at(-1)).toHaveLength(9)
  })

  it("falls back when model output is invalid", async () => {
    modelMock.etaOutput = Number.NaN
    const prediction = await predictEta(etaInput, context, 6)

    expect(prediction).toEqual({ etaMin: 6, source: "heuristic" })
  })

  it("falls back when congestion logits are invalid", async () => {
    modelMock.congestionOutput = new Float32Array([0, 0, Number.NaN, 0, 0])
    const prediction = await predictCongestion(congestionInput, context, 0.42)

    expect(prediction.source).toBe("heuristic")
    expect(prediction.score).toBeCloseTo(0.42)
  })

})
