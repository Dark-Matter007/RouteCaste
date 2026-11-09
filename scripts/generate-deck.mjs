// Generates a professional RouteCast capstone deck as a .pptx file.
// Run: node scripts/generate-deck.mjs  ->  public/RouteCast-Capstone-Deck.pptx
import pptxgen from "pptxgenjs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, "..", "public", "RouteCast-Capstone-Deck.pptx")

// ---- Theme ----------------------------------------------------------------
const BG = "0A1420" // deep navy
const PANEL = "0F1D2E" // card
const CYAN = "22D3EE" // primary accent
const CYAN_DK = "0E7490"
const TEXT = "E6F1F5" // near-white
const MUTED = "7C93A3" // muted slate
const LINE = "1E3345"

const FONT = "Arial"
const MONO = "Consolas"

const pptx = new pptxgen()
pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 })
pptx.layout = "WIDE"
pptx.author = "RouteCast"
pptx.company = "Capstone Project"
pptx.title = "RouteCast — Event Route Digital Twin & AI Traffic Simulator"

const W = 13.333
const H = 7.5

// ---- Helpers --------------------------------------------------------------
function base(slide) {
  slide.background = { color: BG }
  // top accent bar
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.08, fill: { color: CYAN } })
}

function kicker(slide, text, num) {
  slide.addText(text.toUpperCase(), {
    x: 0.6,
    y: 0.5,
    w: 9,
    h: 0.4,
    fontFace: MONO,
    fontSize: 12,
    color: CYAN,
    charSpacing: 2,
    bold: true,
  })
  if (num) {
    slide.addText(num, {
      x: W - 1.6,
      y: 0.45,
      w: 1,
      h: 0.4,
      align: "right",
      fontFace: MONO,
      fontSize: 12,
      color: MUTED,
    })
  }
}

function title(slide, text) {
  slide.addText(text, {
    x: 0.6,
    y: 0.95,
    w: 12.1,
    h: 0.9,
    fontFace: FONT,
    fontSize: 30,
    color: TEXT,
    bold: true,
  })
}

// bullet list block
function bullets(slide, items, opts = {}) {
  const x = opts.x ?? 0.7
  const y = opts.y ?? 2.1
  const w = opts.w ?? 11.9
  const h = opts.h ?? 4.8
  const fontSize = opts.fontSize ?? 16
  slide.addText(
    items.map((t) => ({
      text: t,
      options: {
        bullet: { characterCode: "25AA", indent: 18 },
        color: TEXT,
        fontSize,
        fontFace: FONT,
        paraSpaceAfter: 10,
      },
    })),
    { x, y, w, h, valign: "top" },
  )
}

// a rounded card with heading + lines
function card(slide, x, y, w, h, heading, lines, accent = CYAN) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: PANEL },
    line: { color: LINE, width: 1 },
  })
  slide.addShape(pptx.ShapeType.rect, { x, y, w: 0.06, h, fill: { color: accent } })
  slide.addText(heading, {
    x: x + 0.2,
    y: y + 0.12,
    w: w - 0.35,
    h: 0.45,
    fontFace: MONO,
    fontSize: 13,
    color: accent,
    bold: true,
  })
  slide.addText(
    lines.map((t) => ({
      text: t,
      options: { color: TEXT, fontSize: 12, fontFace: FONT, paraSpaceAfter: 5, breakLine: true },
    })),
    { x: x + 0.2, y: y + 0.62, w: w - 0.4, h: h - 0.75, valign: "top" },
  )
}

// ---- Slide 1: Title -------------------------------------------------------
{
  const s = pptx.addSlide()
  s.background = { color: BG }
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.08, fill: { color: CYAN } })
  s.addShape(pptx.ShapeType.rect, { x: 0, y: H - 0.08, w: W, h: 0.08, fill: { color: CYAN } })

  s.addText("ROUTECAST", {
    x: 0.6,
    y: 2.35,
    w: 12,
    h: 1.2,
    fontFace: FONT,
    fontSize: 60,
    color: TEXT,
    bold: true,
    charSpacing: 2,
  })
  s.addText("Event Route Digital Twin & AI Traffic Simulator", {
    x: 0.65,
    y: 3.55,
    w: 12,
    h: 0.6,
    fontFace: FONT,
    fontSize: 22,
    color: CYAN,
  })
  s.addText("Plan, simulate, and re-route event traffic anywhere in the world.", {
    x: 0.65,
    y: 4.2,
    w: 12,
    h: 0.5,
    fontFace: FONT,
    fontSize: 15,
    color: MUTED,
  })
  s.addText(
    [
      { text: "Next.js  •  React  •  TypeScript  •  Leaflet  •  Three.js  •  PyTorch  →  ONNX", options: {} },
    ],
    { x: 0.65, y: 5.5, w: 12, h: 0.4, fontFace: MONO, fontSize: 13, color: MUTED },
  )
  s.addText("Capstone Project  |  Name • College • Guide", {
    x: 0.65,
    y: 6.4,
    w: 12,
    h: 0.4,
    fontFace: MONO,
    fontSize: 12,
    color: MUTED,
  })
}

