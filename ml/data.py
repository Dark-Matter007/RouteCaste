<<<<<<< HEAD
"""
RouteCast ML Dataset Preparation

Models:
    1. ETA regression
    2. Congestion classification

ETA target:
    log(future_travel_time / current_travel_time)

Congestion target:
    0 = free
    1 = light
    2 = moderate
    3 = heavy
    4 = severe

Important:
    Future traffic fields are NEVER used as model inputs.
"""

from __future__ import annotations

import math
import random
from pathlib import Path
from typing import Dict, Tuple

import numpy as np
import pandas as pd

from schema import (
    ETA_FEATURES,
    CONGESTION_FEATURES,
    hour_cyclical,
)


# ============================================================
# PATHS
# ============================================================

BASE_DIR = (
    Path(__file__).resolve().parent.parent
)

DATA_PATH = (
    BASE_DIR
    / "data"
    / "processed"
    / "routecast_ml_dataset.csv.gz"
)


# ============================================================
# CONFIGURATION
# ============================================================

RANDOM_SEED = 42

CHUNK_SIZE = 50_000

ETA_SAMPLE_SIZE = 200_000

CONGESTION_SAMPLE_SIZE = 200_000


# ============================================================
# RANDOM SEED
# ============================================================

random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)


# ============================================================
# UTILITIES
# ============================================================

def clamp(
    value: float,
    low: float,
    high: float,
) -> float:

    return max(
        low,
        min(high, value),
    )


def safe_float(
    value,
    default: float = 0.0,
) -> float:

    try:

        if pd.isna(value):
            return default

        value = float(value)

        if not math.isfinite(value):
            return default

        return value

    except (
        TypeError,
        ValueError,
    ):

        return default


# ============================================================
# TIME
# ============================================================

def extract_hour(value) -> float:
    """
    Extract decimal hour from timestamp.

    Example:

        18:30 -> 18.5
    """

    try:

        timestamp = pd.to_datetime(
            value
        )

        return (
            float(timestamp.hour)
            + float(timestamp.minute) / 60.0
        )

    except Exception:

        return 12.0


# ============================================================
# EVENT PROXIMITY
# ============================================================

def calculate_event_proximity(
    row,
) -> float:
    """
    Convert event distance into a normalized
    proximity score.

    0-250m       -> 1.00
    250-500m     -> 0.75
    500-1000m    -> 0.50
    >1000m       -> 0.00

    If distance_weight exists, the continuous
    value is also considered.
    """

    scenario_type = str(
        row.get(
            "scenario_type",
            "",
        )
    ).strip().lower()

    if scenario_type != "event":
        return 0.0

    distance = safe_float(
        row.get(
            "distance_to_event_m",
            999999.0,
        ),
        999999.0,
    )

    distance_weight = safe_float(
        row.get(
            "distance_weight",
            0.0,
        )
    )

    if distance <= 250.0:

        proximity = 1.0

    elif distance <= 500.0:

        proximity = 0.75

    elif distance <= 1000.0:

        proximity = 0.50

    else:

        proximity = 0.0

    # Use continuous distance weight when available.
    proximity = max(
        proximity,
        distance_weight,
    )

    return clamp(
        proximity,
        0.0,
        1.0,
    )


# ============================================================
# EVENT SEVERITY
# ============================================================

def calculate_scenario_severity(
    row,
) -> float:
    """
    Event severity based on distance_weight.

    Baseline = 0.
    """

    scenario_type = str(
        row.get(
            "scenario_type",
            "",
        )
    ).strip().lower()

    if scenario_type != "event":
        return 0.0

    distance_weight = safe_float(
        row.get(
            "distance_weight",
            0.0,
        )
    )

    return clamp(
        distance_weight,
        0.0,
        1.0,
    )


# ============================================================
# EVENT LOAD
# ============================================================

