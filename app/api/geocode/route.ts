import { NextResponse } from "next/server"
import { searchPlaces, reversePlace, GeoError } from "@/lib/geo/geocoder"

/**
 * GET /api/geocode?q=...            -> forward geocoding (worldwide search)
 * GET /api/geocode?lat=..&lon=..    -> reverse geocoding
 * Server-side so the geocoder URL/UA stay configurable and off the client.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")
  const lat = searchParams.get("lat")
  const lon = searchParams.get("lon") ?? searchParams.get("lng")

  try {
    if (lat !== null && lon !== null) {
      const place = await reversePlace(Number(lat), Number(lon))
      if (!place) return NextResponse.json({ place: null, error: "no place found at these coordinates" }, { status: 404 })
      return NextResponse.json({ place })
    }
    if (q && q.trim()) {
      const limit = Number(searchParams.get("limit") ?? 6)
      const places = await searchPlaces(q, Number.isFinite(limit) ? limit : 6)
      return NextResponse.json({ places })
    }
    return NextResponse.json({ error: "provide ?q= or ?lat=&lon=" }, { status: 400 })
  } catch (err) {
    const e = err as GeoError
    return NextResponse.json({ error: e.message || "geocoding failed" }, { status: e.status ?? 502 })
  }
}
