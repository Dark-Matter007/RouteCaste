"use client"

import "leaflet/dist/leaflet.css"
<<<<<<< HEAD
import { divIcon } from "leaflet"
import { useEffect } from "react"
import { MapContainer, TileLayer, Polyline, Polygon, Circle, CircleMarker, Marker, Popup, Rectangle, Tooltip, useMap, useMapEvents } from "react-leaflet"
import { GUNTUR_BOUNDS, GUNTUR_CENTER, GUNTUR_DEFAULT_ZOOM } from "@/lib/guntur-places"
import type { EventSimulationResponse } from "@/lib/types"
=======
import { useEffect } from "react"
import { MapContainer, TileLayer, Polyline, Circle, CircleMarker, Tooltip, useMap, useMapEvents } from "react-leaflet"
import type { PlanResponse } from "@/lib/types"
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975

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

<<<<<<< HEAD
// Forwards map clicks up — always fires; the page decides what to do with it.
=======
// Forwards map clicks up so the page can set trip start/end points.
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
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

<<<<<<< HEAD
=======
// color a road by its congestion (0 free -> 1 gridlocked)
function congestionColor(c: number): string {
  if (c < 0.35) return "#22d3ee" // cyan - free
  if (c < 0.6) return "#facc15" // amber - moderate
  return "#f43f5e" // red - heavy
}

>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
/** A real routing-engine result to draw (active one highlighted). */
export type NavGeometry = {
  id: string
  label: string
  latLngs: [number, number][]
}

type Props = {
<<<<<<< HEAD
  basemap: Basemap
  layers: MapLayers
  flyTo?: FlyTarget | null
  tripStart?: LatLng | null
  tripEnd?: LatLng | null
  /** Always fires on map click — the page decides the action */
=======
  data: PlanResponse
  selectedInviteeId: string | null
  basemap: Basemap
  layers: MapLayers
  flyTo?: FlyTarget | null
  directions?: boolean
  tripStart?: LatLng | null
  tripEnd?: LatLng | null
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
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
<<<<<<< HEAD
  /** User-placed event pin with impact rings (250m red, 500m amber, 1000m cyan). */
  eventPin?: { lat: number; lng: number; name: string; radiusMeters: number } | null
  /** Simulation result used to colour routes and show the event hotspot. */
  simulationResult?: EventSimulationResponse | null
  /** Nearby OSM road segments with event-simulation congestion scores. */
  heatmapSegments?: { points: [number, number][]; congestion: number; highway: string }[]
  /** Reachable-area hull under normal and event-affected conditions. */
  isochroneNormal?: [number, number][]
  isochroneAffected?: [number, number][]
  /** Priority corridor calculated for an emergency vehicle. */
  emergencyRoute?: [number, number][]
  /** Two-point road closure drawn by the city planner. */
  closurePoints?: [{ lat: number; lng: number }, { lat: number; lng: number }] | null
  /** Show the Guntur study-area bounding box. */
  showStudyArea?: boolean
}

