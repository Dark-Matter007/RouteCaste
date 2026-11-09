// Geocoding service (OpenStreetMap Nominatim by default).
// Service URL is configurable so a self-hosted Nominatim can be swapped in
// without touching call sites.

const GEOCODING_URL = process.env.GEOCODING_URL || "https://nominatim.openstreetmap.org"

// Nominatim's usage policy requires an identifying UA on server-side calls.
const UA = process.env.GEO_USER_AGENT || "RouteCast/1.0 (capstone digital twin)"

export type GeoPlace = {
  id: string
  name: string
  address: string
  lat: number
  lon: number
  type: string
  region?: string
  country?: string
}

export class GeoError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message)
    this.name = "GeoError"
  }
}

async function getJson(url: string, timeoutMs = 9000): Promise<unknown> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": UA },
    })
    if (!res.ok) throw new GeoError(`geocoder responded ${res.status}`, res.status === 429 ? 429 : 502)
    return await res.json()
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new GeoError("geocoder timed out", 504)
    if (err instanceof GeoError) throw err
    throw new GeoError((err as Error).message || "geocoder unavailable")
  } finally {
    clearTimeout(timer)
  }
}

type NominatimRow = {
  place_id?: number | string
  display_name: string
  name?: string
  lat: string
  lon: string
  type: string
  addresstype?: string
  class?: string
  address?: Record<string, string>
}

function toPlace(r: NominatimRow): GeoPlace {
  const a = r.address ?? {}
  const parts = r.display_name.split(",").map((s) => s.trim())
  return {
    id: String(r.place_id ?? `${r.lat},${r.lon}`),
    name: r.name?.trim() || parts[0] || r.display_name,
    address: r.display_name,
    lat: Number.parseFloat(r.lat),
    lon: Number.parseFloat(r.lon),
    type: r.addresstype || r.type || r.class || "place",
    region: a.state || a.region || a.county,
    country: a.country || parts[parts.length - 1],
  }
}

/** Forward geocoding: free-text query -> ranked places worldwide. */
export async function searchPlaces(query: string, limit = 6): Promise<GeoPlace[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const url =
    `${GEOCODING_URL}/search?format=jsonv2&addressdetails=1&limit=${Math.min(limit, 20)}` +
    `&q=${encodeURIComponent(q)}`
  const rows = (await getJson(url)) as NominatimRow[]
  if (!Array.isArray(rows)) return []
  return rows.filter((r) => Number.isFinite(Number(r.lat))).map(toPlace)
}

/** Reverse geocoding: coordinates -> human readable place. */
export async function reversePlace(lat: number, lon: number): Promise<GeoPlace | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new GeoError("invalid coordinates", 400)
  const url = `${GEOCODING_URL}/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lon}`
  const row = (await getJson(url)) as NominatimRow & { error?: string }
  if (!row || row.error || !row.lat) return null
  return toPlace(row)
}
