// ---------------------------------------------------------------------------
// Server-side ONNX inference for the ETA + congestion models.
//
// Models are imported BY FILE PATH (see ml/README.md):
//   models/eta.onnx          or  process.env.ETA_MODEL_PATH
//   models/congestion.onnx   or  process.env.CONGESTION_MODEL_PATH
//
// The FEATURE ORDER here must match ml/schema.py exactly.
// If a model file is missing or fails to load, every function transparently
// falls back to a deterministic heuristic so the app always works.
// ---------------------------------------------------------------------------

import path from "node:path"
import fs from "node:fs"
import type { InferenceSession, Tensor as OrtTensor } from "onnxruntime-node"
import type { Route } from "@/lib/optimizer"

type Session = InferenceSession | null
type SessionState = { session: Session; tried: boolean; path: string }

const state: Record<"eta" | "congestion", SessionState> = {
  eta: { session: null, tried: false, path: resolvePath("eta", "ETA_MODEL_PATH") },
  congestion: { session: null, tried: false, path: resolvePath("congestion", "CONGESTION_MODEL_PATH") },
}

function resolvePath(name: "eta" | "congestion", envKey: string): string {
  const fromEnv = process.env[envKey]
  if (fromEnv && fromEnv.trim()) return fromEnv.trim()
  return path.join(process.cwd(), "models", `${name}.onnx`)
}

// Lazily create (and cache) an inference session; null if unavailable.
async function getSession(name: "eta" | "congestion"): Promise<Session> {
  const s = state[name]
  if (s.tried) return s.session
  s.tried = true
  try {
    if (!fs.existsSync(/*turbopackIgnore: true*/ s.path)) return null
    const ort = await import("onnxruntime-node")
    s.session = await ort.InferenceSession.create(s.path)
    console.log(`[v0] ML model loaded: ${name} <- ${s.path}`)
  } catch (err) {
    console.log(`[v0] ML model load failed for ${name}:`, (err as Error).message)
    s.session = null
  }
  return s.session
}

async function run(name: "eta" | "congestion", features: number[]): Promise<number | null> {
  const session = await getSession(name)
  if (!session) return null
  try {
    const ort = await import("onnxruntime-node")
    const input = new ort.Tensor("float32", Float32Array.from(features), [1, features.length])
    const feeds: Record<string, OrtTensor> = { [session.inputNames[0]]: input }
    const out = await session.run(feeds)
    const first = out[session.outputNames[0]]
    return Number((first.data as Float32Array)[0])
  } catch (err) {
    console.log(`[v0] ML inference error for ${name}:`, (err as Error).message)
    return null
  }
}

// ---- feature encoders (mirror schema.py) ----------------------------------
function hourCyclical(hour: number): [number, number] {
  const rad = (2 * Math.PI * hour) / 24
  return [Math.sin(rad), Math.cos(rad)]
}

// Context shared by both models: describes WHERE and under WHAT conditions the
// prediction is being made (selected region + active scenario + clock).
export type PredictContext = {
  hour: number // 0..24
  isWeekend: boolean
  areaDensity: number // 0..1 urban density of the selected region
  scenarioSeverity: number // 0..1 disruption severity (accident/closure/...)
  rain: number // 0..1 precipitation intensity
}

export type EtaInput = {
  distanceKm: number
  avgCongestion: number
  numSegments: number
}
export type CongestionInput = {
  current: number
  step: number
  incidentLoad: number
}

// ---- public API ------------------------------------------------------------

/** Predict ETA (minutes). Returns { value, source } so callers can label it. */
export async function predictEta(
  f: EtaInput,
  ctx: PredictContext,
  heuristicMin: number,
): Promise<{ value: number; source: "model" | "heuristic" }> {
  const [hs, hc] = hourCyclical(ctx.hour)
  const feats = [
    f.distanceKm / 10,
    clamp01(f.avgCongestion),
    f.numSegments / 20,
    hs,
    hc,
    ctx.isWeekend ? 1 : 0,
    clamp01(ctx.areaDensity),
    clamp01(ctx.scenarioSeverity),
    clamp01(ctx.rain),
  ]
  const pred = await run("eta", feats)
  if (pred == null || !Number.isFinite(pred)) return { value: heuristicMin, source: "heuristic" }
  return { value: Math.max(0.2, pred), source: "model" }
}

/** Predict next-interval congestion (0..1). */
export async function predictCongestion(
  f: CongestionInput,
  ctx: PredictContext,
  heuristic: number,
): Promise<{ value: number; source: "model" | "heuristic" }> {
  const [hs, hc] = hourCyclical(ctx.hour)
  const feats = [
    clamp01(f.current),
    f.step / 6,
    hs,
    hc,
    clamp01(f.incidentLoad),
    ctx.isWeekend ? 1 : 0,
    clamp01(ctx.areaDensity),
    clamp01(ctx.scenarioSeverity),
    clamp01(ctx.rain),
  ]
  const pred = await run("congestion", feats)
  if (pred == null || !Number.isFinite(pred)) return { value: heuristic, source: "heuristic" }
  return { value: clamp01(pred), source: "model" }
}

/**
 * Score every candidate route with the ML ETA and return them re-ranked
 * (lowest predicted ETA first). Each route gets `mlEtaMin` attached.
 *
 * This is what lets an accident/closure trigger a smarter re-route: the
 * shortest-distance route may now be slower than a longer detour, and the
 * model surfaces that by ranking on predicted TIME, not raw distance.
 */
export async function rerankRoutesByEta(
  routes: Route[],
  ctx: PredictContext,
): Promise<{ routes: Route[]; source: "model" | "heuristic"; rerouted: boolean }> {
  if (routes.length === 0) return { routes, source: "heuristic", rerouted: false }

  let usedModel = false
  const scored = await Promise.all(
    routes.map(async (r) => {
      const eta = await predictEta(
        { distanceKm: r.totalDistanceKm, avgCongestion: r.avgCongestion, numSegments: Math.max(1, r.nodeIds.length - 1) },
        ctx,
        r.totalTimeMin,
      )
      if (eta.source === "model") usedModel = true
      r.mlEtaMin = Math.round(eta.value * 10) / 10
      return { route: r, eta: eta.value }
    }),
  )

  const originalTop = scored[0].route
  scored.sort((a, b) => a.eta - b.eta)
  const rerouted = scored[0].route !== originalTop

  return {
    routes: scored.map((s) => s.route),
    source: usedModel ? "model" : "heuristic",
    rerouted,
  }
}

/** Whether each model file is currently available on disk. */
export function modelStatus(): { eta: boolean; congestion: boolean } {
  return {
    eta: fs.existsSync(/*turbopackIgnore: true*/ state.eta.path),
    congestion: fs.existsSync(/*turbopackIgnore: true*/ state.congestion.path),
  }
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n))
}
