"""
RouteCast — Synthetic Training Data Generator
==============================================
Generates a realistic 300,000-row CSV for Guntur City traffic.

No SUMO or external simulator required.

Outputs:
    data/processed/routecast_ml_dataset.csv.gz

Run from the project root:
    python scripts/generate_synthetic_dataset.py

Design principles:
    - Guntur-specific rush hour patterns (8-10am, 5-7pm, Friday peak)
    - 8 event types with realistic attendance + impact curves
    - Strong feature→target correlation so models have something real to learn
    - Balanced baseline (60%) / event (40%) split
    - ETA target: log(future_tt / current_tt) matching train.py expectation
    - Congestion target: free/light/moderate/heavy/severe matching schema.py
"""

from __future__ import annotations

import gzip
import math
import random
from pathlib import Path

import numpy as np
import pandas as pd

# ============================================================
# PATHS
# ============================================================

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "data" / "processed" / "routecast_ml_dataset.csv.gz"
OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

# ============================================================
# CONFIGURATION
# ============================================================

SEED = 42
TOTAL_ROWS = 300_000
BASELINE_FRACTION = 0.60   # 60% normal traffic, 40% event scenarios
CHUNK_WRITE = 50_000

random.seed(SEED)
np.random.seed(SEED)

# ============================================================
# GUNTUR TRAFFIC PATTERNS
# ============================================================

# Base congestion by hour (0-23).
# Guntur-specific: heavy morning rush 8-10am, evening rush 5-7pm,
# Friday evening spike, late night very light.
HOURLY_BASE_CONGESTION = np.array([
    0.08,  # 00:00
    0.06,  # 01:00
    0.05,  # 02:00
    0.05,  # 03:00
    0.07,  # 04:00
    0.14,  # 05:00  — early morning market traffic
    0.28,  # 06:00  — schools open
    0.52,  # 07:00  — rush building
    0.78,  # 08:00  — PEAK morning
    0.82,  # 09:00  — PEAK morning
    0.65,  # 10:00  — tapering
    0.48,  # 11:00
    0.44,  # 12:00  — lunch
    0.50,  # 13:00  — post-lunch
    0.42,  # 14:00
    0.46,  # 15:00  — schools out
    0.60,  # 16:00  — evening building
    0.80,  # 17:00  — PEAK evening
    0.85,  # 18:00  — PEAK evening
    0.72,  # 19:00  — tapering
    0.52,  # 20:00
    0.36,  # 21:00
    0.22,  # 22:00
    0.12,  # 23:00
], dtype=np.float64)

# Day-of-week multiplier (0=Mon ... 6=Sun)
DOW_MULTIPLIER = np.array([
    1.00,  # Monday
    1.00,  # Tuesday
    1.00,  # Wednesday
    1.05,  # Thursday
    1.18,  # Friday — Guntur weekly market + mosque traffic
    0.85,  # Saturday
    0.72,  # Sunday
], dtype=np.float64)

# Road type configs: (speed_limit_kmh, capacity_veh_per_h, lanes)
ROAD_TYPES = {
    "arterial":    (60, 3600, 2),
    "collector":   (40, 2400, 2),
    "local":       (30, 1200, 1),
    "highway":     (80, 7200, 3),
    "residential": (20,  600, 1),
}
ROAD_TYPE_WEIGHTS = [0.30, 0.30, 0.20, 0.10, 0.10]
ROAD_TYPE_KEYS = list(ROAD_TYPES.keys())

# ============================================================
# EVENT CONFIGS
# ============================================================