def calculate_event_load(
    row,
) -> float:
    """
    Calculate normalized event intensity.

    Uses:
        attendance
        event size
        duration
        arrival rate
        departure rate
    """

    scenario_type = str(
        row.get(
            "scenario_type",
            "",
        )
    ).strip().lower()

    if scenario_type != "event":
        return 0.0

    attendance = safe_float(
        row.get(
            "attendance",
            0.0,
        )
    )

    event_size = safe_float(
        row.get(
            "event_size",
            0.0,
        )
    )

    duration = safe_float(
        row.get(
            "event_duration_min",
            0.0,
        )
    )

    arrival = safe_float(
        row.get(
            "event_arrival_rate",
            0.0,
        )
    )

    departure = safe_float(
        row.get(
            "event_departure_rate",
            0.0,
        )
    )

    # --------------------------------------------------------
    # Normalize each component
    # --------------------------------------------------------

    attendance_score = clamp(
        attendance / 5000.0,
        0.0,
        1.0,
    )

    size_score = clamp(
        event_size / 5.0,
        0.0,
        1.0,
    )

    duration_score = clamp(
        duration / 180.0,
        0.0,
        1.0,
    )

    arrival_score = clamp(
        arrival / 1000.0,
        0.0,
        1.0,
    )

    departure_score = clamp(
        departure / 1000.0,
        0.0,
        1.0,
    )

    # --------------------------------------------------------
    # Weighted event intensity
    # --------------------------------------------------------

    load = (
        0.35 * attendance_score
        + 0.20 * size_score
        + 0.15 * duration_score
        + 0.15 * arrival_score
        + 0.15 * departure_score
    )

    return clamp(
        load,
        0.0,
        1.0,
    )


def calculate_incident_load(
    row,
) -> float:

    return calculate_event_load(row)


# ============================================================
# ETA FEATURES
# ============================================================

def build_eta_features(
    row,
) -> np.ndarray | None:
    """
    Build the ETA feature vector.

    Feature order MUST match schema.py:

        1. distance_km_over_10
        2. current_travel_time_log
        3. current_congestion
        4. current_speed_normalized
        5. hour_sin
        6. hour_cos
        7. event_proximity
        8. scenario_severity
        9. event_load
    """

    current_speed = safe_float(
        row.get(
            "current_speed",
            0.0,
        )
    )

    current_travel_time = safe_float(
        row.get(
            "current_travel_time",
            0.0,
        )
    )

    speed_limit = safe_float(
        row.get(
            "speed_limit",
            0.0,
        )
    )

    length = safe_float(
        row.get(
            "length",
            0.0,
        )
    )

    # Ratio target requires positive current ETA.
    if current_travel_time <= 0:
        return None

    if speed_limit <= 0:
        return None

    # --------------------------------------------------------
    # Distance
    # --------------------------------------------------------

    distance_km = (
        max(length, 0.0)
        / 1000.0
    )

    distance_km_over_10 = clamp(
        distance_km / 10.0,
        0.0,
        1.0,
    )

    # --------------------------------------------------------
    # Current travel time
    # --------------------------------------------------------

    current_travel_time_log = clamp(
        math.log1p(
            current_travel_time
        )
        / math.log1p(3600.0),
        0.0,
        1.0,
    )

    # --------------------------------------------------------
    # Current speed
    # --------------------------------------------------------

    current_speed_normalized = clamp(
        current_speed / speed_limit,
        0.0,
        1.0,
    )

    # --------------------------------------------------------
    # Current congestion
    # --------------------------------------------------------

    current_congestion = clamp(
        1.0
        - current_speed_normalized,
        0.0,
        1.0,
    )

    # --------------------------------------------------------
    # Time
    # --------------------------------------------------------

    hour = extract_hour(
        row.get(
            "current_time"
        )
    )

    hour_sin, hour_cos = (
        hour_cyclical(hour)
    )

    # --------------------------------------------------------
    # Event
    # --------------------------------------------------------

    event_proximity = (
        calculate_event_proximity(
            row
        )
    )

    scenario_severity = (
        calculate_scenario_severity(
            row
        )
    )

    event_load = (
        calculate_event_load(
            row
        )
    )

    # --------------------------------------------------------
    # FINAL VECTOR
    # --------------------------------------------------------

    features = np.array(
        [
            distance_km_over_10,
            current_travel_time_log,
            current_congestion,
            current_speed_normalized,
            hour_sin,
            hour_cos,
            event_proximity,
            scenario_severity,
            event_load,
        ],
        dtype=np.float32,
    )

    if not np.all(
        np.isfinite(features)
    ):
        return None

    return features


# ============================================================
# CONGESTION FEATURES
# ============================================================

