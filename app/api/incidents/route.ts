// ---------------------------------------------------------------------------
// /api/incidents — report, list and clear real incidents.
//
// GET  ?lat&lon&radius   spatial query (defaults to every active incident)
// POST { type, lat, lon, severity?, radiusMeters?, description? }
// DELETE ?id=…  |  ?simulated=1   clear one, or drop all simulated events
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server"
import {
  INCIDENT_TYPES,
  clearIncident,
  clearSimulated,
  createIncident,
  incidentsNear,
  listIncidents,
  type IncidentSeverity,
  type IncidentType,
} from "@/lib/intel/incidents"

const SEVERITIES: IncidentSeverity[] = ["low", "medium", "high", "critical"]

export async function GET(req: Request) {
  const u = new URL(req.url)
  const lat = Number(u.searchParams.get("lat"))
  const lon = Number(u.searchParams.get("lon"))
  const radius = Number(u.searchParams.get("radius") ?? 20_000)

  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return NextResponse.json({ error: "invalid coordinates" }, { status: 400 })
    }
    const near = incidentsNear(lat, lon, Number.isFinite(radius) ? radius : 20_000)
    return NextResponse.json({ incidents: near, count: near.length, scope: "nearby" })
  }

  const all = listIncidents({ activeOnly: true })
  return NextResponse.json({ incidents: all, count: all.length, scope: "all-active" })
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  const b = body as {
    type?: string
    lat?: unknown
    lon?: unknown
    lng?: unknown
    severity?: string
    radiusMeters?: unknown
    description?: string
  }

  const lat = Number(b.lat)
  const lon = Number(b.lon ?? b.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "valid lat/lon are required" }, { status: 400 })
  }
  if (!(INCIDENT_TYPES as readonly string[]).includes(String(b.type))) {
    return NextResponse.json({ error: `type must be one of: ${INCIDENT_TYPES.join(", ")}` }, { status: 400 })
  }
  const severity = (SEVERITIES as string[]).includes(String(b.severity))
    ? (b.severity as IncidentSeverity)
    : "medium"

  const inc = createIncident({
    type: b.type as IncidentType,
    lat,
    lon,
    severity,
    radiusMeters: Number(b.radiusMeters) || undefined,
    description: typeof b.description === "string" ? b.description : undefined,
    origin: "reported",
  })

  return NextResponse.json({ incident: inc }, { status: 201 })
}

export async function DELETE(req: Request) {
  const u = new URL(req.url)
  if (u.searchParams.get("simulated") === "1") {
    return NextResponse.json({ cleared: clearSimulated(), scope: "simulated" })
  }
  const id = u.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id or simulated=1 is required" }, { status: 400 })
  if (!clearIncident(id)) return NextResponse.json({ error: "incident not found" }, { status: 404 })
  return NextResponse.json({ cleared: 1, id })
}