EVENT_TYPES = {
    "festival": {
        "attendance_range": (5000, 80000),
        "duration_h": (3, 8),
        "peak_offset_h": 0.5,     # peak congestion shortly after start
        "radius_m": (600, 1500),
        "congestion_boost": 0.45,
    },
    "sports": {
        "attendance_range": (2000, 30000),
        "duration_h": (2, 4),
        "peak_offset_h": 0.3,
        "radius_m": (400, 1000),
        "congestion_boost": 0.35,
    },
    "concert": {
        "attendance_range": (1000, 20000),
        "duration_h": (2, 5),
        "peak_offset_h": 0.4,
        "radius_m": (300, 800),
        "congestion_boost": 0.30,
    },
    "protest": {
        "attendance_range": (200, 5000),
        "duration_h": (1, 4),
        "peak_offset_h": 0.2,
        "radius_m": (200, 600),
        "congestion_boost": 0.50,   # road blockage effect
    },
    "construction": {
        "attendance_range": (0, 100),
        "duration_h": (4, 10),
        "peak_offset_h": 0.0,
        "radius_m": (100, 400),
        "congestion_boost": 0.40,
    },
    "vip_visit": {
        "attendance_range": (0, 500),
        "duration_h": (1, 3),
        "peak_offset_h": 0.1,
        "radius_m": (500, 1200),
        "congestion_boost": 0.60,   # road closures
    },
    "public_gathering": {
        "attendance_range": (500, 10000),
        "duration_h": (2, 6),
        "peak_offset_h": 0.3,
        "radius_m": (300, 900),
        "congestion_boost": 0.28,
    },
    "other": {
        "attendance_range": (100, 5000),
        "duration_h": (1, 5),
        "peak_offset_h": 0.3,
        "radius_m": (200, 600),
        "congestion_boost": 0.20,
    },
}

# ============================================================
# HELPERS
# ============================================================

def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def hour_congestion_base(hour: float, dow: int) -> float:
    """Interpolate hourly base congestion for fractional hours."""
    h0 = int(hour) % 24
    h1 = (h0 + 1) % 24
    frac = hour - int(hour)
    base = HOURLY_BASE_CONGESTION[h0] * (1 - frac) + HOURLY_BASE_CONGESTION[h1] * frac
    return clamp(base * DOW_MULTIPLIER[dow], 0.0, 1.0)


def congestion_to_class(c: float) -> str:
    if c < 0.20:
        return "free"
    elif c < 0.40:
        return "light"
    elif c < 0.60:
        return "moderate"
    elif c < 0.80:
        return "heavy"
    else:
        return "severe"


def bell_curve(t: float, peak: float, width: float) -> float:
    """Gaussian bell curve centred at peak, spread = width."""
    return math.exp(-0.5 * ((t - peak) / max(width, 0.001)) ** 2)


# ============================================================
# BASELINE ROW GENERATOR
# ============================================================

def generate_baseline_row(rng: np.random.Generator) -> dict:
    """Generate one normal-traffic row (no event)."""

    # Time
    hour = float(rng.uniform(0, 24))
    dow = int(rng.integers(0, 7))

    # Road
    road_type = rng.choice(ROAD_TYPE_KEYS, p=ROAD_TYPE_WEIGHTS)
    speed_limit_kmh, capacity, lanes = ROAD_TYPES[road_type]

    # Road length: 50m–5km
    length_m = float(rng.uniform(50, 5000))
    length_km = length_m / 1000.0

    # Base congestion from time-of-day pattern + small noise
    base_cong = hour_congestion_base(hour, dow)
    noise = float(rng.normal(0, 0.05))
    current_cong = clamp(base_cong + noise, 0.02, 0.98)

    # Speed derived from congestion (BPR-inspired)
    # speed = speed_limit * (1 - 0.85 * congestion^2)
    speed_ratio = clamp(1.0 - 0.85 * current_cong ** 2, 0.05, 1.0)
    current_speed_kmh = speed_limit_kmh * speed_ratio
    current_speed_ms = current_speed_kmh / 3.6

    # Current travel time
    if current_speed_ms < 0.5:
        current_speed_ms = 0.5
    current_tt = length_m / current_speed_ms   # seconds

    if current_tt <= 0 or current_tt > 3600:
        current_tt = clamp(current_tt, 10, 3600)

    # Future congestion: near-term (5–30 min ahead) slight change
    horizon_min = float(rng.choice([5, 10, 15, 20, 30]))

    # Future congestion: auto-correlation + drift toward daily mean
    daily_mean = float(np.mean(HOURLY_BASE_CONGESTION)) * DOW_MULTIPLIER[dow]
    future_cong = clamp(
        current_cong * 0.85
        + daily_mean * 0.10
        + float(rng.normal(0, 0.06)),
        0.02, 0.98
    )

    future_speed_ratio = clamp(1.0 - 0.85 * future_cong ** 2, 0.05, 1.0)
    future_speed_ms = (speed_limit_kmh * future_speed_ratio) / 3.6
    future_tt = clamp(length_m / max(future_speed_ms, 0.5), 10, 3600)

    # Scenario ID
    scenario_id = f"baseline_{rng.integers(0, 999999):06d}"

    return {
        "scenario_id":          scenario_id,
        "scenario_type":        "baseline",
        "current_time":         f"2024-01-{(dow+1):02d}T{int(hour):02d}:{int((hour%1)*60):02d}:00",
        "length":               length_m,
        "speed_limit":          float(speed_limit_kmh / 3.6),   # m/s
        "capacity":             float(capacity),
        "lanes":                float(lanes),
        "current_speed":        current_speed_ms,
        "current_travel_time":  current_tt,
        "future_travel_time":   future_tt,
        "future_congestion":    congestion_to_class(future_cong),
        "horizon_minutes":      horizon_min,
        # Event fields: zero for baseline
        "distance_to_event_m":  999999.0,
        "distance_weight":      0.0,
        "attendance":           0.0,
        "event_size":           0.0,
        "event_duration_min":   0.0,
        "event_arrival_rate":   0.0,
        "event_departure_rate": 0.0,
    }


