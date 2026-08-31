"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { NavPoint, NavRoute, TravelMode } from "@/hooks/use-navigation-route"
import type { GeoFix } from "@/hooks/use-geolocation"
import { computeProgress, cumulativeDistances, type LL, type NavProgress } from "@/lib/nav/progress"

export type NavState = "idle" | "route_ready" | "navigating" | "rerouting" | "arrived" | "error"

/** Consecutive off-route fixes required before rerouting (kills GPS noise). */
const OFF_ROUTE_STRIKES = 2
/**
 * A deviation this large cannot be GPS jitter (a wrong turn or a jumped fix),
 * so it reroutes on the first sample instead of waiting for strikes.
 */
const GROSS_DEVIATION_M = 250
/** Minimum gap between two reroutes. */
const REROUTE_COOLDOWN_MS = 12_000

type Args = {
  /** Routes from the planner (SWR) for the current A→B/waypoints request. */
  routes: NavRoute[]
  selectedRouteId: string | null
  destination: NavPoint | null
  waypoints: NavPoint[]
  mode: TravelMode
  fix: GeoFix | null
  onRerouted?: () => void
}

/**
 * Owns live navigation: which route is being followed, progress along it,
 * off-route detection and automatic rerouting from the current position.
 */
export function useNavSession({
  routes,
  selectedRouteId,
  destination,
  waypoints,
  mode,
  fix,
  onRerouted,
}: Args) {
  const [state, setState] = useState<NavState>("idle")
  const [rerouted, setRerouted] = useState<NavRoute | null>(null)
  const [rerouteCount, setRerouteCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [follow, setFollow] = useState(true)

  const strikes = useRef(0)
  const lastReroute = useRef(0)
  const inFlight = useRef(false)

  const planned = routes.find((r) => r.id === selectedRouteId) ?? routes[0] ?? null
  // A reroute replaces the followed route until endpoints/selection change.
  const route = rerouted ?? planned

  // Drop a stale reroute whenever the underlying request changes.
  const planKey = `${planned?.id ?? ""}:${destination?.lat ?? ""},${destination?.lon ?? ""}:${mode}:${waypoints.length}`
  useEffect(() => {
    setRerouted(null)
    strikes.current = 0
  }, [planKey])

  // Leaving/entering a routable state keeps the machine honest.
  useEffect(() => {
    setState((s) => {
      if (!route) return "idle"
      if (s === "idle") return "route_ready"
      return s
    })
  }, [route])

  const cum = useMemo(() => (route ? cumulativeDistances(route.latLngs as LL[]) : []), [route])

  const progress: NavProgress | null = useMemo(() => {
    if (!route || !fix || route.latLngs.length < 2) return null
    return computeProgress({
      pos: [fix.lat, fix.lon],
      line: route.latLngs as LL[],
      cum,
      steps: route.steps,
      totalMeters: route.distance_meters,
      totalSeconds: route.duration_seconds,
      // Loosen the threshold when the fix itself is imprecise.
      offRouteMeters: Math.max(55, Math.min(140, (fix.accuracy || 0) * 1.5)),
    })
  }, [route, fix, cum])

  const start = useCallback(() => {
    if (!route) return
    setError(null)
    setRerouteCount(0)
    strikes.current = 0
    setFollow(true)
    setState("navigating")
  }, [route])

  const stop = useCallback(() => {
    setState(route ? "route_ready" : "idle")
    setRerouted(null)
    strikes.current = 0
  }, [route])

  /** Recalculates from the live position to the untouched destination. */
  const reroute = useCallback(
    async (from: GeoFix) => {
      if (!destination || inFlight.current) return
      inFlight.current = true
      setState("rerouting")
      try {
        const res = await fetch("/api/navigation/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: { lat: from.lat, lon: from.lon },
            destination: { lat: destination.lat, lon: destination.lon },
            waypoints: waypoints.map((w) => ({ lat: w.lat, lon: w.lon })),
            mode,
            alternatives: false,
          }),
        })
        const body = await res.json()
        if (!res.ok) throw new Error(body?.error || "Reroute failed")
        const next: NavRoute | undefined = body.routes?.[0]
        if (!next) throw new Error("No alternative route from here")
        setRerouted({ ...next, label: "Rerouted" })
        setRerouteCount((n) => n + 1)
        lastReroute.current = Date.now()
        strikes.current = 0
        setState("navigating")
        onRerouted?.()
      } catch (e) {
        setError((e as Error).message)
        setState("error")
      } finally {
        inFlight.current = false
      }
    },
    [destination, waypoints, mode, onRerouted],
  )

  // Arrival + off-route watchdog, evaluated on every accepted fix.
  useEffect(() => {
    if (state !== "navigating" || !progress || !fix) return

    if (progress.arrived) {
      strikes.current = 0
      setState("arrived")
      return
    }

    if (!progress.isOffRoute) {
      strikes.current = 0
      return
    }
    strikes.current += 1
    const cooled = Date.now() - lastReroute.current > REROUTE_COOLDOWN_MS
    const gross = progress.deviationMeters > GROSS_DEVIATION_M
    if (cooled && (gross || strikes.current >= OFF_ROUTE_STRIKES)) void reroute(fix)
  }, [fix, progress, state, reroute])

  return {
    state,
    route,
    progress,
    error,
    rerouteCount,
    isRerouted: rerouted !== null,
    follow,
    setFollow,
    start,
    stop,
    /** Manual retry after a failed reroute. */
    retry: () => fix && reroute(fix),
  }
}
