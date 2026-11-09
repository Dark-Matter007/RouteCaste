import { NextResponse } from "next/server"
import type { TravelMode } from "@/hooks/use-navigation-route"

const EARTH_RADIUS_M = 6_371_000
const DISTANCES_M = [250, 500, 750, 1000, 1500, 2000, 2500, 3000]
const BEARING_COUNT = 15
const WALKING_KMH = 4.8
const CYCLING_KMH = 15

type LatLng = [number, number]
type TableResponse = {
  code?: string
  durations?: (number | null)[][]
  distances?: (number | null)[][]
}

function emptyResult() {
  return { normal: [] as LatLng[], affected: [] as LatLng[], reachableCount: 0, totalPoints: 120 }
}

function inRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum
}

function destinationPoint(lat: number, lng: number, distanceM: number, bearingDegrees: number): LatLng {
  const angular = distanceM / EARTH_RADIUS_M
  const bearing = (bearingDegrees * Math.PI) / 180
  const lat1 = (lat * Math.PI) / 180
  const lng1 = (lng * Math.PI) / 180
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing))
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
    Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
  )
  return [(lat2 * 180) / Math.PI, (((lng2 * 180) / Math.PI + 540) % 360) - 180]
}

function haversineM(a: LatLng, b: LatLng) {
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLng = ((b[1] - a[1]) * Math.PI) / 180
  const lat1 = (a[0] * Math.PI) / 180
  const lat2 = (b[0] * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function convexHull(points: LatLng[]): LatLng[] {
  if (points.length < 3) return []
  const unique = Array.from(new Map(points.map((point) => [`${point[0].toFixed(8)},${point[1].toFixed(8)}`, point])).values())
  if (unique.length < 3) return []

  let anchorIndex = 0
  for (let i = 1; i < unique.length; i++) {
    if (unique[i][0] < unique[anchorIndex][0] ||
      (unique[i][0] === unique[anchorIndex][0] && unique[i][1] < unique[anchorIndex][1])) anchorIndex = i
  }
  const anchor = unique.splice(anchorIndex, 1)[0]
  const cross = (a: LatLng, b: LatLng, c: LatLng) =>
    (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1])
  unique.sort((a, b) => {
    const angleA = Math.atan2(a[0] - anchor[0], a[1] - anchor[1])
    const angleB = Math.atan2(b[0] - anchor[0], b[1] - anchor[1])
    if (angleA !== angleB) return angleA - angleB
    return haversineM(anchor, a) - haversineM(anchor, b)
  })

  const hull: LatLng[] = [anchor]
  for (const point of unique) {
    while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) hull.pop()
    hull.push(point)
  }
  if (hull.length < 3) return []
  hull.push(hull[0])
  return hull
}

export async function POST(request: Request) {
  let body: {
    lat?: unknown
    lng?: unknown
    timeLimitMinutes?: unknown
    mode?: unknown
    eventLat?: unknown
    eventLng?: unknown
    eventLoad?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { lat, lng, timeLimitMinutes, mode, eventLat, eventLng, eventLoad } = body
  if (!inRange(lat, -90, 90) || !inRange(lng, -180, 180)) return NextResponse.json({ error: "Valid origin coordinates are required" }, { status: 400 })
  if (typeof timeLimitMinutes !== "number" || !Number.isFinite(timeLimitMinutes) || timeLimitMinutes < 1 || timeLimitMinutes > 30) {
    return NextResponse.json({ error: "timeLimitMinutes must be between 1 and 30" }, { status: 400 })
  }
  if (mode !== "driving" && mode !== "walking" && mode !== "cycling") {
    return NextResponse.json({ error: "mode must be driving, walking, or cycling" }, { status: 400 })
  }
  const hasEvent = eventLat !== undefined || eventLng !== undefined || eventLoad !== undefined
  if (hasEvent && (!inRange(eventLat, -90, 90) || !inRange(eventLng, -180, 180) || !inRange(eventLoad, 0, 1))) {
    return NextResponse.json({ error: "Event coordinates and eventLoad must be provided together and valid" }, { status: 400 })
  }

  const destinations: LatLng[] = []
  for (const distance of DISTANCES_M) {
    for (let bearingIndex = 0; bearingIndex < BEARING_COUNT; bearingIndex++) {
      destinations.push(destinationPoint(lat, lng, distance, bearingIndex * (360 / BEARING_COUNT)))
    }
  }

  const coordinates = [[lat, lng] as LatLng, ...destinations]
    .map(([pointLat, pointLng]) => `${pointLng},${pointLat}`)
    .join(";")
  // The public OSRM host in this project only serves the driving profile.
  // Walking/cycling estimates are retimed from OSRM road distances, matching routing.ts.
  const baseUrl = (process.env.ROUTING_URL || "https://router.project-osrm.org").replace(/\/$/, "")
  const url = `${baseUrl}/table/v1/driving/${coordinates}?sources=0&annotations=duration,distance`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)

  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } })
    if (!response.ok) return NextResponse.json(emptyResult())
    const data = (await response.json()) as TableResponse
    if (data.code !== "Ok" || !data.durations?.[0] || data.durations[0].length < destinations.length + 1) {
      return NextResponse.json(emptyResult())
    }

    const durations = data.durations[0]
    const distances = data.distances?.[0] ?? []
    const travelSeconds = (index: number) => {
      if (mode === "driving") return durations[index + 1]
      const distanceM = distances[index + 1]
      if (typeof distanceM !== "number" || !Number.isFinite(distanceM)) return null
      const speedKmh = mode === "walking" ? WALKING_KMH : CYCLING_KMH
      return (distanceM / 1000 / speedKmh) * 3600
    }

    const limitSeconds = timeLimitMinutes * 60
    const normalPoints: LatLng[] = []
    const affectedPoints: LatLng[] = []
    for (let i = 0; i < destinations.length; i++) {
      const duration = travelSeconds(i)
      if (duration === null || !Number.isFinite(duration)) continue
      if (duration <= limitSeconds) normalPoints.push(destinations[i])

      if (hasEvent && typeof eventLat === "number" && typeof eventLng === "number" && typeof eventLoad === "number") {
        const proximity = Math.exp(-haversineM(destinations[i], [eventLat, eventLng]) / 1500)
        const adjustedDuration = duration * (1 + eventLoad * proximity * 0.8)
        if (adjustedDuration <= limitSeconds) affectedPoints.push(destinations[i])
      }
    }

    return NextResponse.json({
      normal: convexHull(normalPoints),
      affected: hasEvent ? convexHull(affectedPoints) : [],
      reachableCount: normalPoints.length,
      totalPoints: destinations.length,
    })
  } catch {
    return NextResponse.json(emptyResult())
  } finally {
    clearTimeout(timeout)
  }
}
