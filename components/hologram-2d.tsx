"use client"

import { useEffect, useRef } from "react"
import type { PlanResponse } from "@/lib/types"

type Props = {
  data: PlanResponse
  selectedInviteeId: string | null
}

// Isometric, rotatable "hologram" projection of the route plan on a 2D canvas.
export function Hologram2D({ data, selectedInviteeId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const yawRef = useRef(0.6)
  const zoomRef = useRef(1)
  const draggingRef = useRef<{ x: number; startYaw: number } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // normalize node coords into [-1, 1]
    const lats = data.graph.nodes.map((n) => n.lat)
    const lngs = data.graph.nodes.map((n) => n.lng)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)
    const norm = (lat: number, lng: number) => ({
      x: ((lng - minLng) / (maxLng - minLng)) * 2 - 1,
      y: ((lat - minLat) / (maxLat - minLat)) * 2 - 1,
    })
    const nodeById = Object.fromEntries(data.graph.nodes.map((n) => [n.id, n]))

    let raf = 0
    let t = 0

    const congestionColor = (c: number) =>
      c < 0.35 ? "34,211,238" : c < 0.6 ? "250,204,21" : "244,63,94"

    const render = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr
        canvas.height = h * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const cx = w / 2
      const cy = h / 2 + h * 0.12
      const scale = Math.min(w, h) * 0.42 * zoomRef.current
      const tilt = 0.5
      const yaw = draggingRef.current ? yawRef.current : (yawRef.current += 0.0025)

      // project a normalized point with an elevation z
      const project = (x: number, y: number, z: number) => {
        const rx = x * Math.cos(yaw) - y * Math.sin(yaw)
        const ry = x * Math.sin(yaw) + y * Math.cos(yaw)
        return {
          sx: cx + rx * scale,
          sy: cy + ry * scale * tilt - z * scale * 0.5,
        }
      }

      // ground road network
      for (const e of data.graph.edges) {
        const a = nodeById[e.from]
        const b = nodeById[e.to]
        if (!a || !b) continue
        const na = norm(a.lat, a.lng)
        const nb = norm(b.lat, b.lng)
        const pa = project(na.x, na.y, 0)
        const pb = project(nb.x, nb.y, 0)
        ctx.strokeStyle = `rgba(${congestionColor(e.congestion)},0.35)`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(pa.sx, pa.sy)
        ctx.lineTo(pb.sx, pb.sy)
        ctx.stroke()
      }

      const venue = nodeById[data.event.venueNodeId]
      const nv = norm(venue.lat, venue.lng)

      const plans = selectedInviteeId
        ? data.plans.filter((p) => p.invitee.id === selectedInviteeId)
        : data.plans

      // elevated recommended routes with vertical stems + traveling pulse
      for (const p of plans) {
        if (!p.recommended) continue
        const elev = 0.35
        const pts = p.recommended.path.map((pt) => {
          const n = norm(pt.lat, pt.lng)
          return project(n.x, n.y, elev)
        })

        // stems at origin & venue
        const o = p.recommended.path[0]
        const no = norm(o.lat, o.lng)
        const groundO = project(no.x, no.y, 0)
        const groundV = project(nv.x, nv.y, 0)
        ctx.strokeStyle = "rgba(103,232,249,0.25)"
        ctx.setLineDash([3, 4])
        ctx.beginPath()
        ctx.moveTo(groundO.sx, groundO.sy)
        ctx.lineTo(pts[0].sx, pts[0].sy)
        ctx.moveTo(groundV.sx, groundV.sy)
        ctx.lineTo(pts[pts.length - 1].sx, pts[pts.length - 1].sy)
        ctx.stroke()
        ctx.setLineDash([])

        // glow underlay
        ctx.strokeStyle = "rgba(34,211,238,0.18)"
        ctx.lineWidth = 8
        ctx.beginPath()
        pts.forEach((pt, i) => (i ? ctx.lineTo(pt.sx, pt.sy) : ctx.moveTo(pt.sx, pt.sy)))
        ctx.stroke()

        // bright core
        ctx.strokeStyle = "rgba(165,243,252,0.95)"
        ctx.lineWidth = 2
        ctx.beginPath()
        pts.forEach((pt, i) => (i ? ctx.lineTo(pt.sx, pt.sy) : ctx.moveTo(pt.sx, pt.sy)))
        ctx.stroke()

        // traveling pulse
        const seg = (t * 0.4) % Math.max(1, pts.length - 1)
        const idx = Math.floor(seg)
        const frac = seg - idx
        if (pts[idx] && pts[idx + 1]) {
          const px = pts[idx].sx + (pts[idx + 1].sx - pts[idx].sx) * frac
          const py = pts[idx].sy + (pts[idx + 1].sy - pts[idx].sy) * frac
          ctx.fillStyle = "#ecfeff"
          ctx.shadowColor = "#22d3ee"
          ctx.shadowBlur = 12
          ctx.beginPath()
          ctx.arc(px, py, 3.5, 0, Math.PI * 2)
          ctx.fill()
          ctx.shadowBlur = 0
        }

        // origin marker
        ctx.fillStyle = "#0a1420"
        ctx.strokeStyle = "#67e8f9"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(pts[0].sx, pts[0].sy, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }

      // venue beacon
      const pv = project(nv.x, nv.y, 0.35)
      const pulse = 6 + Math.sin(t * 0.15) * 3
      ctx.fillStyle = "#22d3ee"
      ctx.shadowColor = "#22d3ee"
      ctx.shadowBlur = 18
      ctx.beginPath()
      ctx.arc(pv.sx, pv.sy, pulse, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0

      t += 1
      raf = requestAnimationFrame(render)
    }

    raf = requestAnimationFrame(render)
    return () => cancelAnimationFrame(raf)
  }, [data, selectedInviteeId])

  // pointer interaction: drag to rotate, wheel to zoom
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const down = (e: PointerEvent) => {
      draggingRef.current = { x: e.clientX, startYaw: yawRef.current }
    }
    const move = (e: PointerEvent) => {
      if (!draggingRef.current) return
      yawRef.current = draggingRef.current.startYaw + (e.clientX - draggingRef.current.x) * 0.01
    }
    const up = () => (draggingRef.current = null)
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomRef.current = Math.max(0.5, Math.min(2.5, zoomRef.current - e.deltaY * 0.001))
    }
    canvas.addEventListener("pointerdown", down)
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    canvas.addEventListener("wheel", wheel, { passive: false })
    return () => {
      canvas.removeEventListener("pointerdown", down)
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      canvas.removeEventListener("wheel", wheel)
    }
  }, [])

  return <canvas ref={canvasRef} className="h-full w-full cursor-grab active:cursor-grabbing" />
}
