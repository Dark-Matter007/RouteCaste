"use client"

import { useEffect, useMemo, useRef, useState } from "react"
<<<<<<< HEAD
import dynamic from "next/dynamic"
import type { Basemap, MapLayers, FlyTarget, LatLng } from "@/components/city-map"
import { LayerControls } from "@/components/layer-controls"
import { LocationSearch, type Place } from "@/components/location-search"
import { Satellite, Moon, Layers } from "lucide-react"
import { GUNTUR_BOUNDS, GUNTUR_CENTER, GUNTUR_PLACES } from "@/lib/guntur-places"
=======
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
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
import { NavigationPanel } from "@/components/navigation-panel"
import { useNavigationRoute, type NavPoint, type TravelMode } from "@/hooks/use-navigation-route"
import { useGeolocation } from "@/hooks/use-geolocation"
import { useNavSession } from "@/hooks/use-nav-session"
import { NavHud } from "@/components/nav-hud"
import { PoiPanel, type Poi } from "@/components/poi-panel"
import { useRouteIntel, type IntelScenarioType } from "@/hooks/use-route-intel"
import { RouteIntelPanel } from "@/components/route-intel-panel"
import { WhatIfPanel } from "@/components/whatif-panel"
<<<<<<< HEAD
import { EventSchedulerPanel } from "@/components/event-scheduler-panel"
import type { EventSimulationResponse } from "@/lib/types"
import { ImpactDashboard } from "@/components/impact-dashboard"
import { MetricsDashboard } from "@/components/metrics-dashboard"
import type { CityMetrics } from "@/lib/types"
import { TimeSlider } from "@/components/time-slider"
import { IsochronePanel } from "@/components/isochrone-panel"
import { EmergencyPanel } from "@/components/emergency-panel"

// Map must be client-only (Leaflet accesses window)
=======
import { GunturRoutePanel } from "@/components/guntur-route-panel"

// map + 3D must be client-only
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
const CityMap = dynamic(() => import("@/components/city-map").then((m) => m.CityMap), {
  ssr: false,
  loading: () => <ViewLoading label="Loading map" />,
})
<<<<<<< HEAD

type EventPin = { lat: number; lng: number; name: string; radiusMeters: number }
type HeatmapSegment = { points: [number, number][]; congestion: number; highway: string }

