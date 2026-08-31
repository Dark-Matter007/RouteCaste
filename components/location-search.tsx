"use client"

import { useEffect, useRef, useState } from "react"
import { Search, MapPin, Loader2, X } from "lucide-react"

export type Place = {
  label: string
  lat: number
  lng: number
  kind: string
}

type Props = {
  onSelect: (place: Place) => void
}

// Free worldwide geocoding via OpenStreetMap Nominatim (no API key required).
async function geocode(q: string, signal: AbortSignal): Promise<Place[]> {
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=" +
    encodeURIComponent(q)
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } })
  if (!res.ok) throw new Error("geocode failed")
  const rows = (await res.json()) as Array<{
    display_name: string
    lat: string
    lon: string
    type: string
    addresstype?: string
  }>
  return rows.map((r) => ({
    label: r.display_name,
    lat: Number.parseFloat(r.lat),
    lng: Number.parseFloat(r.lon),
    kind: r.addresstype || r.type,
  }))
}

export function LocationSearch({ onSelect }: Props) {
  const [q, setQ] = useState("")
  const [results, setResults] = useState<Place[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (q.trim().length < 3) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      try {
        const places = await geocode(q, ctrl.signal)
        setResults(places)
        setOpen(true)
      } catch (e) {
        if ((e as Error).name !== "AbortError") setResults([])
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [q])

  function choose(p: Place) {
    onSelect(p)
    setQ(p.label.split(",").slice(0, 2).join(", "))
    setOpen(false)
  }

  return (
    <div className="pointer-events-auto relative w-[min(88vw,26rem)]">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 backdrop-blur-md">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Search any country, state or city…"
          aria-label="Search for a location"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />}
        {!loading && q && (
          <button
            onClick={() => {
              setQ("")
              setResults([])
              setOpen(false)
            }}
            aria-label="Clear search"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-card p-1 backdrop-blur-md">
          {results.map((p, i) => (
            <li key={`${p.lat}-${p.lng}-${i}`}>
              <button
                onClick={() => choose(p)}
                className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-secondary"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                <span className="flex flex-col">
                  <span className="text-xs text-foreground">{p.label.split(",").slice(0, 2).join(", ")}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    {p.kind} · {p.label.split(",").slice(-1)[0].trim()}
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
