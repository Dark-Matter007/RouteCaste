# RouteCast ML — Traffic ETA + Congestion Models

A shared training pipeline that produces **two ONNX models** the RouteCast
backend imports by file path. Both are **location-aware** and
**scenario-aware**, so predictions adapt to the selected city/state/country and
to disruptions (accident, closure, surge, weather).

```
ml/
  schema.py    <- the feature contract (MUST match lib/ml.ts)
  data.py      <- synthetic data generator (swap in real data here)
  train.py     <- trains + exports eta.onnx / congestion.onnx / metrics.json
  requirements.txt
```

## 1. Install

```bash
cd ml
python -m venv .venv && source .venv/bin/activate   # optional
pip install -r requirements.txt
```

## 2. Train

```bash
python train.py
```

This writes into the project's `models/` folder:

- `eta.onnx` — predicts travel time (minutes) for a route
- `congestion.onnx` — predicts next-interval congestion (0..1)
- `metrics.json` — validation MAE / R² (use these numbers in your report)

## 3. Use in the app

Nothing else to do. On the next request the Node backend (`lib/ml.ts`) detects
the files, loads them with `onnxruntime-node`, and the UI flips the **AI model
engine** badge to `ONNX active`. Remove the files to fall back to the built-in
heuristic.

You can also point at custom paths with env vars:

```
ETA_MODEL_PATH=/abs/path/eta.onnx
CONGESTION_MODEL_PATH=/abs/path/congestion.onnx
```

## Feature contract (do not reorder)

**ETA model** — 9 features:
`distance_km/10, avg_congestion, num_segments/20, hour_sin, hour_cos,
is_weekend, area_density, scenario_severity, rain`

**Congestion model** — 9 features:
`current_congestion, step/6, hour_sin, hour_cos, incident_load, is_weekend,
area_density, scenario_severity, rain`

Every model uses input tensor `input` `[batch, N]` float32 and output tensor
`output` `[batch, 1]` float32.

## Bring your own model / data

- Replace `make_*_dataset()` in `data.py` with your real dataset loader
  (return `(X, y)` NumPy arrays in the same column order as `schema.py`).
- Swap the `MLP` in `train.py` for anything (GNN, LSTM, XGBoost via `skl2onnx`).

As long as you keep the feature order above and the `input`/`output` tensor
names, the backend runs it unchanged.

## How the models drive the app

- **ETA model** scores every candidate route; the backend **re-ranks** them and
  recommends the one with the lowest predicted time. When an accident/closure
  makes the shortest route slower, a longer detour is promoted automatically
  (the UI counts these as "Re-routed by AI").
- **Congestion model** produces the 6-step traffic forecast strip.
