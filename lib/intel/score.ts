// ---------------------------------------------------------------------------
// AI route intelligence: scoring, ranking and explanation.
//
// Reuses the EXISTING ML infrastructure in lib/ml.ts (ONNX sessions for ETA and
// congestion, with a deterministic heuristic fallback). Every number returned
// carries its own provenance so the UI can label it truthfully:
//
//   source "model"     -> an ONNX model produced this value
//   source "heuristic" -> the deterministic fallback produced it
//
// Traffic here is PREDICTED, never observed: there is no live traffic feed
// wired into this project, and the response says so explicitly.
// ---------------------------------------------------------------------------

import { predictCongestion, predictEta, modelStatus, type PredictContext } from "@/lib/ml"
import { analyseRoute, isRouteBlocked, SEVERITY_WEIGHT, type Incident, type RouteImpact } from "@/lib/intel/incidents"
import { rainFeature, type WeatherIntel } from "@/lib/intel/weather"
import type { LL } from "@/lib/nav/progress"

export type ScorableRoute = {
  id: string
  label: string
  distanceMeters: number
  durationSeconds: number
  latLngs: LL[]
  stepCount: number
}

export type Band = "low" | "medium" | "high" | "very high"

export type RouteScore = {
  id: string
  label: string
  distanceKm: number
  /** Engine free-flow ETA, minutes. */
  baseEtaMin: number
  /** ETA after predicted congestion, weather and incident delay. */
  adjustedEtaMin: number
  delayMin: number
  trafficLevel: number // 0..1
  trafficBand: Band
  riskScore: number // 0..1
  riskBand: Band
  weatherImpact: number // 0..1
  aiScore: number // 0..100, higher is better
  blocked: boolean
  impacts: RouteImpact[]
  factors: string[]
}

export type Recommendation = {
  routeId: string
  label: string
  reason: string
  bullets: string[]
}

export type IntelResult = {
  scores: RouteScore[]
  recommendation: Recommendation | null
  weather: WeatherIntel
  traffic: {
    /** Always "predicted" — this project has no live traffic feed. */
    source: "predicted"
    modelSource: "model" | "heuristic"
    note: string
  }
  models: { eta: boolean; congestion: boolean }
  scenarioSeverity: number
  generatedAt: number
}

const band = (v: number): Band => (v >= 0.75 ? "very high" : v >= 0.5 ? "high" : v >= 0.25 ? "medium" : "low")
const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Baseline congestion from time of day. This is the deterministic prior the
 * congestion model refines — it is a heuristic, and is labelled as such.
 */
function timeOfDayCongestion(hour: number, isWeekend: boolean): number {
  const peaks = isWeekend ? [{ h: 12, w: 0.35 }, { h: 19, w: 0.4 }] : [{ h: 9, w: 0.72 }, { h: 18.5, w: 0.8 }]
  let c = isWeekend ? 0.16 : 0.22
  for (const p of peaks) {
    const d = Math.min(Math.abs(hour - p.h), 24 - Math.abs(hour - p.h))
    c += p.w * Math.exp(-(d * d) / 3.2)
  }
  if (hour >= 0 && hour < 5) c *= 0.35
  return clamp01(c)
}

/** Urban density proxy from how many manoeuvres occur per kilometre. */
function densityFromShape(stepCount: number, distanceMeters: number): number {
  const km = Math.max(0.3, distanceMeters / 1000)
  return clamp01(stepCount / km / 3)
}

export type ScoreOptions = {
  routes: ScorableRoute[]
  incidents: Incident[]
  weather: WeatherIntel
  /** Extra congestion multiplier from a what-if traffic surge (0 = none). */
  trafficSurge?: number
  /** 0..1 severity of an active simulated scenario. */
  scenarioSeverity?: number
  now?: Date
}