def build_congestion_features(
    row,
) -> np.ndarray | None:
    """
    Build the congestion feature vector.

    Feature order MUST match schema.py:

        1. current_congestion
        2. step_over_6
        3. current_speed_normalized
        4. road_capacity_normalized
        5. hour_sin
        6. hour_cos
        7. incident_load
        8. scenario_severity
        9. event_proximity
    """

    current_speed = safe_float(
        row.get(
            "current_speed",
            0.0,
        )
    )

    speed_limit = safe_float(
        row.get(
            "speed_limit",
            0.0,
        )
    )

    capacity = safe_float(
        row.get(
            "capacity",
            0.0,
        )
    )

    lanes = safe_float(
        row.get(
            "lanes",
            1.0,
        ),
        1.0,
    )

    horizon_minutes = safe_float(
        row.get(
            "horizon_minutes",
            5.0,
        ),
        5.0,
    )

    if speed_limit <= 0:
        return None

    # --------------------------------------------------------
    # Speed
    # --------------------------------------------------------

    current_speed_normalized = clamp(
        current_speed / speed_limit,
        0.0,
        1.0,
    )

    # --------------------------------------------------------
    # Congestion
    # --------------------------------------------------------

    current_congestion = clamp(
        1.0
        - current_speed_normalized,
        0.0,
        1.0,
    )

    # --------------------------------------------------------
    # Forecast horizon
    # --------------------------------------------------------

    step_over_6 = clamp(
        horizon_minutes / 60.0,
        0.0,
        1.0,
    )

    # --------------------------------------------------------
    # Road capacity
    # --------------------------------------------------------

    lane_factor = max(
        lanes,
        1.0,
    )

    road_capacity_normalized = clamp(
        capacity
        / (
            7200.0
            * lane_factor
        ),
        0.0,
        1.0,
    )

    # --------------------------------------------------------
    # Time
    # --------------------------------------------------------

    hour = extract_hour(
        row.get(
            "current_time"
        )
    )

    hour_sin, hour_cos = (
        hour_cyclical(hour)
    )

    # --------------------------------------------------------
    # Event
    # --------------------------------------------------------

    incident_load = (
        calculate_incident_load(
            row
        )
    )

    scenario_severity = (
        calculate_scenario_severity(
            row
        )
    )

    event_proximity = (
        calculate_event_proximity(
            row
        )
    )

    # --------------------------------------------------------
    # FINAL VECTOR
    # --------------------------------------------------------

    features = np.array(
        [
            current_congestion,
            step_over_6,
            current_speed_normalized,
            road_capacity_normalized,
            hour_sin,
            hour_cos,
            incident_load,
            scenario_severity,
            event_proximity,
        ],
        dtype=np.float32,
    )

    if not np.all(
        np.isfinite(features)
    ):
        return None

    return features


# ============================================================
# ETA TARGET
# ============================================================

def build_eta_target(
    row,
) -> float | None:
    """
    ETA target:

        log(
            future_travel_time
            /
            current_travel_time
        )

    Production reconstruction:

        factor = exp(prediction)

        future_eta =
            current_eta * factor
    """

    current_tt = safe_float(
        row.get(
            "current_travel_time",
            0.0,
        )
    )

    future_tt = safe_float(
        row.get(
            "future_travel_time",
            0.0,
        )
    )

    if current_tt <= 0:
        return None

    if future_tt <= 0:
        return None

    # Ignore extreme values outside expected
    # production ETA range.
    if current_tt > 3600:
        return None

    if future_tt > 3600:
        return None

    ratio = (
        future_tt
        / current_tt
    )

    if ratio <= 0:
        return None

    target = math.log(
        ratio
    )

    if not math.isfinite(
        target
    ):
        return None

    # Protect against extreme pathological ratios.
    target = clamp(
        target,
        -5.0,
        5.0,
    )

    return target


# ============================================================
# CONGESTION TARGET
# ============================================================

CONGESTION_CLASS_MAP = {
    "free": 0,
    "light": 1,
    "moderate": 2,
    "heavy": 3,
    "severe": 4,
}


def build_congestion_target(
    row,
) -> int | None:
    """
    Convert categorical congestion label
    into class index.

        free      -> 0
        light     -> 1
        moderate  -> 2
        heavy     -> 3
        severe    -> 4
    """

    label = str(
        row.get(
            "future_congestion",
            "",
        )
    ).strip().lower()

    return CONGESTION_CLASS_MAP.get(
        label
    )


# ============================================================
# SCENARIO SPLIT
# ============================================================