// ---- Slide 2: Overview ----------------------------------------------------
{
  const s = pptx.addSlide()
  base(s)
  kicker(s, "Introduction", "02 / 15")
  title(s, "What is RouteCast?")
  bullets(
    s,
    [
      "A web-based digital-twin platform that computes optimal travel routes for event attendees over a real-coordinate city road network.",
      "Two modes: Event (route many invitees to one venue) and Directions (Google-Maps-style point A → point B).",
      "Works for any location worldwide via free OpenStreetMap geocoding.",
      "Simulates disruptions (accident, closure, weather, surge) and uses trained deep-learning models to re-rank routes by predicted travel time.",
      "Three views: real Map, 2D hologram, and 3D hologram, plus a live metrics dashboard.",
    ],
    { y: 2.0 },
  )
}

// ---- Slide 3: Problem -----------------------------------------------------
{
  const s = pptx.addSlide()
  base(s)
  kicker(s, "Problem Statement", "03 / 15")
  title(s, "The Gap in Existing Tools")
  card(s, 0.7, 2.1, 5.9, 2.1, "TODAY'S NAVIGATION APPS", [
    "Optimize a single traveler in isolation",
    "No collective / organizer-level view",
    "ETA is a black box — not tunable",
    "No what-if disruption simulation",
  ], MUTED)
  card(s, 6.75, 2.1, 5.9, 2.1, "WHAT'S MISSING", [
    "Plan routes for a whole group to one venue",
    "Weight time vs distance vs congestion",
    "Model accidents / closures before they hurt",
    "Aggregate impact: emissions, response time",
  ], CYAN)
  s.addText(
    "Core question: How can an organizer plan, tune, and simulate routing for many people converging on one venue?",
    { x: 0.7, y: 4.6, w: 11.9, h: 0.9, fontFace: FONT, fontSize: 16, color: TEXT, italic: true },
  )
}

// ---- Slide 4: Objectives --------------------------------------------------
{
  const s = pptx.addSlide()
  base(s)
  kicker(s, "Objectives", "04 / 15")
  title(s, "Project Objectives")
  const objs = [
    ["01", "Model a real-coordinate city road network as a routable weighted graph."],
    ["02", "Compute best / fastest / shortest routes with user-adjustable weights."],
    ["03", "Support any worldwide location; auto-generate invitees per city."],
    ["04", "Simulate disruptions and quantify impact vs a baseline."],
    ["05", "Train & integrate deep-learning models (ETA + congestion) via ONNX."],
    ["06", "Visualize on Map + 2D/3D holograms with a live metrics dashboard."],
  ]
  objs.forEach((o, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = 0.7 + col * 6.05
    const y = 2.1 + row * 1.5
    card(s, x, y, 5.9, 1.3, o[0], [o[1]], CYAN)
  })
}

// ---- Slide 5: Proposed Solution -------------------------------------------
{
  const s = pptx.addSlide()
  base(s)
  kicker(s, "Proposed Solution", "05 / 15")
  title(s, "How RouteCast Works")
  const steps = [
    ["Graph", "8×8 intersection grid over real lat/lng; each edge has congestion + free-flow speed."],
    ["Optimize", "Dijkstra computes routes under a normalized weighted blend of time, distance, congestion."],
    ["Simulate", "Scenarios mutate the graph; metrics recomputed vs a no-disruption baseline."],
    ["Predict", "ONNX ETA model re-ranks routes by predicted time; congestion model forecasts ahead."],
  ]
  steps.forEach((st, i) => {
    const x = 0.7 + i * 3.05
    card(s, x, 2.3, 2.85, 3.0, st[0].toUpperCase(), [st[1]], CYAN)
    if (i < 3) {
      s.addText("→", {
        x: x + 2.82,
        y: 3.5,
        w: 0.35,
        h: 0.6,
        align: "center",
        fontFace: FONT,
        fontSize: 24,
        color: CYAN,
        bold: true,
      })
    }
  })
  s.addText(
    "If ONNX model files are absent, the system falls back to a labeled heuristic — so it always runs.",
    { x: 0.7, y: 5.7, w: 11.9, h: 0.5, fontFace: MONO, fontSize: 12, color: MUTED, italic: true },
  )
}

