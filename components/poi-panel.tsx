"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Navigation, Phone, Globe, Clock, MapPin, Plus } from "lucide-react"
import type { NavPoint } from "@/hooks/use-navigation-route"

export type Poi = {
  id: string
  name: string
  category: string
  categoryLabel: string
  lat: number
  lon: number
  distanceMeters: number
  address?: string
  phone?: string
  website?: string
  openingHours?: string
}

const CATEGORIES = [
  { id: "restaurant", label: "Food" },
  { id: "hotel", label: "Hotels" },
  { id: "hospital", label: "Hospitals" },
  { id: "university", label: "Universities" },
  { id: "airport", label: "Airports" },
  { id: "fuel", label: "Fuel" },
  { id: "charging", label: "EV" },
  { id: "bank", label: "Banks" },
  { id: "atm", label: "ATMs" },
  { id: "pharmacy", label: "Pharmacy" },
  { id: "police", label: "Police" },
  { id: "fire_station", label: "Fire" },
  { id: "parking", label: "Parking" },
  { id: "shopping", label: "Shopping" },
  { id: "attraction", label: "Attractions" },
  { id: "government", label: "Govt" },
]

function dist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`
}

type Props = {
  /** Search anchor: the live GPS fix, the chosen origin, or the map centre. */
  center: { lat: number; lon: number } | null
  centerLabel?: string
  pois: Poi[]
  onPois: (p: Poi[]) => void
  onDirections: (p: NavPoint) => void
  onAddStop: (p: NavPoint) => void
  onFocus: (p: Poi) => void
}

/** Category POI search over real OSM data, with directions into the router. */
export function PoiPanel({ center, centerLabel, pois, onPois, onDirections, onAddStop, onFocus }: Props) {
  const [active, setActive] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  // Cache per category+coarse location so re-clicking a chip is free.
  const cache = useRef<Map<string, Poi[]>>(new Map())

  const search = useCallback(
    async (category: string) => {
      if (!center) {
        setError("Set a location or enable GPS first.")
        return
      }
      setActive(category)
      setError(null)
      const key = `${category}:${center.lat.toFixed(2)},${center.lon.toFixed(2)}`
      const hit = cache.current.get(key)
      if (hit) {
        onPois(hit)
        setSource("cache")
        return
      }
      setLoading(true)
      try {
        const res = await fetch(
          `/api/places/nearby?category=${category}&lat=${center.lat}&lon=${center.lon}&radius=8000&limit=20`,
        )
        const body = await res.json()
        if (!res.ok) throw new Error(body?.error || "POI search failed")
        const list: Poi[] = body.pois ?? []
        cache.current.set(key, list)
        onPois(list)
        setSource(body.source)
        if (list.length === 0) setError("No results nearby. Try a wider category or another area.")
      } catch (e) {
        onPois([])
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [center, onPois],
  )

  // Refresh the current category when the anchor moves substantially.
  const anchorKey = center ? `${center.lat.toFixed(2)},${center.lon.toFixed(2)}` : ""
  useEffect(() => {
    if (active && center) void search(active)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorKey])

  return (
    <section className="rounded-xl border border-border bg-card/50 p-3">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-widest text-primary">Places nearby</h2>
        {source && !loading && (
          <span className="rounded-full border border-border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-muted-foreground">
            {source}
          </span>
        )}
      </div>

      <p className="mt-1 truncate font-mono text-[9px] text-muted-foreground">
        {center ? `Around ${centerLabel || `${center.lat.toFixed(3)}, ${center.lon.toFixed(3)}`}` : "No search anchor set"}
      </p>

      <div className="mt-2 flex flex-wrap gap-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => search(c.id)}
            disabled={!center}
            className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider transition-colors disabled:opacity-40 ${
              active === c.id
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading && (
        <p className="mt-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin text-primary" /> Searching OSM…
        </p>
      )}
      {error && !loading && (
        <p className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 px-2 py-1 font-mono text-[10px] text-destructive">
          {error}
        </p>
      )}

      {pois.length > 0 && !loading && (
        <ul className="mt-2 flex max-h-72 flex-col gap-1 overflow-y-auto">
          {pois.map((p) => {
            const open = openId === p.id
            return (
              <li key={p.id} className="rounded-lg border border-border">
                <button
                  onClick={() => {
                    setOpenId(open ? null : p.id)
                    onFocus(p)
                  }}
                  className="flex w-full items-start gap-2 px-2 py-1.5 text-left transition-colors hover:bg-secondary"
                >
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-primary" aria-hidden />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[11px] text-foreground">{p.name}</span>
                    <span className="truncate font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                      {p.categoryLabel} · {dist(p.distanceMeters)}
                    </span>
                  </span>
                </button>

                {open && (
                  <div className="border-t border-border px-2 py-1.5">
                    {/* Only real returned fields are shown; missing ones are omitted. */}
                    {p.address && <p className="text-[10px] leading-snug text-pretty text-muted-foreground">{p.address}</p>}
                    <p className="mt-0.5 font-mono text-[9px] text-muted-foreground">
                      {p.lat.toFixed(5)}, {p.lon.toFixed(5)}
                    </p>
                    {p.phone && (
                      <a href={`tel:${p.phone}`} className="mt-1 flex items-center gap-1 font-mono text-[10px] text-primary hover:underline">
                        <Phone className="h-3 w-3" /> {p.phone}
                      </a>
                    )}
                    {p.website && (
                      <a
                        href={p.website}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-0.5 flex items-center gap-1 truncate font-mono text-[10px] text-primary hover:underline"
                      >
                        <Globe className="h-3 w-3 shrink-0" /> <span className="truncate">{p.website}</span>
                      </a>
                    )}
                    {p.openingHours && (
                      <p className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" /> {p.openingHours}
                      </p>
                    )}
                    <div className="mt-1.5 flex gap-1">
                      <button
                        onClick={() => onDirections({ lat: p.lat, lon: p.lon, label: p.name })}
                        className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
                      >
                        <Navigation className="h-3 w-3" /> Directions
                      </button>
                      <button
                        onClick={() => onAddStop({ lat: p.lat, lon: p.lon, label: p.name })}
                        className="flex items-center justify-center gap-1 rounded-md border border-border px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                      >
                        <Plus className="h-3 w-3" /> Stop
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