# ============================================================
# EVENT ROW GENERATOR
# ============================================================

def generate_event_row(rng: np.random.Generator) -> dict:
    """Generate one event-scenario row."""

    # Pick event type
    etype = rng.choice(list(EVENT_TYPES.keys()))
    cfg = EVENT_TYPES[etype]

    # Time — events tend to cluster in evening (festivals, sports)
    # but construction is daytime
    if etype == "construction":
        hour = float(rng.uniform(7, 18))
    elif etype in ("festival", "concert", "sports"):
        hour = float(rng.triangular(14, 19, 23))
    else:
        hour = float(rng.uniform(8, 22))

    dow = int(rng.integers(0, 7))

    # Event parameters
    att_lo, att_hi = cfg["attendance_range"]
    attendance = float(rng.integers(att_lo, att_hi + 1)) if att_hi > 0 else 0.0
    duration_h = float(rng.uniform(*cfg["duration_h"]))
    duration_min = duration_h * 60.0
    radius_lo, radius_hi = cfg["radius_m"]
    impact_radius = float(rng.uniform(radius_lo, radius_hi))

    # Event phase: where in the event lifecycle is this observation?
    event_start_h = hour - float(rng.uniform(0, duration_h))
    time_since_start_h = hour - event_start_h
    peak_h = event_start_h + cfg["peak_offset_h"] * duration_h
    # bell_curve intensity 0–1
    event_intensity = bell_curve(hour, peak_h, duration_h * 0.3)
    congestion_boost = cfg["congestion_boost"] * event_intensity

    # Road
    road_type = rng.choice(ROAD_TYPE_KEYS, p=ROAD_TYPE_WEIGHTS)
    speed_limit_kmh, capacity, lanes = ROAD_TYPES[road_type]
    length_m = float(rng.uniform(50, 3000))

    # Distance to event (closer = more impact)
    distance_to_event = float(rng.uniform(0, impact_radius * 1.5))
    if distance_to_event <= impact_radius:
        distance_weight = clamp(1.0 - distance_to_event / impact_radius, 0.0, 1.0)
    else:
        distance_weight = 0.0

    # Base congestion from time + event boost
    base_cong = hour_congestion_base(hour, dow)
    effective_boost = congestion_boost * distance_weight
    current_cong = clamp(base_cong + effective_boost + float(rng.normal(0, 0.04)), 0.02, 0.98)

    speed_ratio = clamp(1.0 - 0.85 * current_cong ** 2, 0.05, 1.0)
    current_speed_ms = max((speed_limit_kmh * speed_ratio) / 3.6, 0.5)
    current_tt = clamp(length_m / current_speed_ms, 10, 3600)

    # Future: congestion evolves based on event phase
    horizon_min = float(rng.choice([5, 10, 15, 20, 30]))
    future_hour = hour + horizon_min / 60.0
    future_intensity = bell_curve(future_hour, peak_h, duration_h * 0.3)
    future_boost = cfg["congestion_boost"] * future_intensity * distance_weight
    future_base = hour_congestion_base(future_hour % 24, dow)
    future_cong = clamp(future_base + future_boost + float(rng.normal(0, 0.04)), 0.02, 0.98)

    future_speed_ratio = clamp(1.0 - 0.85 * future_cong ** 2, 0.05, 1.0)
    future_speed_ms = max((speed_limit_kmh * future_speed_ratio) / 3.6, 0.5)
    future_tt = clamp(length_m / future_speed_ms, 10, 3600)

    # Event load components
    event_size = clamp(attendance / 10000.0, 0.0, 5.0)
    arrival_rate = attendance / max(duration_min * 0.3, 1.0)   # people/min in first 30%
    departure_rate = attendance / max(duration_min * 0.2, 1.0)  # faster exit

    scenario_id = f"event_{rng.integers(0, 999999):06d}"

    return {
        "scenario_id":          scenario_id,
        "scenario_type":        "event",
        "current_time":         f"2024-01-{(dow+1):02d}T{int(hour):02d}:{int((hour%1)*60):02d}:00",
        "length":               length_m,
        "speed_limit":          float(speed_limit_kmh / 3.6),
        "capacity":             float(capacity),
        "lanes":                float(lanes),
        "current_speed":        current_speed_ms,
        "current_travel_time":  current_tt,
        "future_travel_time":   future_tt,
        "future_congestion":    congestion_to_class(future_cong),
        "horizon_minutes":      horizon_min,
        "distance_to_event_m":  distance_to_event,
        "distance_weight":      distance_weight,
        "attendance":           attendance,
        "event_size":           event_size,
        "event_duration_min":   duration_min,
        "event_arrival_rate":   arrival_rate,
        "event_departure_rate": departure_rate,
    }


