l pc ile pah or file explorer
# ---------------------------------------------------------------------------
# SHARED FEATURE SCHEMA  (must match lib/ml.ts on the Node side exactly)
# ---------------------------------------------------------------------------
# Two models share this pipeline:
#
#   ETA model         -> predicts travel time (minutes) for a route
#   Congestion model  -> predicts next-interval congestion (0..1)
#
# Both models are LOCATION-AWARE (area_density) and SCENARIO-AWARE
# (scenario_severity + rain), so predictions adapt to the city/state selected
# and to disruptions like an accident, a road closure, or bad weather.
#
# Every ONNX model exported here uses:
#   input  tensor name: "input"   shape [batch, N]  dtype float32
#   output tensor name: "output"  shape [batch, 1]  dtype float32
# ---------------------------------------------------------------------------

import math

# ---- ETA model ------------------------------------------------------------
# Order matters. Node reads features in this EXACT order (see lib/ml.ts).
ETA_FEATURES = [
    "distance_km_over_10",   # distanceKm / 10
    "avg_congestion",        # 0..1 average congestion along the route
    "num_segments_over_20",  # segment (intersection) count / 20
    "hour_sin",              # sin(2*pi*hour/24)
    "hour_cos",              # cos(2*pi*hour/24)
    "is_weekend",            # 0 weekday, 1 weekend
    "area_density",          # 0..1 urban density of the selected region
    "scenario_severity",     # 0..1 disruption severity on/near the route
    "rain",                  # 0..1 precipitation intensity
]
ETA_INPUT_DIM = len(ETA_FEATURES)

# ---- Congestion model -----------------------------------------------------
CONGESTION_FEATURES = [
    "current_congestion",   # 0..1
    "step_over_6",          # forecast horizon step / 6
    "hour_sin",
    "hour_cos",
    "incident_load",        # 0..1  (active incidents / 5, capped)
    "is_weekend",           # 0 weekday, 1 weekend
    "area_density",         # 0..1 urban density of the selected region
    "scenario_severity",    # 0..1 disruption severity
    "rain",                 # 0..1 precipitation intensity
]
CONGESTION_INPUT_DIM = len(CONGESTION_FEATURES)


def hour_cyclical(hour: float):
    """Encode hour-of-day (0..24) as two cyclical features."""
    rad = 2 * math.pi * (hour / 24.0)
    return math.sin(rad), math.cos(rad)
