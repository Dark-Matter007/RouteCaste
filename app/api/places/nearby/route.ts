import { NextResponse } from "next/server"
import { findNearbyPois, POI_CATEGORIES } from "@/lib/geo/places"
import { GeoError } from "@/lib/geo/geocoder"

/** GET /api/places/nearby?category=hospital&lat=..&lon=..&radius=5000 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const category = url.searchParams.get("category")

  // No category -> advertise the available ones (used to build the UI chips).
  if (!category) return NextResponse.json({ categories: POI_CATEGORIES })

  const lat = Number(url.searchParams.get("lat"))
  const lon = Number(url.searchParams.get("lon"))
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "valid lat and lon are required" }, { status: 400 })
  }

  const radius = Math.min(Math.max(Number(url.searchParams.get("radius")) || 5000, 250), 50_000)
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 50)

  try {
    const { source, pois } = await findNearbyPois(category, lat, lon, radius, limit)
    return NextResponse.json({ source, category, radius, count: pois.length, pois })
  } catch (err) {
    const e = err as GeoError
    return NextResponse.json({ error: e.message || "POI lookup failed" }, { status: e.status ?? 502 })
  }
}