def create_scenario_split(
    scenario_ids,
) -> Tuple[set, set, set]:
    """
    Split by scenario_id.

    This is important because rows from the same scenario
    must never appear in both train and test.
    """

    unique_ids = sorted(
        {
            str(x)
            for x in scenario_ids
        }
    )

    rng = random.Random(
        RANDOM_SEED
    )

    rng.shuffle(
        unique_ids
    )

    n = len(
        unique_ids
    )

    train_end = int(
        n * 0.70
    )

    val_end = int(
        n * 0.85
    )

    train_ids = set(
        unique_ids[:train_end]
    )

    val_ids = set(
        unique_ids[
            train_end:val_end
        ]
    )

    test_ids = set(
        unique_ids[
            val_end:
        ]
    )

    return (
        train_ids,
        val_ids,
        test_ids,
    )


# ============================================================
# SCENARIO DISCOVERY
# ============================================================

def discover_scenarios():

    print(
        "\nDiscovering scenarios..."
    )

    scenario_ids = set()

    for chunk in pd.read_csv(
        DATA_PATH,
        compression="gzip",
        usecols=[
            "scenario_id"
        ],
        chunksize=CHUNK_SIZE,
        low_memory=False,
    ):

        values = (
            chunk[
                "scenario_id"
            ]
            .dropna()
            .astype(str)
        )

        scenario_ids.update(
            values.tolist()
        )

    scenario_ids = sorted(
        scenario_ids
    )

    print(
        f"Found {len(scenario_ids)} "
        f"unique scenarios."
    )

    return scenario_ids


# ============================================================
# SAMPLE STORAGE
# ============================================================

def reservoir_add(
    reservoir,
    item,
    capacity,
    rng,
):
    """
    Proper reservoir sampling.

    Unlike simply taking the first N rows, this gives
    every valid row approximately equal probability
    of being selected.
    """

    if len(reservoir) < capacity:

        reservoir.append(
            item
        )

        return

    # Random replacement.
    index = rng.randint(
        0,
        len(reservoir),
    )

    # The caller controls the global count separately.
    return index


# ============================================================
# LOAD DATA
# ============================================================

