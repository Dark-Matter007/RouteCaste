"use client"

import type { ForecastPoint } from "@/lib/types"

type Props = { forecast: ForecastPoint[]; source?: "model" | "heuristic" }

function barColor(c: number): string {
  if (c < 0.4) return "#22d3ee"
  if (c < 0.65) return "#facc15"
  return "#f43f5e"
}

export function ForecastStrip({ forecast, source = "heuristic" }: Props) {
  const isModel = source === "model"
  const max = Math.max(0.6, ...forecast.map((f) => f.congestion))
  const trend =
    forecast.length >= 2 ? forecast[forecast.length - 1].congestion - forecast[0].congestion : 0

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <h2 className="font-mono text-xs uppercase tracking-widest text-primary">Traffic forecast</h2>
          <span
            className="rounded-full border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider"
            style={{
              borderColor: isModel ? "#22d3ee" : "var(--color-border)",
              color: isModel ? "#22d3ee" : "var(--color-muted-foreground)",
            }}
          >
            {isModel ? "AI model" : "Heuristic"}
          </span>
        </span>
        <span
          className="font-mono text-[10px] uppercase tracking-wider"
          style={{ color: trend > 0.02 ? "#f43f5e" : trend < -0.02 ? "#22d3ee" : "var(--color-muted-foreground)" }}
        >
          {trend > 0.02 ? "Rising" : trend < -0.02 ? "Easing" : "Stable"}
        </span>
      </div>

      <div className="flex items-end gap-1.5" style={{ height: 72 }}>
        {forecast.map((f) => (
          <div key={f.step} className="flex h-full flex-1 flex-col items-center gap-1">
            <div className="relative w-full flex-1">
              <div
                className="absolute bottom-0 w-full rounded-sm transition-all"
                style={{
                  height: `${Math.max(4, (f.congestion / max) * 100)}%`,
                  backgroundColor: barColor(f.congestion),
                  opacity: 0.85,
                }}
              />
            </div>
            <span className="font-mono text-[9px] text-muted-foreground">+{f.step}m</span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground text-pretty">
        {isModel
          ? `Trained ONNX model projection of city congestion over the next ${forecast.length} minutes.`
          : `Heuristic projection of city congestion over the next ${forecast.length} minutes. Train a model in /ml to activate the AI forecast.`}
      </p>
    </section>
  )
}
