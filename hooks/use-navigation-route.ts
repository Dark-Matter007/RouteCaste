"use client"

import useSWR from "swr"

export type NavPoint = { lat: number; lon: number; label?: string }
export type TravelMode = "driving" | "walking" | "cycling"

export type NavStep = {
  instruction: string
  maneuver: string
  modifier?: string
  name: string
  distanceMeters: number
  durationSeconds: number
}

export type NavRoute = {
  id: string
  label: string
  distance_meters: number
  duration_seconds: number
  summary: string
  latLngs: [number, number][]
  steps: NavStep[]
  ai_score: number | null
}

export type NavResponse = {
  engine: string
  mode: TravelMode
  routes: NavRoute[]
  traffic: { source: string; note: string }
}

async function postRoute(key: string): Promise<NavResponse> {
  const { origin, destination, waypoints, mode } = JSON.parse(key.replace(/^nav:/, ""))
  const res = await fetch("/api/navigation/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origin, destination, waypoints, mode, alternatives: true }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body?.error || "Routing failed")
  return body as NavResponse
}

/** Fetches real routes whenever origin, destination, waypoints or mode change. */
export function useNavigationRoute(
  origin: NavPoint | null,
  destination: NavPoint | null,
  mode: TravelMode,
  waypoints: NavPoint[] = [],
) {
  const key =
    origin && destination
      ? `nav:${JSON.stringify({
          origin: { lat: origin.lat, lon: origin.lon },
          destination: { lat: destination.lat, lon: destination.lon },
          waypoints: waypoints.map((w) => ({ lat: w.lat, lon: w.lon })),
          mode,
        })}`
      : null

  const { data, error, isLoading } = useSWR<NavResponse>(key, postRoute, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })

  return {
    routes: data?.routes ?? [],
    engine: data?.engine,
    trafficNote: data?.traffic?.note,
    loading: isLoading,
    error: error ? (error as Error).message : null,
  }
}
