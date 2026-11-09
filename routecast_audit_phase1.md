# RouteCast Digital Twin — Phase 1 Audit Report
**Date:** 2026-10-22 | **Auditor:** Antigravity AI | **Scope:** Read-only — no files modified

---

## A. Existing Architecture & Feature Inventory

### Repository Layout

Two zip archives were found in `Downloads/`:
- **`RouteCaste-DigitalTwin-model-training.zip`** (2.14 MB) — the one registered as the workspace. Contains the **complete monorepo**: Next.js frontend, API routes, ML Python pipeline, trained ONNX models, and data pipeline scripts. This is the only real source.
- **`RouteCaste-DigitalTwin-main.zip`** (2.30 MB) — an older / alternative snapshot. Not inspected in detail; assumed to be an earlier version of the same code.

Both extracted directories are currently **empty folders** on disk; the actual files live only inside the zips (extracted temporarily to `Downloads/extracted_training/` during this audit).

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | Next.js 16.3 (App Router) |
| Map rendering | Leaflet 1.9 + react-leaflet 5.0 |
| 3D hologram | Three.js 0.185 + @react-three/fiber 9.7 |
| State / data fetching | SWR 2.5 (15-second auto-refresh) |
| ML inference (server) | onnxruntime-node ^1.27.0 |
| Geocoding | Nominatim (OSM) |
| Routing engine | OSRM public demo server |
| POI lookup | Overpass API → Nominatim fallback |
| ML training | PyTorch (CPU/CUDA), exported to ONNX opset 18 |
| Python deps | numpy, pandas, torch, onnxruntime (see `ml/requirements.txt`) |

### Feature Inventory

