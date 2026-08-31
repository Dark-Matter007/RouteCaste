"use client"

import {
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  RotateCcw,
  Flag,
  Merge,
  Split,
  Loader2,
  AlertTriangle,
  Crosshair,
  X,
  CheckCircle2,
} from "lucide-react"
import type { NavRoute } from "@/hooks/use-navigation-route"
import type { NavState } from "@/hooks/use-nav-session"
import { fmtDistance, fmtDuration, etaClock, type NavProgress } from "@/lib/nav/progress"

/** Maps an OSRM maneuver type/modifier onto an icon. */
function maneuverIcon(type: string, modifier?: string) {
  const m = (modifier || "").toLowerCase()
  const t = (type || "").toLowerCase()
  if (t === "arrive") return Flag
  if (t === "roundabout" || t === "rotary" || t === "roundabout turn") return RotateCcw
  if (t === "merge") return Merge
  if (t === "fork") return Split
  if (m.includes("uturn")) return RotateCcw
  if (m.includes("left")) return CornerUpLeft
  if (m.includes("right")) return CornerUpRight
  return ArrowUp
}

type Props = {
  state: NavState
  route: NavRoute
  progress: NavProgress | null
  error: string | null
  rerouteCount: number
  isRerouted: boolean
  follow: boolean
  onFollow: (v: boolean) => void
  onStop: () => void
  onRetry: () => void
  /** Set when the fix was injected manually rather than read from the device. */
  simulated?: boolean
}

/**
 * Driver-facing heads-up display: next maneuver, live remaining
 * distance/time/ETA and the current navigation state.
 */
export function NavHud({
  state,
  route,
  progress,
  error,
  rerouteCount,
  isRerouted,
  follow,
  onFollow,
  onStop,
  onRetry,
  simulated,
}: Props) {
  const step = progress ? route.steps[progress.stepIndex] : route.steps[0]
  const after = progress ? route.steps[progress.stepIndex + 1] : route.steps[1]
  const Icon = maneuverIcon(step?.maneuver ?? "", step?.modifier)

  const arrived = state === "arrived"
  const rerouting = state === "rerouting"
  const offRoute = progress?.isOffRoute && !rerouting && !arrived

  return (
    <div className="pointer-events-auto w-[min(92vw,26rem)] overflow-hidden rounded-xl border border-primary/40 bg-card/95 shadow-2xl backdrop-blur-md">
      {/* status strip */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest">
          {arrived ? (
            <span className="flex items-center gap-1.5 text-primary">
              <CheckCircle2 className="h-3 w-3" /> Arrived
            </span>
          ) : rerouting ? (
            <span className="flex items-center gap-1.5 text-accent-foreground">
              <Loader2 className="h-3 w-3 animate-spin text-primary" /> Recalculating…
            </span>
          ) : offRoute ? (
            <span className="flex items-center gap-1.5 text-destructive">
              <AlertTriangle className="h-3 w-3" /> Off route
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> Navigating
            </span>
          )}
          {simulated && <span className="text-muted-foreground">· sim fix</span>}
          {isRerouted && !rerouting && <span className="text-muted-foreground">· rerouted ×{rerouteCount}</span>}
        </span>
        <span className="flex items-center gap-1">
          <button
            onClick={() => onFollow(!follow)}
            aria-pressed={follow}
            title="Follow my position"
            className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider transition-colors ${
              follow ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Crosshair className="h-3 w-3" /> Follow
          </button>
          <button
            onClick={onStop}
            aria-label="Stop navigation"
            className="rounded-full border border-border p-1 text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      </div>

      {/* maneuver */}
      {arrived ? (
        <div className="px-3 py-4 text-center">
          <p className="font-mono text-sm uppercase tracking-widest text-primary">You have arrived</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {fmtDistance(route.distance_meters)} travelled · tracking stopped
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 px-3 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-base leading-none text-primary">
              {progress ? fmtDistance(progress.distanceToManeuver) : fmtDistance(step?.distanceMeters ?? 0)}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-pretty text-foreground">
              {step?.instruction ?? "Proceed to route"}
            </p>
            {after && (
              <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                Then · {after.instruction}
              </p>
            )}
          </div>
        </div>
      )}

      {/* progress + remaining */}
      <div className="border-t border-border px-3 py-2">
        <div className="h-1 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={Math.round((progress?.ratio ?? 0) * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${Math.round((progress?.ratio ?? 0) * 100)}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground">
          <span className="text-foreground">
            {fmtDistance(progress?.remainingMeters ?? route.distance_meters)} left
          </span>
          <span className="text-primary">{fmtDuration(progress?.remainingSeconds ?? route.duration_seconds)}</span>
          <span>ETA {etaClock(progress?.remainingSeconds ?? route.duration_seconds)}</span>
          {progress && !arrived && (
            <span className="shrink-0 text-[9px]">
              {progress.stepIndex + 1}/{route.steps.length}
            </span>
          )}
        </div>
      </div>

      {state === "error" && error && (
        <div className="flex items-center justify-between gap-2 border-t border-destructive/40 bg-destructive/10 px-3 py-1.5">
          <p className="font-mono text-[10px] text-destructive">{error}</p>
          <button
            onClick={onRetry}
            className="rounded-md border border-destructive/50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-destructive hover:bg-destructive/20"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