export default function Page() {
  const [basemap, setBasemap] = useState<Basemap>("satellite")
  const [flyTo, setFlyTo] = useState<FlyTarget | null>(null)
  const [place, setPlace] = useState<Place | null>(null)
  const [tripStart, setTripStart] = useState<LatLng | null>(null)
  const [tripEnd, setTripEnd] = useState<LatLng | null>(null)
=======
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
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
  const [navFrom, setNavFrom] = useState<NavPoint | null>(null)
  const [navTo, setNavTo] = useState<NavPoint | null>(null)
  const [travelMode, setTravelMode] = useState<TravelMode>("driving")
  const [activeNavId, setActiveNavId] = useState<string | null>(null)
  const [navStops, setNavStops] = useState<NavPoint[]>([])
  const [pois, setPois] = useState<Poi[]>([])
  const [layersOpen, setLayersOpen] = useState(false)
<<<<<<< HEAD
=======
  // What-if scenario for the REAL routing/AI layer (separate from the grid twin).
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
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

<<<<<<< HEAD
  // Event pin — placed by the user clicking the map in "event" mode
  const [eventPin, setEventPin] = useState<EventPin | null>(null)
  const [outOfBoundsWarning, setOutOfBoundsWarning] = useState(false)
  const [osrmStatus, setOsrmStatus] = useState<"checking" | "ok" | "down">("checking")
  const [simulationResult, setSimulationResult] = useState<EventSimulationResponse | null>(null)
  const [pendingDemoSimulate, setPendingDemoSimulate] = useState(false)
  const demoSimulationInFlight = useRef(false)
  const [eventIncidentLocation, setEventIncidentLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [eventDriven, setEventDriven] = useState(false)
  const eventDrivenRef = useRef(false)
  const [heatmapSegments, setHeatmapSegments] = useState<HeatmapSegment[]>([])
  const [timeOverride, setTimeOverride] = useState<number | null>(null)
  const [debouncedHeatmapHour, setDebouncedHeatmapHour] = useState<number | null>(timeOverride)
  const [isochroneNormal, setIsochroneNormal] = useState<[number, number][]>([])
  const [isochroneAffected, setIsochroneAffected] = useState<[number, number][]>([])
  const [emergencyRoute, setEmergencyRoute] = useState<[number, number][]>([])
  const [closurePoints, setClosurePoints] = useState<[{ lat: number; lng: number }, { lat: number; lng: number }] | null>(null)
  const [awaitingClosurePoint, setAwaitingClosurePoint] = useState<0 | 1 | null>(null)
  // Controls what a map click does: route A/B picking, event placement, or scenario incident pin
  const [mapClickMode, setMapClickMode] = useState<"route" | "event" | "scenario">("route")
  const [scenarioPin, setScenarioPin] = useState<{ lat: number; lon: number } | null>(null)
  // Timestamp guard: prevent the button-activation click from immediately placing the pin
  const scenarioModeActivatedAt = useRef<number>(0)
  const booted = useRef(false)
  const [urlStateReady, setUrlStateReady] = useState(false)

  // Restore shareable route and event state before syncing it back to the URL.
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    const params = new URLSearchParams(window.location.search)
    const fl = params.get("fl")
    const fo = params.get("fo")
    const fn = params.get("fn")
    const tl = params.get("tl")
    const to = params.get("to")
    const tn = params.get("tn")
    const el = params.get("el")
    const eo = params.get("eo")
    const en = params.get("en")
    const mode = params.get("mode")

    if (fl && fo && Number.isFinite(Number(fl)) && Number.isFinite(Number(fo))) {
      const from: NavPoint = { lat: Number(fl), lon: Number(fo), label: fn ?? undefined }
      setNavFrom(from)
      setTripStart({ lat: from.lat, lng: from.lon })
    }
    if (tl && to && Number.isFinite(Number(tl)) && Number.isFinite(Number(to))) {
      const destination: NavPoint = { lat: Number(tl), lon: Number(to), label: tn ?? undefined }
      setNavTo(destination)
      setTripEnd({ lat: destination.lat, lng: destination.lon })
    }
    if (el && eo && Number.isFinite(Number(el)) && Number.isFinite(Number(eo))) {
      setEventPin({ lat: Number(el), lng: Number(eo), name: en ?? "Event Location", radiusMeters: 500 })
    }
    if (mode === "driving" || mode === "walking" || mode === "cycling") setTravelMode(mode)
    setUrlStateReady(true)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)
    fetch("/api/navigation/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: { lat: 16.3067, lon: 80.4365 },
        destination: { lat: 16.2960, lon: 80.4572 },
        mode: "driving",
        alternatives: false,
      }),
      signal: controller.signal,
    })
      .then((response) => setOsrmStatus(response.ok ? "ok" : "down"))
      .catch(() => setOsrmStatus("down"))
      .finally(() => clearTimeout(timer))
    return () => controller.abort()
  }, [])

  // Sync key state into URL so the demo survives a refresh.
  useEffect(() => {
    if (!urlStateReady) return
    const params = new URLSearchParams()
    if (navFrom) {
      params.set("fl", String(navFrom.lat))
      params.set("fo", String(navFrom.lon))
      if (navFrom.label) params.set("fn", navFrom.label)
    }
    if (navTo) {
      params.set("tl", String(navTo.lat))
      params.set("to", String(navTo.lon))
      if (navTo.label) params.set("tn", navTo.label)
    }
    if (eventPin) {
      params.set("el", String(eventPin.lat))
      params.set("eo", String(eventPin.lng))
      params.set("en", eventPin.name)
    }
    if (travelMode !== "driving") params.set("mode", travelMode)
    const query = params.toString()
    const newUrl = query ? `?${query}` : window.location.pathname
    window.history.replaceState(null, "", newUrl)
  }, [navFrom, navTo, eventPin, travelMode, urlStateReady])

  useEffect(() => {
    if (!simulationResult) {
      if (eventDrivenRef.current) {
        setIntelScenario((previous) => previous.type === "traffic" ? { type: "none", intensity: 0.6 } : previous)
      }
      eventDrivenRef.current = false
      setEventDriven(false)
      setEventIncidentLocation(null)
      return
    }

    const intensity = Math.min(1, simulationResult.event.eventLoad * 1.3)
    eventDrivenRef.current = true
    setEventDriven(true)
    setIntelScenario({ type: "traffic", intensity })
    setEventIncidentLocation({ lat: simulationResult.event.lat, lon: simulationResult.event.lng })
  }, [simulationResult])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedHeatmapHour(timeOverride), 400)
    return () => clearTimeout(timer)
  }, [timeOverride])

  useEffect(() => {
    if (!simulationResult) {
      setHeatmapSegments([])
      return
    }

    const currentResult = simulationResult
    const controller = new AbortController()
    async function loadHeatmap() {
      try {
        const response = await fetch("/api/heatmap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: currentResult.event.lat,
            lng: currentResult.event.lng,
            impactRadiusMeters: currentResult.event.impactRadiusMeters,
            eventLoad: currentResult.event.eventLoad,
            ...(debouncedHeatmapHour === null ? {} : { hourOverride: debouncedHeatmapHour }),
          }),
          signal: controller.signal,
        })
        if (!response.ok) throw new Error("Heatmap request failed")
        const data = (await response.json()) as { segments?: HeatmapSegment[] }
        setHeatmapSegments(Array.isArray(data.segments) ? data.segments : [])
      } catch {
        if (!controller.signal.aborted) setHeatmapSegments([])
      }
    }

    void loadHeatmap()
    return () => controller.abort()
  }, [simulationResult, debouncedHeatmapHour])

  const isSatellite = basemap !== "dark"

  function handlePlace(p: Place) {
    setPlace(p)
=======
  // "Neon" view = the dark carto basemap; "Satellite" = Esri hybrid imagery.
  const isSatellite = basemap !== "dark"
  function handlePlace(p: Place) {
    setPlace(p)
    setDensity(areaDensityFor(p.kind))
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
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

<<<<<<< HEAD
  function loadDemo() {
    const from = GUNTUR_PLACES.find((place) => place.id === "guntur-jn")!
    const to = GUNTUR_PLACES.find((place) => place.id === "loyola-college")!
    const eventLoc = GUNTUR_PLACES.find((place) => place.id === "bus-stand")!

    pickFrom({ lat: from.lat, lon: from.lng, label: from.name })
    pickTo({ lat: to.lat, lon: to.lng, label: to.name })
    setEventPin({ lat: eventLoc.lat, lng: eventLoc.lng, name: "Sankranthi Festival", radiusMeters: 800 })
    setMapClickMode("route")
    setAwaitingClosurePoint(null)
    setClosurePoints(null)
    setFlyTo({ lat: GUNTUR_CENTER.lat, lng: GUNTUR_CENTER.lng, zoom: 14, nonce: Date.now() })
    setPendingDemoSimulate(true)
  }

  // Google-Maps-style point picking: 1st click = start (A), 2nd = end (B),
  // 3rd click starts a fresh trip.
  async function handleMapClick(p: LatLng) {
    if (awaitingClosurePoint !== null) {
      if (awaitingClosurePoint === 0) {
        setClosurePoints([{ lat: p.lat, lng: p.lng }, { lat: p.lat, lng: p.lng }])
        setAwaitingClosurePoint(1)
      } else {
        setClosurePoints((previous) => previous ? [previous[0], { lat: p.lat, lng: p.lng }] : null)
        setAwaitingClosurePoint(null)
      }
      return
    }

    if (mapClickMode === "event") {
      const inBounds =
        p.lat >= GUNTUR_BOUNDS.minLat && p.lat <= GUNTUR_BOUNDS.maxLat &&
        p.lng >= GUNTUR_BOUNDS.minLng && p.lng <= GUNTUR_BOUNDS.maxLng
      if (!inBounds) {
        setOutOfBoundsWarning(true)
        return
      }
      setOutOfBoundsWarning(false)
      setEventPin({ lat: p.lat, lng: p.lng, name: "Event Location", radiusMeters: 500 })
      return
    }

    if (mapClickMode === "scenario") {
      // Guard against the button-activation click bubbling through to the map
      if (Date.now() - scenarioModeActivatedAt.current < 400) return
      setScenarioPin({ lat: p.lat, lon: p.lng })
      setMapClickMode("route")
      return
    }

    // While navigating, a click means "I'm here now" — drives the
=======
  // Google-Maps-style point picking: 1st click = start (A), 2nd = end (B),
  // 3rd click starts a fresh trip. Labels come from reverse geocoding.
  async function handleMapClick(p: LatLng) {
    if (appMode !== "directions") return
    // While navigating, a click means "I'm here now" — this drives the
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
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

<<<<<<< HEAD
  // Only stops that were actually resolved to coordinates are routable.
  const validStops = useMemo(() => navStops.filter((w) => w.lat !== 0 || w.lon !== 0), [navStops])

  // Real routing (OSRM over OpenStreetMap)
  const nav = useNavigationRoute(navFrom, navTo, travelMode, validStops)
  const activeRouteId = nav.routes.some((r) => r.id === activeNavId) ? activeNavId : (nav.routes[0]?.id ?? null)

  useEffect(() => {
    if (!pendingDemoSimulate || nav.loading || nav.routes.length === 0 || !eventPin || demoSimulationInFlight.current) return

    const pin = eventPin
    const routes = nav.routes
    const timer = window.setTimeout(() => {
      demoSimulationInFlight.current = true
      async function simulateDemoEvent() {
        try {
          const response = await fetch("/api/event/simulate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: {
                name: "Sankranthi Festival",
                type: "festival",
                lat: pin.lat,
                lng: pin.lng,
                locationName: "Guntur Bus Stand (APSRTC)",
                startTime: new Date(Date.now() + 2 * 3600_000).toISOString(),
                endTime: new Date(Date.now() + 6 * 3600_000).toISOString(),
                attendance: 45000,
              },
              routes: routes.map((route) => ({
                id: route.id,
                label: route.label,
                distanceMeters: route.distanceMeters,
                durationSeconds: route.durationSeconds,
                samplePoints: route.latLngs.map(([lat, lng]) => ({ lat, lng })),
              })),
            }),
          })
          if (!response.ok) throw new Error("Demo event simulation failed")
          const data = (await response.json()) as EventSimulationResponse
          setSimulationResult(data)
        } catch (error) {
          console.error("Demo event simulation failed:", error)
        } finally {
          demoSimulationInFlight.current = false
          setPendingDemoSimulate(false)
        }
      }

      void simulateDemoEvent()
    }, 1200)

    return () => window.clearTimeout(timer)
  }, [pendingDemoSimulate, nav.routes, eventPin, nav.loading])

  // AI decision layer: scores the same trip with traffic, weather + incidents.
  // When event-driven, use the event's location; otherwise use the manually placed scenario pin.
  const intelIncidentLocation = eventDriven ? eventIncidentLocation : scenarioPin
  const intel = useRouteIntel(navFrom, navTo, travelMode, validStops, intelScenario, timeOverride, intelIncidentLocation)
  const scenarioActive = intelScenario.type !== "none" && !!intel.scenario

  useEffect(() => {
    const recommendedId = eventDriven ? intel.intel?.recommendation?.routeId : null
    if (recommendedId && nav.routes.some((route) => route.id === recommendedId)) setActiveNavId(recommendedId)
  }, [eventDriven, intel.intel?.recommendation?.routeId, nav.routes])

