"use client"

import { useState } from "react"
import { Layers, Loader2, MapPinned } from "lucide-react"
import type { EventSimulationResponse } from "@/lib/types"
import type { TravelMode } from "@/hooks/use-navigation-route"

type Point = [number, number]

type IsochronePanelProps = {
  origin: { lat: number; lng: number } | null
  mode: TravelMode
  simulationResult: EventSimulationResponse | null
  onIsochrone: (normal: Point[], affected: Point[]) => void
  onClear: () => void
}

type IsochroneResult = {
  normal: Point[]
  affected: Point[]
  reachableCount: number
  totalPoints: number
}

const TIME_LIMITS = [5, 10, 15, 20]

export function IsochronePanel({ origin, mode, simulationResult, onIsochrone, onClear }: IsochronePanelProps) {
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<IsochroneResult | null>(null)

  async function calculate() {
    if (!origin) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/isochrone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: origin.lat,
          lng: origin.lng,
          timeLimitMinutes,
          mode,
          ...(simulationResult ? {
            eventLat: simulationResult.event.lat,
            eventLng: simulationResult.event.lng,
            eventLoad: simulationResult.event.eventLoad,
          } : {}),
        }),
      })
      const data = (await response.json()) as IsochroneResult & { error?: string }
      if (!response.ok) throw new Error(data.error || "Isochrone calculation failed")
      if (!Array.isArray(data.normal) || !Array.isArray(data.affected)) throw new Error("Invalid isochrone response")
      setResult(data)
      onIsochrone(data.normal, data.affected)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not calculate reachable area")
    } finally {
      setLoading(false)
    }
  }

  function clear() {
    setResult(null)
    setError(null)
    onClear()
  }

  return (
    <section className="rounded-xl border border-border bg-card/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-primary">
          <MapPinned className="h-3.5 w-3.5" aria-hidden /> Reachable Area
        </h2>
        <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          <Layers className="h-3 w-3" aria-hidden /> Isochrone
        </span>
      </div>

      {!origin ? (
        <p className="mt-2 font-mono text-[10px] text-muted-foreground">Set point A on the map to calculate reachable area.</p>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-4 gap-1">
            {TIME_LIMITS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                aria-pressed={timeLimitMinutes === minutes}
                onClick={() => setTimeLimitMinutes(minutes)}
                className={`rounded-lg border px-1 py-1 font-mono text-[9px] uppercase tracking-wider transition-colors ${timeLimitMinutes === minutes ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary"}`}
              >
                {minutes} min
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={calculate}
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary bg-primary px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary-foreground disabled:opacity-60"
          >
            {loading && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {loading ? "Calculating…" : "Calculate Reachable Area"}
          </button>
          {error && <p role="alert" className="mt-2 font-mono text-[10px] text-destructive">⚠ {error}</p>}

          {result && (
            <div className="mt-2 border-t border-border/60 pt-2">
              <p className="font-mono text-[10px] text-foreground">
                Reachable: {result.reachableCount} of {result.totalPoints} points within {timeLimitMinutes} min
              </p>
              {simulationResult && result.affected.length > 0 && (
                <p className="mt-1 text-[10px] leading-snug text-amber-300">
                  ⚠ Event reduces reachable area — congestion near {simulationResult.event.name} limits travel.
                </p>
              )}
              <button
                type="button"
                onClick={clear}
                className="mt-2 w-full rounded-lg border border-border bg-card px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                × Clear
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
