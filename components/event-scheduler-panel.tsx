"use client"

import { useEffect, useState } from "react"
import { CalendarDays } from "lucide-react"
import { GUNTUR_PLACES } from "@/lib/guntur-places"
import type { EventSimulationResponse, EventType } from "@/lib/types"

type EventSchedulerPanelProps = {
  eventPin: { lat: number; lng: number; name?: string } | null
  onEventPin: (pin: { lat: number; lng: number; name: string; radiusMeters: number } | null) => void
  routes: { id: string; label: string; distanceMeters: number; durationSeconds: number; latLngs: [number, number][] }[]
  onSimulationResult: (result: EventSimulationResponse | null) => void
}

const EVENT_TYPES: { id: EventType; label: string }[] = [
  { id: "festival", label: "Festival" },
  { id: "sports", label: "Sports" },
  { id: "concert", label: "Concert" },
  { id: "protest", label: "Protest" },
  { id: "construction", label: "Construction" },
  { id: "vip_visit", label: "VIP Visit" },
  { id: "public_gathering", label: "Gathering" },
  { id: "other", label: "Other" },
]

function congestionColor(value: number) {
  return value < 0.35 ? "#22c55e" : value < 0.6 ? "#facc15" : value < 0.8 ? "#f97316" : "#f43f5e"
}

