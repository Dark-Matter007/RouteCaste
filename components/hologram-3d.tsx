"use client"

import * as THREE from "three"
import { Canvas, useThree } from "@react-three/fiber"
import { Line, OrbitControls, Grid } from "@react-three/drei"
import { useEffect, useMemo } from "react"
import type { PlanResponse } from "@/lib/types"

const SPREAD = 6
const ELEV = 2.2

function congestionColor(c: number): string {
  if (c < 0.35) return "#22d3ee"
  if (c < 0.6) return "#facc15"
  return "#f43f5e"
}

type Props = {
  data: PlanResponse
  selectedInviteeId: string | null
}

function Scene({ data, selectedInviteeId }: Props) {
  const { nodeById, norm } = useMemo(() => {
    const lats = data.graph.nodes.map((n) => n.lat)
    const lngs = data.graph.nodes.map((n) => n.lng)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)
    const nb = Object.fromEntries(data.graph.nodes.map((n) => [n.id, n]))
    const fn = (lat: number, lng: number): [number, number] => [
      (((lng - minLng) / (maxLng - minLng)) * 2 - 1) * SPREAD,
      (((lat - minLat) / (maxLat - minLat)) * 2 - 1) * SPREAD,
    ]
    return { nodeById: nb, norm: fn }
  }, [data])

  const venue = nodeById[data.event.venueNodeId]
  const [vx, vz] = norm(venue.lat, venue.lng)

  const plans = selectedInviteeId
    ? data.plans.filter((p) => p.invitee.id === selectedInviteeId)
    : data.plans

  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[0, 8, 0]} intensity={40} color="#22d3ee" />

      <Grid
        args={[SPREAD * 2.4, SPREAD * 2.4]}
        cellColor="#164e63"
        sectionColor="#0e7490"
        fadeDistance={30}
        infiniteGrid={false}
        position={[0, -0.01, 0]}
      />

      {/* road network on the ground plane */}
      {data.graph.edges.map((e, i) => {
        const a = nodeById[e.from]
        const b = nodeById[e.to]
        if (!a || !b) return null
        const [ax, az] = norm(a.lat, a.lng)
        const [bx, bz] = norm(b.lat, b.lng)
        return (
          <Line
            key={i}
            points={[
              [ax, 0, az],
              [bx, 0, bz],
            ]}
            color={congestionColor(e.congestion)}
            lineWidth={1}
            transparent
            opacity={0.5}
          />
        )
      })}

      {/* elevated recommended routes + stems */}
      {plans.map((p) => {
        if (!p.recommended) return null
        const pts = p.recommended.path.map((pt) => {
          const [x, z] = norm(pt.lat, pt.lng)
          return [x, ELEV, z] as [number, number, number]
        })
        const [ox, oz] = norm(p.recommended.path[0].lat, p.recommended.path[0].lng)
        return (
          <group key={p.invitee.id}>
            <Line points={pts} color="#67e8f9" lineWidth={3} />
            {/* stems */}
            <Line points={[[ox, 0, oz], [ox, ELEV, oz]]} color="#22d3ee" lineWidth={1} transparent opacity={0.4} dashed dashSize={0.2} gapSize={0.2} />
            <Line points={[[vx, 0, vz], [vx, ELEV, vz]]} color="#22d3ee" lineWidth={1} transparent opacity={0.4} dashed dashSize={0.2} gapSize={0.2} />
            {/* origin marker */}
            <mesh position={[ox, ELEV, oz]}>
              <sphereGeometry args={[0.12, 16, 16]} />
              <meshStandardMaterial color="#a5f3fc" emissive="#22d3ee" emissiveIntensity={1.5} />
            </mesh>
          </group>
        )
      })}

      {/* venue beacon */}
      <mesh position={[vx, ELEV, vz]}>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={2.5} />
      </mesh>
      <Line
        points={[[vx, 0, vz], [vx, ELEV + 1.2, vz]]}
        color="#22d3ee"
        lineWidth={2}
        transparent
        opacity={0.5}
      />

      <OrbitControls autoRotate autoRotateSpeed={0.6} enablePan={false} minDistance={5} maxDistance={22} />
    </>
  )
}