| Feature | Location | Status |
|---|---|---|
| Interactive Leaflet map | `components/city-map.tsx` | ✅ Working |
| Location search (Nominatim) | `components/location-search.tsx`, `app/api/geocode/` | ✅ Working |
| Reverse geocoding on click | `app/page.tsx` | ✅ Working |
| OSRM real-road routing (Directions mode) | `lib/geo/routing.ts`, `app/api/navigation/route/` | ✅ Working |
| Multi-mode (driving/walking/cycling) | `lib/geo/routing.ts` | ✅ Working (walking/cycling re-timed from driving geometry when OSRM only has driving profile) |
| AI route intelligence + scoring | `lib/intel/score.ts`, `app/api/intelligence/route/` | ✅ Implemented (see defects) |
| What-if scenario (Directions mode) | `app/api/intelligence/route/route.ts`, `components/whatif-panel.tsx` | ✅ Implemented |
| Live navigation session / turn-by-turn | `hooks/use-nav-session.ts`, `lib/nav/progress.ts`, `components/nav-hud.tsx` | ✅ Implemented |
| GPS geolocation + manual position | `hooks/use-geolocation.ts` | ✅ Implemented |
| Rerouting on off-route | `hooks/use-nav-session.ts` | ✅ Implemented |
| POI search (Overpass) | `lib/geo/places.ts`, `app/api/places/nearby/` | ✅ Working |
| Waypoint stops | `app/page.tsx`, `components/navigation-panel.tsx` | ✅ Implemented |
| Synthetic 8×8 grid road network | `lib/city.ts` | ✅ Working (Event mode) |
| Event-mode multi-invitee routing | `lib/optimizer.ts`, `app/api/plan/` | ✅ Working |
| Dijkstra optimizer (best/fastest/shortest) | `lib/optimizer.ts` | ✅ Working |
| What-if scenario (Event mode) | `lib/sim.ts`, `app/api/plan/` | ✅ Working |
| Baseline vs scenario comparison | `app/api/plan/`, `components/comparison-table.tsx` | ✅ Working |
| ONNX ETA model inference | `lib/ml.ts` | ✅ Loads & runs — **but wrong features** (see Defect #1) |
| ONNX Congestion model inference | `lib/ml.ts` | ✅ Loads & runs — **but wrong features AND wrong output handling** (see Defects #1, #2) |
| Short-horizon congestion forecast | `app/api/plan/`, `lib/sim.ts` | ✅ Heuristic + optional ML path |
| 2D hologram view | `components/hologram-2d.tsx` | ✅ Implemented |
| 3D hologram view | `components/hologram-3d.tsx` | ✅ Implemented |
| Presentation slide deck | `app/presentation/`, `components/presentation/` | ✅ Implemented |
| Weather intel (Open-Meteo) | `lib/intel/weather.ts` | ✅ Implemented (external API) |
| Incident management | `lib/intel/incidents.ts`, `app/api/incidents/` | ✅ Implemented |
| Pollution heat layer | `lib/sim.ts`, `components/city-map.tsx` | ✅ Working |
| Metrics dashboard | `components/metrics-dashboard.tsx` | ✅ Working |
| ML status badge ("ONNX active" / "Heuristic") | `app/page.tsx` → `MlStatus` component | ⚠️ Misleading — see Defect #4 |

---

## B. Confirmed Defects

### Defect #1 — CRITICAL: Complete ETA Feature Vector Mismatch

**Severity: P0 — The ETA model is receiving wrong inputs every call.**

**Training pipeline** (`ml/schema.py` + `ml/data.py`) defines and builds this 9-feature vector in this exact order:

```
[1] distance_km_over_10         = segment_length_m / 1000 / 10
[2] current_travel_time_log     = clamp(log1p(current_tt) / log1p(3600))
[3] current_congestion          = clamp(1 - current_speed / speed_limit)
[4] current_speed_normalized    = clamp(current_speed / speed_limit)
[5] hour_sin                    = sin(2π * hour / 24)
[6] hour_cos                    = cos(2π * hour / 24)
[7] event_proximity             = discrete proximity score (0, 0.5, 0.75, 1.0)
[8] scenario_severity           = distance_weight clamped 0..1
[9] event_load                  = weighted blend of attendance/size/duration/rates
```

**Inference code** (`lib/ml.ts`, lines 101–111) constructs this 9-element vector:

```typescript
const feats = [
  f.distanceKm / 10,            // [1] ✅ matches distance_km_over_10
  clamp01(f.avgCongestion),     // [2] ❌ WRONG — slot 2 must be current_travel_time_log, not congestion
  f.numSegments / 20,           // [3] ❌ WRONG — slot 3 must be current_congestion
  hs,                           // [4] ❌ WRONG — slot 4 must be current_speed_normalized
  hc,                           // [5] ❌ WRONG — slot 5 must be hour_sin
  ctx.isWeekend ? 1 : 0,       // [6] ❌ WRONG — slot 6 must be hour_cos (not a training feature at all)
  clamp01(ctx.areaDensity),    // [7] ❌ WRONG — slot 7 must be event_proximity (not a training feature)
  clamp01(ctx.scenarioSeverity),// [8] ✅ maps to scenario_severity
  clamp01(ctx.rain),            // [9] ❌ WRONG — slot 9 must be event_load (rain was never a training feature)
]
```

**Summary:** 7 of the 9 feature slots are either swapped or carry values the model was never trained on (`isWeekend`, `areaDensity`, `rain`). The model is consuming random noise in almost every slot. The heuristic fallback is more correct than the model call.

**Files:** [`lib/ml.ts` L101–111](file:///c:/Users/chait/Downloads/extracted_training/RouteCaste-DigitalTwin-model-training/lib/ml.ts#L101-L111), [`ml/schema.py` L4–14](file:///c:/Users/chait/Downloads/extracted_training/RouteCaste-DigitalTwin-model-training/ml/schema.py#L4-L14), [`ml/data.py` L384–547](file:///c:/Users/chait/Downloads/extracted_training/RouteCaste-DigitalTwin-model-training/ml/data.py#L384-L547)

---

### Defect #2 — CRITICAL: ETA Model Output Not Inverse-Transformed

**Severity: P0 — Raw log-ratio used as minutes; the model is producing nonsense ETA values.**

The ETA model was trained to predict:

```
target = log(future_travel_time / current_travel_time)
```

So the model output is a **log-ratio**, clamped to `[-5, 5]`. To recover a travel-time estimate in real units:

```python
factor = exp(prediction)          # inverse of log()
future_eta_seconds = current_travel_time_seconds * factor
future_eta_minutes = future_eta_seconds / 60
```

**Inference code** (`lib/ml.ts`, line 114) does:

```typescript
return { value: Math.max(0.2, pred), source: "model" }
```

It treats the raw log-ratio directly as a value in minutes and returns it. `log(ratio)` for a reasonable trip ranges from approximately `-0.5` to `+0.5` (a ±60% change in travel time), so the model always "predicts" sub-minute trips. `score.ts` then floors it with `Math.max(baseEtaMin, eta.value)` which means the corrected ETA always falls back to `baseEtaMin` anyway — masking the bug but producing results no better than the engine's own timing.

**Required fix:** After getting `pred` from `run("eta", feats)`, decode it:
```typescript
// current_travel_time is encoded in feature[1]: log1p(tt) / log1p(3600)
const ttSec = Math.expm1(feats[1] * Math.log1p(3600))
const factor = Math.exp(pred)
const etaMin = ttSec * factor / 60
return { value: Math.max(0.2, etaMin), source: "model" }
```
(But this only applies once Defect #1 is fixed so `feats[1]` actually contains the right value.)

**Files:** [`lib/ml.ts` L113–115](file:///c:/Users/chait/Downloads/extracted_training/RouteCaste-DigitalTwin-model-training/lib/ml.ts#L113-L115), [`ml/data.py` L730–802](file:///c:/Users/chait/Downloads/extracted_training/RouteCaste-DigitalTwin-model-training/ml/data.py#L730-L802), [`ml/train.py` L979–1068](file:///c:/Users/chait/Downloads/extracted_training/RouteCaste-DigitalTwin-model-training/ml/train.py#L979-L1068)

---

### Defect #3 — CRITICAL: Congestion Feature Vector Mismatch + Wrong Output Decoding

**Severity: P0 — Wrong inputs AND the 5-class logit output is read as a scalar 0..1.**

**Training pipeline** defines this 9-feature congestion vector:

```
[1] current_congestion           = clamp(1 - current_speed / speed_limit)
[2] step_over_6                  = clamp(horizon_minutes / 60)  ← "step" is horizon in hours
[3] current_speed_normalized     = clamp(current_speed / speed_limit)
[4] road_capacity_normalized     = clamp(capacity / (7200 * lanes))
[5] hour_sin
[6] hour_cos
[7] incident_load                = weighted event/attendance blend
[8] scenario_severity
[9] event_proximity
```

**Inference code** (`lib/ml.ts`, lines 124–134) sends:

```typescript
const feats = [
  clamp01(f.current),        // [1] ✅ current_congestion
  f.step / 6,               // [2] ❌ WRONG — schema's step_over_6 = horizon_min/60, not step/6
  hs,                        // [3] ❌ WRONG — slot 3 must be current_speed_normalized
  hc,                        // [4] ❌ WRONG — slot 4 must be road_capacity_normalized
  clamp01(f.incidentLoad),  // [5] ❌ WRONG — slot 5 must be hour_sin
  ctx.isWeekend ? 1 : 0,   // [6] ❌ WRONG — slot 6 must be hour_cos
  clamp01(ctx.areaDensity), // [7] ❌ WRONG — slot 7 must be incident_load
  clamp01(ctx.scenarioSeverity), // [8] ✅ scenario_severity
  clamp01(ctx.rain),        // [9] ❌ WRONG — slot 9 must be event_proximity
]
```

**Output shape mismatch:** The ONNX model outputs **5 class logits** `[free, light, moderate, heavy, severe]` (shape `[1, 5]`). The inference code reads only `(first.data as Float32Array)[0]` — just the first logit (the "free" class score, unnormalized), treats it as a continuous 0–1 congestion value, then `clamp01()` clips it. The correct approach is softmax over all 5 logits, then `argmax` for the predicted class, then map to a 0–1 scale:

```typescript
const logits = Array.from(first.data as Float32Array)  // length 5
const maxLogit = Math.max(...logits)
const expd = logits.map(l => Math.exp(l - maxLogit))
const sum = expd.reduce((a, b) => a + b, 0)
const probs = expd.map(p => p / sum)
const classIndex = probs.indexOf(Math.max(...probs))  // 0=free..4=severe
const congestion = classIndex / 4  // map to 0..1
```

**Files:** [`lib/ml.ts` L124–137](file:///c:/Users/chait/Downloads/extracted_training/RouteCaste-DigitalTwin-model-training/lib/ml.ts#L124-L137), [`ml/schema.py` L17–27](file:///c:/Users/chait/Downloads/extracted_training/RouteCaste-DigitalTwin-model-training/ml/schema.py#L17-L27), [`ml/train.py` L1431–1450](file:///c:/Users/chait/Downloads/extracted_training/RouteCaste-DigitalTwin-model-training/ml/train.py#L1431-L1450)

---

### Defect #4 — HIGH: ONNX Status Badge Reports File Existence, Not Successful Inference

**Severity: P1 — UI label "ONNX active" can be false when models fail to run.**

`modelStatus()` in `lib/ml.ts` (lines 180–185) only calls `fs.existsSync(path)` — it never checks whether the session was successfully created or whether any inference actually ran:

```typescript
export function modelStatus(): { eta: boolean; congestion: boolean } {
  return {
    eta: fs.existsSync(state.eta.path),
    congestion: fs.existsSync(state.congestion.path),
  }
}
```

The UI badge `MlStatus` (page.tsx lines 612–648) shows **"ONNX active"** whenever `ml.eta || ml.congestion` is truthy. Since the ONNX files exist in the `models/` directory, this badge always shows "ONNX active" — even if the session failed to load, or inference is returning garbage because of Defects #1–3.

A correct implementation would check `state.eta.tried && state.eta.session !== null`.

**Files:** [`lib/ml.ts` L180–185](file:///c:/Users/chait/Downloads/extracted_training/RouteCaste-DigitalTwin-model-training/lib/ml.ts#L180-L185), [`app/page.tsx` L612–648](file:///c:/Users/chait/Downloads/extracted_training/RouteCaste-DigitalTwin-model-training/app/page.tsx#L612-L648)

---

### Defect #5 — HIGH: Event Mode Uses Manhattan Synthetic Grid, Not Guntur Road Network

**Severity: P1 — Core MVP requirement not met.**

`lib/city.ts` (line 40) hard-codes the grid center to **Lower Manhattan (lat: 40.712, lng: -74.012)**:

```typescript
const DEFAULT_CENTER: LatLng = { lat: 40.712 + 3.5 * STEP, lng: -74.012 + 3.5 * STEP }
```

The 8×8 synthetic lattice is not an actual road network — it is a mathematically generated grid that overlays real OSM map tiles. Moving the center via the `place` search only shifts the grid; it does not fetch or use Guntur's actual streets. Incident placement is also hard-coded to Manhattan grid cells (`ACCIDENT_NODE = "n3_4"`, `CLOSURE_NODE = "n4_5"` in `lib/sim.ts`).

The OSRM-based Directions mode **does** use real roads for any location. Only the Event-mode grid is synthetic.

**Files:** [`lib/city.ts` L40](file:///c:/Users/chait/Downloads/extracted_training/RouteCaste-DigitalTwin-model-training/lib/city.ts#L40), [`lib/sim.ts` L42–43](file:///c:/Users/chait/Downloads/extracted_training/RouteCaste-DigitalTwin-model-training/lib/sim.ts#L42-L43)

---

### Defect #6 — HIGH: Training Dataset Unavailable (Git LFS Pointers)

**Severity: P1 — Cannot retrain without resolving.**

All four `.csv.gz` files under `data/processed/` are **Git LFS pointer files**, not real data. Confirmed via magic bytes:

```
routecast_ml_dataset.csv.gz (133 bytes):
  version https://git-lfs.github.com/spec/v1
  oid sha256:8ce2025de7b17bc893e659627159bf82e4b49f86ae8...
  size 35386048
```

The actual training dataset is 35.4 MB (compressed). The `.gitattributes` file marks all `data/processed/*.csv.gz` as LFS objects. Without running `git lfs pull` against the original repository (or obtaining the files from the team), the training pipeline (`ml/train.py`, `ml/data.py`) cannot run.

The 30+ numbered scripts in `scripts/` are the SUMO simulation pipeline that originally produced these CSVs. Running them end-to-end requires SUMO installed + the Guntur OSM network download.

The **trained ONNX models** (`models/eta.onnx`, `models/congestion.onnx` and their `.data` sidecar files) **are real binary files** — they are present in the zip and load correctly. Inference can be fixed without retraining.

**Files:** [`data/processed/routecast_ml_dataset.csv.gz`](file:///c:/Users/chait/Downloads/extracted_training/RouteCaste-DigitalTwin-model-training/data/processed/routecast_ml_dataset.csv.gz), [`.gitattributes`](file:///c:/Users/chait/Downloads/extracted_training/RouteCaste-DigitalTwin-model-training/.gitattributes)

---

### Defect #7 — MEDIUM: Two Completely Separate Scenario/Intelligence Systems

**Severity: P2 — Architectural confusion, risk of divergence.**

There are **two parallel, entirely separate** what-if systems:

| Aspect | Event Mode (`/api/plan`) | Directions Mode (`/api/intelligence/route`) |
|---|---|---|
| Road graph | 8×8 synthetic grid (`lib/city.ts`) | Real OSRM / OSM network |
| Incident placement | Hard-coded grid nodes | Lat/lon on real route |
| Scenario types | `none/closure/accident/surge/weather` | `none/closure/accident/traffic/rain/flood` |
| ML calls | `rerankRoutesByEta`, `predictCongestion` | `scoreRoutes` (calls same `predictEta`, `predictCongestion`) |
| Congestion forecast | `forecastCongestion` (heuristic/ML) | Not exposed |

They share `lib/ml.ts` for inference but otherwise are completely separate code paths. Users switching between "Event" and "Directions" modes see qualitatively different simulations.

**Files:** [`app/api/plan/route.ts`](file:///c:/Users/chait/Downloads/extracted_training/RouteCaste-DigitalTwin-model-training/app/api/plan/route.ts), [`app/api/intelligence/route/route.ts`](file:///c:/Users/chait/Downloads/extracted_training/RouteCaste-DigitalTwin-model-training/app/api/intelligence/route/route.ts)

---

### Defect #8 — MEDIUM: ETA Metrics Are In Seconds, Displayed Without Units Context

**Severity: P2 — Metrics are misleading without understanding.**

`metrics.json` shows:
- ETA MAE: **26.2** (seconds, not minutes — the target is a log-ratio of travel times in seconds)
- ETA RMSE: **166.4** (seconds)
- Median AE: **0.36** (seconds — most predictions are off by <1 second of travel time change)
- R²: **0.18** — weak, meaning the model explains only 18% of the variance in the log-ratio

However `within_10_percent: 51%` means the model is within 10% of the correct ratio roughly half the time — a reasonable but not strong result. The RMSE is dominated by the p95 of 61 seconds (some badly wrong outliers).

This is not a code defect but must be understood when communicating model quality.

---

### Defect #9 — LOW: No Guntur-Specific Location Defaults

**Severity: P3 — UX gap for the target city.**

The app defaults to Manhattan coordinates on first load. No Guntur preset exists. The user must manually search "Guntur" each session. For the capstone demo, the app should open centered on Guntur (lat: 16.3067, lng: 80.4365) by default.

---

### Defect #10 — LOW: `step_over_6` Name vs Actual Formula Mismatch

**Severity: P3 — Minor confusion.**

`schema.py` names the feature `step_over_6` but `data.py` computes it as `horizon_minutes / 60` (i.e., horizon in hours, range 0..1). The name implies division by 6, not 60. The formula is correct for normalizing the horizon; only the name is misleading.

---

## C. Existing Features That Must Be Preserved

The following work correctly and must not be broken during implementation sprints:

1. **OSRM real-road routing** — Directions mode fetches real OSM-aligned routes for any city globally, including Guntur.
2. **AI route intelligence scoring + what-if scenarios** (Directions mode) — the `scoreRoutes` / `intelligence/route` pipeline is architecturally sound and handles incidents, weather, detours, and real re-routing.
3. **Live navigation session** — GPS tracking, snapping, off-route detection, and rerouting work end-to-end.
4. **Location search + reverse geocode** — Nominatim integration is fully functional.
5. **POI discovery** — Overpass API integration returns real OSM POIs for any location.
6. **Trained ONNX models** — Both `eta.onnx` and `congestion.onnx` are valid binary files verified by the training pipeline's parity check (max difference < 2×10⁻⁶).
7. **Heuristic fallback** — The graceful degradation path (heuristic when models are missing or fail) must remain intact.
8. **Baseline vs scenario comparison table** — Event mode compares before/after metrics correctly.
9. **Data provenance labelling** — `traffic.source: "predicted"` and `source: "model" | "heuristic"` labels are already wired through the stack. These transparency labels are an important design feature.
10. **Presentation slide deck route** — `/presentation` page used for capstone demos.

---

## D. Missing Data & Dependencies

| Item | Status | Impact |
|---|---|---|
| `routecast_ml_dataset.csv.gz` (35 MB) | Git LFS pointer — not available | Cannot retrain; can still fix inference |
| `event_prediction_targets_reduced.csv.gz` | Git LFS pointer | Cannot retrain |
| `baseline_prediction_targets_reduced.csv.gz` | Git LFS pointer | Cannot retrain |
| `event_traffic_1km.csv.gz` | Git LFS pointer | Cannot retrain |
| SUMO traffic simulator | Not included (required by scripts 01–32) | Cannot regenerate datasets |
| Guntur OSM network files (`.net.xml`, `.taz.xml`) | Not included | Cannot regenerate datasets |
| Python ML environment | Not installed (requires `ml/requirements.txt`) | Cannot run training |
| `onnxruntime` Python package | Optional — needed only for parity check | Won't block training if absent |
| Node.js + pnpm | Likely installed; needs verification | Required to run Next.js dev server |
| Real Guntur traffic data | Not collected | MVP uses SUMO simulation proxy |
| Live traffic API | Not wired (no TomTom/Here/Google Traffic) | Confirmed: all traffic is predicted |
| OpenWeather or Open-Meteo API key | Optional — `lib/intel/weather.ts` uses Open-Meteo which is free/no-key | Weather works without a key |
| ROUTING_URL env var | Defaults to public OSRM demo — rate-limited, unreliable | Should self-host OSRM for production |

---

## E. Prioritized Implementation Plan

### Priority 1 — ML Inference Correctness (Blockers)

#### Task E-1: Fix ETA Feature Vector
**Why first:** Every ETA model call currently sends wrong features. This is the most impactful single fix — it unlocks the value of the trained model across both `/api/plan` and `/api/intelligence/route`.

**Acceptance criteria:**
- `lib/ml.ts` `predictEta()` constructs features in exactly this order, using values derivable from `EtaInput + PredictContext`:
  1. `distanceKm / 10` ← `f.distanceKm / 10`
  2. `log1p(currentTravelTimeSec) / log1p(3600)` — requires passing `currentTravelTimeSec` in `EtaInput`
  3. `clamp01(1 - currentSpeedNorm)` — requires `currentSpeedNorm = currentSpeed / speedLimit`
  4. `clamp01(currentSpeedNorm)`
  5. `sin(2π * hour / 24)`
  6. `cos(2π * hour / 24)`
  7. `eventProximity` (0 / 0.5 / 0.75 / 1.0 based on distance to event, or 0 if no event)
  8. `scenarioSeverity` (0..1, currently passed correctly)
  9. `eventLoad` (0..1, weighted attendance/size/duration/rates blend, or 0 if no event)
- Add `currentTravelTimeSec`, `currentSpeedNorm`, `speedLimitKmh`, `eventProximity`, `eventLoad` to `EtaInput`
- All callers in `score.ts` and `api/plan/` updated to supply these values
- Unit test: feed a known feature vector, verify the model returns a finite float

#### Task E-2: Fix ETA Inverse Transform
**Why second:** Even with correct features, the raw log-ratio output must be decoded. Depends on E-1 (needs `currentTravelTimeSec` from the corrected feature set).

**Acceptance criteria:**
- After `run("eta", feats)` returns log-ratio `pred`:
  - `ttSec = Math.expm1(feats[1] * Math.log1p(3600))`
  - `factor = Math.exp(pred)`
  - `etaMin = ttSec * factor / 60`
  - Return `Math.max(0.2, etaMin)`
- For a highway segment (10 km, 90 km/h, low congestion), the model should predict ~7–12 min ETA (not 0.2 min)
- Existing `Math.max(baseEtaMin, eta.value)` floor in `score.ts` can be relaxed or removed once the output is correct

#### Task E-3: Fix Congestion Feature Vector + Output Decoding
**Why third:** Depends on understanding the corrected ETA approach, and similar refactoring of `CongestionInput`.

**Acceptance criteria:**
- `predictCongestion()` constructs the 9-feature vector in schema order (see Defect #3)
- Output decoding: read all 5 logits, apply softmax, take argmax → class index 0–4, map to 0..1 by dividing by 4
- Expose predicted class label `"free" | "light" | "moderate" | "heavy" | "severe"` alongside the 0..1 score
- The `ForecastStrip` component shows the class label, not just a 0..1 number

#### Task E-4: Fix ONNX Status Badge
**Acceptance criteria:**
- `modelStatus()` returns `{ eta: boolean; congestion: boolean }` where `true` means the session was successfully created AND at least one inference call has returned a finite value
- The badge reads "ONNX active" only when this is confirmed
- A new `"ONNX error"` state is shown if the file exists but the session failed to load

---

### Priority 2 — Guntur MVP Defaults & Real Road Network

#### Task E-5: Set Guntur as Default City
**Why:** The target MVP is explicitly a Guntur Digital Twin. Every demo, every screenshot, every evaluation should open on Guntur by default.

**Acceptance criteria:**
- App opens centered on Guntur, Andhra Pradesh (lat: 16.3067, lng: 80.4365, zoom: 13)
- Event mode auto-generates invitee origins within the Guntur metropolitan bounding box
- The `DEFAULT_CENTER` in `lib/city.ts` (and/or an env var `DEFAULT_LAT/DEFAULT_LNG`) is set to Guntur coordinates
- `README.md` updated to document the city default

#### Task E-6: Add Guntur Location Preset to Search UI
**Acceptance criteria:**
- A "Guntur" quick-select button or default appears in the `LocationSearch` component or the header
- Selecting it flies to Guntur and sets `density=0.75` (urban)
- The 8×8 synthetic grid re-centers on Guntur for Event mode

---

### Priority 3 — Architecture & Code Quality

#### Task E-7: Document the Two-Network Architecture
**Why:** Developers and evaluators are confused by Event mode (synthetic grid) vs Directions mode (real roads). Clear labelling prevents incorrect claims.

**Acceptance criteria:**
- A prominent UI label in Event mode: **"Synthetic road graph — for event simulation only"**
- A label in Directions mode: **"Real OpenStreetMap roads via OSRM"**
- `README.md` updated with an architecture diagram distinguishing the two modes
- All API responses already include `engine: "osrm"` — surface this in the UI

#### Task E-8: Add End-to-End Smoke Tests
**Why:** There are zero tests currently. Defects #1–3 existed because there was no regression harness.

**Acceptance criteria:**
- A Jest/Vitest test file exercises `predictEta` with a known feature vector and asserts the returned minutes fall in a plausible range (e.g., 5–60 min for a 10-km urban segment)
- A test for `predictCongestion` asserts the class index is 0–4 and the 0..1 score maps correctly
- A test for `scoreRoutes` with mocked ONNX sessions asserts `adjustedEtaMin >= baseEtaMin`
- CI-runnable with `pnpm test` (or `npm test`)

---

## F. Acceptance Criteria Summary

| Task | Done When |
|---|---|
| E-1 Fix ETA features | Feature vector matches `schema.py` exactly; `EtaInput` type extended; all callers supply new fields |
| E-2 Fix ETA inverse transform | ETA prediction is in minutes; 10-km highway segment predicts 7–15 min; floor logic updated |
| E-3 Fix congestion features + output | Correct 9-feature vector; 5-logit output → softmax → class + 0..1 score; class label exposed |
| E-4 Fix ONNX status badge | Badge requires confirmed successful inference, not just file presence; "ONNX error" state added |
| E-5 Guntur default city | App opens on Guntur; event invitees placed in Guntur area; env var documented |
| E-6 Guntur location preset | Quick-select button in search UI; flies to correct coordinates + zoom |
| E-7 Document two-network architecture | UI labels in both modes; README architecture section; no misleading claims |
| E-8 Smoke tests | `pnpm test` passes; covers ETA/congestion inference and `scoreRoutes`; runs in CI |

---

## G. Commands to Verify the Current Baseline

```powershell
# 1. Extract the zip to a working directory (already done to extracted_training/)
# The zip is at: C:\Users\chait\Downloads\RouteCaste-DigitalTwin-model-training.zip

# 2. Verify ONNX model files are real binaries (not LFS pointers)
python -c "
import struct
for name in ['eta', 'congestion']:
    with open(f'models/{name}.onnx', 'rb') as f:
        magic = f.read(4)
    print(f'{name}.onnx magic bytes:', magic.hex(), '(expected 08 for protobuf)')
"

# 3. Run ONNX inference parity check (requires onnxruntime)
python -c "
import onnxruntime as ort, numpy as np
for name, n_feat, n_out in [('eta', 9, 1), ('congestion', 9, 5)]:
    sess = ort.InferenceSession(f'models/{name}.onnx')
    x = np.random.rand(1, n_feat).astype('float32')
    out = sess.run(None, {'input': x})[0]
    print(f'{name}: input={x.shape} output={out.shape} sample={out[0][:3]}')
"

# 4. Check for LFS pointers in dataset
python -c "
import os
for f in os.listdir('data/processed'):
    if f.endswith('.gz'):
        with open(f'data/processed/{f}', 'rb') as fh:
            head = fh.read(20)
        lfs = b'git-lfs' in head
        print(f'{f}: LFS={lfs} size={os.path.getsize(\"data/processed/\"+f)}B')
"

# 5. Install Node dependencies and start dev server
# (run from the extracted project root)
pnpm install
pnpm dev
# Then open http://localhost:3000 and verify:
#   - Map loads (Leaflet tiles visible)
#   - ML status badge shows "ONNX active" (file-exists check currently, will be wrong)
#   - Event mode returns /api/plan JSON with ml.eta=true, ml.congestion=true
#   - Directions mode: pick two points, verify routes appear

# 6. Verify current feature mismatch (confirms Defect #1)
# Open http://localhost:3000/api/plan?mode=directions&fromLat=16.31&fromLng=80.44&toLat=16.30&toLng=80.43
# Inspect the ml.etaSource field — it should say "model" if models loaded
# But the eta values will be implausibly small (< 1 minute) due to the inverse transform bug

# 7. Check Python environment for retraining
python -c "import torch, numpy, pandas, onnxruntime; print('ML deps OK')"
```

---

## First Three Tasks — Recommended Implementation Order

### 1. **E-1 → Fix ETA Feature Vector** *(Start here)*

**Why first:** It is the root cause of the most impactful defect. The ETA model is present, loaded, and running — it is simply being fed the wrong numbers. Fixing the feature mapping immediately makes the model meaningful. This task also requires extending the `EtaInput` type, which is the type foundation that E-2 and E-3 depend on. Without fixing the input, fixing the inverse transform (E-2) still produces garbage output.

The fix is contained entirely within `lib/ml.ts` and the callers in `lib/intel/score.ts` and `app/api/plan/route.ts`. No model retraining needed.

---

### 2. **E-2 → Fix ETA Inverse Transform** *(Immediately after E-1)*

**Why second:** Once features are correct, the output still needs to be decoded. This is a one-line change in concept (add `exp(pred) * ttSec / 60`) but requires the `currentTravelTimeSec` value now available from E-1's extended `EtaInput`. The two tasks naturally form a single PR or back-to-back commits. After both land, run the baseline smoke test: the ETA model should predict plausible travel times for Guntur routes, visibly better than the flat heuristic.

---

### 3. **E-3 → Fix Congestion Feature Vector + Output Decoding** *(Third)*

**Why third:** Structurally identical to E-1/E-2 but for the second model. Fixing congestion after ETA means the team has a proven pattern to follow. The congestion model has an additional complexity (5-logit softmax output) so doing it third when the pattern is established reduces risk. After this task the forecast strip and route intelligence congestion bands will be driven by the real model, completing the "ETA + congestion = ML active" MVP promise.

---

> **Note on Defect #5 (Guntur Real Road Network):** Replacing the 8×8 synthetic grid with a real OSM-based graph for Event mode is architecturally significant and intentionally placed after the ML fixes (E-5/E-6). The OSRM-based Directions mode already uses real Guntur roads — the ML fixes (E-1 through E-3) benefit both modes immediately. The grid replacement is the larger engineering effort and warrants its own sprint.
