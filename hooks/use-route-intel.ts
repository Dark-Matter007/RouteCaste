"use client"

import useSWR from "swr"
import type { NavPoint, TravelMode } from "@/hooks/use-navigation-route"

export type IntelScenarioType = "none" | "closure" | "accident" | "traffic" | "rain" | "flood"

export type GeoIncident = {
  id: string
  type: string
  lat: number
  lon: number
  severity: "low" | "medium" | "high" | "critical"
  status: string
  origin: "reported" | "simulated"
  radiusMeters: number
  description: string
  createdAt: number
}

export type RouteImpact = {
  incident: GeoIncident
  distanceMeters: number
  alongMeters: number
  blocks: boolean
  delaySeconds: number
}

export type RouteScore = {
  id: string
  label: string
  distanceKm: number
  baseEtaMin: number
  adjustedEtaMin: number
  delayMin: number
  trafficLevel: number
  trafficBand: string
  riskScore: number
  riskBand: string
  weatherImpact: number
  aiScore: number
  blocked: boolean
  impacts: RouteImpact[]
  factors: string[]
}

export type WeatherIntel = {
  available: boolean
  source: string
  impact: number
  band: "none" | "low" | "medium" | "high"
  reasons: string[]
  note: string
  samples: { tempC: number | null; precipMmH: number | null; windKmh: number | null; visibilityM: number | null }[]
}

export type Intel = {
  scores: RouteScore[]
  recommendation: { routeId: string; label: string; reason: string; bullets: string[] } | null
  weather: WeatherIntel
  traffic: { source: string; modelSource: "model" | "heuristic"; note: string }
  models: { eta: boolean; congestion: boolean }
  generatedAt: number
}

export type IntelResponse = {
  engine: string
  mode: TravelMode
  routes: { id: string; label: string; distance_meters: number; duration_seconds: number; latLngs: [number, number][] }[]
  baseline: Intel
  scenario: {
    type: IntelScenarioType
    label: string
    intensity: number
    simulated: true
    at: { lat: number; lon: number }
    surge: number
    rerouted: boolean
    /** Every candidate still blocked and no plausible detour existed. */
    noViableRoute?: boolean
    detour: { lat: number; lon: number } | null
    intel: Intel
    note: string
  } | null
  incidents: GeoIncident[]
}

async function post(key: string): Promise<IntelResponse> {
  const body = JSON.parse(key.replace(/^intel:/, ""))
  const res = await fetch("/api/intelligence/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error || "Intelligence unavailable")
  return json as IntelResponse
}

/**
 * Runs the AI decision layer for the current trip. Optional by design: if it
 * fails, plain routing keeps working and the panel shows the error.
 */
export function useRouteIntel(
  origin: NavPoint | null,
  destination: NavPoint | null,
  mode: TravelMode,
  waypoints: NavPoint[],
  scenario: { type: IntelScenarioType; intensity: number },
) {
  const key =
    origin && destination
      ? `intel:${JSON.stringify({
          origin: { lat: origin.lat, lon: origin.lon },
          destination: { lat: destination.lat, lon: destination.lon },
          waypoints: waypoints.map((w) => ({ lat: w.lat, lon: w.lon })),
          mode,
          scenario,
        })}`
      : null

  const { data, error, isLoading, mutate } = useSWR<IntelResponse>(key, post, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    keepPreviousData: true,
  })

  const active = data?.scenario ? data.scenario.intel : (data?.baseline ?? null)

  return {
    data: data ?? null,
    /** Intelligence for whatever is currently in effect (scenario or baseline). */
    intel: active,
    baseline: data?.baseline ?? null,
    scenario: data?.scenario ?? null,
    incidents: data?.incidents ?? [],
    routes: data?.routes ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh: mutate,
  }
}