# ============================================================
# MAIN
# ============================================================

def main():

    rng = np.random.default_rng(SEED)

    n_baseline = int(TOTAL_ROWS * BASELINE_FRACTION)
    n_event = TOTAL_ROWS - n_baseline

    print("=" * 60)
    print(" RouteCast Synthetic Dataset Generator")
    print("=" * 60)
    print(f" Total rows    : {TOTAL_ROWS:,}")
    print(f" Baseline rows : {n_baseline:,}  ({BASELINE_FRACTION*100:.0f}%)")
    print(f" Event rows    : {n_event:,}  ({(1-BASELINE_FRACTION)*100:.0f}%)")
    print(f" Output        : {OUT_PATH}")
    print("=" * 60)

    rows = []
    generated = 0

    # --- Baseline ---
    print(f"\nGenerating {n_baseline:,} baseline rows...")
    for i in range(n_baseline):
        rows.append(generate_baseline_row(rng))
        generated += 1
        if generated % 50_000 == 0:
            print(f"  {generated:,} / {TOTAL_ROWS:,}")

    # --- Event ---
    print(f"\nGenerating {n_event:,} event rows...")
    for i in range(n_event):
        rows.append(generate_event_row(rng))
        generated += 1
        if generated % 50_000 == 0:
            print(f"  {generated:,} / {TOTAL_ROWS:,}")

    # Shuffle
    print("\nShuffling...")
    random.shuffle(rows)

    # Build DataFrame
    print("Building DataFrame...")
    df = pd.DataFrame(rows)

    # Quick sanity check
    print("\n--- Sanity check ---")
    print(f"Rows           : {len(df):,}")
    print(f"Columns        : {list(df.columns)}")
    print(f"\nCongestion dist (future):")
    print(df["future_congestion"].value_counts().to_string())
    print(f"\nScenario type dist:")
    print(df["scenario_type"].value_counts().to_string())

    # Compute ETA ratio for reference
    valid_mask = (df["current_travel_time"] > 0) & (df["future_travel_time"] > 0)
    ratio = df.loc[valid_mask, "future_travel_time"] / df.loc[valid_mask, "current_travel_time"]
    log_ratio = np.log(ratio)
    print(f"\nETA log-ratio stats:")
    print(f"  mean  : {log_ratio.mean():.4f}")
    print(f"  std   : {log_ratio.std():.4f}")
    print(f"  min   : {log_ratio.min():.4f}")
    print(f"  max   : {log_ratio.max():.4f}")

    # Write gzipped CSV
    print(f"\nWriting to {OUT_PATH} ...")
    df.to_csv(OUT_PATH, index=False, compression="gzip")

    size_mb = OUT_PATH.stat().st_size / (1024 * 1024)
    print(f"Done. File size: {size_mb:.2f} MB")
    print("\n✓ Now run:  python ml/train.py")
    print("=" * 60)


if __name__ == "__main__":
    main()
