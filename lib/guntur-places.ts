/**
 * Guntur city landmarks, transport hubs, and key locations.
 *
 * Used for:
 *  - Map default center and zoom
 *  - Location search presets (quick-select in the sidebar)
 *  - Event scheduler location suggestions
 *  - Research paper: validated real-world coordinates for Guntur, AP, India
 *
 * Coordinates verified against OpenStreetMap Nominatim (Oct 2024).
 */

export type GunturPlace = {
  id: string
  name: string
  lat: number
  lng: number
  type: "landmark" | "hospital" | "education" | "transport" | "government" | "commercial"
  description: string
}

/** Geographic center of Guntur city used as the map's default origin. */
export const GUNTUR_CENTER = { lat: 16.3067, lng: 80.4365 }

/** Default zoom level that shows the whole city core comfortably. */
export const GUNTUR_DEFAULT_ZOOM = 13

/**
 * Key Guntur locations used as quick-select presets across the UI.
 * Ordered roughly by expected demo relevance (bus stand first — highest traffic).
 */
export const GUNTUR_PLACES: GunturPlace[] = [
  {
    id: "bus-stand",
    name: "Guntur Bus Stand (APSRTC)",
    lat: 16.3085,
    lng: 80.4329,
    type: "transport",
    description: "Main city bus terminal — highest daily footfall, frequent congestion",
  },
  {
    id: "guntur-jn",
    name: "Guntur Railway Junction",
    lat: 16.3076,
    lng: 80.4261,
    type: "transport",
    description: "Main railway station — major passenger interchange",
  },
  {
    id: "collectorate",
    name: "Guntur Collectorate",
    lat: 16.3004,
    lng: 80.4428,
    type: "government",
    description: "District administrative HQ — rallies and processions common here",
  },
  {
    id: "ggh",
    name: "GGH Guntur (Government General Hospital)",
    lat: 16.3012,
    lng: 80.4451,
    type: "hospital",
    description: "Largest public hospital in the district — emergency access critical",
  },
  {
    id: "lakshmipuram",
    name: "Lakshmipuram Junction",
    lat: 16.3148,
    lng: 80.4412,
    type: "landmark",
    description: "Key traffic intersection in city centre",
  },
  {
    id: "brodipet",
    name: "Brodipet Main Road",
    lat: 16.3055,
    lng: 80.4389,
    type: "commercial",
    description: "Primary shopping and commercial corridor — congests on weekends",
  },
  {
    id: "arundelpet",
    name: "Arundelpet",
    lat: 16.2988,
    lng: 80.4362,
    type: "commercial",
    description: "Dense commercial and residential area",
  },
  {
    id: "loyola-college",
    name: "Andhra Loyola College",
    lat: 16.3092,
    lng: 80.4473,
    type: "education",
    description: "Central city college — peak congestion during admissions",
  },
  {
    id: "kothapet",
    name: "Kothapet Junction",
    lat: 16.3188,
    lng: 80.4522,
    type: "landmark",
    description: "Northern city junction — arterial road intersection",
  },
  {
    id: "amaravathi-rd",
    name: "Amaravathi Road Corridor",
    lat: 16.3200,
    lng: 80.4600,
    type: "landmark",
    description: "Key arterial road toward AP state capital Amaravathi",
  },
  {
    id: "old-town",
    name: "Guntur Old Town",
    lat: 16.3037,
    lng: 80.4344,
    type: "landmark",
    description: "Historic city core — narrow lanes, prone to gridlock",
  },
  {
    id: "nagarjuna-u",
    name: "Nagarjuna University",
    lat: 16.4428,
    lng: 80.4998,
    type: "education",
    description: "Major university campus — large student population movement",
  },
]

/** Return the place closest to a given lat/lng (for event pin reverse lookup). */
export function nearestGunturPlace(lat: number, lng: number): GunturPlace | null {
  if (GUNTUR_PLACES.length === 0) return null
  let best = GUNTUR_PLACES[0]
  let bestDist = Infinity
  for (const p of GUNTUR_PLACES) {
    const d = (p.lat - lat) ** 2 + (p.lng - lng) ** 2
    if (d < bestDist) { bestDist = d; best = p }
  }
  return best
}

/** Guntur bounding box for validation (roughly 30 km × 30 km around the city). */
export const GUNTUR_BOUNDS = {
  minLat: 16.15,
  maxLat: 16.55,
  minLng: 80.25,
  maxLng: 80.65,
}

export function isInGunturRegion(lat: number, lng: number): boolean {
  return (
    lat >= GUNTUR_BOUNDS.minLat &&
    lat <= GUNTUR_BOUNDS.maxLat &&
    lng >= GUNTUR_BOUNDS.minLng &&
    lng <= GUNTUR_BOUNDS.maxLng
  )
}
