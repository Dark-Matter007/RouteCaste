import type { ReactNode } from "react"

export type Slide = {
  id: string
  kicker: string
  title: string
  body: ReactNode
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" />
      <span className="text-pretty leading-relaxed">{children}</span>
    </li>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-5">
      <h3 className="mb-2 font-mono text-xs uppercase tracking-widest text-primary">{title}</h3>
      <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  )
}

// A lightweight flow box used to draw the block / architecture diagrams.
function Node({ label, sub, accent }: { label: string; sub?: string; accent?: boolean }) {
  return (
    <div
      className={`flex min-w-[8rem] flex-col items-center gap-0.5 rounded-lg border px-4 py-3 text-center ${
        accent ? "border-primary bg-primary/10" : "border-border bg-card"
      }`}
    >
      <span className={`font-mono text-xs uppercase tracking-wider ${accent ? "text-primary" : "text-foreground"}`}>
        {label}
      </span>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  )
}

function Arrow() {
  return <span className="font-mono text-primary">{"->"}</span>
}

export const slides: Slide[] = [
  // 1 — Title
  {
    id: "title",
    kicker: "Capstone Project",
    title: "RouteCast",
    body: (
      <div className="flex flex-col gap-6">
        <p className="max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground">
          An AI-powered event route optimization &amp; traffic digital-twin platform. It evaluates every possible route
          for an event&apos;s attendees against live traffic and recommends the optimal one — visualized on a real
          worldwide satellite map and an interactive 3D hologram.
        </p>
        <div className="flex flex-wrap gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          <span className="rounded-full border border-primary/50 px-3 py-1 text-primary">Full-Stack</span>
          <span className="rounded-full border border-border px-3 py-1">Deep Learning (ONNX)</span>
          <span className="rounded-full border border-border px-3 py-1">Geospatial</span>
          <span className="rounded-full border border-border px-3 py-1">3D Visualization</span>
        </div>
      </div>
    ),
  },

  // 2 — Introduction
  {
    id: "introduction",
    kicker: "01 — Introduction",
    title: "What is RouteCast?",
    body: (
      <div className="grid gap-8 md:grid-cols-2">
        <ul className="flex flex-col gap-4 text-sm text-muted-foreground">
          <Bullet>
            Navigation apps like Google Maps optimize a route for <em>one</em> person. RouteCast optimizes for a whole
            event — many attendees converging on a single venue.
          </Bullet>
          <Bullet>
            It computes fastest / shortest / best-overall routes for every invitee, factoring live traffic, distance and
            congestion.
          </Bullet>
          <Bullet>
            Works anywhere on Earth — pick any country, state or city and the road network, guests and traffic
            regenerate for that location.
          </Bullet>
          <Bullet>
            An AI model predicts congestion and travel time, and actively re-routes attendees when incidents occur.
          </Bullet>
        </ul>
        <div className="flex flex-col gap-3">
          <Card title="Two Modes">
            <span className="text-foreground">Event mode</span> — many attendees, one venue.
            <br />
            <span className="text-foreground">Directions mode</span> — point-to-point trip, like Google Maps.
          </Card>
          <Card title="Three Views">
            Real satellite map · 2D holographic projection · orbitable 3D hologram.
          </Card>
        </div>
      </div>
    ),
  },

  // 3 — Problem statement
  {
    id: "problem",
    kicker: "02 — Problem Statement",
    title: "The Problem",
    body: (
      <div className="grid gap-8 md:grid-cols-2">
        <ul className="flex flex-col gap-4 text-sm text-muted-foreground">
          <Bullet>
            When an organization hosts an event, dozens or hundreds of people travel to one place at the same time —
            straining specific roads and causing avoidable congestion.
          </Bullet>
          <Bullet>
            Existing tools route each person individually and are blind to the collective load and to sudden disruptions
            (accidents, closures, weather).
          </Bullet>
          <Bullet>
            Organizers have no way to <em>simulate</em> &quot;what if a road closes?&quot; before the event and plan
            around it.
          </Bullet>
        </ul>
        <Card title="Core Question">
          <p className="text-base text-foreground text-pretty">
            &quot;Given a venue and many attendees, what is the best set of routes — and how does it change when
            something goes wrong?&quot;
          </p>
        </Card>
      </div>
    ),
  },

  // 4 — Purpose / objectives
  {
    id: "purpose",
    kicker: "03 — Purpose & Objectives",
    title: "Purpose",
    body: (
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Optimize">
          Recommend the best route per attendee using a weighted blend of time, distance and congestion.
        </Card>
        <Card title="Simulate">
          Model accidents, road closures, traffic surges and weather, then measure their impact vs a baseline.
        </Card>
        <Card title="Predict">
          Use a trained deep-learning model to forecast congestion and refine ETAs, re-routing when needed.
        </Card>
        <Card title="Visualize">
          Show routes on real satellite imagery plus 2D and 3D holographic projections for close inspection.
        </Card>
        <Card title="Globalize">
          Operate for any country / state / city selected by the user, with location-aware behavior.
        </Card>
        <Card title="Inform">
          Surface live city metrics — avg speed, congestion, incidents, air quality, response time, CO₂.
        </Card>
      </div>
    ),
  },

  // 5 — Architecture blueprint
  {
    id: "architecture",
    kicker: "04 — Blueprint / Architecture",
    title: "System Architecture",
    body: (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Node label="Browser" sub="React UI" accent />
          <Arrow />
          <Node label="Next.js" sub="App Router / RSC" />
          <Arrow />
          <Node label="API Route" sub="/api/plan" />
          <Arrow />
          <Node label="Engine" sub="optimizer + sim" />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Node label="Engine" sub="optimizer + sim" />
          <Arrow />
          <Node label="ML Runtime" sub="onnxruntime-node" accent />
          <Arrow />
          <Node label="ONNX Models" sub="eta + congestion" />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Node label="Map Tiles" sub="Esri / OSM" />
          <Node label="Geocoding" sub="Nominatim" />
          <Node label="3D" sub="Three.js / R3F" />
          <Node label="Data Fetch" sub="SWR" />
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Presentation, business logic and ML inference are cleanly separated — the frontend only talks to the API
          contract, never to the routing logic directly.
        </p>
      </div>
    ),
  },

  // 6 — Block diagram (data flow)
  {
    id: "block-diagram",
    kicker: "05 — Block Diagram",
    title: "Data Flow",
    body: (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
          <Node label="Select City" sub="search / click" accent />
          <Arrow />
          <Node label="Build Network" sub="grid on real coords" />
          <Arrow />
          <Node label="Apply Scenario" sub="accident / closure" />
        </div>
        <div className="flex justify-center">
          <span className="font-mono text-primary">{"|"}</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
          <Node label="Optimize Routes" sub="weighted Dijkstra" />
          <Arrow />
          <Node label="ML Re-rank" sub="predict ETA" accent />
          <Arrow />
          <Node label="Forecast" sub="congestion model" />
        </div>
        <div className="flex justify-center">
          <span className="font-mono text-primary">{"|"}</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
          <Node label="Metrics + Impact" sub="baseline vs scenario" />
          <Arrow />
          <Node label="Render" sub="Map · 2D · 3D" accent />
        </div>
      </div>
    ),
  },

  // 7 — Features
  {
    id: "features",
    kicker: "06 — Features",
    title: "Key Features",
    body: (
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Worldwide & Location-Aware">
          Search any country/state/city; road network, attendees and area names regenerate for that place.
        </Card>
        <Card title="Multi-Route Optimization">
          Best / fastest / shortest routes per attendee with adjustable time/distance/congestion weighting.
        </Card>
        <Card title="Scenario Simulation">
          Inject accidents, closures, surges, weather — see live re-routing and a baseline-vs-scenario impact table.
        </Card>
        <Card title="AI Prediction & Re-routing">
          ONNX models forecast congestion and ETA; attendees are re-routed by predicted time on disruption.
        </Card>
        <Card title="Google-Maps Directions">
          Point-to-point mode: click a start and destination for an optimized A→B route.
        </Card>
        <Card title="Satellite + Hologram Views">
          Esri/OSM basemaps with a satellite⇄neon toggle, plus 2D and orbitable 3D holographic projections.
        </Card>
      </div>
    ),
  },

  // 8 — ML models
  {
    id: "ml",
    kicker: "07 — ML / Deep Learning",
    title: "The AI Models",
    body: (
      <div className="grid gap-8 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Card title="Model Type">
            Deep neural networks (multi-layer perceptrons) built in <span className="text-foreground">PyTorch</span>,
            exported to <span className="text-foreground">ONNX</span>, and run in Node via{" "}
            <span className="text-foreground">onnxruntime</span>.
          </Card>
          <Card title="Two Heads (shared pipeline)">
            <span className="text-foreground">Congestion model</span> — forecasts next-interval congestion.
            <br />
            <span className="text-foreground">ETA model</span> — predicts travel time to re-rank routes.
          </Card>
        </div>
        <div className="flex flex-col gap-3">
          <Card title="9 Input Features">
            distance · avg congestion · segments · hour (cyclical) · weekend · urban density · scenario severity · rain
          </Card>
          <Card title="Training & Fallback">
            Trained on a physics-based synthetic dataset (MAE/R² reported). If no model file is present, the app cleanly
            falls back to heuristics — never breaks.
          </Card>
        </div>
      </div>
    ),
  },

  // 9 — Integration
  {
    id: "integration",
    kicker: "08 — Integration",
    title: "How It All Connects",
    body: (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Node label="Frontend" sub="React + SWR" accent />
          <Arrow />
          <Node label="API Contract" sub="JSON /api/plan" />
          <Arrow />
          <Node label="Backend" sub="TS engine + ML" accent />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card title="Frontend → Backend">
            SWR calls <code className="text-primary">/api/plan</code> with query params (weights, scenario, location) and
            polls for live updates.
          </Card>
          <Card title="Backend → ML">
            The API loads ONNX models by file path, mirrors the exact feature schema, and runs inference per request.
          </Card>
          <Card title="External Services">
            Esri/OSM map tiles and OSM Nominatim geocoding — all free, no API keys required.
          </Card>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Clean API seam = teammates can build frontend and backend features in parallel.
        </p>
      </div>
    ),
  },

  // 10 — Software / tech stack
  {
    id: "stack",
    kicker: "09 — Software & Tools",
    title: "Technology Stack",
    body: (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card title="Frontend">Next.js · React · TypeScript · Tailwind CSS · shadcn/ui · SWR · Lucide</Card>
        <Card title="Mapping">Leaflet · React-Leaflet · Esri World Imagery · OpenStreetMap · OpenTopoMap</Card>
        <Card title="3D / Visualization">Three.js · React Three Fiber · Drei · HTML Canvas</Card>
        <Card title="Machine Learning">PyTorch · scikit-learn · ONNX · onnxruntime-node · NumPy</Card>
        <Card title="Backend">Next.js Route Handlers · Weighted Dijkstra · Deterministic sim engine</Card>
        <Card title="Geocoding & Tooling">OSM Nominatim · pnpm · Vercel · Git / GitHub</Card>
      </div>
    ),
  },

  // 11 — Algorithm detail
  {
    id: "algorithm",
    kicker: "10 — Core Algorithm",
    title: "Route Optimization",
    body: (
      <div className="grid gap-8 md:grid-cols-2">
        <ul className="flex flex-col gap-4 text-sm text-muted-foreground">
          <Bullet>
            Roads are modeled as a weighted graph; each edge cost blends travel time, distance and congestion.
          </Bullet>
          <Bullet>
            <span className="text-foreground">Weighted Dijkstra</span> finds the lowest-cost path per attendee across
            the whole network.
          </Bullet>
          <Bullet>The ML ETA model re-ranks candidate routes by predicted time, not just raw distance.</Bullet>
          <Bullet>On a disruption, a longer-but-faster detour can be promoted automatically.</Bullet>
        </ul>
        <Card title="Blended Edge Cost">
          <p className="font-mono text-sm text-foreground">
            cost = w<sub>t</sub>·time + w<sub>d</sub>·distance + w<sub>c</sub>·congestion
          </p>
          <p className="mt-3 text-xs">
            Weights are user-controlled sliders, so the &quot;optimal&quot; definition is transparent and adjustable in
            real time.
          </p>
        </Card>
      </div>
    ),
  },

  // 12 — Future scope + close
  {
    id: "future",
    kicker: "11 — Future Scope",
    title: "What's Next",
    body: (
      <div className="grid gap-8 md:grid-cols-2">
        <ul className="flex flex-col gap-4 text-sm text-muted-foreground">
          <Bullet>Integrate a live traffic API (Mapbox / TomTom) for real per-city congestion.</Bullet>
          <Bullet>Upgrade the model to a Graph Neural Network trained on real GPS traces.</Bullet>
          <Bullet>Persist events, attendees and saved plans in a database with user accounts &amp; roles.</Bullet>
          <Bullet>Send attendees their optimized routes by email / SMS with live updates.</Bullet>
        </ul>
        <div className="flex flex-col justify-center gap-3 rounded-xl border border-primary/40 bg-primary/5 p-6">
          <h3 className="font-mono text-xs uppercase tracking-widest text-primary">Summary</h3>
          <p className="text-pretty text-base leading-relaxed text-foreground">
            RouteCast unites full-stack engineering, geospatial visualization and deep learning into one cohesive,
            worldwide, scenario-aware route optimization platform.
          </p>
          <p className="font-mono text-sm text-primary">Thank you — Questions?</p>
        </div>
      </div>
    ),
  },
]
