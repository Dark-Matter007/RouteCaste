"use client"

import type { CityMetrics } from "@/lib/types"

type Props = {
  baseMetrics: CityMetrics
  scenMetrics: CityMetrics
  baseAvgTravel: number
  scenAvgTravel: number
}

type Row = {
  label: string
  base: number
  scen: number
  unit: string
  // whether an INCREASE is bad (true) or good (false)
  higherIsWorse: boolean
}

function fmt(n: number) {
  return Number.isInteger(n) ? `${n}` : n.toFixed(1)
}

export function ComparisonTable({ baseMetrics, scenMetrics, baseAvgTravel, scenAvgTravel }: Props) {
  const rows: Row[] = [
    { label: "Avg arrival", base: baseAvgTravel, scen: scenAvgTravel, unit: "min", higherIsWorse: true },
    { label: "Avg speed", base: baseMetrics.avgSpeedKmh, scen: scenMetrics.avgSpeedKmh, unit: "km/h", higherIsWorse: false },
    {
      label: "Congestion",
      base: Math.round(baseMetrics.congestionIndex * 100),
      scen: Math.round(scenMetrics.congestionIndex * 100),
      unit: "%",
      higherIsWorse: true,
    },
    { label: "Air quality", base: baseMetrics.aqi, scen: scenMetrics.aqi, unit: "AQI", higherIsWorse: true },
    {
      label: "Emergency resp.",
      base: baseMetrics.ambulanceResponseMin,
      scen: scenMetrics.ambulanceResponseMin,
      unit: "min",
      higherIsWorse: true,
    },
    { label: "CO2 output", base: baseMetrics.co2Kg, scen: scenMetrics.co2Kg, unit: "kg", higherIsWorse: true },
  ]

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-mono text-xs uppercase tracking-widest text-primary">Impact vs baseline</h2>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-secondary font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 font-medium">Metric</th>
              <th className="px-2 py-2 text-right font-medium">Base</th>
              <th className="px-2 py-2 text-right font-medium">Now</th>
              <th className="px-3 py-2 text-right font-medium">Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const delta = r.scen - r.base
              const worse = r.higherIsWorse ? delta > 0.05 : delta < -0.05
              const better = r.higherIsWorse ? delta < -0.05 : delta > 0.05
              const color = worse ? "#f43f5e" : better ? "#22d3ee" : "var(--color-muted-foreground)"
              const sign = delta > 0 ? "+" : ""
              return (
                <tr key={r.label} className="border-t border-border text-xs">
                  <td className="px-3 py-2 text-foreground">{r.label}</td>
                  <td className="px-2 py-2 text-right font-mono text-muted-foreground">{fmt(r.base)}</td>
                  <td className="px-2 py-2 text-right font-mono text-foreground">{fmt(r.scen)}</td>
                  <td className="px-3 py-2 text-right font-mono" style={{ color }}>
                    {sign}
                    {fmt(delta)}
                    <span className="ml-0.5 text-[9px] text-muted-foreground">{r.unit}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