/** Real navigation geometry projected into the twin. */
export type NavTwin = {
  routes: { id: string; latLngs: [number, number][] }[]
  activeId: string | null
  origin: { lat: number; lon: number } | null
  destination: { lat: number; lon: number } | null
  waypoints: { lat: number; lon: number }[]
  currentPos: { lat: number; lon: number } | null
  pois: { id: string; lat: number; lon: number }[]
  /** Incidents + their affected radius, drawn as glowing ground rings. */
  incidents?: { id: string; lat: number; lon: number; type: string; severity: string; radiusMeters: number }[]
}

/**
 * Pulls the camera back far enough that the whole normalised route fits the
 * canvas, accounting for both the vertical FOV and the viewport aspect so the
 * twin is never cropped on narrow/short panels.
 */
function FitCamera({ radius, enabled }: { radius: number; enabled: boolean }) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)

  useEffect(() => {
    if (!enabled || size.height === 0) return
    const cam = camera as THREE.PerspectiveCamera
    const aspect = size.width / size.height
    const vHalf = (cam.fov * Math.PI) / 360
    const hHalf = Math.atan(Math.tan(vHalf) * aspect)
    // The tighter of the two axes decides how far back the camera must sit.
    const dist = radius / Math.min(Math.tan(vHalf), Math.tan(hHalf))
    const dir = new THREE.Vector3(0.8, 0.72, 0.8).normalize()
    const target = new THREE.Vector3(0, ELEV, 0)
    cam.position.copy(target).add(dir.multiplyScalar(dist))
    cam.near = 0.1
    cam.far = dist * 6
    cam.updateProjectionMatrix()
    cam.lookAt(target)
  }, [camera, size.width, size.height, radius, enabled])

  return null
}

/**
 * Projects the actual routing-engine geometry into the 3D twin. All positions
 * come from real coordinates normalised against the route's own bounds, so the
 * hologram stays geographically consistent with the map.
 */
