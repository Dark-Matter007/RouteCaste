"use client"

import { useEffect, useRef, useState } from "react"
import {
  Car,
  PersonStanding,
  Bike,
  Loader2,
  MapPin,
  X,
  ArrowUpDown,
  CornerUpRight,
  LocateFixed,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Play,
  GripVertical,
} from "lucide-react"
<<<<<<< HEAD
import type { NavigationErrorWithActions, NavPoint, NavRoute, TravelMode } from "@/hooks/use-navigation-route"
import type { GeoStatus } from "@/hooks/use-geolocation"
import type { NavState } from "@/hooks/use-nav-session"
import { GUNTUR_PLACES } from "@/lib/guntur-places"
import type { EventSimulationResponse } from "@/lib/types"
=======
import type { NavPoint, NavRoute, TravelMode } from "@/hooks/use-navigation-route"
import type { GeoStatus } from "@/hooks/use-geolocation"
import type { NavState } from "@/hooks/use-nav-session"
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975

type GeoPlace = {
  id: string
  name: string
  address: string
  lat: number
  lon: number
  type: string
  region?: string
  country?: string
}

const MODES: { id: TravelMode; label: string; Icon: typeof Car }[] = [
  { id: "driving", label: "Drive", Icon: Car },
  { id: "walking", label: "Walk", Icon: PersonStanding },
  { id: "cycling", label: "Cycle", Icon: Bike },
]

function km(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}
function mins(s: number) {
  const total = Math.round(s / 60)
  if (total < 60) return `${total} min`
  return `${Math.floor(total / 60)} h ${total % 60} min`
}
<<<<<<< HEAD
function emissions(distanceMeters: number, congestionLoad: number) {
  const distKm = distanceMeters / 1000
  const multiplier = 1 + Math.min(1, congestionLoad) * 0.6
  const co2 = distKm * 0.21 * multiplier
  const fuel = distKm * 0.08 * multiplier
  return {
    co2: co2 < 1 ? `${Math.round(co2 * 1000)} g` : `${co2.toFixed(1)} kg`,
    fuel: `${fuel.toFixed(2)} L`,
  }
}
=======
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975