// ---- Slide 6: Architecture ------------------------------------------------
{
  const s = pptx.addSlide()
  base(s)
  kicker(s, "System Architecture", "06 / 15")
  title(s, "Architecture Blueprint")
  card(s, 0.7, 2.05, 3.85, 4.6, "FRONTEND", [
    "Next.js App Router",
    "React 19 + TypeScript",
    "Tailwind CSS v4",
    "Leaflet (map)",
    "Three.js + R3F (3D)",
    "SWR (fetch/cache)",
  ], CYAN)
  card(s, 4.75, 2.05, 3.85, 4.6, "BACKEND / LOGIC", [
    "Route Handler: GET /api/plan",
    "lib/city — graph builder",
    "lib/optimizer — Dijkstra",
    "lib/sim — scenarios + metrics",
    "lib/ml — ONNX inference",
    "No database • No auth",
  ], CYAN)
  card(s, 8.8, 2.05, 3.85, 4.6, "ML + EXTERNAL", [
    "PyTorch (offline training)",
    "ONNX export (eta, congestion)",
    "onnxruntime-node (serve)",
    "OSM Nominatim (geocode)",
    "Reverse geocode (area names)",
    "Map tile basemaps",
  ], CYAN)
}

// ---- Slide 7: Block Diagram / Data Flow -----------------------------------
{
  const s = pptx.addSlide()
  base(s)
  kicker(s, "Block Diagram", "07 / 15")
  title(s, "End-to-End Data Flow")
  const flow = [
    "User input\n(location / mode / weights / scenario)",
    "API /api/plan\nrebuild graph + generate invitees",
    "Apply scenario\nmutate congestion + speed",
    "Dijkstra routing\nbest / fastest / shortest",
    "ML re-rank + forecast\nETA + congestion (ONNX)",
    "Metrics + baseline\n→ JSON → Map / 2D / 3D",
  ]
  flow.forEach((f, i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const x = 0.7 + col * 4.1
    const y = 2.3 + row * 2.0
    const [head, sub] = f.split("\n")
    s.addShape(pptx.ShapeType.roundRect, {
      x,
      y,
      w: 3.7,
      h: 1.5,
      rectRadius: 0.08,
      fill: { color: PANEL },
      line: { color: CYAN, width: 1 },
    })
    s.addText(
      [
        { text: head + "\n", options: { color: CYAN, fontSize: 13, bold: true, fontFace: MONO } },
        { text: sub, options: { color: TEXT, fontSize: 11, fontFace: FONT } },
      ],
      { x: x + 0.15, y: y + 0.15, w: 3.4, h: 1.2, valign: "middle", align: "center" },
    )
    if (col < 2 && i < flow.length - 1) {
      s.addText("→", { x: x + 3.7, y: y + 0.5, w: 0.4, h: 0.5, align: "center", fontSize: 22, color: CYAN, bold: true })
    }
  })
  s.addText("↓", { x: 4.55, y: 3.85, w: 0.4, h: 0.5, align: "center", fontSize: 22, color: CYAN, bold: true })
}

// ---- Slide 8: Tech Stack --------------------------------------------------
{
  const s = pptx.addSlide()
  base(s)
  kicker(s, "Technology Stack", "08 / 15")
  title(s, "Software & Tools")
  card(s, 0.7, 2.05, 3.85, 4.6, "FRONTEND", [
    "Next.js 16",
    "React 19",
    "TypeScript",
    "Tailwind CSS v4",
    "Leaflet / react-leaflet",
    "Three.js / R3F / Drei",
    "SWR • lucide-react",
  ])
  card(s, 4.75, 2.05, 3.85, 4.6, "BACKEND & ML", [
    "Next.js Route Handlers",
    "PyTorch (training)",
    "NumPy (data gen)",
    "ONNX (export)",
    "onnxruntime-node (serve)",
    "No database",
  ])
  card(s, 8.8, 2.05, 3.85, 4.6, "SERVICES & DEV", [
    "OpenStreetMap Nominatim",
    "Map tile basemaps",
    "pnpm • ESLint",
    "PostCSS",
    "Python 3.10+",
    "Vercel (hosting)",
  ])
}

