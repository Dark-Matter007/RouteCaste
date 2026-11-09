"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type GeoFix = {
  lat: number
  lon: number
  /** Reported horizontal accuracy in metres (may be large indoors). */
  accuracy: number
  heading: number | null
  speed: number | null
  ts: number
  /** True when the fix was injected for testing rather than from the device. */
  simulated?: boolean
}

export type GeoStatus = "idle" | "locating" | "active" | "denied" | "unavailable" | "timeout" | "error"

const MSG: Record<GeoStatus, string | null> = {
  idle: null,
  locating: null,
  active: null,
  denied: "Location permission denied. Enable it in your browser settings to navigate.",
  unavailable: "Location is unavailable on this device or connection.",
  timeout: "Location request timed out. Move to open sky or retry.",
  error: "Could not determine your location.",
}

function classify(err: GeolocationPositionError): GeoStatus {
  if (err.code === err.PERMISSION_DENIED) return "denied"
  if (err.code === err.POSITION_UNAVAILABLE) return "unavailable"
  if (err.code === err.TIMEOUT) return "timeout"
  return "error"
}

/** Discards jitter: ignore fixes that barely moved and arrived very quickly. */
function tooSimilar(a: GeoFix | null, b: GeoFix): boolean {
  if (!a) return false
  if (b.ts - a.ts > 4000) return false
  const dLat = Math.abs(a.lat - b.lat)
  const dLon = Math.abs(a.lon - b.lon)
  return dLat < 0.00004 && dLon < 0.00004 // ~4 m
}

/**
 * Device location with explicit permission/error states. A single watcher is
 * reused for live navigation and is always torn down on stop/unmount.
 */
export function useGeolocation() {
  const [fix, setFix] = useState<GeoFix | null>(null)
  const [status, setStatus] = useState<GeoStatus>("idle")
  const [watching, setWatching] = useState(false)
  const watchId = useRef<number | null>(null)
  const lastFix = useRef<GeoFix | null>(null)
  const simulated = useRef(false)

  const accept = useCallback((p: GeolocationPosition) => {
    if (simulated.current) return // a manual test fix takes precedence
    const next: GeoFix = {
      lat: p.coords.latitude,
      lon: p.coords.longitude,
      accuracy: p.coords.accuracy ?? 0,
      heading: Number.isFinite(p.coords.heading as number) ? (p.coords.heading as number) : null,
      speed: Number.isFinite(p.coords.speed as number) ? (p.coords.speed as number) : null,
      ts: Date.now(),
    }
    if (tooSimilar(lastFix.current, next)) return
    lastFix.current = next
    setFix(next)
    setStatus("active")
  }, [])

  const stopWatch = useCallback(() => {
    if (watchId.current !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
    setWatching(false)
  }, [])

  /** One-shot fix — used before navigation starts. */
  const locateOnce = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable")
      return
    }
    simulated.current = false
    setStatus("locating")
    navigator.geolocation.getCurrentPosition(accept, (err) => setStatus(classify(err)), {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 30000,
    })
  }, [accept])

  /** Continuous tracking for active navigation. */
  const startWatch = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable")
      return
    }
    if (watchId.current !== null) return
    simulated.current = false
    setStatus((s) => (s === "active" ? s : "locating"))
    watchId.current = navigator.geolocation.watchPosition(accept, (err) => setStatus(classify(err)), {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 2000,
    })
    setWatching(true)
  }, [accept])

  /**
   * Inject a position manually. Needed to verify off-route/rerouting without a
   * physical drive, and useful for demos.
   */
  const setManualFix = useCallback(
    (lat: number, lon: number) => {
      stopWatch()
      simulated.current = true
      const next: GeoFix = { lat, lon, accuracy: 8, heading: null, speed: null, ts: Date.now(), simulated: true }
      lastFix.current = next
      setFix(next)
      setStatus("active")
    },
    [stopWatch],
  )

  const clearFix = useCallback(() => {
    stopWatch()
    simulated.current = false
    lastFix.current = null
    setFix(null)
    setStatus("idle")
  }, [stopWatch])

  // Never leave a watcher running behind an unmounted view.
  useEffect(() => stopWatch, [stopWatch])

  return {
    fix,
    status,
    watching,
    message: MSG[status],
    isSimulated: fix?.simulated === true,
    locateOnce,
    startWatch,
    stopWatch,
    setManualFix,
    clearFix,
  }
}