function CongestionLegend({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div className="leaflet-bottom leaflet-left" style={{ pointerEvents: "none" }}>
      <div className="leaflet-control m-3 rounded-lg border border-border/60 bg-card/80 px-3 py-2 backdrop-blur-sm" style={{ pointerEvents: "none" }}>
        <p className="mb-1.5 font-mono text-[8px] uppercase tracking-widest text-muted-foreground">Congestion</p>
        {[
          { color: "#22c55e", label: "Free flow" },
          { color: "#facc15", label: "Moderate" },
          { color: "#f97316", label: "Heavy" },
          { color: "#f43f5e", label: "Severe" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2 py-0.5">
            <span style={{ backgroundColor: color }} className="inline-block h-2 w-5 flex-shrink-0 rounded-sm" />
            <span className="font-mono text-[9px] text-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CityMap({
  basemap,
  layers,
  flyTo = null,
=======
}

export function CityMap({
  data,
  selectedInviteeId,
  basemap,
  layers,
  flyTo = null,
  directions = false,
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
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
<<<<<<< HEAD
  eventPin = null,
  simulationResult = null,
  heatmapSegments = [],
  isochroneNormal = [],
  isochroneAffected = [],
  emergencyRoute = [],
  closurePoints = null,
  showStudyArea = false,
}: Props) {
  return (
    <MapContainer
      center={[GUNTUR_CENTER.lat, GUNTUR_CENTER.lng]}
      zoom={GUNTUR_DEFAULT_ZOOM}
=======
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
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
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
<<<<<<< HEAD
      <ClickHandler onClick={onMapClick} />
=======
      {directions && <ClickHandler onClick={onMapClick} />}
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975

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

<<<<<<< HEAD
      {isochroneAffected.length > 0 && (
        <Polygon
          positions={isochroneAffected}
          pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.10, weight: 1.5, dashArray: "4 4" }}
        >
          <Tooltip sticky>Reachable area — during event (reduced)</Tooltip>
        </Polygon>
      )}
      {isochroneNormal.length > 0 && (
        <Polygon
          positions={isochroneNormal}
          pathOptions={{ color: "#22d3ee", fillColor: "#22d3ee", fillOpacity: 0.08, weight: 1.5, dashArray: "6 4" }}
        >
          <Tooltip sticky>Reachable area — normal conditions</Tooltip>
        </Polygon>
      )}

      {/* Event congestion heatmap — rendered below route lines. */}
      {layers.traffic && heatmapSegments.map((segment, index) => {
        const color = segment.congestion < 0.35
          ? "#22c55e"
          : segment.congestion < 0.6
            ? "#facc15"
            : segment.congestion < 0.8
              ? "#f97316"
              : "#f43f5e"
        const minorRoad = segment.highway === "residential" || segment.highway === "unclassified"
        return (
          <Polyline
            key={`heatmap-${segment.highway}-${index}`}
            positions={segment.points}
            pathOptions={{ color, weight: minorRoad ? 2 : 3, opacity: 0.7 }}
          />
        )
      })}

      {emergencyRoute.length >= 2 && (
        <>
          <Polyline positions={emergencyRoute} pathOptions={{ color: "#22c55e", weight: 10, opacity: 0.15 }} />
          <Polyline positions={emergencyRoute} pathOptions={{ color: "#22c55e", weight: 4, opacity: 0.95 }}>
            <Tooltip sticky>🚨 Emergency Route — Priority Corridor</Tooltip>
          </Polyline>
        </>
      )}
=======
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
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975

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
<<<<<<< HEAD
            {(() => {
              const simRoute = simulationResult?.routes.find((sr) => sr.routeId === r.id)
              const cong = simRoute?.congestionDuring ?? 0
              const routeColor = simulationResult
                ? cong < 0.35 ? "#22c55e"
                  : cong < 0.6 ? "#facc15"
                  : cong < 0.8 ? "#f97316"
                  : "#f43f5e"
                : "#67e8f9"
              const isRecommended = !!simRoute?.recommended
              const tooltip = `${r.label}${simRoute ? ` · ${simRoute.congestionClass} (${simRoute.etaDeltaMin > 0 ? "+" : ""}${simRoute.etaDeltaMin.toFixed(1)} min)` : ""}${isRecommended ? " · ⭐ AI Recommended" : ""}`
              return <>
                <Polyline
                  positions={r.latLngs}
                  pathOptions={{
                    color: routeColor,
                    weight: isRecommended ? 20 : 12,
                    opacity: isRecommended ? 0.25 : 0.18,
                  }}
                />
                {isRecommended && (
                  <Polyline positions={r.latLngs} pathOptions={{ color: "#ffffff", weight: 7, opacity: 0.35 }} />
                )}
                <Polyline
                  positions={r.latLngs}
                  pathOptions={{ color: routeColor, weight: isRecommended ? 5 : 5, opacity: 0.95 }}
                >
                  <Tooltip sticky>{tooltip}</Tooltip>
                </Polyline>
              </>
            })()}
          </div>
        ))}
      {(() => {
        if (!simulationResult) return null
        const recId = simulationResult.routes.find((route) => route.recommended)?.routeId
        const recNav = navRoutes.find((route) => route.id === recId)
        if (!recNav || recNav.latLngs.length < 2) return null
        const mid = recNav.latLngs[Math.floor(recNav.latLngs.length / 2)]
        const icon = divIcon({
          html: '<div style="background:#0a1420;border:1.5px solid #22d3ee;border-radius:20px;padding:2px 7px;font-family:monospace;font-size:9px;color:#22d3ee;white-space:nowrap;box-shadow:0 0 8px #22d3ee44">⭐ AI Pick</div>',
          className: "",
          iconAnchor: [32, 10],
        })
        return <Marker key="ai-pick-badge" position={mid} icon={icon} interactive={false} />
      })()}

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

      {/* Point-to-point trip markers (A / B) */}
      {tripStart && (
=======
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
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
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
<<<<<<< HEAD
      {tripEnd && (
=======
      {directions && tripEnd && (
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
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
<<<<<<< HEAD
      {waypoints.map((w, i) => (
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
=======
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
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975

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

<<<<<<< HEAD
      {simulationResult?.hotspot && (
        <Circle
          center={[simulationResult.hotspot.lat, simulationResult.hotspot.lng]}
          radius={simulationResult.routes.length > 0 ? 800 : 500}
          pathOptions={{ color: "#f97316", fillColor: "#f97316", fillOpacity: 0.12, weight: 2, dashArray: "8 6" }}
        >
          <Tooltip sticky>🔥 Event Hotspot · {simulationResult.hotspot.severityLabel} Congestion</Tooltip>
        </Circle>
      )}

      {closurePoints && (
        <>
          <Polyline
            positions={[[closurePoints[0].lat, closurePoints[0].lng], [closurePoints[1].lat, closurePoints[1].lng]]}
            pathOptions={{ color: "#f43f5e", weight: 6, opacity: 0.85, dashArray: "10 6" }}
          >
            <Tooltip sticky>🚧 Planned Road Closure</Tooltip>
          </Polyline>
          <CircleMarker center={[closurePoints[0].lat, closurePoints[0].lng]} radius={7} pathOptions={{ color: "#f43f5e", fillColor: "#f43f5e", fillOpacity: 0.9, weight: 2 }}>
            <Tooltip direction="top">Closure Start</Tooltip>
          </CircleMarker>
          <CircleMarker center={[closurePoints[1].lat, closurePoints[1].lng]} radius={7} pathOptions={{ color: "#f43f5e", fillColor: "#f43f5e", fillOpacity: 0.9, weight: 2 }}>
            <Tooltip direction="top">Closure End</Tooltip>
          </CircleMarker>
        </>
      )}

      {/* User-placed event pin: 3 concentric impact rings + centre marker */}
      {eventPin && (
        <>
          {/* 1000m cyan — crowd influx boundary */}
          <Circle
            center={[eventPin.lat, eventPin.lng]}
            radius={1000}
            pathOptions={{
              color: "#22d3ee",
              fillColor: "#22d3ee",
              fillOpacity: 0.04,
              weight: 1,
              dashArray: "8 8",
            }}
          >
            <Tooltip sticky>🔵 1,000 m Peripheral Zone — Crowd Influx Boundary</Tooltip>
          </Circle>
          {/* 500m amber — moderate congestion risk */}
          <Circle
            center={[eventPin.lat, eventPin.lng]}
            radius={500}
            pathOptions={{
              color: "#facc15",
              fillColor: "#facc15",
              fillOpacity: 0.09,
              weight: 1.5,
              dashArray: "6 6",
            }}
          >
            <Tooltip sticky>🟡 500 m Buffer Zone — Moderate Congestion Risk</Tooltip>
          </Circle>
          {/* 250m red — severe delay epicentre */}
          <Circle
            center={[eventPin.lat, eventPin.lng]}
            radius={250}
            pathOptions={{
              color: "#f43f5e",
              fillColor: "#f43f5e",
              fillOpacity: 0.18,
              weight: 2,
              dashArray: "4 4",
            }}
          >
            <Tooltip sticky>🔴 250 m Event Epicentre — Severe Delay &amp; Congestion Zone</Tooltip>
          </Circle>
          {/* Centre pin */}
          <CircleMarker
            center={[eventPin.lat, eventPin.lng]}
            radius={10}
            pathOptions={{ color: "#22d3ee", fillColor: "#22d3ee", fillOpacity: 0.9, weight: 3 }}
          >
            {simulationResult ? (
              <Popup minWidth={200} className="font-mono">
                <div style={{ fontFamily: "monospace", fontSize: 11, lineHeight: 1.6 }}>
                  <p style={{ fontWeight: 700, marginBottom: 4, color: "#22d3ee" }}>
                    📍 {simulationResult.event.name}
                  </p>
                  <p style={{ color: "#94a3b8", fontSize: 10, marginBottom: 6 }}>
                    {simulationResult.event.type.replace("_", " ").toUpperCase()}
                  </p>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                      {[
                        ["Attendance", simulationResult.event.attendance.toLocaleString() + " people"],
                        ["Impact radius", Math.round(simulationResult.event.impactRadiusMeters) + " m"],
                        ["Peak at", Number.isNaN(Date.parse(simulationResult.peakAt))
                          ? "--:--"
                          : new Date(simulationResult.peakAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        ],
                        ["Severity", simulationResult.hotspot?.severityLabel ?? "Low"],
                        ["AI model", simulationResult.source === "model" ? "✓ ONNX" : "Heuristic"],
                      ].map(([label, value]) => (
                        <tr key={label}>
                          <td style={{ color: "#64748b", paddingRight: 8, fontSize: 10 }}>{label}</td>
                          <td style={{ color: "#f1f5f9", fontSize: 10 }}>{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {simulationResult.routes.find((route) => route.recommended) && (
                    <p style={{ marginTop: 6, fontSize: 10, color: "#22d3ee" }}>
                      ⭐ Recommended: {simulationResult.routes.find((route) => route.recommended)?.label}
                    </p>
                  )}
                </div>
              </Popup>
            ) : (
              <Tooltip direction="top" permanent>
                📍 {eventPin.name}
              </Tooltip>
            )}
          </CircleMarker>
        </>
      )}

=======
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
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
<<<<<<< HEAD
      {showStudyArea && (
        <Rectangle
          bounds={[
            [GUNTUR_BOUNDS.minLat, GUNTUR_BOUNDS.minLng],
            [GUNTUR_BOUNDS.maxLat, GUNTUR_BOUNDS.maxLng],
          ]}
          pathOptions={{
            color: "#22d3ee",
            weight: 1,
            opacity: 0.25,
            fillColor: "#22d3ee",
            fillOpacity: 0.03,
            dashArray: "6 8",
          }}
        >
          <Tooltip sticky direction="top">
            📐 Guntur City Study Area
          </Tooltip>
        </Rectangle>
      )}
      <CongestionLegend visible={heatmapSegments.length > 0 || simulationResult !== null} />
=======
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
    </MapContainer>
  )
}