// ---- Slide 9: Features ----------------------------------------------------
{
  const s = pptx.addSlide()
  base(s)
  kicker(s, "Key Features", "09 / 15")
  title(s, "What It Does")
  const feats = [
    ["Worldwide search", "Any country / state / city; grid recenters, invitees regenerate."],
    ["Event + Directions", "Group-to-venue routing, plus click-A / click-B trips."],
    ["Weighted routing", "Best / fastest / shortest with time-distance-congestion sliders."],
    ["Scenario simulator", "Accident, closure, surge, weather — with baseline comparison."],
    ["Metrics dashboard", "Speed, congestion, AQI, response time, CO₂, fuel, travel time."],
    ["AI model engine", "ONNX ETA + congestion, ETA re-routing, model/heuristic status."],
  ]
  feats.forEach((f, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    card(s, 0.7 + col * 6.05, 2.05 + row * 1.55, 5.9, 1.35, f[0].toUpperCase(), [f[1]], CYAN)
  })
}

// ---- Slide 10: Workflow ---------------------------------------------------
{
  const s = pptx.addSlide()
  base(s)
  kicker(s, "System Workflow", "10 / 15")
  title(s, "Request Lifecycle")
  bullets(
    s,
    [
      "User searches a location, picks Event or Directions mode, sets weights and a scenario.",
      "Frontend builds a query string and calls GET /api/plan via SWR (polls every 15s to stay live).",
      "Backend rebuilds the city graph centered on the location and generates invitees (or A/B points).",
      "The active scenario mutates edge congestion and speed; incidents are added to the graph.",
      "Dijkstra computes best / fastest / shortest routes per invitee.",
      "ML layer predicts ETA per route and re-ranks them; congestion model forecasts ahead.",
      "Metrics + a no-disruption baseline are computed and returned as JSON.",
      "React renders Map / 2D / 3D views, the dashboard, and the baseline-vs-scenario table.",
    ],
    { y: 2.0, fontSize: 15 },
  )
}

// ---- Slide 11: Core Modules & Algorithm -----------------------------------
{
  const s = pptx.addSlide()
  base(s)
  kicker(s, "Implementation", "11 / 15")
  title(s, "Core Modules & Algorithm")
  card(s, 0.7, 2.05, 5.9, 4.4, "MODULES", [
    "lib/city.ts — builds graph, centers on coords, nearest-node snap",
    "lib/optimizer.ts — weighted Dijkstra, 3 cost modes",
    "lib/sim.ts — scenario mutation + city metrics + baseline",
    "lib/ml.ts — ONNX sessions, ETA re-rank, heuristic fallback",
    "ml/ — schema.py, data.py, train.py (PyTorch → ONNX)",
  ])
  s.addShape(pptx.ShapeType.roundRect, {
    x: 6.75,
    y: 2.05,
    w: 5.9,
    h: 4.4,
    rectRadius: 0.08,
    fill: { color: PANEL },
    line: { color: LINE, width: 1 },
  })
  s.addText("WEIGHTED COST", {
    x: 6.95,
    y: 2.2,
    w: 5.5,
    h: 0.4,
    fontFace: MONO,
    fontSize: 13,
    color: CYAN,
    bold: true,
  })
  s.addText(
    "cost(edge) =\n  wTime · timeNorm\n  + wDistance · distNorm\n  + wCongestion · congestion\n\nDijkstra minimizes the summed cost\nalong the path. Routes are then\nre-ranked by the ML-predicted ETA,\nso a longer detour can win when an\naccident makes it genuinely faster.",
    { x: 6.95, y: 2.65, w: 5.5, h: 3.6, fontFace: MONO, fontSize: 13, color: TEXT, valign: "top", lineSpacingMultiple: 1.1 },
  )
}

