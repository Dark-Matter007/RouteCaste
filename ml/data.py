# ---------------------------------------------------------------------------
# Synthetic training data generator.
#
# The ground-truth generators below encode physically-plausible traffic
# behaviour so a model trained on them learns sensible relationships even
# before you plug in real data. Replace `load_real_dataset()` with your own
# CSV/Parquet loader when you have real traffic data -- just keep the returned
# column order identical to schema.py.
# ---------------------------------------------------------------------------

import numpy as np
from schema import hour_cyclical


def _rush(hour):
    """Rush-hour bump peaking ~08:00 and ~18:00 (0..~0.8)."""
    return np.exp(-((hour - 8) ** 2) / 6) + np.exp(-((hour - 18) ** 2) / 6)


def make_eta_dataset(n=40000, seed=42):
    """
    Build (X, y) for the ETA model.

    Travel time grows with distance, congestion, rush hour, urban density,
    scenario severity (accident/closure), and rain. Weekends soften rush hour.
    """
    rng = np.random.default_rng(seed)
    dim = 9
    X = np.zeros((n, dim), dtype=np.float32)
    y = np.zeros((n, 1), dtype=np.float32)

    for i in range(n):
        distance_km = rng.uniform(0.3, 14.0)
        congestion = rng.uniform(0.0, 0.95)
        segments = rng.integers(1, 22)
        hour = rng.uniform(0, 24)
        is_weekend = float(rng.random() < 0.28)
        area_density = rng.uniform(0.2, 1.0)     # rural .. dense downtown
        severity = rng.uniform(0.0, 1.0) if rng.random() < 0.4 else 0.0
        rain = rng.uniform(0.0, 1.0) if rng.random() < 0.5 else 0.0
        hs, hc = hour_cyclical(hour)

        # rush effect is dampened on weekends and amplified in dense areas
        rush = 1.0 + 0.45 * _rush(hour) * (0.4 if is_weekend else 1.0) * (0.6 + 0.6 * area_density)

        # free-flow speed drops with congestion, density, severity and rain
        base_speed = 48.0 * (1 - 0.75 * congestion)
        base_speed *= (1 - 0.30 * area_density)
        base_speed *= (1 - 0.45 * severity)
        base_speed *= (1 - 0.20 * rain)
        base_speed = max(4.0, base_speed)

        eta = (distance_km / base_speed) * 60.0 * rush          # minutes
        eta += segments * (0.15 + 0.25 * area_density)          # intersection delay
        eta += severity * rng.uniform(2.0, 6.0)                 # incident queue
        eta += rng.normal(0, 0.5)                               # noise

        X[i] = [
            distance_km / 10.0, congestion, segments / 20.0, hs, hc,
            is_weekend, area_density, severity, rain,
        ]
        y[i] = max(0.2, eta)

    return X, y


def make_congestion_dataset(n=40000, seed=7):
    """Build (X, y) for the next-interval congestion model."""
    rng = np.random.default_rng(seed)
    dim = 9
    X = np.zeros((n, dim), dtype=np.float32)
    y = np.zeros((n, 1), dtype=np.float32)

    for i in range(n):
        current = rng.uniform(0.0, 0.95)
        step = rng.integers(1, 7)
        hour = rng.uniform(0, 24)
        incident_load = rng.uniform(0.0, 1.0)
        is_weekend = float(rng.random() < 0.28)
        area_density = rng.uniform(0.2, 1.0)
        severity = rng.uniform(0.0, 1.0) if rng.random() < 0.4 else 0.0
        rain = rng.uniform(0.0, 1.0) if rng.random() < 0.5 else 0.0
        hs, hc = hour_cyclical(hour)

        # congestion drifts toward a rush-hour baseline scaled by density,
        # then pushed up by incidents, severity and rain.
        rush_base = 0.30 + 0.45 * _rush(hour) * (0.4 if is_weekend else 1.0)
        rush_base *= (0.6 + 0.6 * area_density)
        target = 0.55 * current + 0.45 * rush_base
        target += (step / 6.0) * (rush_base - current) * 0.3     # regress over horizon
        target += 0.15 * incident_load + 0.20 * severity + 0.10 * rain
        target += rng.normal(0, 0.03)
        target = float(np.clip(target, 0.0, 1.0))

        X[i] = [
            current, step / 6.0, hs, hc, incident_load,
            is_weekend, area_density, severity, rain,
        ]
        y[i] = target

    return X, y
