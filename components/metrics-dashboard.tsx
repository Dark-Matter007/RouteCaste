"use client"

import type { CityMetrics } from "@/lib/types"

type Props = { metrics: CityMetrics; avgTravelMin: number }

// AQI category color
function aqiColor(aqi: number): string {
  if (aqi <= 80) return "#22d3ee"
  if (aqi <= 130) return "#facc15"
  return "#f43f5e"
}
function congColor(c: number): string {
  if (c < 0.4) return "#22d3ee"
  if (c < 0.65) return "#facc15"
  return "#f43f5e"
}

export function MetricsDashboard({ metrics, avgTravelMin }: Props) {
  const cards = [
    { label: "Avg speed", value: `${metrics.avgSpeedKmh}`, unit: "km/h", color: "#67e8f9" },
    {
      label: "Congestion",
      value: `${Math.round(metrics.congestionIndex * 100)}`,
      unit: "%",
      color: congColor(metrics.congestionIndex),
    },
    { label: "Avg arrival", value: `${avgTravelMin}`, unit: "min", color: "#67e8f9" },
    { label: "Air quality", value: `${metrics.aqi}`, unit: "AQI", color: aqiColor(metrics.aqi) },
    { label: "Emergency", value: `${metrics.ambulanceResponseMin}`, unit: "min", color: "#67e8f9" },
    {
      label: "Incidents",
      value: `${metrics.activeIncidents}`,
      unit: "active",
      color: metrics.activeIncidents ? "#f43f5e" : "#67e8f9",
    },
    { label: "CO2", value: `${metrics.co2Kg}`, unit: "kg", color: "#67e8f9" },
    { label: "Fuel", value: `${metrics.fuelL}`, unit: "L", color: "#67e8f9" },
  ]

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-mono text-xs uppercase tracking-widest text-primary">Live city metrics</h2>
      <div className="grid grid-cols-2 gap-2">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-card p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.label}</p>
            <p className="mt-1 flex items-baseline gap-1 font-mono">
              <span className="text-lg font-semibold" style={{ color: c.color }}>
                {c.value}
              </span>
              <span className="text-[10px] text-muted-foreground">{c.unit}</span>
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
