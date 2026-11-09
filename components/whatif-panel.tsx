"use client"

<<<<<<< HEAD
import { useState } from "react"
import { Building2, FlaskConical, TriangleAlert } from "lucide-react"
import type { Intel, IntelResponse, IntelScenarioType } from "@/hooks/use-route-intel"
import type { EventSimulationResponse } from "@/lib/types"
=======
import { FlaskConical, TriangleAlert } from "lucide-react"
import type { Intel, IntelResponse, IntelScenarioType } from "@/hooks/use-route-intel"
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975

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
<<<<<<< HEAD
  simulationResult,
  onClosurePoints,
  closurePoints,
  eventDriven,
  scenarioPin,
  onPlacePin,
  onClearPin,
=======
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
}: {
  scenario: { type: IntelScenarioType; intensity: number }
  onScenario: (s: { type: IntelScenarioType; intensity: number }) => void
  baseline: Intel | null
  result: IntelResponse["scenario"]
  loading: boolean
  ready: boolean
<<<<<<< HEAD
  simulationResult?: EventSimulationResponse | null
  onClosurePoints?: (points: [{ lat: number; lng: number }, { lat: number; lng: number }] | null) => void
  closurePoints?: [{ lat: number; lng: number }, { lat: number; lng: number }] | null
  eventDriven?: boolean
  scenarioPin?: { lat: number; lon: number } | null
  onPlacePin?: () => void
  onClearPin?: () => void
}) {
  const [tab, setTab] = useState<"citizen" | "planner">("citizen")
=======
}) {
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
  const baseTop = baseline?.scores.find((s) => s.id === baseline?.recommendation?.routeId) ?? baseline?.scores[0]
  const scenTop = result?.intel.scores.find((s) => s.id === result?.intel.recommendation?.routeId) ?? result?.intel.scores[0]
  const switched = !!baseTop && !!scenTop && baseTop.label !== scenTop.label

  return (
    <section className="rounded-xl border border-border bg-card/50 p-3">
      <div className="flex items-center justify-between gap-2">
<<<<<<< HEAD
        <div className="flex gap-1">
          {(["citizen", "planner"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[9px] uppercase tracking-widest transition-colors ${
                tab === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary"
              }`}
            >
              {t === "citizen" ? <FlaskConical className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
              {t === "citizen" ? "What-If" : "City Planner"}
            </button>
          ))}
        </div>
        {loading && <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">running…</span>}
      </div>

      {tab === "citizen" && (
        <>
=======
        <h2 className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-primary">
          <FlaskConical className="h-3.5 w-3.5" aria-hidden /> Route what-if
        </h2>
        {loading && <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">running…</span>}
      </div>

>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
      <p className="mt-1 text-[10px] leading-snug text-pretty text-muted-foreground">
        Applies to your real A→B road route — blocked plans are re-routed by the routing engine.
      </p>

      {!ready && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Set A and B to run a scenario
        </p>
      )}

<<<<<<< HEAD
      {eventDriven && (
        <div className="mt-2 rounded-lg border border-primary/40 bg-primary/5 p-2 font-mono text-[10px] text-primary">
          <p>🎪 Event-driven rerouting active</p>
          <p className="mt-0.5 text-muted-foreground">Routes are being re-ranked to avoid the event zone. Switch scenario or set to Normal to override.</p>
        </div>
      )}

=======
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
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

<<<<<<< HEAD
      {scenario.type !== "none" && scenario.type !== "closure" && (
        <div className="mt-2.5">
          {scenarioPin ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/5 px-2.5 py-1.5">
              <span className="font-mono text-[9px] text-primary">
                📍 {scenarioPin.lat.toFixed(4)}, {scenarioPin.lon.toFixed(4)}
              </span>
              <button
                type="button"
                onClick={onClearPin}
                className="font-mono text-[9px] text-muted-foreground hover:text-destructive"
              >
                × clear
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onPlacePin}
              disabled={!ready}
              className="w-full rounded-lg border border-dashed border-primary/40 bg-primary/5 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-wider text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-40"
            >
              📍 Place incident on map
            </button>
          )}
        </div>
      )}

=======
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
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
<<<<<<< HEAD
        </>
      )}

      {tab === "planner" && (
        <PlannerTab
          simulationResult={simulationResult}
          onClosurePoints={onClosurePoints}
          closurePoints={closurePoints}
        />
      )}
=======
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
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
<<<<<<< HEAD

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radius = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatClock(value: string): string {
  if (Number.isNaN(Date.parse(value))) return "--:--"
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function PlannerTab({
  simulationResult,
  onClosurePoints,
  closurePoints,
}: {
  simulationResult?: EventSimulationResponse | null
  onClosurePoints?: (points: [{ lat: number; lng: number }, { lat: number; lng: number }] | null) => void
  closurePoints?: [{ lat: number; lng: number }, { lat: number; lng: number }] | null
}) {
  const isNearEvent = (() => {
    if (!simulationResult || !closurePoints) return false
    const midLat = (closurePoints[0].lat + closurePoints[1].lat) / 2
    const midLng = (closurePoints[0].lng + closurePoints[1].lng) / 2
    return haversineM(midLat, midLng, simulationResult.event.lat, simulationResult.event.lng) <= simulationResult.event.impactRadiusMeters * 2
  })()

  return (
    <div className="mt-2.5 space-y-2.5">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">🏙 City Planner Mode</p>
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
          Mark a road closure by clicking two endpoints on the map, then compare the impact against the current event simulation.
        </p>
      </div>

      {closurePoints ? (
        <div className="rounded-lg border border-border bg-background/50 p-2">
          <p className="font-mono text-[9px] text-foreground">
            ✓ Closure marked: [{closurePoints[0].lat.toFixed(4)}, {closurePoints[0].lng.toFixed(4)}] → [{closurePoints[1].lat.toFixed(4)}, {closurePoints[1].lng.toFixed(4)}]
          </p>
          <button
            type="button"
            onClick={() => onClosurePoints?.(null)}
            className="mt-2 w-full rounded-lg border border-border bg-card px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            × Clear Closure
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onClosurePoints?.(null)}
          className="w-full rounded-lg border border-destructive/60 bg-destructive/10 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-destructive hover:bg-destructive/15"
        >
          ✏ Mark Road Closure on Map
        </button>
      )}

      {!simulationResult ? (
        <p className="rounded-lg border border-border bg-background/50 p-2 font-mono text-[10px] text-muted-foreground">
          Run an event simulation first to compare closure impact.
        </p>
      ) : closurePoints ? (
        <div className={`rounded-lg border p-3 ${isNearEvent ? "border-destructive/50 bg-destructive/5" : "border-green-500/40 bg-green-500/5"}`}>
          <h3 className={`font-mono text-[10px] uppercase tracking-widest ${isNearEvent ? "text-destructive" : "text-green-400"}`}>
            Closure vs Event Simulation
          </h3>
          <p className="mt-2 text-[10px] text-muted-foreground">Event: <span className="text-foreground">{simulationResult.event.name}</span></p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Peak: {simulationResult.hotspot?.severityLabel ?? "Low"} at {formatClock(simulationResult.peakAt)}
          </p>
          <p className={`mt-2 font-mono text-[10px] font-bold ${isNearEvent ? "text-red-400" : "text-green-400"}`}>
            {isNearEvent ? "HIGH RISK" : "LOW RISK"}
          </p>
          <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
            {isNearEvent
              ? "Adding a road closure during this event is high risk — both disruptions overlap in the same area."
              : "Closure is outside the event impact zone. Should not cause compounded congestion."}
          </p>
          <p className="mt-2 border-t border-border/60 pt-2 text-[10px] text-foreground">
            Recommended: Delay the closure until after {formatClock(simulationResult.event.endTime)} when the event disperses.
          </p>
        </div>
      ) : null}
    </div>
  )
}
=======
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