=======
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

>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
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
<<<<<<< HEAD
=======
    setAppMode("directions")
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
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

<<<<<<< HEAD
  const isochroneOrigin = tripStart ?? (eventPin ? { lat: eventPin.lat, lng: eventPin.lng } : null)

  // ── City metrics derived from live route + simulation state ──────────────
  const activeRoute = nav.routes.find((r) => r.id === activeRouteId) ?? nav.routes[0] ?? null
  const cityMetrics = useMemo((): CityMetrics => {
    const distKm = activeRoute ? activeRoute.distanceMeters / 1000 : 5
    const durationSec = activeRoute ? activeRoute.durationSeconds : 600
    const avgSpeedKmh = durationSec > 0 ? Math.round((distKm / durationSec) * 3600) : 30
    // congestion: use simulation result if available, else intel, else heuristic from speed
    const congestionIndex = simulationResult
      ? Math.min(1, simulationResult.event.eventLoad)
      : intel.intel?.routes?.[0]?.congestionScore != null
        ? intel.intel.routes[0].congestionScore / 100
        : Math.max(0, Math.min(1, 1 - avgSpeedKmh / 50))
    const congMultiplier = 1 + congestionIndex * 0.6
    const co2Kg = Math.round(distKm * 0.21 * congMultiplier * 10) / 10
    const fuelL = Math.round(distKm * 0.08 * congMultiplier * 10) / 10
    return {
      avgSpeedKmh,
      congestionIndex,
      activeIncidents: intel.incidents?.length ?? (simulationResult ? 1 : 0),
      aqi: simulationResult ? Math.round(60 + congestionIndex * 80) : 55,
      ambulanceResponseMin: Math.round(8 + congestionIndex * 7),
      co2Kg,
      fuelL,
    }
  }, [activeRoute, simulationResult, intel.intel, intel.incidents])

  const avgTravelMin = activeRoute ? Math.round(activeRoute.durationSeconds / 60) : 0

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground md:flex-row">
      {/* Map area */}
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 z-0">
          <CityMap
            basemap={basemap}
            layers={layers}
            flyTo={flyTo}
            tripStart={tripStart}
            tripEnd={tripEnd}
            onMapClick={handleMapClick}
            showStudyArea={mapClickMode === "event"}
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
            eventPin={eventPin}
            simulationResult={simulationResult}
            heatmapSegments={heatmapSegments}
            isochroneNormal={isochroneNormal}
            isochroneAffected={isochroneAffected}
            emergencyRoute={emergencyRoute}
            closurePoints={closurePoints}
            onLocate={() => {
              if (geo.fix) setFlyTo({ lat: geo.fix.lat, lng: geo.fix.lon, zoom: 16, nonce: Date.now() })
              else geo.locateOnce()
            }}
          />
