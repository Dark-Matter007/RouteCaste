import { NextResponse } from "next/server"

type OverpassWay = {
  id: number
  tags?: { highway?: string }
  geometry?: { lat: number; lon: number }[]
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function timeOfDayCongestion(hour: number, isWeekend: boolean) {
  const peaks = isWeekend ? [{ h: 12, w: 0.35 }, { h: 19, w: 0.4 }] : [{ h: 9, w: 0.72 }, { h: 18.5, w: 0.8 }]
  let congestion = isWeekend ? 0.16 : 0.22
  for (const peak of peaks) {
    const distance = Math.min(Math.abs(hour - peak.h), 24 - Math.abs(hour - peak.h))
    congestion += peak.w * Math.exp(-(distance * distance) / 3.2)
  }
  if (hour >= 0 && hour < 5) congestion *= 0.35
  return clamp01(congestion)
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radiusKm = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function POST(request: Request) {
  let body: { lat?: unknown; lng?: unknown; impactRadiusMeters?: unknown; eventLoad?: unknown; hourOverride?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ segments: [] })
  }

  const { lat, lng, impactRadiusMeters, eventLoad, hourOverride } = body
  if (
    !isFiniteNumber(lat) || lat < -90 || lat > 90 ||
    !isFiniteNumber(lng) || lng < -180 || lng > 180 ||
    !isFiniteNumber(impactRadiusMeters) || impactRadiusMeters < 0 ||
    !isFiniteNumber(eventLoad)
  ) {
    return NextResponse.json({ segments: [] })
  }

  const radiusMeters = Math.min(2000, impactRadiusMeters * 2)
  const now = new Date()
  let hour = now.getHours() + now.getMinutes() / 60
  if (typeof hourOverride === "number" && Number.isFinite(hourOverride) && hourOverride >= 0 && hourOverride <= 24) {
    hour = Math.min(23 + 59 / 60, hourOverride)
  }
  const isWeekend = now.getDay() === 0 || now.getDay() === 6
  const timePrior = timeOfDayCongestion(hour, isWeekend)
  const deltaLat = Math.min(0.02, radiusMeters / 111_000)
  const longitudeScale = Math.max(0.01, Math.cos((lat * Math.PI) / 180))
  const deltaLng = Math.min(0.02, radiusMeters / (111_000 * longitudeScale))
  const south = Math.max(-90, lat - deltaLat)
  const north = Math.min(90, lat + deltaLat)
  const west = Math.max(-180, lng - deltaLng)
  const east = Math.min(180, lng + deltaLng)
  const highwayTypes = "motorway|trunk|primary|secondary|tertiary|residential|unclassified"
  const query = `[out:json][timeout:15];way["highway"~"^(${highwayTypes})$"](${south},${west},${north},${east});out geom;`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
      cache: "no-store",
    })
    if (!response.ok) return NextResponse.json({ segments: [] })

    const data = (await response.json()) as { elements?: OverpassWay[] }
    const segments = (data.elements ?? []).flatMap((way) => {
      const geometry = way.geometry ?? []
      if (geometry.length < 2) return []
      const middle = geometry[Math.floor(geometry.length / 2)]
      const proximity = Math.exp(-haversineKm(lat, lng, middle.lat, middle.lon) / 1.0)
      const congestion = clamp01(Math.max(0.25, timePrior) + clamp01(eventLoad) * 0.65 * proximity)
      return [{
        points: geometry.map((point): [number, number] => [point.lat, point.lon]),
        congestion,
        highway: way.tags?.highway ?? "unclassified",
      }]
    })
    return NextResponse.json({ segments })
  } catch {
    return NextResponse.json({ segments: [] })
  } finally {
    clearTimeout(timeout)
  }
}
