"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import dynamic from "next/dynamic"
import type { PlanResponse, ScenarioType } from "@/lib/types"
import type { Basemap, MapLayers, FlyTarget, LatLng } from "@/components/city-map"
import { ControlPanel } from "@/components/control-panel"
import { LayerControls } from "@/components/layer-controls"
import { LocationSearch, type Place } from "@/components/location-search"
import { Satellite, Moon, Layers } from "lucide-react"
import { MetricsDashboard } from "@/components/metrics-dashboard"
import { ScenarioPanel } from "@/components/scenario-panel"
import { ComparisonTable } from "@/components/comparison-table"
import { ForecastStrip } from "@/components/forecast-strip"
import { useAreaNames } from "@/hooks/use-area-names"
import { NavigationPanel } from "@/components/navigation-panel"
import { useNavigationRoute, type NavPoint, type TravelMode } from "@/hooks/use-navigation-route"
import { useGeolocation } from "@/hooks/use-geolocation"
import { useNavSession } from "@/hooks/use-nav-session"
import { NavHud } from "@/components/nav-hud"
import { PoiPanel, type Poi } from "@/components/poi-panel"
import { useRouteIntel, type IntelScenarioType } from "@/hooks/use-route-intel"
import { RouteIntelPanel } from "@/components/route-intel-panel"
import { WhatIfPanel } from "@/components/whatif-panel"

// map + 3D must be client-only
const CityMap = dynamic(() => import("@/components/city-map").then((m) => m.CityMap), {
  ssr: false,
  loading: () => <ViewLoading label="Loading map" />,
})
const Hologram2D = dynamic(() => import("@/components/hologram-2d").then((m) => m.Hologram2D), {
  ssr: false,
})
const Hologram3D = dynamic(() => import("@/components/hologram-3d").then((m) => m.Hologram3D), {
  ssr: false,
  loading: () => <ViewLoading label="Projecting hologram" />,
})

