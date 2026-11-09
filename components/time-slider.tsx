"use client"

import { Clock } from "lucide-react"
import type { EventSimulationResponse } from "@/lib/types"

type TimeSliderProps = {
  value: number | null
  onChange: (value: number | null) => void
  simulationResult?: EventSimulationResponse | null
}

function formatHour(value: number) {
  const hour = Math.floor(value)
  const minute = Math.round((value % 1) * 60)
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function trafficContext(hour: number) {
  if (hour < 6) return "Late night — minimal traffic"
  if (hour < 10) return "Morning rush hour"
  if (hour < 12) return "Mid morning — light traffic"
  if (hour < 14) return "Lunch hour — moderate"
  if (hour < 17) return "Afternoon — light traffic"
  if (hour < 20) return "Evening rush hour"
  return "Night — light traffic"
}

/** Convert an ISO timestamp to fractional hours (e.g. 18.5 = 18:30). */
function isoToHour(iso: string): number {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? 0 : date.getHours() + date.getMinutes() / 60
}

/** Get interpolated congestion for a given hour from the forecast. */
function congestionAtHour(
  hour: number,
  forecast: EventSimulationResponse["forecast"],
  startHour: number,
): number {
  if (forecast.length === 0) return 0
  const totalMinutes = (hour - startHour) * 60
  const sorted = [...forecast].sort((a, b) => a.minutesFromStart - b.minutesFromStart)
  if (totalMinutes <= sorted[0].minutesFromStart) return sorted[0].congestion
  if (totalMinutes >= sorted[sorted.length - 1].minutesFromStart) return sorted[sorted.length - 1].congestion
  const index = sorted.findIndex((point) => point.minutesFromStart > totalMinutes)
  const lower = sorted[index - 1]
  const upper = sorted[index]
  const fraction = (totalMinutes - lower.minutesFromStart) / (upper.minutesFromStart - lower.minutesFromStart)
  return lower.congestion + fraction * (upper.congestion - lower.congestion)
}

function congestionColor(value: number) {
  return value < 0.35 ? "#22c55e" : value < 0.6 ? "#facc15" : value < 0.8 ? "#f97316" : "#f43f5e"
}

function eventPhaseLabel(hour: number, startHour: number, peakHour: number, endHour: number): string {
  if (hour < startHour - 0.5) return "Pre-event — normal traffic"
  if (hour < startHour) return "Event approaching — crowds arriving"
  if (hour < peakHour - 0.25) return "Event opening — congestion building"
  if (hour < peakHour + 0.25) return "⚠ Peak congestion — event in full swing"
  if (hour < endHour) return "Event ongoing — traffic elevated"
  if (hour < endHour + 0.75) return "Event dispersal — crowds leaving"
  return "Post-event — traffic normalising"
}

export function TimeSlider({ value, onChange, simulationResult }: TimeSliderProps) {
  const activeHour = value ?? 0
  const hasEvent = !!simulationResult && value !== null
  const startHour = simulationResult ? isoToHour(simulationResult.event.startTime) : 0
  const endHour = simulationResult ? isoToHour(simulationResult.event.endTime) : 0
  const peakHour = simulationResult ? isoToHour(simulationResult.peakAt) : 0
  const liveCongest = hasEvent
    ? congestionAtHour(activeHour, simulationResult!.forecast, startHour)
    : null

  return (
    <section className="rounded-xl border border-border bg-card/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-primary">
          <Clock className="h-3.5 w-3.5" aria-hidden /> Traffic Time
        </h2>
        <span className={`font-mono text-[10px] uppercase tracking-wider ${value === null ? "text-green-400" : "text-primary"}`}>
          {value === null ? "Live" : formatHour(value)}
        </span>
      </div>

      <div className="mt-2 flex gap-1">
        <button
          type="button"
          aria-pressed={value === null}
          onClick={() => onChange(null)}
          className={`flex-1 rounded-lg border px-2 py-1 font-mono text-[9px] uppercase tracking-widest transition-colors ${value === null ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary"}`}
        >
          Live
        </button>
        <button
          type="button"
          aria-pressed={value !== null}
          onClick={() => {
            const now = new Date()
            onChange(now.getHours() + now.getMinutes() / 60)
          }}
          className={`flex-1 rounded-lg border px-2 py-1 font-mono text-[9px] uppercase tracking-widest transition-colors ${value !== null ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary"}`}
        >
          Simulate
        </button>
      </div>

      {value !== null && (
        <div className="mt-2">
          <label htmlFor="traffic-time" className="sr-only">Simulated time of day</label>
          <input
            id="traffic-time"
            type="range"
            min={0}
            max={23.99}
            step={0.25}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            className="w-full accent-[var(--color-primary)]"
          />
          <div className="flex justify-between font-mono text-[8px] text-muted-foreground">
            <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:45</span>
          </div>
          {hasEvent && liveCongest !== null ? (
            <div className="mt-2 space-y-1">
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="absolute inset-y-0 opacity-30"
                  style={{
                    left: `${(startHour / 24) * 100}%`,
                    width: `${((endHour - startHour) / 24) * 100}%`,
                    backgroundColor: "#22d3ee",
                  }}
                />
                {simulationResult!.forecast.map((point, index, forecast) => {
                  const segmentStart = startHour + point.minutesFromStart / 60
                  const segmentEnd = index < forecast.length - 1
                    ? startHour + forecast[index + 1].minutesFromStart / 60
                    : endHour
                  return (
                    <div
                      key={point.minutesFromStart}
                      className="absolute inset-y-0"
                      style={{
                        left: `${(segmentStart / 24) * 100}%`,
                        width: `${((segmentEnd - segmentStart) / 24) * 100}%`,
                        backgroundColor: congestionColor(point.congestion),
                        opacity: 0.85,
                      }}
                    />
                  )
                })}
                <div
                  className="absolute inset-y-0 w-px"
                  style={{ left: `${(peakHour / 24) * 100}%`, backgroundColor: "#f43f5e" }}
                />
              </div>
              <div className="flex justify-between font-mono text-[8px] text-muted-foreground">
                <span>{simulationResult!.event.startTime.slice(11, 16)} start</span>
                <span>{simulationResult!.peakAt.slice(11, 16)} peak</span>
                <span>{simulationResult!.event.endTime.slice(11, 16)} end</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: congestionColor(liveCongest) }} />
                <p className="font-mono text-[9px]" style={{ color: congestionColor(liveCongest) }}>
                  {eventPhaseLabel(activeHour, startHour, peakHour, endHour)}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-center font-mono text-[9px] text-muted-foreground">
              {trafficContext(activeHour)}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