export async function scoreRoutes(opts: ScoreOptions): Promise<IntelResult> {
  const { routes, incidents, weather } = opts
  const surge = clamp01(opts.trafficSurge ?? 0)
  const scenarioSeverity = clamp01(opts.scenarioSeverity ?? 0)
  const now = opts.now ?? new Date()
  const hour = now.getHours() + now.getMinutes() / 60
  const isWeekend = now.getDay() === 0 || now.getDay() === 6
  const rain = rainFeature(weather)

  let modelSource: "model" | "heuristic" = "heuristic"
  const scores: RouteScore[] = []

  for (const r of routes) {
    const impacts = analyseRoute(r.latLngs, incidents, r.durationSeconds)
    const blocked = isRouteBlocked(impacts)
    const areaDensity = densityFromShape(r.stepCount, r.distanceMeters)

    const ctx: PredictContext = { hour, isWeekend, areaDensity, scenarioSeverity, rain }

    // --- predicted congestion for this corridor -----------------------------
    const prior = timeOfDayCongestion(hour, isWeekend)
    const incidentLoad = clamp01(
      impacts.reduce((a, i) => a + SEVERITY_WEIGHT[i.incident.severity], 0) / 2 + (blocked ? 0.4 : 0),
    )
    const heuristicCongestion = clamp01(prior + incidentLoad * 0.35 + surge * 0.45 + weather.impact * 0.18)
    const cong = await predictCongestion(
      { current: prior, step: 1, incidentLoad },
      ctx,
      heuristicCongestion,
    )
    if (cong.source === "model") modelSource = "model"
    // A surge/incident is applied on top of the model output too, otherwise a
    // simulation would have no effect whenever a model happens to be loaded.
    const trafficLevel = clamp01(Math.max(cong.value, prior) + surge * 0.45 + incidentLoad * 0.2)

    // --- ETA ---------------------------------------------------------------
    const baseEtaMin = r.durationSeconds / 60
    const congestionPenalty = 1 + trafficLevel * 0.85
    const weatherPenalty = 1 + weather.impact * 0.22
    const incidentDelayMin = impacts.reduce((a, i) => a + i.delaySeconds, 0) / 60
    const heuristicEta = baseEtaMin * congestionPenalty * weatherPenalty + incidentDelayMin

    const eta = await predictEta(
      { distanceKm: r.distanceMeters / 1000, avgCongestion: trafficLevel, numSegments: r.stepCount },
      ctx,
      heuristicEta,
    )
    if (eta.source === "model") modelSource = "model"
    const adjustedEtaMin = Math.max(baseEtaMin, eta.value)

    // --- risk --------------------------------------------------------------
    const incidentRisk = clamp01(impacts.reduce((a, i) => a + SEVERITY_WEIGHT[i.incident.severity] * 0.6, 0))
    const riskScore = clamp01(
      incidentRisk * 0.45 + weather.impact * 0.3 + trafficLevel * 0.15 + areaDensity * 0.1 + (blocked ? 0.35 : 0),
    )

    // --- explanation -------------------------------------------------------
    const factors: string[] = []
    factors.push(`${r1(r.distanceMeters / 1000)} km · ${Math.round(adjustedEtaMin)} min predicted`)
    factors.push(`Predicted traffic: ${band(trafficLevel)}`)
    if (weather.available && weather.impact > 0.05) factors.push(`Weather impact: ${weather.band} — ${weather.reasons[0] ?? "conditions noted"}`)
    else if (!weather.available) factors.push("Weather: unavailable (excluded from score)")
    else factors.push("Weather impact: none")
    if (impacts.length > 0) {
      for (const i of impacts.slice(0, 3)) {
        factors.push(
          `${i.blocks ? "BLOCKED" : "Delay"}: ${i.incident.type} (${i.incident.severity}) ${i.distanceMeters} m off route${
            i.blocks ? "" : ` · +${Math.round(i.delaySeconds / 60)} min`
          }`,
        )
      }
    } else {
      factors.push("No incidents on this route")
    }
    factors.push(`Risk: ${band(riskScore)}`)

    scores.push({
      id: r.id,
      label: r.label,
      distanceKm: r1(r.distanceMeters / 1000),
      baseEtaMin: r1(baseEtaMin),
      adjustedEtaMin: r1(adjustedEtaMin),
      delayMin: r1(Math.max(0, adjustedEtaMin - baseEtaMin)),
      trafficLevel: r2(trafficLevel),
      trafficBand: band(trafficLevel),
      riskScore: r2(riskScore),
      riskBand: band(riskScore),
      weatherImpact: r2(weather.impact),
      aiScore: 0, // filled in below, needs the field to be comparative
      blocked,
      impacts,
      factors,
    })
  }

  // --- comparative AI score -------------------------------------------------
  // Time is scored relative to the fastest candidate so the number means
  // "how good is this versus the alternatives", not an absolute constant.
  const bestEta = Math.min(...scores.map((s) => s.adjustedEtaMin))
  for (const s of scores) {
    const timePenalty = clamp01((s.adjustedEtaMin - bestEta) / Math.max(6, bestEta * 0.35))
    const raw = 1 - (timePenalty * 0.45 + s.riskScore * 0.3 + s.trafficLevel * 0.18 + s.weatherImpact * 0.07)
    const score = Math.round(clamp01(raw) * 100)
    s.aiScore = s.blocked ? Math.min(score, 12) : score
  }

  const ranked = [...scores].sort((a, b) => b.aiScore - a.aiScore)
  const recommendation = ranked.length > 0 ? explain(ranked[0], scores, bestEta) : null

  return {
    scores,
    recommendation,
    weather,
    traffic: {
      source: "predicted",
      modelSource,
      note:
        modelSource === "model"
          ? "Traffic and ETA predicted by the loaded ONNX models. No live traffic feed is connected."
          : "Traffic and ETA predicted by the deterministic heuristic fallback (no ONNX model loaded). No live traffic feed is connected.",
    },
    models: modelStatus(),
    scenarioSeverity,
    generatedAt: Date.now(),
  }
}

