"use client"

import { AlertTriangle, Brain, CloudRain, Gauge, ShieldAlert, Sparkles } from "lucide-react"
import type { Intel, RouteScore } from "@/hooks/use-route-intel"

const bandColor = (b: string) =>
  b === "very high" || b === "high" ? "text-destructive" : b === "medium" ? "text-amber-400" : "text-primary"

function scoreColor(n: number) {
  return n >= 80 ? "text-primary" : n >= 55 ? "text-amber-400" : "text-destructive"
}

/**
 * AI decision dashboard: the recommendation, the numbers behind it, the
 * explanation, and a side-by-side comparison of every candidate route.
 * Every value comes from /api/intelligence/route — nothing is hard-coded.
 */
export function RouteIntelPanel({
  intel,
  loading,
  error,
  simulated,
  onSelectRoute,
  activeRouteId,
}: {
  intel: Intel | null
  loading: boolean
  error: string | null
  simulated: boolean
  onSelectRoute?: (id: string) => void
  activeRouteId?: string | null
}) {
  if (error) {
    return (
      <section className="rounded-xl border border-destructive/40 bg-card/50 p-3">
        <h2 className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-destructive">
          <Brain className="h-3.5 w-3.5" aria-hidden /> AI route intelligence
        </h2>
        <p className="mt-2 text-[11px] text-pretty text-muted-foreground">
          Unavailable: {error}. Routing and navigation continue to work without it.
        </p>
      </section>
    )
  }

  if (!intel) {
    return (
      <section className="rounded-xl border border-border bg-card/50 p-3">
        <h2 className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-primary">
          <Brain className="h-3.5 w-3.5" aria-hidden /> AI route intelligence
        </h2>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {loading ? "Scoring routes…" : "Set A and B to score routes"}
        </p>
      </section>
    )
  }

  const rec = intel.recommendation
  const top = intel.scores.find((s) => s.id === rec?.routeId) ?? intel.scores[0]

  return (
    <section className="rounded-xl border border-border bg-card/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-primary">
          <Brain className="h-3.5 w-3.5" aria-hidden /> AI route intelligence
        </h2>
        <div className="flex items-center gap-1">
          {simulated && (
            <span className="rounded-full border border-destructive/50 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-destructive">
              Simulated
            </span>
          )}
          <span
            className={`rounded-full border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider ${
              intel.traffic.modelSource === "model"
                ? "border-primary/50 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {intel.traffic.modelSource === "model" ? "ONNX" : "Heuristic"}
          </span>
        </div>
      </div>

      {/* recommendation */}
      {rec && top && (
        <div className="mt-2.5 rounded-lg border border-primary/40 bg-primary/5 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-primary">
              <Sparkles className="h-3 w-3" aria-hidden /> Recommended
            </span>
            <span className={`font-mono text-lg font-semibold leading-none ${scoreColor(top.aiScore)}`}>
              {top.aiScore}
              <span className="text-[9px] text-muted-foreground">/100</span>
            </span>
          </div>
          <p className="mt-1 font-mono text-sm font-semibold text-foreground">{rec.label}</p>

          <dl className="mt-2 grid grid-cols-3 gap-2 font-mono text-[10px]">
            <Stat label="ETA" value={`${Math.round(top.adjustedEtaMin)} min`} />
            <Stat label="Distance" value={`${top.distanceKm} km`} />
            <Stat label="Delay" value={`+${Math.round(top.delayMin)} min`} />
            <Stat label="Traffic" value={top.trafficBand} className={bandColor(top.trafficBand)} />
            <Stat label="Risk" value={top.riskBand} className={bandColor(top.riskBand)} />
            <Stat
              label="Weather"
              value={intel.weather.available ? intel.weather.band : "n/a"}
              className={bandColor(intel.weather.band)}
            />
          </dl>

          <p className="mt-2 text-[11px] text-pretty leading-relaxed text-muted-foreground">{rec.reason}</p>
          <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-primary">Why?</p>
          <ul className="mt-1 space-y-0.5">
            {rec.bullets.map((b, i) => (
              <li key={`${i}-${b}`} className="flex gap-1.5 text-[11px] text-pretty text-muted-foreground">
                <span className="text-primary" aria-hidden>
                  •
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* comparison */}
      {intel.scores.length > 1 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse font-mono text-[10px]">
            <caption className="sr-only">AI comparison of candidate routes</caption>
            <thead>
              <tr className="text-left text-muted-foreground">
                <th scope="col" className="pb-1 pr-2 font-normal uppercase tracking-wider">
                  Route
                </th>
                <th scope="col" className="pb-1 pr-2 font-normal uppercase tracking-wider">
                  ETA
                </th>
                <th scope="col" className="pb-1 pr-2 font-normal uppercase tracking-wider">
                  Km
                </th>
                <th scope="col" className="pb-1 pr-2 font-normal uppercase tracking-wider">
                  Traf
                </th>
                <th scope="col" className="pb-1 pr-2 font-normal uppercase tracking-wider">
                  Risk
                </th>
                <th scope="col" className="pb-1 font-normal uppercase tracking-wider">
                  AI
                </th>
              </tr>
            </thead>
            <tbody>
              {intel.scores.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => onSelectRoute?.(s.id)}
                  className={`cursor-pointer border-t border-border/60 transition-colors hover:bg-primary/5 ${
                    s.id === activeRouteId ? "bg-primary/10" : ""
                  }`}
                >
                  <th scope="row" className="py-1 pr-2 text-left font-normal text-foreground">
                    {s.label}
                    {s.blocked && <span className="ml-1 text-destructive">blocked</span>}
                  </th>
                  <td className="py-1 pr-2 text-muted-foreground">{Math.round(s.adjustedEtaMin)}m</td>
                  <td className="py-1 pr-2 text-muted-foreground">{s.distanceKm}</td>
                  <td className={`py-1 pr-2 ${bandColor(s.trafficBand)}`}>{s.trafficBand}</td>
                  <td className={`py-1 pr-2 ${bandColor(s.riskBand)}`}>{s.riskBand}</td>
                  <td className={`py-1 font-semibold ${scoreColor(s.aiScore)}`}>{s.aiScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* factor detail for the recommended route */}
      {top && (
        <ul className="mt-3 space-y-1">
          {/* Two incidents can yield identical factor text, so the index is
              part of the key to keep it unique. */}
          {top.factors.map((f, i) => (
            <li key={`${i}-${f}`} className="flex items-start gap-1.5 font-mono text-[10px] text-muted-foreground">
              <FactorIcon text={f} />
              <span className="text-pretty">{f}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 border-t border-border/60 pt-2 text-[9px] text-pretty leading-relaxed text-muted-foreground">
        Traffic: {intel.traffic.note} Weather:{" "}
        {intel.weather.available ? `${intel.weather.source} — ${intel.weather.note}` : intel.weather.note}
      </p>
    </section>
  )
}

function Stat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <dt className="text-[8px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 font-semibold ${className || "text-foreground"}`}>{value}</dd>
    </div>
  )
}

function FactorIcon({ text }: { text: string }) {
  const t = text.toLowerCase()
  if (t.startsWith("blocked") || t.startsWith("delay"))
    return <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" aria-hidden />
  if (t.startsWith("weather")) return <CloudRain className="mt-0.5 h-3 w-3 shrink-0 text-primary" aria-hidden />
  if (t.startsWith("risk")) return <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" aria-hidden />
  return <Gauge className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
}

export type { RouteScore }
