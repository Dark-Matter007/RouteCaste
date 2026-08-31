"use client"

import "leaflet/dist/leaflet.css"
import { useEffect } from "react"
import { MapContainer, TileLayer, Polyline, Circle, CircleMarker, Tooltip, useMap, useMapEvents } from "react-leaflet"
import type { PlanResponse } from "@/lib/types"

export type FlyTarget = { lat: number; lng: number; zoom?: number; nonce: number }
export type LatLng = { lat: number; lng: number }

// Animates the map to a new location whenever a search result is chosen.
function FlyController({ target }: { target: FlyTarget | null }) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    map.flyTo([target.lat, target.lng], target.zoom ?? 15, { duration: 1.6 })
  }, [target, map])
  return null
}

// Frames the whole real route once it loads so both endpoints are visible.
function FitRoute({ latLngs }: { latLngs: [number, number][] }) {
  const map = useMap()
  const key = latLngs.length ? `${latLngs.length}:${latLngs[0]}:${latLngs[latLngs.length - 1]}` : ""
  useEffect(() => {
    if (latLngs.length < 2) return
    map.fitBounds(latLngs, { padding: [40, 40], animate: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])
  return null
}

// Keeps the camera locked on the live position while "follow" is enabled.
function FollowController({ pos, enabled }: { pos: LatLng | null; enabled: boolean }) {
  const map = useMap()
  useEffect(() => {
    if (!enabled || !pos) return
    map.panTo([pos.lat, pos.lng], { animate: true, duration: 0.6 })
  }, [pos?.lat, pos?.lng, enabled, map])
  return null
}

// Exposes zoom / recenter controls without pulling in a paid map SDK.
function MapButtons({ onLocate }: { onLocate?: () => void }) {
  const map = useMap()
  return (
    <div className="leaflet-top leaflet-right" style={{ marginTop: 96, marginRight: 12 }}>
      <div className="leaflet-control flex flex-col gap-1">
        {[
          { label: "+", title: "Zoom in", fn: () => map.zoomIn() },
          { label: "−", title: "Zoom out", fn: () => map.zoomOut() },
        ].map((b) => (
          <button
            key={b.title}
            title={b.title}
            aria-label={b.title}
            onClick={(e) => {
              e.stopPropagation()
              b.fn()
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card font-mono text-sm text-foreground backdrop-blur-md transition-colors hover:border-primary"
          >
            {b.label}
          </button>
        ))}
        {onLocate && (
          <button
            title="Center on my location"
            aria-label="Center on my location"
            onClick={(e) => {
              e.stopPropagation()
              onLocate()
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card font-mono text-[10px] text-primary backdrop-blur-md transition-colors hover:border-primary"
          >
            ◎
          </button>
        )}
      </div>
    </div>
  )
}

// Forwards map clicks up so the page can set trip start/end points.
function ClickHandler({ onClick }: { onClick?: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

export type Basemap = "dark" | "satellite" | "hybrid" | "streets" | "terrain"
export type MapLayers = {
  traffic: boolean
  incidents: boolean
  pollution: boolean
  closures: boolean
}

// color a road by its congestion (0 free -> 1 gridlocked)
function congestionColor(c: number): string {
  if (c < 0.35) return "#22d3ee" // cyan - free
  if (c < 0.6) return "#facc15" // amber - moderate
  return "#f43f5e" // red - heavy
}

/** A real routing-engine result to draw (active one highlighted). */
export type NavGeometry = {
  id: string
  label: string
  latLngs: [number, number][]
}

type Props = {
  data: PlanResponse
  selectedInviteeId: string | null
  basemap: Basemap
  layers: MapLayers
  flyTo?: FlyTarget | null
  directions?: boolean
  tripStart?: LatLng | null
  tripEnd?: LatLng | null
  onMapClick?: (p: LatLng) => void
  navRoutes?: NavGeometry[]
  activeNavId?: string | null
  /** Live GPS position drawn as the "puck". */
  currentPos?: (LatLng & { accuracy?: number }) | null
  /** Position snapped onto the followed route while navigating. */
  snappedPos?: LatLng | null
  followPos?: boolean
  /** Ordered intermediate stops. */
  waypoints?: LatLng[]
  /** POI pins from a category search. */
  pois?: { id: string; name: string; lat: number; lon: number }[]
  onPoiClick?: (id: string) => void
  onLocate?: () => void
  /** Real geographic incidents with a metre-accurate affected radius. */
  geoIncidents?: {
    id: string
    type: string
    lat: number
    lon: number
    severity: string
    origin: string
    radiusMeters: number
    description: string
  }[]
  /** Suppresses route auto-fit so it can't fight the follow camera. */
  navigating?: boolean
}

export function CityMap({
  data,
  selectedInviteeId,
  basemap,
  layers,
  flyTo = null,
  directions = false,
  tripStart = null,
  tripEnd = null,
  onMapClick,
  navRoutes = [],
  activeNavId = null,
  currentPos = null,
  snappedPos = null,
  followPos = false,
  waypoints = [],
  pois = [],
  onPoiClick,
  onLocate,
  geoIncidents = [],
  navigating = false,
}: Props) {
  const nodeById = Object.fromEntries(data.graph.nodes.map((n) => [n.id, n]))
  const venue = nodeById[data.event.venueNodeId]

  const pollution = data.pollution ?? []
  const incidents = data.incidents ?? []
  const visiblePlans = selectedInviteeId ? data.plans.filter((p) => p.invitee.id === selectedInviteeId) : data.plans

  return (
    <MapContainer
      center={[venue.lat, venue.lng]}
      zoom={14}
      className="h-full w-full"
      style={{ background: "#0a1420" }}
      zoomControl={false}
    >
      <FlyController target={flyTo} />
      {navRoutes.length > 0 && !navigating && (
        <FitRoute latLngs={(navRoutes.find((r) => r.id === activeNavId) ?? navRoutes[0]).latLngs} />
      )}
      <FollowController pos={currentPos} enabled={followPos} />
      <MapButtons onLocate={onLocate} />
      {directions && <ClickHandler onClick={onMapClick} />}

      {/* Basemap */}
      {basemap === "dark" && (
        <TileLayer
          attribution="&copy; OpenStreetMap &copy; CARTO"
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
      )}
      {(basemap === "satellite" || basemap === "hybrid") && (
        <TileLayer
          attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
      )}
      {basemap === "hybrid" && (
        <TileLayer
          attribution="Labels &copy; Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
        />
      )}
      {basemap === "streets" && (
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      )}
      {basemap === "terrain" && (
        <TileLayer
          attribution="&copy; OpenTopoMap (CC-BY-SA)"
          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
        />
      )}

      {/* Pollution heat zones (derived from congestion) */}
      {layers.pollution &&
        pollution.map((z, i) => (
          <CircleMarker
            key={`poll-${i}`}
            center={[z.lat, z.lng]}
            radius={22 * z.intensity}
            pathOptions={{
              color: "transparent",
              fillColor: "#f43f5e",
              fillOpacity: 0.08 + z.intensity * 0.18,
              weight: 0,
            }}
          />
        ))}

      {/* Road network colored by live traffic (simulated grid) */}
      {layers.traffic &&
        navRoutes.length === 0 &&
        data.graph.edges.map((e, i) => {
          const a = nodeById[e.from]
          const b = nodeById[e.to]
          if (!a || !b) return null
          return (
            <Polyline
              key={i}
              positions={[
                [a.lat, a.lng],
                [b.lat, b.lng],
              ]}
              pathOptions={{ color: congestionColor(e.congestion), weight: 2, opacity: 0.55 }}
            />
          )
        })}

      {/* Road closures / blocked segments (congestion near gridlock) */}
      {layers.closures &&
        navRoutes.length === 0 &&
        data.graph.edges
          .filter((e) => e.congestion >= 0.9)
          .map((e, i) => {
            const a = nodeById[e.from]
            const b = nodeById[e.to]
            if (!a || !b) return null
            return (
              <Polyline
                key={`clo-${i}`}
                positions={[
                  [a.lat, a.lng],
                  [b.lat, b.lng],
                ]}
                pathOptions={{ color: "#f43f5e", weight: 5, opacity: 0.9, dashArray: "4 6" }}
              />
            )
          })}

      {/* Real routing-engine geometry (OSM/OSRM): inactive alternatives first */}
      {navRoutes
        .filter((r) => r.id !== (activeNavId ?? navRoutes[0]?.id))
        .map((r) => (
          <Polyline
            key={`nav-alt-${r.id}`}
            positions={r.latLngs}
            pathOptions={{ color: "#94a3b8", weight: 4, opacity: 0.55, dashArray: "6 8" }}
          >
            <Tooltip sticky>{r.label}</Tooltip>
          </Polyline>
        ))}
      {navRoutes
        .filter((r) => r.id === (activeNavId ?? navRoutes[0]?.id))
        .map((r) => (
          <div key={`nav-${r.id}`}>
            <Polyline positions={r.latLngs} pathOptions={{ color: "#22d3ee", weight: 12, opacity: 0.2 }} />
            <Polyline positions={r.latLngs} pathOptions={{ color: "#67e8f9", weight: 5, opacity: 0.95 }}>
              <Tooltip sticky>{r.label}</Tooltip>
            </Polyline>
          </div>
        ))}

      {/* Simulated grid routes (hidden once a real route is loaded) */}
      {navRoutes.length === 0 &&
        visiblePlans.map((p) => {
        if (!p.recommended) return null
        const pts = p.recommended.path.map((pt) => [pt.lat, pt.lng] as [number, number])
        return (
          <div key={p.invitee.id}>
            <Polyline positions={pts} pathOptions={{ color: "#22d3ee", weight: 10, opacity: 0.18 }} />
            <Polyline positions={pts} pathOptions={{ color: "#67e8f9", weight: 3, opacity: 0.95 }} />
          </div>
        )
      })}

      {/* Alternative routes when a single invitee is selected */}
      {navRoutes.length === 0 &&
        selectedInviteeId &&
        visiblePlans[0]?.alternatives.map((alt, i) => {
          const pts = alt.path.map((pt) => [pt.lat, pt.lng] as [number, number])
          return (
            <Polyline
              key={`alt-${i}`}
              positions={pts}
              pathOptions={{ color: "#94a3b8", weight: 2, opacity: 0.5, dashArray: "6 8" }}
            />
          )
        })}

        {/* Real incidents: affected area (metres) + centre marker */}
        {layers.incidents &&
          geoIncidents.map((inc) => {
            const color =
              inc.severity === "critical" || inc.type === "closure" || inc.type === "flooding"
                ? "#f97316"
                : inc.severity === "high"
                  ? "#f43f5e"
                  : "#facc15"
            return (
              <div key={`geo-${inc.id}`}>
                <Circle
                  center={[inc.lat, inc.lon]}
                  radius={inc.radiusMeters}
                  pathOptions={{
                    color,
                    weight: 1.5,
                    opacity: 0.8,
                    fillColor: color,
                    fillOpacity: 0.14,
                    dashArray: inc.origin === "simulated" ? "6 4" : undefined,
                  }}
                />
                <CircleMarker
                  center={[inc.lat, inc.lon]}
                  radius={7}
                  pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: 0.9 }}
                >
                  <Tooltip direction="top">
                    {inc.origin === "simulated" ? "SIMULATED · " : ""}
                    {inc.type} ({inc.severity}) — {inc.description}
                  </Tooltip>
                </CircleMarker>
              </div>
            )
          })}

        {/* Incident markers */}
        {layers.incidents &&
        incidents.map((inc) => {
          const n = nodeById[inc.nodeId]
          if (!n) return null
          const color = inc.kind === "closure" ? "#f97316" : "#f43f5e"
          return (
            <CircleMarker
              key={inc.id}
              center={[n.lat, n.lng]}
              radius={9}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 2 }}
            >
              <Tooltip direction="top">{inc.label}</Tooltip>
            </CircleMarker>
          )
        })}

      {/* Invitee origins */}
      {navRoutes.length === 0 &&
        visiblePlans.map((p) => {
        const n = nodeById[p.invitee.originNodeId]
        return (
          <CircleMarker
            key={p.invitee.id}
            center={[n.lat, n.lng]}
            radius={6}
            pathOptions={{ color: "#67e8f9", fillColor: "#0a1420", fillOpacity: 1, weight: 2 }}
          >
            <Tooltip direction="top">{p.invitee.name}</Tooltip>
          </CircleMarker>
        )
      })}

      {/* Venue (hidden in directions mode; the B marker stands in for it) */}
      {!directions && (
        <CircleMarker
          center={[venue.lat, venue.lng]}
          radius={10}
          pathOptions={{ color: "#22d3ee", fillColor: "#22d3ee", fillOpacity: 0.9, weight: 3 }}
        >
          <Tooltip direction="top" permanent>
            {data.event.name}
          </Tooltip>
        </CircleMarker>
      )}

      {/* Point-to-point trip markers */}
      {directions && tripStart && (
        <CircleMarker
          center={[tripStart.lat, tripStart.lng]}
          radius={9}
          pathOptions={{ color: "#22d3ee", fillColor: "#0a1420", fillOpacity: 1, weight: 3 }}
        >
          <Tooltip direction="top" permanent>
            A · Start
          </Tooltip>
        </CircleMarker>
      )}
      {directions && tripEnd && (
        <CircleMarker
          center={[tripEnd.lat, tripEnd.lng]}
          radius={10}
          pathOptions={{ color: "#22d3ee", fillColor: "#22d3ee", fillOpacity: 0.9, weight: 3 }}
        >
          <Tooltip direction="top" permanent>
            B · Destination
          </Tooltip>
        </CircleMarker>
      )}

      {/* Numbered intermediate stops */}
      {directions &&
        waypoints.map((w, i) => (
          <CircleMarker
            key={`wp-${i}`}
            center={[w.lat, w.lng]}
            radius={7}
            pathOptions={{ color: "#f8fafc", fillColor: "#64748b", fillOpacity: 0.95, weight: 2 }}
          >
            <Tooltip direction="top" className="font-mono">
              Stop {i + 1}
            </Tooltip>
          </CircleMarker>
        ))}

      {/* POI pins from a category search */}
      {pois.map((p) => (
        <CircleMarker
          key={p.id}
          center={[p.lat, p.lon]}
          radius={5}
          pathOptions={{ color: "#fbbf24", fillColor: "#fbbf24", fillOpacity: 0.7, weight: 1 }}
          eventHandlers={{ click: () => onPoiClick?.(p.id) }}
        >
          <Tooltip direction="top" className="font-mono">
            {p.name}
          </Tooltip>
        </CircleMarker>
      ))}

      {/* Live position: accuracy halo, snapped point, then the puck */}
      {currentPos && (currentPos.accuracy ?? 0) > 25 && (
        <CircleMarker
          center={[currentPos.lat, currentPos.lng]}
          radius={Math.min(40, Math.max(10, (currentPos.accuracy ?? 0) / 6))}
          pathOptions={{ color: "#22d3ee", fillColor: "#22d3ee", fillOpacity: 0.1, weight: 1, opacity: 0.35 }}
        />
      )}
      {snappedPos && navigating && (
        <CircleMarker
          center={[snappedPos.lat, snappedPos.lng]}
          radius={5}
          pathOptions={{ color: "#a5f3fc", fillColor: "#a5f3fc", fillOpacity: 0.9, weight: 1 }}
        />
      )}
      {currentPos && (
        <CircleMarker
          center={[currentPos.lat, currentPos.lng]}
          radius={8}
          pathOptions={{ color: "#0f172a", fillColor: "#22d3ee", fillOpacity: 1, weight: 3 }}
        >
          <Tooltip direction="top" className="font-mono">
            You{currentPos.accuracy ? ` · ±${Math.round(currentPos.accuracy)} m` : ""}
          </Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  )
}
