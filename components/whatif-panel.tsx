"use client"

import { FlaskConical, TriangleAlert } from "lucide-react"
import type { Intel, IntelResponse, IntelScenarioType } from "@/hooks/use-route-intel"

const SCENARIOS: { id: IntelScenarioType; label: string }[] = [
  { id: "none", label: "Normal" },
  { id: "closure", label: "Road closure" },
  { id: "accident", label: "Accident" },
  { id: "traffic", label: "Traffic surge" },
  { id: "rain", label: "Heavy rain" },
  { id: "flood", label: "Flood risk" },
]

const delta = (a: number, b: number) => {
  const d = Math.round((b - a) * 10) / 10
  return d === 0 ? "±0" : d > 0 ? `+${d}` : `${d}`
}

/**
 * Digital-twin what-if console. Selecting a scenario re-runs the backend
 * decision layer: the incident is created, routes are re-scored, and a
 * blocked plan is re-routed by the real routing engine.
 */
export function WhatIfPanel({
  scenario,
  onScenario,
  baseline,
  result,
  loading,
  ready,
}: {
  scenario: { type: IntelScenarioType; intensity: number }
  onScenario: (s: { type: IntelScenarioType; intensity: number }) => void
  baseline: Intel | null
  result: IntelResponse["scenario"]
  loading: boolean
  ready: boolean
}) {
  const baseTop = baseline?.scores.find((s) => s.id === baseline?.recommendation?.routeId) ?? baseline?.scores[0]
  const scenTop = result?.intel.scores.find((s) => s.id === result?.intel.recommendation?.routeId) ?? result?.intel.scores[0]
  const switched = !!baseTop && !!scenTop && baseTop.label !== scenTop.label

  return (
    <section className="rounded-xl border border-border bg-card/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-primary">
          <FlaskConical className="h-3.5 w-3.5" aria-hidden /> Route what-if
        </h2>
        {loading && <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">running…</span>}
      </div>

      <p className="mt-1 text-[10px] leading-snug text-pretty text-muted-foreground">
        Applies to your real A→B road route — blocked plans are re-routed by the routing engine.
      </p>

      {!ready && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Set A and B to run a scenario
        </p>
      )}

      <fieldset className="mt-2.5" disabled={!ready}>
        <legend className="sr-only">Scenario</legend>
        <div className="grid grid-cols-3 gap-1">
          {SCENARIOS.map((s) => {
            const active = scenario.type === s.id
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={active}
                disabled={!ready}
                onClick={() => onScenario({ ...scenario, type: s.id })}
                className={`rounded-lg border px-1.5 py-1.5 font-mono text-[9px] uppercase tracking-wider transition-colors disabled:opacity-40 ${
                  active
                    ? s.id === "none"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-destructive bg-destructive text-destructive-foreground"
                    : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </fieldset>

      {scenario.type !== "none" && (
        <div className="mt-3">
          <label
            htmlFor="intensity"
            className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
          >
            Severity
            <span className="text-foreground">{Math.round(scenario.intensity * 100)}%</span>
          </label>
          <input
            id="intensity"
            type="range"
            min={0.2}
            max={1}
            step={0.1}
            value={scenario.intensity}
            disabled={!ready}
            onChange={(e) => onScenario({ ...scenario, intensity: Number(e.target.value) })}
            className="mt-1 w-full accent-[var(--color-primary)]"
          />
        </div>
      )}

      {result && scenTop && baseTop && (
        <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 p-2.5">
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-destructive">
            <TriangleAlert className="h-3 w-3" aria-hidden /> {result.label} · simulated
          </p>

          <dl className="mt-2 space-y-1 font-mono text-[10px]">
            <Row label="Affected area" value={`${result.at.lat.toFixed(4)}, ${result.at.lon.toFixed(4)}`} />
            {/*
              After a reroute, result.intel describes the NEW detour (which is
              clear by construction), so counting it would always read "0 of n".
              The disruption is measured on the plan that was actually hit.
            */}
            <Row
              label={result.rerouted ? "Original plan" : "Affected routes"}
              value={
                result.rerouted
                  ? "blocked — detour required"
                  : `${result.intel.scores.filter((s) => s.impacts.length > 0 || s.blocked).length} of ${result.intel.scores.length} hit`
              }
              danger={result.rerouted}
            />
            <Row
              label="ETA impact"
              value={`${Math.round(baseTop.adjustedEtaMin)} → ${Math.round(scenTop.adjustedEtaMin)} min (${delta(
                baseTop.adjustedEtaMin,
                scenTop.adjustedEtaMin,
              )})`}
              danger={scenTop.adjustedEtaMin > baseTop.adjustedEtaMin}
            />
            <Row
              label="AI score"
              value={`${baseTop.aiScore} → ${scenTop.aiScore} (${delta(baseTop.aiScore, scenTop.aiScore)})`}
              danger={scenTop.aiScore < baseTop.aiScore}
            />
            <Row label="Traffic" value={`${baseTop.trafficBand} → ${scenTop.trafficBand}`} />
            <Row label="Risk" value={`${baseTop.riskBand} → ${scenTop.riskBand}`} />
            <Row
              label="Alternative"
              value={
                result.noViableRoute
                  ? "none found — trip not viable"
                  : result.rerouted
                    ? "recalculated by routing engine"
                    : "original roads still viable"
              }
              danger={result.noViableRoute}
            />
          </dl>

          <p className="mt-2 border-t border-destructive/30 pt-2 text-[11px] text-pretty leading-relaxed text-muted-foreground">
            <span className="font-mono uppercase tracking-wider text-primary">AI: </span>
            {switched ? (
              <>
                recommendation switched from <span className="text-foreground">{baseTop.label}</span> to{" "}
                <span className="text-primary">{scenTop.label}</span>. {result.intel.recommendation?.reason}
              </>
            ) : (
              <>
                keeps <span className="text-primary">{scenTop.label}</span>. {result.intel.recommendation?.reason}
              </>
            )}
          </p>
          <p className="mt-1.5 text-[9px] text-pretty leading-relaxed text-muted-foreground">{result.note}</p>
        </div>
      )}
    </section>
  )
}

function Row({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right ${danger ? "text-destructive" : "text-foreground"}`}>{value}</dd>
    </div>
  )
}
