// Real POI lookup over OpenStreetMap data.
// Primary source is Overpass (rich tags: phone, website, opening hours).
// If Overpass is busy/unavailable we fall back to Nominatim so the feature
// degrades instead of failing.

import { GeoError } from "@/lib/geo/geocoder"

const OVERPASS_URL = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter"
const GEOCODING_URL = process.env.GEOCODING_URL || "https://nominatim.openstreetmap.org"
const UA = process.env.GEO_USER_AGENT || "RouteCast/1.0 (capstone digital twin)"

/** Category id -> OSM tag filters + a Nominatim fallback keyword. */
const CATEGORIES: Record<string, { label: string; filters: string[]; keyword: string }> = {
  restaurant: { label: "Restaurants", filters: ['amenity=restaurant', 'amenity=fast_food'], keyword: "restaurant" },
  hotel: { label: "Hotels", filters: ['tourism=hotel', 'tourism=guest_house'], keyword: "hotel" },
  hospital: { label: "Hospitals", filters: ['amenity=hospital', 'amenity=clinic'], keyword: "hospital" },
  university: { label: "Universities", filters: ['amenity=university', 'amenity=college'], keyword: "university" },
  airport: { label: "Airports", filters: ['aeroway=aerodrome'], keyword: "airport" },
  fuel: { label: "Fuel", filters: ['amenity=fuel'], keyword: "fuel station" },
  charging: { label: "EV Charging", filters: ['amenity=charging_station'], keyword: "charging station" },
  bank: { label: "Banks", filters: ['amenity=bank'], keyword: "bank" },
  atm: { label: "ATMs", filters: ['amenity=atm'], keyword: "atm" },
  pharmacy: { label: "Pharmacies", filters: ['amenity=pharmacy'], keyword: "pharmacy" },
  police: { label: "Police", filters: ['amenity=police'], keyword: "police station" },
  fire_station: { label: "Fire", filters: ['amenity=fire_station'], keyword: "fire station" },
  parking: { label: "Parking", filters: ['amenity=parking'], keyword: "parking" },
  shopping: { label: "Shopping", filters: ['shop=mall', 'shop=supermarket'], keyword: "shopping mall" },
  attraction: { label: "Attractions", filters: ['tourism=attraction', 'tourism=museum'], keyword: "tourist attraction" },
  government: { label: "Government", filters: ['office=government', 'amenity=townhall'], keyword: "government office" },
}

export const POI_CATEGORIES = Object.entries(CATEGORIES).map(([id, c]) => ({ id, label: c.label }))

export type Poi = {
  id: string
  name: string
  category: string
  categoryLabel: string
  lat: number
  lon: number
  distanceMeters: number
  address?: string
  phone?: string
  website?: string
  openingHours?: string
}

const R = 6_371_000
function metersBetween(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLon = ((bLon - aLon) * Math.PI) / 180
  const la1 = (aLat * Math.PI) / 180
  const la2 = (bLat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

type OverpassEl = {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

/** Builds a compact street address from addr:* tags; omitted when absent. */
function addressFrom(t: Record<string, string>): string | undefined {
  const parts = [
    [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" "),
    t["addr:suburb"] || t["addr:neighbourhood"],
    t["addr:city"] || t["addr:town"] || t["addr:village"],
    t["addr:state"],
  ].filter((s) => s && s.trim().length > 0)
  return parts.length ? parts.join(", ") : undefined
}

async function overpass(category: string, lat: number, lon: number, radius: number, limit: number): Promise<Poi[]> {
  const cat = CATEGORIES[category]
  const body = `[out:json][timeout:20];(${cat.filters
    .flatMap((f) => {
      const [k, v] = f.split("=")
      return [
        `node["${k}"="${v}"](around:${radius},${lat},${lon});`,
        `way["${k}"="${v}"](around:${radius},${lat},${lon});`,
      ]
    })
    .join("")});out center ${Math.min(limit * 3, 90)};`

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 22000)
  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
      body: `data=${encodeURIComponent(body)}`,
    })
    if (!res.ok) throw new GeoError(`overpass responded ${res.status}`, res.status === 429 ? 429 : 502)
    const json = (await res.json()) as { elements?: OverpassEl[] }
    const els = json.elements ?? []
    return els
      .map((el): Poi | null => {
        const p = el.center ?? { lat: el.lat, lon: el.lon }
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return null
        const t = el.tags ?? {}
        const name = t.name || t["name:en"] || t.operator || t.brand
        if (!name) return null // unnamed nodes are noise in a POI list
        return {
          id: `${el.type}/${el.id}`,
          name,
          category,
          categoryLabel: cat.label,
          lat: p.lat as number,
          lon: p.lon as number,
          distanceMeters: Math.round(metersBetween(lat, lon, p.lat as number, p.lon as number)),
          address: addressFrom(t),
          phone: t.phone || t["contact:phone"],
          website: t.website || t["contact:website"],
          openingHours: t.opening_hours,
        }
      })
      .filter((p): p is Poi => p !== null)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, limit)
  } finally {
    clearTimeout(timer)
  }
}

/** Fallback: bounded Nominatim keyword search around the same point. */
async function nominatimNearby(category: string, lat: number, lon: number, radius: number, limit: number): Promise<Poi[]> {
  const cat = CATEGORIES[category]
  const d = Math.min(0.6, radius / 111_000)
  const viewbox = `${lon - d},${lat + d},${lon + d},${lat - d}`
  const url =
    `${GEOCODING_URL}/search?format=jsonv2&addressdetails=1&limit=${limit}&bounded=1` +
    `&viewbox=${viewbox}&q=${encodeURIComponent(cat.keyword)}`
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA } })
  if (!res.ok) throw new GeoError(`geocoder responded ${res.status}`, 502)
  const rows = (await res.json()) as { place_id?: number; display_name: string; name?: string; lat: string; lon: string }[]
  if (!Array.isArray(rows)) return []
  return rows
    .map((r): Poi => {
      const la = Number.parseFloat(r.lat)
      const lo = Number.parseFloat(r.lon)
      const parts = r.display_name.split(",").map((s) => s.trim())
      return {
        id: String(r.place_id ?? `${r.lat},${r.lon}`),
        name: r.name?.trim() || parts[0],
        category,
        categoryLabel: cat.label,
        lat: la,
        lon: lo,
        distanceMeters: Math.round(metersBetween(lat, lon, la, lo)),
        address: r.display_name,
      }
    })
    .filter((p) => Number.isFinite(p.lat))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
}

export type PoiResult = { source: "overpass" | "nominatim"; pois: Poi[] }

/** Nearby POIs of one category, real OSM data only. */
export async function findNearbyPois(
  category: string,
  lat: number,
  lon: number,
  radius = 5000,
  limit = 20,
): Promise<PoiResult> {
  if (!CATEGORIES[category]) throw new GeoError(`unknown category "${category}"`, 400)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new GeoError("invalid coordinates", 400)
  try {
    const pois = await overpass(category, lat, lon, radius, limit)
    if (pois.length > 0) return { source: "overpass", pois }
  } catch {
    // fall through to the geocoder
  }
  return { source: "nominatim", pois: await nominatimNearby(category, lat, lon, radius, limit) }
}
