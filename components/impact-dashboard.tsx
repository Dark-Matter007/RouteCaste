"use client"

import { BarChart3, Download } from "lucide-react"
import type { EventSimulationResponse } from "@/lib/types"

type ImpactDashboardProps = {
  result: EventSimulationResponse | null
}

function congestionColor(value: number) {
  return value < 0.35 ? "#22c55e" : value < 0.6 ? "#facc15" : value < 0.8 ? "#f97316" : "#f43f5e"
}

function severityColor(label: string) {
  const value = label.toLowerCase()
  if (value.includes("severe")) return "text-red-400"
  if (value.includes("high")) return "text-orange-400"
  if (value.includes("moderate")) return "text-yellow-400"
  return "text-green-400"
}

function formatTime(value: string) {
  if (Number.isNaN(Date.parse(value))) return "--:--"
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function ImpactDashboard({ result }: ImpactDashboardProps) {
  if (!result) return null

  const affectedCount = result.routes.filter((route) => route.affected).length
  const maxDelta = result.routes.length > 0 ? Math.max(...result.routes.map((route) => route.etaDeltaMin)) : 0
  const recommended = result.routes.find((route) => route.recommended)
  const severity = result.hotspot?.severityLabel ?? "Low"

  function exportJson(simulation: EventSimulationResponse) {
    const blob = new Blob([JSON.stringify(simulation, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `routecast-simulation-${simulation.event.name.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="rounded-xl border border-border bg-card/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-primary">
          <BarChart3 className="h-3.5 w-3.5" aria-hidden /> Impact Dashboard
        </h2>
        <span className="max-w-[45%] truncate font-mono text-[9px] text-muted-foreground">{result.event.name}</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <StatCard label="Affected Routes" value={`${affectedCount} / ${result.routes.length}`} />
        <StatCard label="Peak Congestion" value={severity} valueClass={severityColor(severity)} />
        <StatCard label="Max Delay" value={maxDelta > 0 ? `+${maxDelta.toFixed(1)} min` : "Minimal"} valueClass={maxDelta > 0 ? "text-orange-400" : "text-green-400"} />
      </div>

      {recommended && (() => {
        const saved = recommended.etaDeltaMin
        const pctWorse = recommended.baseEtaMin > 0
          ? ((recommended.eventEtaMin - recommended.baseEtaMin) / recommended.baseEtaMin) * 100
          : 0
        return (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border bg-background/50 p-3 text-center">
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Normal ETA</p>
              <p className="mt-1 font-mono text-2xl font-bold text-foreground">
                {recommended.baseEtaMin.toFixed(1)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">min</span>
              </p>
              <p className="mt-0.5 font-mono text-[9px] text-muted-foreground">free-flow baseline</p>
            </div>
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-center">
              <p className="font-mono text-[9px] uppercase tracking-widest text-amber-400/70">Event ETA</p>
              <p className="mt-1 font-mono text-2xl font-bold text-amber-300">
                {recommended.eventEtaMin.toFixed(1)}
                <span className="ml-1 text-xs font-normal text-amber-400/60">min</span>
              </p>
              <p className={`mt-0.5 font-mono text-[9px] ${saved > 0 ? "text-red-400" : "text-green-400"}`}>
                {saved > 0 ? `+${saved.toFixed(1)} min  (+${pctWorse.toFixed(0)}%)` : "No delay"}
              </p>
            </div>
          </div>
        )
      })()}

      {result.forecast.length >= 3 && (() => {
        const W = 300
        const H = 60
        const pad = 4
        const maxC = Math.max(...result.forecast.map((point) => point.congestion), 0.01)
        const pts = result.forecast.map((point, index) => {
          const x = pad + (index / (result.forecast.length - 1)) * (W - pad * 2)
          const y = H - pad - (point.congestion / maxC) * (H - pad * 2)
          return `${x},${y}`
        })
        const pathD = `M ${pts.join(" L ")}`
        const areaD = `M ${pts[0]} L ${pts.join(" L ")} L ${pad + (W - pad * 2)},${H - pad} L ${pad},${H - pad} Z`
        const peakIdx = result.forecast.reduce((best, point, index) =>
          point.congestion > result.forecast[best].congestion ? index : best, 0)
        const peakX = pad + (peakIdx / (result.forecast.length - 1)) * (W - pad * 2)
        const peakY = H - pad - (result.forecast[peakIdx].congestion / maxC) * (H - pad * 2)
        const peakColor = congestionColor(result.forecast[peakIdx].congestion)
        return (
          <div className="mt-3">
            <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              Congestion Forecast · {result.forecast[0].minutesFromStart}–{result.forecast[result.forecast.length - 1].minutesFromStart} min
            </p>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full overflow-visible"
              aria-label="Congestion forecast chart"
            >
              <defs>
                <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={peakColor} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={peakColor} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75, 1].map((fraction) => {
                const y = H - pad - fraction * (H - pad * 2)
                return <line key={fraction} x1={pad} y1={y} x2={W - pad} y2={y} stroke="#334155" strokeWidth={0.5} />
              })}
              <path d={areaD} fill="url(#forecastGrad)" />
              <path d={pathD} fill="none" stroke={peakColor} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
              <line x1={peakX} y1={pad} x2={peakX} y2={H - pad} stroke={peakColor} strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={peakX} cy={peakY} r={3} fill={peakColor} />
              <text x={peakX + 4} y={peakY - 3} fill={peakColor} fontSize={7} fontFamily="monospace">
                peak
              </text>
            </svg>
            <div className="flex justify-between font-mono text-[8px] text-muted-foreground">
              <span>+{result.forecast[0].minutesFromStart}m</span>
              <span>+{result.forecast[Math.floor((result.forecast.length - 1) / 2)].minutesFromStart}m</span>
              <span>+{result.forecast[result.forecast.length - 1].minutesFromStart}m</span>
            </div>
          </div>
        )
      })()}

      {recommended && (
        <div className="mt-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <p className="font-mono text-[9px] uppercase tracking-widest text-primary">⭐ Recommended During Event</p>
          <p className="mt-1 text-sm font-bold text-primary">{recommended.label}</p>
          <p className="mt-1 text-[10px] italic text-muted-foreground">{recommended.reason}</p>
          <p className="mt-1 text-[10px] text-foreground">
            Base: {recommended.baseEtaMin.toFixed(1)} min → Event: {recommended.eventEtaMin.toFixed(1)} min
            {recommended.etaDeltaMin > 0 ? ` (+${recommended.etaDeltaMin.toFixed(1)} min delay)` : " (Minimal delay)"}
          </p>
        </div>
      )}

      <div className="mt-3 overflow-x-auto">
        {result.routes.length === 0 ? (
          <p className="py-3 text-center font-mono text-[10px] text-muted-foreground">
            No routes to compare — set A and B before simulating.
          </p>
        ) : <table className="w-full min-w-[420px] text-left font-mono text-[10px]">
          <thead>
            <tr className="border-b border-border text-[9px] uppercase tracking-widest text-muted-foreground">
              <th className="py-1.5 pr-2 font-normal">Route</th>
              <th className="py-1.5 pr-2 font-normal">Normal ETA</th>
              <th className="py-1.5 pr-2 font-normal">Event ETA</th>
              <th className="py-1.5 pr-2 font-normal">Delay</th>
              <th className="py-1.5 font-normal">Congestion</th>
            </tr>
          </thead>
          <tbody>
            {result.routes.map((route) => {
              const delayClass = route.etaDeltaMin <= 0
                ? "text-green-400"
                : route.etaDeltaMin <= 5
                  ? "text-yellow-400"
                  : route.etaDeltaMin <= 15
                    ? "text-orange-400"
                    : "text-red-400"
              return (
                <tr key={route.routeId} className={`border-b border-border/50 ${route.recommended ? "border-l-2 border-l-primary bg-primary/5" : ""}`}>
                  <th scope="row" className="max-w-28 truncate py-1.5 pl-1 pr-2 text-left font-normal text-foreground">{route.label}</th>
                  <td className="py-1.5 pr-2 text-muted-foreground">{route.baseEtaMin.toFixed(1)} min</td>
                  <td className="py-1.5 pr-2 text-foreground">{route.eventEtaMin.toFixed(1)} min</td>
                  <td className={`whitespace-nowrap py-1.5 pr-2 ${delayClass}`}>{route.etaDeltaMin > 0 ? `+${route.etaDeltaMin.toFixed(1)} min` : "Minimal"}</td>
                  <td className="whitespace-nowrap py-1.5 text-muted-foreground"><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: congestionColor(route.congestionDuring) }} />{route.congestionClass}</td>
                </tr>
              )
            })}
          </tbody>
        </table>}
      </div>

      <p className="mt-3 text-[10px] text-muted-foreground">
        Peak congestion expected at {formatTime(result.peakAt)} · Event: {formatTime(result.event.startTime)} – {formatTime(result.event.endTime)}
      </p>

      <div className="mt-3 border-t border-border/60 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] text-muted-foreground">
          <span>Simulated at {formatTime(result.simulatedAt)}</span>
          <span className={`rounded-full border px-1.5 py-0.5 ${result.source === "model" ? "border-amber-400/50 text-amber-300" : "border-border text-muted-foreground"}`}>
            {result.source === "model" ? "ONNX Model" : "Heuristic"}
          </span>
        </div>
        <p className="mt-1 text-[9px] italic text-muted-foreground">{result.note.slice(0, 100)}{result.note.length > 100 ? "…" : ""}</p>
      </div>

      <button type="button" onClick={() => exportJson(result)} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">
        <Download className="h-3 w-3" aria-hidden /> Export Simulation JSON
      </button>
    </section>
  )
}

function StatCard({ label, value, valueClass = "text-foreground" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-2 text-center">
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-bold ${valueClass}`}>{value}</p>
    </div>
  )
}
