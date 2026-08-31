"use client"

import type { ScenarioType } from "@/lib/types"

type Scenario = { type: ScenarioType; intensity: number }

type Props = {
  scenario: Scenario
  onScenario: (s: Scenario) => void
}

const SCENARIOS: { id: ScenarioType; label: string; desc: string }[] = [
  { id: "none", label: "Normal", desc: "Baseline traffic, no disruption" },
  { id: "closure", label: "Road closure", desc: "A key corridor is shut down" },
  { id: "accident", label: "Accident", desc: "Multi-vehicle crash spikes local congestion" },
  { id: "surge", label: "Traffic surge", desc: "City-wide demand spike (rush hour)" },
  { id: "weather", label: "Severe weather", desc: "Rain/snow slows every road" },
]

export function ScenarioPanel({ scenario, onScenario }: Props) {
  const active = SCENARIOS.find((s) => s.id === scenario.type) ?? SCENARIOS[0]

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-mono text-xs uppercase tracking-widest text-primary">Scenario simulator</h2>
        <p className="mt-1 text-xs text-muted-foreground text-pretty">
          Inject a disruption and watch routes and metrics re-plan in real time.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {SCENARIOS.map((s) => {
          const on = scenario.type === s.id
          return (
            <button
              key={s.id}
              onClick={() => onScenario({ ...scenario, type: s.id })}
              className={`rounded-lg border px-2.5 py-2 text-left transition-colors ${
                on ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <span className={`text-xs font-medium ${on ? "text-primary" : "text-foreground"}`}>{s.label}</span>
            </button>
          )
        })}
      </div>

      <p className="text-[11px] text-muted-foreground text-pretty">{active.desc}</p>

      {scenario.type !== "none" && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm text-foreground">Severity</label>
            <span className="font-mono text-xs text-primary">{Math.round(scenario.intensity * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={scenario.intensity}
            onChange={(e) => onScenario({ ...scenario, intensity: Number(e.target.value) })}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-[var(--color-primary)]"
            aria-label="Scenario severity"
          />
        </div>
      )}
    </section>
  )
}