/** Builds the "why this route" narrative from the winning route's own numbers. */
function explain(top: RouteScore, all: RouteScore[], bestEta: number): Recommendation {
  const bullets: string[] = []
  const others = all.filter((s) => s.id !== top.id)
  const fastest = all.reduce((a, b) => (a.adjustedEtaMin <= b.adjustedEtaMin ? a : b))

  if (top.id === fastest.id) {
    bullets.push(`Fastest predicted arrival (${Math.round(top.adjustedEtaMin)} min)`)
  } else {
    const gap = Math.round(top.adjustedEtaMin - bestEta)
    bullets.push(`Only ${gap} min slower than the fastest option`)
  }

  const minTraffic = Math.min(...all.map((s) => s.trafficLevel))
  if (top.trafficLevel <= minTraffic + 0.02) bullets.push(`Lowest predicted congestion (${top.trafficBand})`)
  else bullets.push(`Predicted congestion: ${top.trafficBand}`)

  const minRisk = Math.min(...all.map((s) => s.riskScore))
  if (top.riskScore <= minRisk + 0.02) bullets.push(`Lowest risk score (${top.riskBand})`)
  else bullets.push(`Risk score: ${top.riskBand}`)

  const blockedAlternatives = others.filter((s) => s.blocked).length
  if (blockedAlternatives > 0) {
    bullets.push(`${blockedAlternatives} alternative${blockedAlternatives > 1 ? "s" : ""} blocked by an active incident`)
  }
  if (top.impacts.length === 0) bullets.push("No active incidents on this route")
  if (top.weatherImpact > 0.3) bullets.push(`Weather penalty applied (${top.weatherImpact})`)

  let reason: string
  if (others.length === 0) {
    reason = `Only one route was returned by the routing engine; scored ${top.aiScore}/100.`
  } else if (top.id === fastest.id) {
    reason = `Recommended because it is both the fastest predicted route (${Math.round(top.adjustedEtaMin)} min) and scores best overall at ${top.aiScore}/100.`
  } else {
    const gap = Math.round(top.adjustedEtaMin - bestEta)
    reason = `Recommended because it has lower predicted congestion and lower risk despite being ${gap} min longer than the fastest option.`
  }

  return { routeId: top.id, label: top.label, reason, bullets }
}
