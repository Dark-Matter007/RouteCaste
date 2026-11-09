// ---------------------------------------------------------------------------
// Weather intelligence.
//
// Source: Open-Meteo (https://open-meteo.com) — free, keyless, no signup.
// Override with WEATHER_API_URL if a different provider is configured.
//
// Weather is an OPTIONAL input: if the provider is unreachable the whole
// intelligence layer keeps working and reports `available: false` so the UI
// can say "unavailable" instead of implying a clear forecast.
// ---------------------------------------------------------------------------

import type { LL } from "@/lib/nav/progress"

const BASE = process.env.WEATHER_API_URL?.trim() || "https://api.open-meteo.com/v1/forecast"
const TIMEOUT_MS = 6_000

export type WeatherSample = {
  lat: number
  lon: number
  tempC: number | null
  precipMmH: number | null
  windKmh: number | null
  visibilityM: number | null
  code: number | null
}

export type WeatherIntel = {
  available: boolean
  source: string
  /** 0..1 — how much the weather should penalise a route. */
  impact: number
  /** Human-readable band for the UI. */
  band: "none" | "low" | "medium" | "high"
  /** Plain-language reasons; empty when nothing notable. */
  reasons: string[]
  samples: WeatherSample[]
  note: string
}

export const WEATHER_UNAVAILABLE: WeatherIntel = {
  available: false,
  source: "unavailable",
  impact: 0,
  band: "none",
  reasons: [],
  samples: [],
  note: "Weather provider unreachable — weather excluded from scoring.",
}

/** WMO weather codes that indicate a genuinely disruptive condition. */
function codeRisk(code: number | null): { risk: number; label?: string } {
  if (code == null) return { risk: 0 }
  if (code >= 95) return { risk: 1, label: "Thunderstorm" }
  if (code >= 80) return { risk: 0.7, label: "Rain showers" }
  if (code >= 71 && code <= 77) return { risk: 0.8, label: "Snow" }
  if (code >= 61 && code <= 67) return { risk: 0.55, label: "Rain" }
  if (code >= 51 && code <= 57) return { risk: 0.3, label: "Drizzle" }
  if (code === 45 || code === 48) return { risk: 0.5, label: "Fog" }
  return { risk: 0 }
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n))
}

/** Evenly spaced sample points so one fetch covers the whole corridor. */
export function sampleAlong(line: LL[], count = 3): LL[] {
  if (line.length === 0) return []
  if (line.length <= count) return line
  const out: LL[] = []
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i / (count - 1)) * (line.length - 1))
    out.push(line[idx])
  }
  return out
}

/**
 * Fetches current conditions for up to a handful of points along a corridor.
 * Open-Meteo accepts comma-separated coordinate lists, so this is one request.
 */
export async function getWeatherIntel(points: LL[]): Promise<WeatherIntel> {
  if (points.length === 0) return WEATHER_UNAVAILABLE

  const lats = points.map((p) => p[0].toFixed(4)).join(",")
  const lons = points.map((p) => p[1].toFixed(4)).join(",")
  const url =
    `${BASE}?latitude=${lats}&longitude=${lons}` +
    `&current=temperature_2m,precipitation,weather_code,wind_speed_10m,visibility`

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } })
    if (!res.ok) throw new Error(`weather HTTP ${res.status}`)
    const body = await res.json()

    // A single point returns an object; several return an array.
    const rows: any[] = Array.isArray(body) ? body : [body]
    const samples: WeatherSample[] = rows.map((r, i) => ({
      lat: Number(r?.latitude ?? points[i]?.[0]),
      lon: Number(r?.longitude ?? points[i]?.[1]),
      tempC: num(r?.current?.temperature_2m),
      precipMmH: num(r?.current?.precipitation),
      windKmh: num(r?.current?.wind_speed_10m),
      visibilityM: num(r?.current?.visibility),
      code: num(r?.current?.weather_code),
    }))

    if (samples.length === 0) return WEATHER_UNAVAILABLE
    return summarise(samples)
  } catch (err) {
    console.log("[v0] weather unavailable:", (err as Error).message)
    return WEATHER_UNAVAILABLE
  } finally {
    clearTimeout(timer)
  }
}

function num(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Turns raw samples into an impact score plus the reasons behind it. */
function summarise(samples: WeatherSample[]): WeatherIntel {
  const reasons: string[] = []
  let impact = 0

  const worstCode = samples.reduce<{ risk: number; label?: string }>(
    (acc, s) => {
      const r = codeRisk(s.code)
      return r.risk > acc.risk ? r : acc
    },
    { risk: 0 },
  )
  if (worstCode.risk > 0 && worstCode.label) {
    impact = Math.max(impact, worstCode.risk * 0.6)
    reasons.push(`${worstCode.label} reported along the corridor`)
  }

  const maxPrecip = Math.max(...samples.map((s) => s.precipMmH ?? 0))
  if (maxPrecip >= 7.5) {
    impact = Math.max(impact, 0.9)
    reasons.push(`Heavy rainfall (${maxPrecip.toFixed(1)} mm/h) — flooding risk`)
  } else if (maxPrecip >= 2.5) {
    impact = Math.max(impact, 0.55)
    reasons.push(`Moderate rainfall (${maxPrecip.toFixed(1)} mm/h)`)
  } else if (maxPrecip > 0.2) {
    impact = Math.max(impact, 0.25)
    reasons.push(`Light rainfall (${maxPrecip.toFixed(1)} mm/h)`)
  }

  const minVis = Math.min(...samples.map((s) => s.visibilityM ?? Number.POSITIVE_INFINITY))
  if (Number.isFinite(minVis) && minVis < 1000) {
    impact = Math.max(impact, 0.7)
    reasons.push(`Low visibility (${Math.round(minVis)} m)`)
  } else if (Number.isFinite(minVis) && minVis < 4000) {
    impact = Math.max(impact, 0.35)
    reasons.push(`Reduced visibility (${Math.round(minVis / 100) / 10} km)`)
  }

  const maxWind = Math.max(...samples.map((s) => s.windKmh ?? 0))
  if (maxWind >= 60) {
    impact = Math.max(impact, 0.6)
    reasons.push(`Strong wind (${Math.round(maxWind)} km/h)`)
  }

  const temps = samples.map((s) => s.tempC).filter((t): t is number => t != null)
  const maxT = temps.length ? Math.max(...temps) : null
  const minT = temps.length ? Math.min(...temps) : null
  if (maxT != null && maxT >= 43) {
    impact = Math.max(impact, 0.3)
    reasons.push(`Extreme heat (${Math.round(maxT)} °C)`)
  }
  if (minT != null && minT <= 0) {
    impact = Math.max(impact, 0.45)
    reasons.push(`Freezing conditions (${Math.round(minT)} °C) — ice risk`)
  }

  impact = clamp01(impact)
  const band: WeatherIntel["band"] = impact >= 0.6 ? "high" : impact >= 0.3 ? "medium" : impact > 0 ? "low" : "none"

  return {
    available: true,
    source: "Open-Meteo (live observations)",
    impact: Math.round(impact * 100) / 100,
    band,
    reasons,
    samples,
    note: reasons.length === 0 ? "Clear conditions reported along the corridor." : reasons[0],
  }
}

/** Precipitation intensity 0..1, fed to the ONNX models as the `rain` feature. */
export function rainFeature(w: WeatherIntel): number {
  if (!w.available) return 0
  const maxPrecip = Math.max(0, ...w.samples.map((s) => s.precipMmH ?? 0))
  return clamp01(maxPrecip / 10)
}