function NavScene({ nav, follow }: { nav: NavTwin; follow: boolean }) {
  const active = nav.routes.find((r) => r.id === nav.activeId) ?? nav.routes[0]

  const norm = useMemo(() => {
    const pts: [number, number][] = [
      ...nav.routes.flatMap((r) => r.latLngs),
      ...(nav.origin ? ([[nav.origin.lat, nav.origin.lon]] as [number, number][]) : []),
      ...(nav.destination ? ([[nav.destination.lat, nav.destination.lon]] as [number, number][]) : []),
      ...nav.pois.map((p) => [p.lat, p.lon] as [number, number]),
    ]
    if (pts.length === 0) return null
    const lats = pts.map((p) => p[0])
    const lngs = pts.map((p) => p[1])
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)
    // Preserve aspect ratio so the route isn't stretched.
    const spanLat = Math.max(1e-6, maxLat - minLat)
    const spanLng = Math.max(1e-6, maxLng - minLng)
    const span = Math.max(spanLat, spanLng)
    const cLat = (minLat + maxLat) / 2
    const cLng = (minLng + maxLng) / 2
    return (lat: number, lng: number): [number, number, number] => [
      ((lng - cLng) / span) * 2 * SPREAD,
      0,
      -((lat - cLat) / span) * 2 * SPREAD,
    ]
  }, [nav])

  if (!norm || !active) return null

  const linePts = (lls: [number, number][]) =>
    lls.map(([la, ln]) => {
      const [x, , z] = norm(la, ln)
      return [x, ELEV, z] as [number, number, number]
    })

  const marker = (p: { lat: number; lon: number }) => {
    const [x, , z] = norm(p.lat, p.lon)
    return [x, ELEV, z] as [number, number, number]
  }

  return (
    <>
      {/* Frame the whole route once; following hands control to OrbitControls. */}
      <FitCamera radius={SPREAD * 1.28} enabled={!follow} />
      <ambientLight intensity={0.6} />
      <pointLight position={[0, 8, 0]} intensity={40} color="#22d3ee" />
      <Grid
        args={[SPREAD * 2.6, SPREAD * 2.6]}
        cellColor="#164e63"
        sectionColor="#0e7490"
        fadeDistance={40}
        position={[0, -0.01, 0]}
      />

      {/* alternative routes, dimmed */}
      {nav.routes
        .filter((r) => r.id !== active.id)
        .map((r) => (
          <Line key={r.id} points={linePts(r.latLngs)} color="#64748b" lineWidth={2} transparent opacity={0.45} />
        ))}

      {/* the followed route */}
      <Line points={linePts(active.latLngs)} color="#67e8f9" lineWidth={4} />

      {nav.origin && (
        <mesh position={marker(nav.origin)}>
          <sphereGeometry args={[0.16, 20, 20]} />
          <meshStandardMaterial color="#a5f3fc" emissive="#22d3ee" emissiveIntensity={1.6} />
        </mesh>
      )}
      {nav.waypoints.map((w, i) => (
        <mesh key={`w-${i}`} position={marker(w)}>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshStandardMaterial color="#e2e8f0" emissive="#94a3b8" emissiveIntensity={0.8} />
        </mesh>
      ))}
      {nav.destination && (
        <>
          <mesh position={marker(nav.destination)}>
            <sphereGeometry args={[0.26, 24, 24]} />
            <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={2.4} />
          </mesh>
          <Line
            points={[
              [marker(nav.destination)[0], 0, marker(nav.destination)[2]],
              [marker(nav.destination)[0], ELEV + 1.2, marker(nav.destination)[2]],
            ]}
            color="#22d3ee"
            lineWidth={2}
            transparent
            opacity={0.5}
          />
        </>
      )}

      {/* Incidents: affected area ring (real radius) + severity core */}
      {(nav.incidents ?? []).map((inc) => {
        const [x, , z] = norm(inc.lat, inc.lon)
        // Convert the metre radius into scene units via the same projection.
        const dLon = inc.radiusMeters / (111_320 * Math.max(0.15, Math.cos((inc.lat * Math.PI) / 180)))
        const [x2] = norm(inc.lat, inc.lon + dLon)
        const r = Math.max(0.08, Math.abs(x2 - x))
        const color =
          inc.severity === "critical" || inc.type === "closure" || inc.type === "flooding"
            ? "#f97316"
            : inc.severity === "high"
              ? "#f43f5e"
              : "#facc15"
        return (
          <group key={`inc-${inc.id}`} position={[x, ELEV - 0.02, z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[r * 0.94, r, 48]} />
              <meshBasicMaterial color={color} transparent opacity={0.85} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[r, 40]} />
              <meshBasicMaterial color={color} transparent opacity={0.14} />
            </mesh>
            <mesh position={[0, 0.18, 0]}>
              <sphereGeometry args={[0.13, 14, 14]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} />
            </mesh>
          </group>
        )
      })}

      {/* POIs from the live category search */}
      {nav.pois.map((p) => (
        <mesh key={p.id} position={marker(p)}>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={1.2} />
        </mesh>
      ))}

      {/* live position */}
      {nav.currentPos && (
        <mesh position={marker(nav.currentPos)}>
          <sphereGeometry args={[0.2, 20, 20]} />
          <meshStandardMaterial color="#fef08a" emissive="#facc15" emissiveIntensity={2.2} />
        </mesh>
      )}

      <OrbitControls
        autoRotate={!follow}
        autoRotateSpeed={0.5}
        enablePan
        minDistance={3}
        maxDistance={30}
        target={nav.currentPos && follow ? marker(nav.currentPos) : [0, ELEV, 0]}
      />
    </>
  )
}

export function Hologram3D({
  data,
  selectedInviteeId,
  nav = null,
  follow = false,
}: Props & { nav?: NavTwin | null; follow?: boolean }) {
  const showNav = !!nav && nav.routes.length > 0
  return (
    <Canvas camera={{ position: [8, 7, 8], fov: 45 }} style={{ background: "transparent" }}>
      {showNav ? (
        <NavScene nav={nav as NavTwin} follow={follow} />
      ) : (
        <Scene data={data} selectedInviteeId={selectedInviteeId} />
      )}
    </Canvas>
  )
}