type ViewMode = "map" | "2d" | "3d"
type Weights = { time: number; distance: number; congestion: number }
type Scenario = { type: ScenarioType; intensity: number }

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function Page() {
  const [view, setView] = useState<ViewMode>("map")
  const [weights, setWeights] = useState<Weights>({ time: 0.5, distance: 0.2, congestion: 0.3 })
  const [scenario, setScenario] = useState<Scenario>({ type: "none", intensity: 0.6 })
  const [selected, setSelected] = useState<string | null>(null)
  const [basemap, setBasemap] = useState<Basemap>("satellite")
  const [flyTo, setFlyTo] = useState<FlyTarget | null>(null)
  const [place, setPlace] = useState<Place | null>(null)
  const [density, setDensity] = useState(0.7)
  const [appMode, setAppMode] = useState<"event" | "directions">("event")
  const [tripStart, setTripStart] = useState<LatLng | null>(null)
  const [tripEnd, setTripEnd] = useState<LatLng | null>(null)
  // Real OSM/OSRM navigation state
  const [navFrom, setNavFrom] = useState<NavPoint | null>(null)
  const [navTo, setNavTo] = useState<NavPoint | null>(null)
  const [travelMode, setTravelMode] = useState<TravelMode>("driving")
  const [activeNavId, setActiveNavId] = useState<string | null>(null)
  const [navStops, setNavStops] = useState<NavPoint[]>([])
  const [pois, setPois] = useState<Poi[]>([])
  const [layersOpen, setLayersOpen] = useState(false)
  // What-if scenario for the REAL routing/AI layer (separate from the grid twin).
  const [intelScenario, setIntelScenario] = useState<{ type: IntelScenarioType; intensity: number }>({
    type: "none",
    intensity: 0.6,
  })
  const [layers, setLayers] = useState<MapLayers>({
    traffic: true,
    incidents: true,
    pollution: false,
    closures: true,
  })

  // "Neon" view = the dark carto basemap; "Satellite" = Esri hybrid imagery.
  const isSatellite = basemap !== "dark"
  function handlePlace(p: Place) {
    setPlace(p)
    setDensity(areaDensityFor(p.kind))
    setFlyTo({ lat: p.lat, lng: p.lng, zoom: p.kind === "country" ? 6 : p.kind === "state" ? 9 : 13, nonce: Date.now() })
  }

  // Keep the A/B map markers and the routing endpoints in sync.
  function pickFrom(p: NavPoint | null) {
    setNavFrom(p)
    setTripStart(p ? { lat: p.lat, lng: p.lon } : null)
    if (p) setFlyTo({ lat: p.lat, lng: p.lon, zoom: 13, nonce: Date.now() })
  }
  function pickTo(p: NavPoint | null) {
    setNavTo(p)
    setTripEnd(p ? { lat: p.lat, lng: p.lon } : null)
  }

  // Google-Maps-style point picking: 1st click = start (A), 2nd = end (B),
  // 3rd click starts a fresh trip. Labels come from reverse geocoding.
  async function handleMapClick(p: LatLng) {
    if (appMode !== "directions") return
    // While navigating, a click means "I'm here now" — this drives the
    // off-route/reroute path on desktop where there is no moving GPS.
    if (navigating) {
      geo.setManualFix(p.lat, p.lng)
      return
    }
    const fallback = `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`
    const asStart = !navFrom || (navFrom && navTo)
    if (asStart) {
      setNavFrom({ lat: p.lat, lon: p.lng, label: fallback })
      setTripStart(p)
      setNavTo(null)
      setTripEnd(null)
    } else {
      setNavTo({ lat: p.lat, lon: p.lng, label: fallback })
      setTripEnd(p)
    }
    try {
      const res = await fetch(`/api/geocode?lat=${p.lat}&lon=${p.lng}`)
      const body = await res.json()
      const label: string | undefined = body?.place?.name || body?.place?.address?.split(",")[0]
      if (!res.ok || !label) return
      if (asStart) setNavFrom((v) => (v ? { ...v, label } : v))
      else setNavTo((v) => (v ? { ...v, label } : v))
    } catch {
      // keep coordinate label if reverse geocoding fails
    }
  }

  const query = useMemo(() => {
    const center = place ? `&lat=${place.lat}&lng=${place.lng}` : ""
    if (appMode === "directions") {
      const pts =
        tripStart && tripEnd
          ? `&fromLat=${tripStart.lat}&fromLng=${tripStart.lng}&toLat=${tripEnd.lat}&toLng=${tripEnd.lng}`
          : ""
      return (
        `/api/plan?mode=directions&wTime=${weights.time}&wDistance=${weights.distance}` +
        `&wCongestion=${weights.congestion}&scenario=${scenario.type}&intensity=${scenario.intensity}` +
        `&density=${density}${center}${pts}`
      )
    }
    return (
      `/api/plan?wTime=${weights.time}&wDistance=${weights.distance}&wCongestion=${weights.congestion}` +
      `&scenario=${scenario.type}&intensity=${scenario.intensity}&density=${density}${center}`
    )
  }, [weights, scenario, density, place, appMode, tripStart, tripEnd])
  const { data, error } = useSWR<PlanResponse>(query, fetcher, { refreshInterval: 15000 })
  const live = !!data && !error
  const areaNames = useAreaNames(data)

  // Only stops that were actually resolved to coordinates are routable.
  const validStops = useMemo(() => navStops.filter((w) => w.lat !== 0 || w.lon !== 0), [navStops])

  // Real routing (OSRM over OpenStreetMap) — active in Directions mode.
  const nav = useNavigationRoute(
    appMode === "directions" ? navFrom : null,
    appMode === "directions" ? navTo : null,
    travelMode,
    validStops,
  )
  const activeRouteId = nav.routes.some((r) => r.id === activeNavId) ? activeNavId : (nav.routes[0]?.id ?? null)

  // AI decision layer: scores the same trip with traffic, weather + incidents.
  const intel = useRouteIntel(
    appMode === "directions" ? navFrom : null,
    appMode === "directions" ? navTo : null,
    travelMode,
    validStops,
    intelScenario,
  )
  const scenarioActive = intelScenario.type !== "none" && !!intel.scenario

  // Device location + live navigation session (progress, off-route, reroute).
  const geo = useGeolocation()
  const session = useNavSession({
    routes: nav.routes,
    selectedRouteId: activeRouteId,
    destination: navTo,
    waypoints: validStops,
    mode: travelMode,
    fix: geo.fix,
  })

  const navigating = session.state === "navigating" || session.state === "rerouting"

  // Track continuously only while navigating; release the watcher otherwise.
  useEffect(() => {
    if (navigating) geo.startWatch()
    else geo.stopWatch()
  }, [navigating]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Sets the live position as the routing origin. */
  function useMyLocation() {
    geo.locateOnce()
  }
  // Once a fix lands from the "My location" button, adopt it as origin A.
  const adoptedFix = useRef(false)
  useEffect(() => {
    if (!geo.fix || navigating || adoptedFix.current) return
    adoptedFix.current = true
    const p: NavPoint = { lat: geo.fix.lat, lon: geo.fix.lon, label: "My location" }
    setNavFrom(p)
    setTripStart({ lat: p.lat, lng: p.lon })
    setFlyTo({ lat: p.lat, lng: p.lon, zoom: 15, nonce: Date.now() })
  }, [geo.fix, navigating])
  useEffect(() => {
    if (!geo.fix) adoptedFix.current = false
  }, [geo.fix])

  /** POI "Directions": the POI becomes B, origin stays A (or the live fix). */
  function poiDirections(p: NavPoint) {
    setAppMode("directions")
    if (!navFrom && geo.fix) {
      setNavFrom({ lat: geo.fix.lat, lon: geo.fix.lon, label: "My location" })
      setTripStart({ lat: geo.fix.lat, lng: geo.fix.lon })
    }
    setNavTo(p)
    setTripEnd({ lat: p.lat, lng: p.lon })
    setActiveNavId(null)
  }

  // While rerouted, draw the recalculated line instead of the stale plan.
  const drawnRoutes = useMemo(() => {
    if (session.isRerouted && session.route) {
      return [{ id: session.route.id, label: session.route.label, latLngs: session.route.latLngs }]
    }
    // A simulated closure/flood forces a genuine engine re-route — draw that.
    if (scenarioActive && intel.scenario?.rerouted && intel.routes.length > 0) {
      return intel.routes.map((r) => ({ id: r.id, label: `${r.label} (scenario)`, latLngs: r.latLngs }))
    }
    return nav.routes.map((r) => ({ id: r.id, label: r.label, latLngs: r.latLngs }))
  }, [session.isRerouted, session.route, nav.routes, scenarioActive, intel.scenario?.rerouted, intel.routes])

  // POI search anchor: live position first, else chosen origin, else viewport.
  const poiCenter = geo.fix
    ? { lat: geo.fix.lat, lon: geo.fix.lon }
    : navFrom
      ? { lat: navFrom.lat, lon: navFrom.lon }
      : place
        ? { lat: place.lat, lon: place.lng }
        : null

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground md:flex-row">
      {/* view area */}
      <div className="relative min-h-0 flex-1">
        {/* grid backdrop for hologram modes */}
        {view !== "map" && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 opacity-20"
            style={{
              backgroundImage:
                "linear-gradient(var(--color-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-primary) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
              maskImage: "radial-gradient(ellipse at center, black 20%, transparent 72%)",
            }}
          />
        )}

        <div className="absolute inset-0 z-0">
          {data ? (
            view === "map" ? (
              <CityMap
                data={data}
                selectedInviteeId={selected}
                basemap={basemap}
                layers={layers}
                flyTo={flyTo}
                directions={appMode === "directions"}
                tripStart={tripStart}
                tripEnd={tripEnd}
                onMapClick={handleMapClick}
                navRoutes={drawnRoutes}
                activeNavId={session.isRerouted ? drawnRoutes[0]?.id : activeRouteId}
                currentPos={geo.fix ? { lat: geo.fix.lat, lng: geo.fix.lon, accuracy: geo.fix.accuracy } : null}
                snappedPos={
                  session.progress
                    ? { lat: session.progress.snapped[0], lng: session.progress.snapped[1] }
                    : null
                }
                followPos={navigating && session.follow}
                navigating={navigating}
                waypoints={validStops.map((w) => ({ lat: w.lat, lng: w.lon }))}
                pois={pois.map((p) => ({ id: p.id, name: p.name, lat: p.lat, lon: p.lon }))}
                geoIncidents={intel.incidents}
                onLocate={() => {
                  if (geo.fix) setFlyTo({ lat: geo.fix.lat, lng: geo.fix.lon, zoom: 16, nonce: Date.now() })
                  else geo.locateOnce()
                }}
              />
            ) : view === "2d" ? (
              <Hologram2D data={data} selectedInviteeId={selected} />
            ) : (
              <Hologram3D
                data={data}
                selectedInviteeId={selected}
                follow={navigating && session.follow}
                // Real geographic geometry feeds the twin — no hard-coded 3D points.
                nav={
                  appMode === "directions" && drawnRoutes.length > 0
                    ? {
                        routes: drawnRoutes.map((r) => ({ id: r.id, latLngs: r.latLngs })),
                        activeId: session.isRerouted ? drawnRoutes[0].id : activeRouteId,
                        origin: navFrom,
                        destination: navTo,
                        waypoints: validStops,
                        currentPos: geo.fix ? { lat: geo.fix.lat, lon: geo.fix.lon } : null,
                        pois: pois.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon })),
                        incidents: intel.incidents.map((i) => ({
                          id: i.id,
                          lat: i.lat,
                          lon: i.lon,
                          type: i.type,
                          severity: i.severity,
                          radiusMeters: i.radiusMeters,
                        })),
                      }
                    : null
                }
              />
            )
          ) : (
            <ViewLoading label={error ? "Failed to load" : "Optimizing routes"} />
          )}
        </div>

        {/* overlay header */}
        <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 backdrop-blur-md">
            <div>
              <h1 className="font-mono text-sm font-semibold tracking-tight text-balance">
                ROUTE<span className="text-primary">CAST</span>
              </h1>
              <p className="text-[10px] text-muted-foreground">Event route digital twin</p>
            </div>
            <a
              href="/presentation"
              className="rounded-full border border-primary/50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-primary transition-colors hover:bg-primary/10"
            >
              Deck
            </a>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            {view === "map" && (
              <button
                onClick={() => setBasemap(isSatellite ? "dark" : "hybrid")}
                aria-label={isSatellite ? "Switch to neon view" : "Switch to satellite view"}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-foreground backdrop-blur-md transition-colors hover:border-primary"
              >
                {isSatellite ? <Moon className="h-3.5 w-3.5" /> : <Satellite className="h-3.5 w-3.5 text-primary" />}
                {isSatellite ? "Neon" : "Satellite"}
              </button>
            )}
            {scenario.type !== "none" && (
              <span className="rounded-full border border-destructive/50 bg-card px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-destructive backdrop-blur-md">
                Scenario
              </span>
            )}
            <span
              className={`flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest backdrop-blur-md ${
                live ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${live ? "animate-pulse bg-primary" : "bg-muted-foreground"}`} />
              {live ? "Live" : "…"}
            </span>
          </div>
        </header>

        {/* worldwide location search + mode toggle (map view only) */}
        {view === "map" && (
          <div className="absolute left-1/2 top-20 z-20 flex -translate-x-1/2 flex-col items-center gap-1.5">
            <LocationSearch onSelect={handlePlace} />
            <div className="pointer-events-auto flex gap-1 rounded-full border border-border bg-card p-0.5 backdrop-blur-md">
              {(
                [
                  { id: "event", label: "Event" },
                  { id: "directions", label: "Directions" },
                ] as { id: "event" | "directions"; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setAppMode(m.id)}
                  className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                    appMode === m.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {place && (
              <span className="pointer-events-none rounded-full border border-border bg-card px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-primary backdrop-blur-md">
                Viewing · {place.label.split(",").slice(0, 2).join(", ")}
              </span>
            )}
            {appMode === "directions" && (
              <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-[10px] text-muted-foreground backdrop-blur-md">
                {navigating ? (
                  <span className="text-primary">Click map to move your position</span>
                ) : (
                  <>
                    <span className={tripStart ? "text-primary" : ""}>A {tripStart ? "set" : "· click map"}</span>
                    <span className="text-border">|</span>
                    <span className={tripEnd ? "text-primary" : ""}>B {tripEnd ? "set" : "· click map"}</span>
                  </>
                )}
                {validStops.length > 0 && <span className="text-primary">· {validStops.length} stop(s)</span>}
                {(tripStart || tripEnd) && (
                  <button
                    onClick={() => {
                      setTripStart(null)
                      setTripEnd(null)
                      setNavFrom(null)
                      setNavTo(null)
                      setActiveNavId(null)
                      setNavStops([])
                      setPois([])
                      session.stop()
                      geo.clearFix()
                    }}
                    className="ml-1 rounded-full border border-border px-1.5 uppercase tracking-wider hover:border-primary hover:text-foreground"
                  >
                    Reset
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* layer + basemap controls (map view only) */}
        {view === "map" && (
          <div className="absolute right-4 top-20 z-10 flex flex-col items-end gap-1.5">
            <button
              onClick={() => setLayersOpen((o) => !o)}
              aria-expanded={layersOpen}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-foreground backdrop-blur-md transition-colors hover:border-primary"
            >
              <Layers className="h-3.5 w-3.5 text-primary" aria-hidden />
              Layers
            </button>
            {layersOpen && (
              <LayerControls basemap={basemap} onBasemap={setBasemap} layers={layers} onLayers={setLayers} />
            )}
          </div>
        )}

        {/* live turn-by-turn HUD (map + 3D twin) */}
        {session.route && session.state !== "idle" && session.state !== "route_ready" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-16 z-20 flex justify-center px-3">
            <NavHud
              state={session.state}
              route={session.route}
              progress={session.progress}
              error={session.error}
              rerouteCount={session.rerouteCount}
              isRerouted={session.isRerouted}
              follow={session.follow}
              onFollow={session.setFollow}
              onStop={session.stop}
              onRetry={session.retry}
              simulated={geo.isSimulated}
            />
          </div>
        )}

        {/* awaiting the first fix after pressing Start */}
        {navigating && !geo.fix && (
          <div className="pointer-events-none absolute inset-x-0 bottom-16 z-20 flex justify-center px-3">
            <p className="rounded-full border border-primary/40 bg-card px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary backdrop-blur-md">
              Waiting for GPS fix…
            </p>
          </div>
        )}

        {/* view toggle */}
        <div className="pointer-events-auto absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1 rounded-xl border border-border bg-card p-1 backdrop-blur-md">
          {(
            [
              { id: "map", label: "Map" },
              { id: "2d", label: "2D Holo" },
              { id: "3d", label: "3D Holo" },
            ] as { id: ViewMode; label: string }[]
          ).map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`rounded-lg px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                view === v.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* control panel */}
      <aside className="max-h-[46vh] w-full overflow-y-auto border-t border-border bg-background p-5 md:h-screen md:max-h-screen md:w-96 md:border-l md:border-t-0">
        {data ? (
          <div className="flex flex-col gap-7">
            {appMode === "directions" && (
              <NavigationPanel
                from={navFrom}
                to={navTo}
                onFrom={pickFrom}
                onTo={pickTo}
                mode={travelMode}
                onMode={setTravelMode}
                routes={nav.routes}
                activeRouteId={activeRouteId}
                onActiveRoute={setActiveNavId}
                loading={nav.loading}
                error={nav.error}
                engine={nav.engine}
                trafficNote={nav.trafficNote}
                waypoints={navStops}
                onWaypoints={setNavStops}
                gpsStatus={geo.status}
                gpsMessage={geo.message}
                onUseMyLocation={useMyLocation}
                navState={session.state}
                onStartNav={() => {
                  geo.startWatch()
                  session.start()
                }}
              />
            )}
            {appMode === "directions" && (
              <RouteIntelPanel
                intel={intel.intel}
                loading={intel.loading}
                error={intel.error}
                simulated={scenarioActive}
                activeRouteId={activeRouteId}
                onSelectRoute={setActiveNavId}
              />
            )}
            {appMode === "directions" && (
              <WhatIfPanel
                scenario={intelScenario}
                onScenario={setIntelScenario}
                baseline={intel.baseline}
                result={intel.scenario}
                loading={intel.loading}
                ready={!!navFrom && !!navTo}
              />
            )}
            {appMode === "directions" && (
              <PoiPanel
                center={poiCenter}
                centerLabel={geo.fix ? "my location" : navFrom?.label || place?.label?.split(",")[0]}
                pois={pois}
                onPois={setPois}
                onDirections={poiDirections}
                onAddStop={(p) => setNavStops((w) => [...w, p])}
                onFocus={(p) => setFlyTo({ lat: p.lat, lng: p.lon, zoom: 16, nonce: Date.now() })}
              />
            )}
            <MlStatus ml={data.ml} />
            <MetricsDashboard metrics={data.metrics} avgTravelMin={data.avgTravelMin} />
            <ScenarioPanel scenario={scenario} onScenario={setScenario} />
            {scenario.type !== "none" && (
              <ComparisonTable
                baseMetrics={data.baseline.metrics}
                scenMetrics={data.metrics}
                baseAvgTravel={data.baseline.avgTravelMin}
                scenAvgTravel={data.avgTravelMin}
              />
            )}
            <ForecastStrip forecast={data.forecast} source={data.forecastSource} />
            <ControlPanel
              data={data}
              weights={weights}
              onWeights={setWeights}
              selectedInviteeId={selected}
              onSelect={setSelected}
              areaNames={areaNames}
            />
          </div>
        ) : (
          <p className="font-mono text-xs text-muted-foreground">Loading event plan…</p>
        )}
      </aside>
    </main>
  )
}

// Rough urban-density estimate from the geocoder's place type. A city is
// dense (slow, congested); a state/country is an average of mixed terrain.
function areaDensityFor(kind: string): number {
  const k = kind.toLowerCase()
  if (["city", "town", "suburb", "neighbourhood", "borough", "municipality"].includes(k)) return 0.85
  if (["village", "hamlet"].includes(k)) return 0.5
  if (["state", "region", "province", "county", "administrative"].includes(k)) return 0.55
  if (["country"].includes(k)) return 0.45
  return 0.7
}

function ViewLoading({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{label}…</span>
    </div>
  )
}

function MlStatus({ ml }: { ml: PlanResponse["ml"] }) {
  const active = ml.eta || ml.congestion
  return (
    <section className="rounded-xl border border-border bg-card/50 p-3">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-widest text-primary">AI model engine</h2>
        <span
          className="rounded-full border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider"
          style={{
            borderColor: active ? "#22d3ee" : "var(--color-border)",
            color: active ? "#22d3ee" : "var(--color-muted-foreground)",
          }}
        >
          {active ? "ONNX active" : "Heuristic"}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[10px] text-muted-foreground">
        <span>ETA model: {ml.eta ? <span className="text-primary">loaded</span> : "fallback"}</span>
        <span>Forecast model: {ml.congestion ? <span className="text-primary">loaded</span> : "fallback"}</span>
        <span className="col-span-2">
          Re-routed by AI:{" "}
          <span className={ml.reroutedCount > 0 ? "text-primary" : ""}>
            {ml.reroutedCount} {ml.reroutedCount === 1 ? "invitee" : "invitees"}
          </span>{" "}
          · density {ml.context.areaDensity.toFixed(2)}
          {ml.context.rain > 0 && ` · rain ${ml.context.rain.toFixed(1)}`}
        </span>
      </div>
      {!active && (
        <p className="mt-2 text-[10px] text-pretty text-muted-foreground">
          Train models in <span className="font-mono text-foreground">/ml</span> (see README) and drop the .onnx files
          in <span className="font-mono text-foreground">/models</span> to activate AI predictions.
        </p>
      )}
    </section>
  )
}