function today() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export function EventSchedulerPanel({ eventPin, onEventPin, routes, onSimulationResult }: EventSchedulerPanelProps) {
  const [eventName, setEventName] = useState("")
  const [eventType, setEventType] = useState<EventType>("festival")
  const [locationName, setLocationName] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [date, setDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [attendance, setAttendance] = useState(5000)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<EventSimulationResponse | null>(null)

  useEffect(() => {
    setDate(today())
    setStartTime("18:00")
    setEndTime("22:00")
    setAttendance(5000)
    setResult(null)
    setError(null)
    onSimulationResult(null)
  }, [eventPin?.lat, eventPin?.lng, onSimulationResult])

  useEffect(() => {
    if (eventPin?.name && eventPin.name !== "Event Location") setEventName(eventPin.name)
  }, [eventPin?.name])

  async function simulate() {
    if (!eventPin || !eventName.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    onSimulationResult(null)

    const startIso = date && startTime ? `${date}T${startTime}:00` : new Date().toISOString()
    const endIso = date && endTime ? `${date}T${endTime}:00` : new Date(Date.now() + 3 * 3600_000).toISOString()
    const routePayload = routes.map((route) => ({
      id: route.id,
      label: route.label,
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      samplePoints: route.latLngs
        .filter((_, index) => index % 5 === 0 || index === route.latLngs.length - 1)
        .map(([lat, lng]) => ({ lat, lng })),
    }))

    try {
      const response = await fetch("/api/event/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: {
            name: eventName.trim(),
            type: eventType,
            lat: eventPin.lat,
            lng: eventPin.lng,
            locationName: locationName.trim() || `${eventPin.lat.toFixed(4)}, ${eventPin.lng.toFixed(4)}`,
            startTime: startIso,
            endTime: endIso,
            attendance,
          },
          routes: routePayload,
        }),
      })
      const data = (await response.json()) as EventSimulationResponse & { error?: string }
      if (!response.ok) throw new Error(data.error || "Simulation failed")
      setResult(data)
      onSimulationResult(data)
      onEventPin({ ...eventPin, name: eventName.trim(), radiusMeters: data.event.impactRadiusMeters })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Simulation failed. Check your connection.")
    } finally {
      setLoading(false)
    }
  }

  const impact = attendance < 1000
    ? { label: "Low impact", color: "text-green-400" }
    : attendance <= 10000
      ? { label: "Moderate impact", color: "text-yellow-400" }
      : attendance <= 50000
        ? { label: "High impact", color: "text-orange-400" }
        : { label: "Severe impact", color: "text-red-400" }

  return (
    <section className="rounded-xl border border-border bg-card/50 p-3">
      <h2 className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-primary">
        <CalendarDays className="h-3.5 w-3.5" aria-hidden /> Event Scheduler
        <span className="ml-auto rounded-full border border-amber-400/30 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-amber-400/80">
          AI Simulated
        </span>
      </h2>

      {!eventPin ? (
        <p className="mt-3 font-mono text-[10px] text-muted-foreground">📍 Click “Place Event” then tap the map to choose a location</p>
      ) : (
        <div className="mt-3 space-y-3 font-mono text-xs">
          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground">
            Event Name
            <input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="e.g. Sankranthi Festival" className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground" />
          </label>

          <div className="relative">
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground">
              Location Name
              <input
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="e.g. Guntur Bus Stand"
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground"
              />
              <span className="mt-1 block normal-case text-muted-foreground">{eventPin.lat.toFixed(4)}°N, {eventPin.lng.toFixed(4)}°E</span>
            </label>
            {showSuggestions && (
              <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                {GUNTUR_PLACES
                  .filter((place) => locationName.trim() === "" || place.name.toLowerCase().includes(locationName.toLowerCase()))
                  .map((place) => (
                    <button
                      key={place.id}
                      type="button"
                      onMouseDown={() => {
                        setLocationName(place.name)
                        setShowSuggestions(false)
                        onEventPin({ lat: place.lat, lng: place.lng, name: place.name, radiusMeters: 500 })
                      }}
                      className="flex w-full flex-col px-2 py-1.5 text-left hover:bg-primary/10"
                    >
                      <span className="font-mono text-[10px] text-foreground">{place.name}</span>
                      <span className="font-mono text-[9px] text-muted-foreground">{place.description}</span>
                    </button>
                  ))}
                {GUNTUR_PLACES.filter((place) => locationName.trim() === "" || place.name.toLowerCase().includes(locationName.toLowerCase())).length === 0 && (
                  <p className="px-2 py-2 font-mono text-[10px] text-muted-foreground">No matching places — pin placed by map click</p>
                )}
              </div>
            )}
            </div>

          <fieldset>
            <legend className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Event Type</legend>
            <div className="flex flex-wrap gap-1">
              {EVENT_TYPES.map((type) => (
                <button key={type.id} type="button" aria-pressed={eventType === type.id} onClick={() => setEventType(type.id)} className={`rounded-full border px-2 py-1 text-[9px] transition-colors ${eventType === type.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary"}`}>
                  {type.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-3 gap-2">
            <label className="text-[9px] uppercase tracking-wider text-muted-foreground">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-1 py-1 text-[10px] text-foreground" /></label>
            <label className="text-[9px] uppercase tracking-wider text-muted-foreground">From<input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-1 py-1 text-[10px] text-foreground" /></label>
            <label className="text-[9px] uppercase tracking-wider text-muted-foreground">To<input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-1 py-1 text-[10px] text-foreground" /></label>
          </div>

          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground">
            <span className="flex justify-between">Expected Attendance <span className="text-foreground">{attendance.toLocaleString()} people</span></span>
            <input type="range" min={100} max={100000} step={100} value={attendance} onChange={(e) => setAttendance(Number(e.target.value))} className="mt-1 w-full accent-[var(--color-primary)]" />
            <span className={`block text-right normal-case ${impact.color}`}>{impact.label}</span>
          </label>

          <button type="button" onClick={simulate} disabled={loading || !eventName.trim()} className="w-full rounded-lg border border-primary bg-primary px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "Simulating…" : "⚡ Simulate Traffic Impact"}
          </button>
          {error && <p role="alert" className="text-[10px] text-red-400">⚠ {error}</p>}

          {result && (
            <div className="space-y-3 border-t border-border pt-3">
              <div>
                <span className={`rounded-full border px-2 py-1 text-[9px] uppercase tracking-wider ${result.source === "model" ? "border-amber-400/50 text-amber-300" : "border-border text-muted-foreground"}`}>
                  {result.source === "model" ? "AI Simulated Estimate" : "Heuristic Estimate"}
                </span>
                <p className="mt-2 line-clamp-2 text-[9px] italic text-muted-foreground">{result.note.slice(0, 120)}{result.note.length > 120 ? "…" : ""}</p>
              </div>

              <div className="flex justify-between gap-2 text-[10px]">
                <span className="text-foreground">Peak at {Number.isNaN(Date.parse(result.peakAt)) ? "--:--" : new Date(result.peakAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="text-muted-foreground">{result.hotspot?.severityLabel ?? "No hotspot"}</span>
              </div>

              <div className="space-y-2">
                {result.routes.map((route) => {
                  const color = congestionColor(route.congestionDuring)
                  return <div key={route.routeId} className="rounded-lg border border-border/70 p-2 text-[10px]">
                    <div className="flex justify-between"><span className="truncate text-foreground">{route.label}</span>{route.recommended && <span aria-label="Recommended">⭐</span>}</div>
                    <p className="mt-1 text-muted-foreground">Base: {route.baseEtaMin.toFixed(1)}m → Event: {route.eventEtaMin.toFixed(1)}m ({route.etaDeltaMin > 0 ? "+" : ""}{route.etaDeltaMin.toFixed(1)} min)</p>
                    <div className="mt-1 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded bg-muted"><div className="h-full" style={{ width: `${Math.max(0, Math.min(100, route.congestionDuring * 100))}%`, backgroundColor: color }} /></div><span style={{ color }}>{route.congestionClass}</span></div>
                  </div>
                })}
              </div>

              <div>
                <p className="mb-1 text-[9px] uppercase tracking-widest text-muted-foreground">Congestion Forecast</p>
                <div className="flex h-20 items-end gap-1 border-b border-l border-border px-1">
                  {result.forecast.map((point, index) => <div key={`${point.minutesFromStart}-${index}`} title={`${point.label}: ${Math.round(point.congestion * 100)}%`} className="min-w-0 flex-1 rounded-t-sm" style={{ height: `${Math.max(4, Math.min(100, point.congestion * 100))}%`, backgroundColor: congestionColor(point.congestion) }} />)}
                </div>
                {result.forecast.length > 0 && <div className="flex justify-between text-[8px] text-muted-foreground"><span>{result.forecast[0].minutesFromStart} min</span><span>{result.forecast[Math.floor((result.forecast.length - 1) / 2)].minutesFromStart} min</span><span>{result.forecast[result.forecast.length - 1].minutesFromStart} min</span></div>}
              </div>

              <button type="button" onClick={() => { setResult(null); onSimulationResult(null) }} className="w-full rounded-lg border border-border bg-card px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">× Clear Simulation</button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
