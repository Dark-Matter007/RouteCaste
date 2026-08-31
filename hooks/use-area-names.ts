"use client"

import { useEffect, useRef, useState } from "react"
import type { PlanResponse } from "@/lib/types"

// Module-level cache shared across renders/instances, keyed by rounded coords.
const cache = new Map<string, string>()

function key(lat: number, lng: number) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`
}

/** Pull the most specific area label from a Nominatim address object. */
function pickArea(addr: Record<string, string> | undefined): string | null {
  if (!addr) return null
  return (
    addr.suburb ||
    addr.neighbourhood ||
    addr.quarter ||
    addr.city_district ||
    addr.residential ||
    addr.town ||
    addr.village ||
    addr.city_block ||
    addr.hamlet ||
    addr.city ||
    addr.county ||
    null
  )
}

/**
 * Reverse-geocode each invitee's origin coordinates to a real neighborhood /
 * area name using free OSM Nominatim. Requests are cached and throttled
 * (~1.2s apart) to respect Nominatim's usage policy. Returns a map of
 * invitee id -> area name; entries fill in progressively as they resolve.
 */
export function useAreaNames(data: PlanResponse | undefined): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({})
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    if (!data) return

    const nodeById = new Map(data.graph.nodes.map((n) => [n.id, n]))
    const targets = data.plans
      .map((p) => {
        const node = nodeById.get(p.invitee.originNodeId)
        return node ? { id: p.invitee.id, lat: node.lat, lng: node.lng } : null
      })
      .filter((t): t is { id: string; lat: number; lng: number } => t !== null)

    // Seed from cache immediately.
    const seeded: Record<string, string> = {}
    for (const t of targets) {
      const c = cache.get(key(t.lat, t.lng))
      if (c) seeded[t.id] = c
    }
    if (Object.keys(seeded).length) setNames((prev) => ({ ...prev, ...seeded }))

    async function run() {
      for (const t of targets) {
        if (cancelled.current) return
        const k = key(t.lat, t.lng)
        if (cache.has(k)) continue
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&zoom=14&addressdetails=1&lat=${t.lat}&lon=${t.lng}`,
            { headers: { "Accept-Language": "en" } },
          )
          const json = await res.json()
          const area = pickArea(json?.address) || (json?.display_name?.split(",")[0] ?? null)
          if (area) {
            cache.set(k, area)
            if (!cancelled.current) setNames((prev) => ({ ...prev, [t.id]: area }))
          }
        } catch {
          // ignore; the person name remains as fallback
        }
        // Throttle to respect Nominatim's ~1 req/sec policy.
        await new Promise((r) => setTimeout(r, 1200))
      }
    }
    run()

    return () => {
      cancelled.current = true
    }
    // Re-run when the set of invitee locations changes.
  }, [data])

  return names
}
