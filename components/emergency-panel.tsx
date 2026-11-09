"use client"

import { useState } from "react"
import { Loader2, Siren } from "lucide-react"
import { GUNTUR_PLACES } from "@/lib/guntur-places"
import type { EventSimulationResponse } from "@/lib/types"

type Severity = "minimal" | "moderate" | "severe" | "critical"
type EmergencyResult = {
  latLngs: [number, number][]
  distanceMeters: number
  baseEtaMin: number
  normalEtaMin: number
  eventEtaMin: number
  delayMin: number
  degradationPct: number
  severity: Severity
  recommendation: string
  routeSummary: string
  error?: string
}

type EmergencyPanelProps = {
  simulationResult: EventSimulationResponse | null
  timeOverride: number | null
  onEmergencyRoute: (latLngs: [number, number][]) => void
  onClear: () => void
}

const SEVERITY_STYLES: Record<Severity, { banner: string; message: string }> = {
  minimal: { banner: "border-green-500/40 bg-green-500/5 text-green-400", message: "✓ Minimal impact on emergency response" },
  moderate: { banner: "border-yellow-500/40 bg-yellow-500/5 text-yellow-300", message: "⚠ Moderate delay — consider pre-positioning" },
  severe: { banner: "border-orange-500/40 bg-orange-500/5 text-orange-400", message: "⚠ Severe delay — pre-position units recommended" },
  critical: { banner: "border-red-500/50 bg-red-500/10 text-red-400", message: "🚨 CRITICAL — Emergency corridor required" },
}

export function EmergencyPanel({ simulationResult, timeOverride, onEmergencyRoute, onClear }: EmergencyPanelProps) {
  const [originId, setOriginId] = useState("ggh")
  const [destId, setDestId] = useState("bus-stand")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<EmergencyResult | null>(null)

  async function calculate() {
    const origin = GUNTUR_PLACES.find((place) => place.id === originId)
    const destination = GUNTUR_PLACES.find((place) => place.id === destId)
    if (!origin || !destination) return

    setLoading(true)
    setError(null)
    setResult(null)
    onEmergencyRoute([])
    try {
      const response = await fetch("/api/emergency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originLat: origin.lat,
          originLng: origin.lng,
          destLat: destination.lat,
          destLng: destination.lng,
          ...(timeOverride === null ? {} : { hourOverride: timeOverride }),
          ...(simulationResult ? {
            eventLat: simulationResult.event.lat,
            eventLng: simulationResult.event.lng,
            eventLoad: simulationResult.event.eventLoad,
            impactRadiusMeters: simulationResult.event.impactRadiusMeters,
          } : {}),
        }),
      })
      const data = (await response.json()) as EmergencyResult
      if (!response.ok) throw new Error(data.error || "Could not calculate emergency route")
      setResult(data)
      onEmergencyRoute(data.latLngs)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not calculate emergency route")
    } finally {
      setLoading(false)
    }
  }

  function clear() {
    setResult(null)
    setError(null)
    onClear()
  }

  const severityStyle = result ? SEVERITY_STYLES[result.severity] : null

  return (
    <section className="rounded-xl border border-border bg-card/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-red-400">
          <Siren className="h-3.5 w-3.5" aria-hidden /> Emergency Routing
        </h2>
        <span className="rounded-full border border-red-500/50 bg-red-500/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-red-400">Priority</span>
      </div>
      <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
        Fastest corridor for emergency vehicles. Compares response time under normal and event conditions.
      </p>

      <div className="mt-3 space-y-2">
        <label className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          From (Emergency Unit)
          <select value={originId} onChange={(event) => setOriginId(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground">
            {GUNTUR_PLACES.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
          </select>
        </label>
        <label className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          To (Incident)
          <select value={destId} onChange={(event) => setDestId(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground">
            {GUNTUR_PLACES.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
          </select>
        </label>
      </div>

      <button type="button" onClick={calculate} disabled={loading} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-500 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-white transition-colors hover:bg-red-600 disabled:opacity-60">
        {loading && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
        {loading ? "Calculating…" : "🚨 Calculate Emergency Route"}
      </button>
      {error && <p role="alert" className="mt-2 font-mono text-[10px] text-red-400">⚠ {error}</p>}

      {result && (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
          <p className="font-mono text-[8px] uppercase tracking-widest text-amber-300">Simulated estimate · not live traffic data</p>
          <p className="text-[9px] text-muted-foreground">{result.routeSummary} · {(result.distanceMeters / 1000).toFixed(1)} km</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Metric label="Base ETA" value={`${result.baseEtaMin.toFixed(1)} min`} />
            <Metric label="Normal Traffic" value={`${result.normalEtaMin.toFixed(1)} min`} />
            {simulationResult ? (
              <>
                <Metric label="Event ETA" value={`${result.eventEtaMin.toFixed(1)} min`} />
                <Metric label="Delay" value={`+${result.delayMin.toFixed(1)} min`} valueClass={result.delayMin > 2 ? "text-red-400" : result.delayMin > 0 ? "text-yellow-300" : "text-green-400"} />
              </>
            ) : (
              <p className="col-span-2 text-[10px] text-muted-foreground">Run an event simulation to see event impact.</p>
            )}
          </div>

          {simulationResult && severityStyle && (
            <>
              <div className={`rounded-lg border p-2 font-mono text-[10px] ${severityStyle.banner}`}>
                {severityStyle.message} <span className="ml-1 text-[9px]">({result.degradationPct}% vs. base)</span>
              </div>
              <p className="text-[10px] italic leading-snug text-muted-foreground">{result.recommendation}</p>
            </>
          )}
          <button type="button" onClick={clear} className="w-full rounded-lg border border-border bg-card px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">
            × Clear Route
          </button>
        </div>
      )}
    </section>
  )
}

function Metric({ label, value, valueClass = "text-foreground" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-2">
      <p className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-xs font-semibold ${valueClass}`}>{value}</p>
    </div>
  )
}
