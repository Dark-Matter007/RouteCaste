"use client"

import type { Basemap, MapLayers } from "@/components/city-map"

type Props = {
  basemap: Basemap
  onBasemap: (b: Basemap) => void
  layers: MapLayers
  onLayers: (l: MapLayers) => void
}

const BASEMAPS: { id: Basemap; label: string }[] = [
  { id: "dark", label: "Neon" },
  { id: "satellite", label: "Sat" },
  { id: "hybrid", label: "Hybrid" },
  { id: "streets", label: "Streets" },
  { id: "terrain", label: "Topo" },
]

const LAYER_DEFS: { key: keyof MapLayers; label: string; dot: string }[] = [
  { key: "traffic", label: "Traffic", dot: "#22d3ee" },
  { key: "incidents", label: "Incidents", dot: "#f43f5e" },
  { key: "pollution", label: "Pollution", dot: "#a855f7" },
  { key: "closures", label: "Closures", dot: "#f97316" },
]

export function LayerControls({ basemap, onBasemap, layers, onLayers }: Props) {
  return (
    <div className="pointer-events-auto flex w-52 flex-col gap-2 rounded-xl border border-border bg-card p-2 backdrop-blur-md">
      {/* Basemap picker */}
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-secondary p-0.5">
        {BASEMAPS.map((b) => (
          <button
            key={b.id}
            onClick={() => onBasemap(b.id)}
            className={`overflow-hidden rounded-md px-1.5 py-1 font-mono text-[10px] uppercase tracking-wider whitespace-nowrap transition-colors ${
              basemap === b.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* Layer toggles */}
      <div className="flex flex-col gap-0.5">
        {LAYER_DEFS.map((l) => {
          const on = layers[l.key]
          return (
            <button
              key={l.key}
              onClick={() => onLayers({ ...layers, [l.key]: !on })}
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors hover:bg-secondary"
            >
              <span className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: on ? l.dot : "transparent", border: `1px solid ${l.dot}` }}
                />
                <span className={`text-xs ${on ? "text-foreground" : "text-muted-foreground"}`}>{l.label}</span>
              </span>
              <span
                className={`font-mono text-[9px] uppercase ${on ? "text-primary" : "text-muted-foreground"}`}
              >
                {on ? "On" : "Off"}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
