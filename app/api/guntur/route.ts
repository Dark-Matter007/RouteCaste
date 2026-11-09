import { NextResponse } from "next/server"
import { gunturInfo, routeGuntur } from "@/lib/guntur"
export const runtime = "nodejs"
export async function GET(request: Request) {
  const p=new URL(request.url).searchParams
  try { if(!p.get("route")) return NextResponse.json(gunturInfo()); return NextResponse.json(routeGuntur(p.get("eventId")??"gtr_evt_004",p.get("timestamp")??"2026-09-11T17:00:00",p.get("algorithm")??"dijkstra",p.get("sourceNode")??undefined,p.get("destinationNode")??undefined)) }
  catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"Guntur route failed"},{status:400}) }
}