// ---- Slide 12: ML / Deep Learning -----------------------------------------
{
  const s = pptx.addSlide()
  base(s)
  kicker(s, "ML / Deep Learning", "12 / 15")
  title(s, "The Model Engine")
  card(s, 0.7, 2.05, 5.9, 4.4, "ARCHITECTURE", [
    "Two feed-forward MLP regressors",
    "Layers: in → 128 → 128 → 64 → 1",
    "ReLU • Dropout 0.1 • Adam + weight decay",
    "Huber (SmoothL1) loss • cosine LR schedule",
    "Best-checkpoint-by-val-MAE restored",
    "Exported to ONNX (opset 17, dynamic batch)",
    "Served in Node via onnxruntime-node",
  ])
  card(s, 6.75, 2.05, 5.9, 4.4, "9 FEATURES + EVAL", [
    "ETA: distance, congestion, segments,",
    "     hour(sin,cos), weekend, density,",
    "     scenario severity, rain",
    "Congestion: current, step, hour(sin,cos),",
    "     incident load, weekend, density,",
    "     severity, rain",
    "Trained on 40k synthetic samples/model",
    "Metrics: MAE + R² → models/metrics.json",
    "Fallback: labeled heuristic if no ONNX file",
  ])
}

// ---- Slide 13: Results ----------------------------------------------------
{
  const s = pptx.addSlide()
  base(s)
  kicker(s, "Results & Output", "13 / 15")
  title(s, "What the System Delivers")
  bullets(
    s,
    [
      "End-to-end route planning for many invitees to a venue, and single A→B directions — for any location worldwide.",
      "Three comparable routes (best / fastest / shortest) with live, tunable weights.",
      "Scenario simulation with a baseline-vs-scenario impact table: travel time, speed, congestion, CO₂, fuel, incidents, AQI, response time.",
      "Working ONNX inference path that re-ranks routes by predicted ETA and reports how many invitees were re-routed.",
      "Transparent 'ONNX active / Heuristic' indicator and a short-horizon congestion forecast strip.",
      "Map + 2D/3D holographic visualizations and an in-app presentation deck.",
      "Training produces metrics.json with MAE / R² per model (values depend on the run).",
    ],
    { y: 2.0, fontSize: 15 },
  )
}

// ---- Slide 14: Advantages / Limitations / Future --------------------------
{
  const s = pptx.addSlide()
  base(s)
  kicker(s, "Evaluation", "14 / 15")
  title(s, "Advantages · Limitations · Future")
  card(s, 0.7, 2.05, 3.85, 4.6, "ADVANTAGES", [
    "Works globally, not one city",
    "Transparent, tunable routing",
    "Digital-twin what-if simulation",
    "Real PyTorch → ONNX models",
    "Map + 2D/3D + dashboard",
    "Clean, extensible layers",
  ], CYAN)
  card(s, 4.75, 2.05, 3.85, 4.6, "LIMITATIONS", [
    "Synthetic 8×8 grid, not real roads",
    "Simulated (not live) traffic",
    "ML trained on synthetic data",
    "No database / auth / test suite",
    "Auto-generated invitees",
    "Nominatim rate limits area names",
  ], "F59E0B")
  card(s, 8.8, 2.05, 3.85, 4.6, "FUTURE SCOPE", [
    "Real road graph (OSM / OSRM)",
    "Real traffic data + a GNN model",
    "Persistence + accounts + guest lists",
    "Live traffic / weather feeds",
    "Automated tests + CI",
    "Plan export + multi-venue",
  ], CYAN)
}

// ---- Slide 15: Conclusion -------------------------------------------------
{
  const s = pptx.addSlide()
  s.background = { color: BG }
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.08, fill: { color: CYAN } })
  s.addShape(pptx.ShapeType.rect, { x: 0, y: H - 0.08, w: W, h: 0.08, fill: { color: CYAN } })
  s.addText("Conclusion", {
    x: 0.6,
    y: 2.2,
    w: 12,
    h: 0.9,
    fontFace: FONT,
    fontSize: 36,
    color: TEXT,
    bold: true,
  })
  s.addText(
    "RouteCast unifies classic shortest-path optimization, a transparent traffic simulator, and trained deep-learning models into a single global, presentation-ready digital twin for event routing.",
    { x: 0.65, y: 3.2, w: 11.5, h: 1.4, fontFace: FONT, fontSize: 18, color: TEXT, lineSpacingMultiple: 1.2 },
  )
  s.addText("Thank you  —  Questions?", {
    x: 0.65,
    y: 5.2,
    w: 12,
    h: 0.6,
    fontFace: MONO,
    fontSize: 20,
    color: CYAN,
    bold: true,
  })
}

await pptx.writeFile({ fileName: OUT })
console.log("[deck] written to", OUT)