def load_sample(
    model: str,
    sample_size: int,
    train_ids: set,
    val_ids: set,
    test_ids: set,
):
    """
    Load a balanced baseline/event sample.

    For both models we target approximately:

        50% baseline
        50% event

    within each split.

    This is especially useful for the event-aware
    RouteCast use case.
    """

    if model == "eta":

        feature_builder = (
            build_eta_features
        )

        target_builder = (
            build_eta_target
        )

    elif model == "congestion":

        feature_builder = (
            build_congestion_features
        )

        target_builder = (
            build_congestion_target
        )

    else:

        raise ValueError(
            f"Unknown model: {model}"
        )

    # --------------------------------------------------------
    # Split sizes
    # --------------------------------------------------------

    split_total = {
        "train": int(
            sample_size * 0.70
        ),
        "val": int(
            sample_size * 0.15
        ),
        "test": int(
            sample_size * 0.15
        ),
    }

    # 50/50 baseline-event target.
    quotas = {}

    for split, total in (
        split_total.items()
    ):

        baseline_quota = (
            total // 2
        )

        event_quota = (
            total
            - baseline_quota
        )

        quotas[split] = {
            "baseline": baseline_quota,
            "event": event_quota,
        }

    # --------------------------------------------------------
    # Reservoirs
    # --------------------------------------------------------

    buffers: Dict[
        str,
        Dict[str, list],
    ] = {}

    counts: Dict[
        str,
        Dict[str, int],
    ] = {}

    for split in [
        "train",
        "val",
        "test",
    ]:

        buffers[split] = {
            "baseline": [],
            "event": [],
        }

        counts[split] = {
            "baseline": 0,
            "event": 0,
        }

    rng = random.Random(
        RANDOM_SEED
    )

    scanned = 0

    valid = 0

    skipped = 0

    print(
        f"\nLoading {model.upper()} dataset..."
    )

    print(
        f"Target sample size: "
        f"{sample_size:,}"
    )

    # ========================================================
    # READ CSV
    # ========================================================

    for chunk in pd.read_csv(
        DATA_PATH,
        compression="gzip",
        chunksize=CHUNK_SIZE,
        low_memory=False,
    ):

        scanned += len(
            chunk
        )

        for _, row in chunk.iterrows():

            scenario_id = str(
                row.get(
                    "scenario_id"
                )
            )

            # ------------------------------------------------
            # Determine split
            # ------------------------------------------------

            if scenario_id in train_ids:

                split = "train"

            elif scenario_id in val_ids:

                split = "val"

            elif scenario_id in test_ids:

                split = "test"

            else:

                continue

            # ------------------------------------------------
            # Determine scenario category
            # ------------------------------------------------

            scenario_type = str(
                row.get(
                    "scenario_type",
                    "",
                )
            ).strip().lower()

            if scenario_type == "event":

                category = "event"

            else:

                category = "baseline"

            # ------------------------------------------------
            # Build feature vector
            # ------------------------------------------------

            features = feature_builder(
                row
            )

            if features is None:

                skipped += 1

                continue

            # ------------------------------------------------
            # Build target
            # ------------------------------------------------

            target = target_builder(
                row
            )

            if target is None:

                skipped += 1

                continue

            valid += 1

            # ------------------------------------------------
            # Reservoir sampling
            # ------------------------------------------------

            counts[split][category] += 1

            count = counts[
                split
            ][category]

            quota = quotas[
                split
            ][category]

            item = (
                features,
                target,
            )

            reservoir = buffers[
                split
            ][category]

            if len(reservoir) < quota:

                reservoir.append(
                    item
                )

            else:

                replacement_index = (
                    rng.randint(
                        1,
                        count,
                    )
                )

                if (
                    replacement_index
                    <= quota
                ):

                    reservoir[
                        replacement_index
                        - 1
                    ] = item

        # ----------------------------------------------------
        # Progress
        # ----------------------------------------------------

        if (
            scanned % 250_000
            < CHUNK_SIZE
        ):

            print(
                f"  scanned="
                f"{scanned:,} "
                f"valid="
                f"{valid:,}"
            )

    # ========================================================
    # CONVERT TO NUMPY
    # ========================================================

    result = {}

    for split in [
        "train",
        "val",
        "test",
    ]:

        rows = (
            buffers[
                split
            ]["baseline"]
            +
            buffers[
                split
            ]["event"]
        )

        rng.shuffle(
            rows
        )

        if not rows:

            raise RuntimeError(
                f"No valid samples "
                f"for {split}"
            )

        X = np.stack(
            [
                item[0]
                for item in rows
            ]
        ).astype(
            np.float32
        )

        # ----------------------------------------------------
        # ETA = float regression
        # Congestion = integer classification
        # ----------------------------------------------------

        if model == "congestion":

            y = np.array(
                [
                    item[1]
                    for item in rows
                ],
                dtype=np.int64,
            )

        else:

            y = np.array(
                [
                    item[1]
                    for item in rows
                ],
                dtype=np.float32,
            ).reshape(
                -1,
                1,
            )

        result[split] = (
            X,
            y,
        )

        print(
            f"  {split.upper():5s}: "
            f"{len(rows):,} samples "
            f"(baseline="
            f"{len(buffers[split]['baseline']):,}, "
            f"event="
            f"{len(buffers[split]['event']):,})"
        )

    print(
        f"\nFinished {model.upper()} loading."
    )

    print(
        f"Scanned: {scanned:,}"
    )

    print(
        f"Valid:   {valid:,}"
    )

    print(
        f"Skipped: {skipped:,}"
    )

    return result


# ============================================================
# PUBLIC FUNCTIONS
# ============================================================

def load_eta_data():

    scenario_ids = (
        discover_scenarios()
    )

    (
        train_ids,
        val_ids,
        test_ids,
    ) = create_scenario_split(
        scenario_ids
    )

    print(
        "\nScenario split:"
    )

    print(
        f"  Train scenarios: "
        f"{len(train_ids)}"
    )

    print(
        f"  Validation scenarios: "
        f"{len(val_ids)}"
    )

    print(
        f"  Test scenarios: "
        f"{len(test_ids)}"
    )

    return load_sample(
        model="eta",
        sample_size=ETA_SAMPLE_SIZE,
        train_ids=train_ids,
        val_ids=val_ids,
        test_ids=test_ids,
    )


def load_congestion_data():

    scenario_ids = (
        discover_scenarios()
    )

    (
        train_ids,
        val_ids,
        test_ids,
    ) = create_scenario_split(
        scenario_ids
    )

    print(
        "\nScenario split:"
    )

    print(
        f"  Train scenarios: "
        f"{len(train_ids)}"
    )

    print(
        f"  Validation scenarios: "
        f"{len(val_ids)}"
    )

    print(
        f"  Test scenarios: "
        f"{len(test_ids)}"
    )

    return load_sample(
        model="congestion",
        sample_size=CONGESTION_SAMPLE_SIZE,
        train_ids=train_ids,
        val_ids=val_ids,
        test_ids=test_ids,
    )
=======
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
>>>>>>> 3e0d87cf2d454d04991b28c4d01c5022b1cbc975