=======
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
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
        </div>

        {/* overlay header */}
        <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 backdrop-blur-md">
            <div>
              <h1 className="font-mono text-sm font-semibold tracking-tight text-balance">
                ROUTE<span className="text-primary">CAST</span>
              </h1>
<<<<<<< HEAD
              <p className="text-[10px] text-muted-foreground">Guntur Digital Twin</p>
=======
              <p className="text-[10px] text-muted-foreground">Event route digital twin</p>
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
            </div>
            <a
              href="/presentation"
              className="rounded-full border border-primary/50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-primary transition-colors hover:bg-primary/10"
            >
              Deck
            </a>
<<<<<<< HEAD
            <span
              title={osrmStatus === "ok" ? "OSRM routing server online" : osrmStatus === "checking" ? "Checking routing server…" : "OSRM routing server unreachable"}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground backdrop-blur-md"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${osrmStatus === "ok" ? "bg-green-400" : osrmStatus === "checking" ? "bg-yellow-400 animate-pulse" : "bg-red-400"}`}
              />
              OSRM
            </span>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={loadDemo}
              className="flex items-center gap-1.5 rounded-full border border-primary/60 bg-primary/10 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary backdrop-blur-md transition-colors hover:bg-primary/20"
            >
              ▶ Demo
            </button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href).catch(() => null)
                const toast = document.getElementById("share-toast")
                if (toast) {
                  toast.style.opacity = "1"
                  setTimeout(() => { toast.style.opacity = "0" }, 1800)
                }
              }}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-foreground backdrop-blur-md transition-colors hover:border-primary"
              title="Copy shareable link"
            >
              🔗 Share
            </button>
            <span
              id="share-toast"
              aria-live="polite"
              className="pointer-events-none rounded-full bg-primary/10 px-2.5 py-1 font-mono text-[9px] text-primary transition-opacity duration-500"
              style={{ opacity: 0 }}
            >
              Link copied!
            </span>
            {/* Event placement mode indicator */}
            {mapClickMode === "event" && (
              <span className="rounded-full border border-primary bg-primary/10 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary backdrop-blur-md animate-pulse">
                Click map to place event
              </span>
            )}
            {/* Scenario incident pin indicator */}
            {mapClickMode === "scenario" && (
              <span className="rounded-full border border-destructive bg-destructive/10 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-destructive backdrop-blur-md animate-pulse">
                Click map to place incident
              </span>
            )}
            {outOfBoundsWarning && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-full border border-destructive/60 bg-destructive/10 px-3 py-1.5 font-mono text-[10px] text-destructive backdrop-blur-md"
              >
                ⚠ Outside Guntur study area — tap inside the city
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => setOutOfBoundsWarning(false)}
                  className="ml-1 opacity-60 hover:opacity-100"
                >
                  ×
                </button>
              </div>
            )}
            {awaitingClosurePoint !== null && (
              <span className="rounded-full border border-destructive bg-destructive/10 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-destructive backdrop-blur-md animate-pulse">
                Click map — closure point {awaitingClosurePoint === 0 ? "A" : "B"}
              </span>
            )}

            <button
              onClick={() => setBasemap(isSatellite ? "dark" : "hybrid")}
              aria-label={isSatellite ? "Switch to neon view" : "Switch to satellite view"}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-foreground backdrop-blur-md transition-colors hover:border-primary"
            >
              {isSatellite ? <Moon className="h-3.5 w-3.5" /> : <Satellite className="h-3.5 w-3.5 text-primary" />}
              {isSatellite ? "Neon" : "Satellite"}
            </button>
          </div>
        </header>

        {/* Location search + A/B route status bar */}
        <div className="absolute left-1/2 top-20 z-20 flex -translate-x-1/2 flex-col items-center gap-1.5">
          <LocationSearch onSelect={handlePlace} />

          {place && (
            <span className="pointer-events-none rounded-full border border-border bg-card px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-primary backdrop-blur-md">
              Viewing · {place.label.split(",").slice(0, 2).join(", ")}
            </span>
          )}

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
                  setIsochroneNormal([])
                  setIsochroneAffected([])
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
        </div>

        {/* Layer + basemap controls */}
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

        {/* Map toolbar: Place Event toggle */}
        <div className="pointer-events-auto absolute bottom-16 right-4 z-10 flex flex-col items-end gap-1.5">
          <button
            onClick={() => setMapClickMode((m) => (m === "event" ? "route" : "event"))}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest backdrop-blur-md transition-colors ${
              mapClickMode === "event"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-foreground hover:border-primary"
            }`}
          >
            📍 Place Event
          </button>
          {eventPin && (
            <button
              onClick={() => {
                setEventPin(null)
                setSimulationResult(null)
              }}
              className="rounded-full border border-border bg-card px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground backdrop-blur-md hover:border-destructive hover:text-destructive"
            >
              Clear Pin
            </button>
          )}
        </div>

        {/* Live turn-by-turn HUD */}
=======
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
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
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

<<<<<<< HEAD
        {/* Awaiting the first GPS fix after pressing Start */}
=======
        {/* awaiting the first fix after pressing Start */}
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
        {navigating && !geo.fix && (
          <div className="pointer-events-none absolute inset-x-0 bottom-16 z-20 flex justify-center px-3">
            <p className="rounded-full border border-primary/40 bg-card px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary backdrop-blur-md">
              Waiting for GPS fix…
            </p>
          </div>
        )}

<<<<<<< HEAD
        {/* Map-only view indicator at bottom */}
        <div className="pointer-events-auto absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1 rounded-xl border border-border bg-card p-1 backdrop-blur-md">
          <span className="rounded-lg px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider bg-primary text-primary-foreground">
            Map
          </span>
        </div>
      </div>

      {/* Sidebar — always visible, always showing real-road panels */}
      <aside className="h-[50vh] w-full overflow-y-auto border-t border-border bg-background p-5 md:h-screen md:w-96 md:border-l md:border-t-0">
        <div className="flex flex-col gap-7">
          {/* 1. Navigation (route A → B) */}
          <NavigationPanel
            from={navFrom}
            to={navTo}
            onFrom={pickFrom}
            onTo={pickTo}
            mode={travelMode}
            onMode={setTravelMode}
            routes={nav.routes}
            simulationResult={simulationResult}
            activeRouteId={activeRouteId}
            onActiveRoute={setActiveNavId}
            loading={nav.loading}
            error={nav.error}
            isFromCache={nav.isFromCache}
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

          <TimeSlider value={timeOverride} onChange={setTimeOverride} simulationResult={simulationResult} />

          {/* 2. Route intelligence (AI scoring + weather + risk) */}
          <RouteIntelPanel
            intel={intel.intel}
            loading={intel.loading}
            error={intel.error}
            simulated={scenarioActive}
            eventDriven={eventDriven}
            activeRouteId={activeRouteId}
            onSelectRoute={setActiveNavId}
          />

          <IsochronePanel
            origin={isochroneOrigin}
            mode={travelMode}
            simulationResult={simulationResult}
            onIsochrone={(normal, affected) => {
              setIsochroneNormal(normal)
              setIsochroneAffected(affected)
            }}
            onClear={() => {
              setIsochroneNormal([])
              setIsochroneAffected([])
            }}
          />

          <EmergencyPanel
            simulationResult={simulationResult}
            timeOverride={timeOverride}
            onEmergencyRoute={setEmergencyRoute}
            onClear={() => setEmergencyRoute([])}
          />

          {/* 3. What-if scenario simulator */}
          <WhatIfPanel
            scenario={intelScenario}
            onScenario={(nextScenario) => {
              eventDrivenRef.current = false
              setEventDriven(false)
              setEventIncidentLocation(null)
              setIntelScenario(nextScenario)
            }}
            baseline={intel.baseline}
            result={intel.scenario}
            loading={intel.loading}
            ready={!!navFrom && !!navTo}
            simulationResult={simulationResult}
            eventDriven={eventDriven}
            closurePoints={closurePoints}
            onClosurePoints={(points) => {
              setClosurePoints(points)
              if (points === null) setAwaitingClosurePoint(closurePoints === null ? 0 : null)
            }}
            scenarioPin={scenarioPin}
            onPlacePin={() => {
              scenarioModeActivatedAt.current = Date.now()
              setMapClickMode("scenario")
            }}
            onClearPin={() => setScenarioPin(null)}
          />

          {/* 4. POI search */}
          <PoiPanel
            center={poiCenter}
            centerLabel={geo.fix ? "my location" : navFrom?.label || place?.label?.split(",")[0]}
            pois={pois}
            onPois={setPois}
            onDirections={poiDirections}
            onAddStop={(p) => setNavStops((w) => [...w, p])}
            onFocus={(p) => setFlyTo({ lat: p.lat, lng: p.lon, zoom: 16, nonce: Date.now() })}
          />

          <EventSchedulerPanel
            eventPin={eventPin}
            onEventPin={setEventPin}
            routes={nav.routes.map((route) => ({
              id: route.id,
              label: route.label,
              distanceMeters: route.distanceMeters,
              durationSeconds: route.durationSeconds,
              latLngs: route.latLngs,
            }))}
            onSimulationResult={setSimulationResult}
          />
          <ImpactDashboard result={simulationResult} />

          {/* 6. Live city metrics */}
          <MetricsDashboard metrics={cityMetrics} avgTravelMin={avgTravelMin} />
        </div>
=======
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
            <GunturRoutePanel />
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
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
      </aside>
    </main>
  )
}

<<<<<<< HEAD
=======
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

>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
function ViewLoading({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{label}…</span>
    </div>
  )
}
<<<<<<< HEAD
=======

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
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
