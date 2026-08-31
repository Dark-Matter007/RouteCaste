"use client"

import type { PlanResponse } from "@/lib/types"

type Weights = { time: number; distance: number; congestion: number }

type Props = {
  data: PlanResponse
  weights: Weights
  onWeights: (w: Weights) => void
  selectedInviteeId: string | null
  onSelect: (id: string | null) => void
  areaNames?: Record<string, string>
}

function pct(n: number, total: number) {
  if (total <= 0) return 0
  return Math.round((n / total) * 100)
}

export function ControlPanel({ data, weights, onWeights, selectedInviteeId, onSelect, areaNames = {} }: Props) {
  const total = weights.time + weights.distance + weights.congestion

  const sliders: { key: keyof Weights; label: string; hint: string }[] = [
    { key: "time", label: "Travel time", hint: "Prefer faster arrival" },
    { key: "distance", label: "Distance", hint: "Prefer shorter trips" },
    { key: "congestion", label: "Avoid traffic", hint: "Steer around jams" },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Optimization weights */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-widest text-primary">Optimization priorities</h2>
          <p className="mt-1 text-xs text-muted-foreground text-pretty">
            The recommended route minimizes a weighted blend of these factors.
          </p>
        </div>
        {sliders.map((s) => (
          <div key={s.key} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm text-foreground">{s.label}</label>
              <span className="font-mono text-xs text-primary">{pct(weights[s.key], total)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={weights[s.key]}
              onChange={(e) => onWeights({ ...weights, [s.key]: Number(e.target.value) })}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-[var(--color-primary)]"
              aria-label={s.label}
            />
            <span className="text-[11px] text-muted-foreground">{s.hint}</span>
          </div>
        ))}
      </section>

      {/* Invitee routes */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-widest text-primary">
            Invitee routes ({data.plans.length})
          </h2>
          <button
            onClick={() => onSelect(null)}
            className={`rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              selectedInviteeId === null
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Show all
          </button>
        </div>

        <ul className="flex flex-col gap-2">
          {data.plans.map((p) => {
            const r = p.recommended
            const active = selectedInviteeId === p.invitee.id
            return (
              <li key={p.invitee.id}>
                <button
                  onClick={() => onSelect(active ? null : p.invitee.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {areaNames[p.invitee.id] ?? (
                        <span className="text-muted-foreground">Locating area…</span>
                      )}
                    </span>
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary shadow-[0_0_6px_var(--color-primary)]" />
                  </div>
                  {r && (
                    <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[11px]">
                      <Stat label="ETA" value={`${r.totalTimeMin.toFixed(0)}m`} />
                      <Stat label="Dist" value={`${r.totalDistanceKm.toFixed(1)}km`} />
                      <Stat label="Traffic" value={`${Math.round(r.avgCongestion * 100)}%`} />
                    </div>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-primary">{value}</span>
    </div>
  )
}