/** Search-as-you-type place field backed by the server geocoder. */
function PlaceField({
  value,
  placeholder,
  dotClass,
  onPick,
  onClear,
}: {
  value: NavPoint | null
  placeholder: string
  dotClass: string
  onPick: (p: NavPoint) => void
  onClear: () => void
}) {
  const [q, setQ] = useState("")
  const [results, setResults] = useState<GeoPlace[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Reflect externally-set points (e.g. picked from the map).
  useEffect(() => {
    if (value?.label) setQ(value.label)
    if (!value) setQ("")
  }, [value])

  useEffect(() => {
    if (q.trim().length < 3 || q === value?.label) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    setErr(null)
    const t = setTimeout(async () => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}&limit=6`, { signal: ctrl.signal })
        const body = await res.json()
        if (!res.ok) throw new Error(body?.error || "Search failed")
        setResults(body.places ?? [])
        setOpen(true)
        if ((body.places ?? []).length === 0) setErr("No results found")
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setResults([])
          setErr((e as Error).message)
        }
      } finally {
        setLoading(false)
      }
    }, 380)
    return () => clearTimeout(t)
  }, [q, value?.label])

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-2.5 py-1.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" aria-hidden />}
        {!loading && (q || value) && (
          <button
            onClick={() => {
              setQ("")
              setResults([])
              onClear()
            }}
            aria-label="Clear"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {err && !open && <p className="mt-1 px-1 font-mono text-[9px] text-destructive">{err}</p>}

      {open && results.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-xl backdrop-blur-md">
          {results.map((p) => (
            <li key={p.id}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const label = p.name || p.address.split(",")[0]
                  onPick({ lat: p.lat, lon: p.lon, label })
                  setQ(label)
                  setOpen(false)
                }}
                className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-secondary"
              >
                <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-primary" aria-hidden />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[11px] text-foreground">{p.name}</span>
                  <span className="truncate font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                    {p.type} · {[p.region, p.country].filter(Boolean).join(", ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

type Props = {
  from: NavPoint | null
  to: NavPoint | null
  onFrom: (p: NavPoint | null) => void
  onTo: (p: NavPoint | null) => void
  mode: TravelMode
  onMode: (m: TravelMode) => void
  routes: NavRoute[]
  activeRouteId: string | null
  onActiveRoute: (id: string) => void
  loading: boolean
<<<<<<< HEAD
  error: NavigationErrorWithActions | null
  isFromCache?: boolean
=======
  error: string | null
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
  engine?: string
  trafficNote?: string
  /** Multi-stop support — ordered intermediate stops. */
  waypoints: NavPoint[]
  onWaypoints: (w: NavPoint[]) => void
  gpsStatus: GeoStatus
  gpsMessage: string | null
  onUseMyLocation: () => void
  navState: NavState
  onStartNav: () => void
<<<<<<< HEAD
  simulationResult?: EventSimulationResponse | null
=======
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
}

export function NavigationPanel({
  from,
  to,
  onFrom,
  onTo,
  mode,
  onMode,
  routes,
  activeRouteId,
  onActiveRoute,
  loading,
  error,
<<<<<<< HEAD
  isFromCache = false,
=======
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
  engine,
  trafficNote,
  waypoints,
  onWaypoints,
  gpsStatus,
  gpsMessage,
  onUseMyLocation,
  navState,
  onStartNav,
<<<<<<< HEAD
  simulationResult = null,
}: Props) {
  const [showSteps, setShowSteps] = useState(true)
  const [showLandmarks, setShowLandmarks] = useState(false)
  const [landmarkTarget, setLandmarkTarget] = useState<"from" | "to">("to")
  const [cacheNoticeDismissed, setCacheNoticeDismissed] = useState(false)
  const active = routes.find((r) => r.id === activeRouteId) ?? routes[0] ?? null

  useEffect(() => {
    if (!isFromCache) setCacheNoticeDismissed(false)
  }, [isFromCache])

=======
}: Props) {
  const [showSteps, setShowSteps] = useState(true)
  const active = routes.find((r) => r.id === activeRouteId) ?? routes[0] ?? null

>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
  return (
    <section className="rounded-xl border border-border bg-card/50 p-3">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-widest text-primary">Navigation</h2>
        {engine && (
          <span className="rounded-full border border-primary/40 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-primary">
            {engine} · osm
          </span>
        )}
      </div>

      {/* From / To */}
      <div className="mt-3 flex flex-col gap-1.5">
        <PlaceField
          value={from}
          placeholder="Choose starting point"
          dotClass="bg-primary"
          onPick={onFrom}
          onClear={() => onFrom(null)}
        />
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          <button
            onClick={onUseMyLocation}
            aria-label="Use my current location as start"
            className="flex items-center gap-1 rounded-md border border-primary/50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary transition-colors hover:bg-primary/10"
          >
            {gpsStatus === "locating" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <LocateFixed className="h-3 w-3" />
            )}
            My location
          </button>
          <button
            onClick={() => {
              const a = from
              onFrom(to)
              onTo(a)
              onWaypoints([...waypoints].reverse())
            }}
            disabled={!from && !to}
            aria-label="Swap origin and destination"
            className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-40"
          >
            <ArrowUpDown className="h-3 w-3" /> Swap
          </button>
          <button
            onClick={() => onWaypoints([...waypoints, { lat: 0, lon: 0, label: "" }])}
            aria-label="Add an intermediate stop"
            className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          >
            <Plus className="h-3 w-3" /> Stop
          </button>
        </div>

        {gpsMessage && (
          <p className="px-1 font-mono text-[9px] text-destructive">{gpsMessage}</p>
        )}

        {/* Intermediate stops: A -> stop 1 -> ... -> B */}
        {waypoints.map((w, i) => (
          <div key={i} className="flex items-center gap-1">
            <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <PlaceField
                value={w.lat || w.lon ? w : null}
                placeholder={`Stop ${i + 1}`}
                dotClass="bg-muted-foreground"
                onPick={(p) => {
                  const next = [...waypoints]
                  next[i] = p
                  onWaypoints(next)
                }}
                onClear={() => onWaypoints(waypoints.filter((_, j) => j !== i))}
              />
            </div>
            <div className="flex shrink-0 flex-col">
              <button
                onClick={() => {
                  if (i === 0) return
                  const next = [...waypoints]
                  ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
                  onWaypoints(next)
                }}
                disabled={i === 0}
                aria-label={`Move stop ${i + 1} up`}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                onClick={() => {
                  if (i === waypoints.length - 1) return
                  const next = [...waypoints]
                  ;[next[i + 1], next[i]] = [next[i], next[i + 1]]
                  onWaypoints(next)
                }}
                disabled={i === waypoints.length - 1}
                aria-label={`Move stop ${i + 1} down`}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
            <button
              onClick={() => onWaypoints(waypoints.filter((_, j) => j !== i))}
              aria-label={`Remove stop ${i + 1}`}
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        <PlaceField
          value={to}
          placeholder="Choose destination"
          dotClass="bg-accent ring-2 ring-primary/40"
          onPick={onTo}
          onClear={() => onTo(null)}
        />
      </div>

<<<<<<< HEAD
      <div className="mt-2">
        <button
          type="button"
          onClick={() => setShowLandmarks((visible) => !visible)}
          className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground hover:text-primary"
        >
          <MapPin className="h-3 w-3" aria-hidden /> Guntur landmarks {showLandmarks ? "−" : "+"}
        </button>
        {showLandmarks && (
          <div className="mt-2 space-y-1.5">
            <div className="flex gap-1">
              {(["from", "to"] as const).map((target) => (
                <button
                  key={target}
                  type="button"
                  onClick={() => setLandmarkTarget(target)}
                  className={`rounded-md border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider transition-colors ${
                    landmarkTarget === target
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary"
                  }`}
                >
                  Set as {target === "from" ? "Start" : "Destination"}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {GUNTUR_PLACES.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => {
                    const point: NavPoint = { lat: place.lat, lon: place.lng, label: place.name }
                    if (landmarkTarget === "from") onFrom(point)
                    else onTo(point)
                  }}
                  title={place.description}
                  className="rounded-full border border-border bg-background/60 px-2 py-0.5 font-mono text-[9px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                >
                  {place.name.split("(")[0].trim()}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

=======
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
      {/* Travel mode */}
      <div className="mt-3 flex gap-1 rounded-lg border border-border bg-background/60 p-0.5">
        {MODES.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onMode(id)}
            className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              mode === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {/* States */}
      {loading && (
        <p className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin text-primary" /> Calculating route…
        </p>
      )}
<<<<<<< HEAD
      {isFromCache && !cacheNoticeDismissed && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 font-mono text-[10px] text-amber-300">
          <span className="flex-shrink-0">📦</span>
          <span className="flex-1">Showing cached route — OSRM may be busy. Route is at most 10 min old.</span>
          <button
            type="button"
            aria-label="Dismiss cached route notice"
            onClick={() => setCacheNoticeDismissed(true)}
            className="opacity-60 hover:opacity-100"
          >
            ×
          </button>
        </div>
      )}
      {error && !loading && routes.length === 0 && (
        <div role="alert" className="mt-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3 font-mono text-[10px]">
          <p className="text-destructive">⚠ {error.message}</p>
          {error.code === "rate_limited" && (
            <p className="mt-1 text-muted-foreground">
              The public OSRM demo server has rate limits. On demo day, set ROUTING_URL in .env.local to a self-hosted instance.
            </p>
          )}
          <div className="mt-2 flex gap-2">
            {error.retryable && (
              <button
                type="button"
                onClick={error.retry}
                className="rounded-lg border border-primary bg-primary/10 px-3 py-1 text-primary hover:bg-primary/20"
              >
                ↻ Retry
              </button>
            )}
            <button
              type="button"
              onClick={error.clearError}
              className="rounded-lg border border-border px-3 py-1 text-muted-foreground hover:text-foreground"
            >
              × Dismiss
            </button>
          </div>
        </div>
=======
      {error && !loading && (
        <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-2 py-1.5 font-mono text-[10px] text-destructive">
          {error}
        </p>
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
      )}
      {!loading && !error && (!from || !to) && (
        <p className="mt-3 font-mono text-[10px] text-muted-foreground">Set a start and destination to route.</p>
      )}

      {/* Route options (real engine results) */}
      {routes.length > 0 && !loading && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {routes.map((r) => {
            const isActive = active?.id === r.id
<<<<<<< HEAD
            const eventRoute = simulationResult?.routes.find((candidate) => candidate.routeId === r.id) ??
              simulationResult?.routes.find((candidate) => candidate.label.trim().toLowerCase() === r.label.trim().toLowerCase())
=======
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
            return (
              <li key={r.id}>
                <button
                  onClick={() => onActiveRoute(r.id)}
                  className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    isActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
<<<<<<< HEAD
                    <span className="flex min-w-0 flex-wrap items-center gap-1">
                      <span
                        className={`font-mono text-[9px] uppercase tracking-widest ${
                          isActive ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {r.label}
                      </span>
                      {eventRoute?.recommended && !eventRoute.affected && (
                        <span className="rounded-full border border-green-500/40 bg-green-500/5 px-1 py-0.5 font-mono text-[7px] uppercase tracking-wider text-green-400">✓ Avoids event</span>
                      )}
                      {eventRoute?.affected && (
                        <span className="rounded-full border border-amber-500/40 bg-amber-500/5 px-1 py-0.5 font-mono text-[7px] uppercase tracking-wider text-amber-300">⚠ Event zone</span>
                      )}
                    </span>
                    <span className="font-mono text-[11px] text-foreground">{mins(r.durationSeconds)}</span>
=======
                    <span
                      className={`font-mono text-[9px] uppercase tracking-widest ${
                        isActive ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {r.label}
                    </span>
                    <span className="font-mono text-[11px] text-foreground">{mins(r.duration_seconds)}</span>
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[10px] text-muted-foreground">
                      {r.summary || `${r.steps.length} steps`}
                    </span>
<<<<<<< HEAD
                    <span className="font-mono text-[10px] text-primary">{km(r.distanceMeters)}</span>
                  </div>
                  {(() => {
                    const load = eventRoute?.congestionScore != null
                      ? eventRoute.congestionScore / 100
                      : simulationResult?.event.eventLoad ?? 0
                    const { co2, fuel } = emissions(r.distanceMeters, load)
                    return (
                      <div className="mt-1 flex items-center gap-2 font-mono text-[9px] text-muted-foreground">
                        <span title="Estimated CO₂ emissions">🌿 {co2} CO₂</span>
                        <span className="text-border">·</span>
                        <span title="Estimated fuel consumption">⛽ {fuel}</span>
                      </div>
                    )
                  })()}
=======
                    <span className="font-mono text-[10px] text-primary">{km(r.distance_meters)}</span>
                  </div>
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* Start live navigation on the selected route */}
      {active && !loading && navState !== "navigating" && navState !== "rerouting" && (
        <button
          onClick={onStartNav}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-2 py-2 font-mono text-[11px] uppercase tracking-widest text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Play className="h-3.5 w-3.5" />
          {navState === "arrived" ? "Navigate again" : "Start navigation"}
        </button>
      )}

      {trafficNote && routes.length > 0 && (
        <p className="mt-2 text-[9px] text-pretty text-muted-foreground">{trafficNote}</p>
      )}

      {/* Turn-by-turn */}
      {active && active.steps.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowSteps((s) => !s)}
            className="flex w-full items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            <span className="flex items-center gap-1">
              <CornerUpRight className="h-3 w-3" aria-hidden /> Directions ({active.steps.length})
            </span>
            <span>{showSteps ? "−" : "+"}</span>
          </button>
          {showSteps && (
            <ol className="mt-2 max-h-64 overflow-y-auto border-l border-border pl-3">
              {active.steps.map((s, i) => (
                <li key={i} className="relative py-1.5">
                  <span
                    className="absolute -left-[17px] top-2.5 h-1.5 w-1.5 rounded-full bg-primary"
                    aria-hidden
                  />
                  <p className="text-[11px] leading-snug text-pretty text-foreground">{s.instruction}</p>
                  <p className="font-mono text-[9px] text-muted-foreground">
                    {s.distanceMeters > 0 ? km(s.distanceMeters) : "—"}
                    {s.durationSeconds > 0 && ` · ${mins(s.durationSeconds)}`}
                    {s.name && ` · ${s.name}`}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}
