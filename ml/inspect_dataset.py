"""
RouteCast Dataset Audit
-----------------------
Audits the full routecast_ml_dataset.csv.gz before retraining.

Run from:
    C:\\Users\\Happy\\RouteCast-dataset-pipeline\\ml

Command:
    python inspect_dataset.py
"""

import os
import csv
import json
import math
import gzip
from collections import Counter, defaultdict


# ============================================================
# PATHS
# ============================================================

DATASET_PATH = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "data",
        "processed",
        "routecast_ml_dataset.csv.gz",
    )
)

OUTPUT_PATH = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "models",
        "dataset_audit.json",
    )
)


# ============================================================
# CONFIG
# ============================================================

TARGET_COLUMNS = [
    "future_travel_time",
    "current_travel_time",
    "current_speed",
    "future_speed",
    "speed_limit",
    "length",
    "horizon_minutes",
]

REQUIRED_COLUMNS = [
    "scenario_type",
    "scenario_id",
    "edge_id",
    "current_time",
    "future_time",
    "horizon_minutes",
    "current_speed",
    "current_travel_time",
    "future_speed",
    "future_travel_time",
    "length",
    "lanes",
    "speed_limit",
    "road_type",
    "future_congestion",
]


# ============================================================
# HELPERS
# ============================================================

def safe_float(value):
    """Convert value to float or return None."""
    if value is None:
        return None

    value = str(value).strip()

    if value == "":
        return None

    try:
        number = float(value)

        if not math.isfinite(number):
            return None

        return number

    except (ValueError, TypeError):
        return None


def percentile(sorted_values, p):
    """
    Calculate percentile using linear interpolation.
    p must be between 0 and 100.
    """
    if not sorted_values:
        return None

    if len(sorted_values) == 1:
        return sorted_values[0]

    position = (len(sorted_values) - 1) * (p / 100.0)

    lower = int(math.floor(position))
    upper = int(math.ceil(position))

    if lower == upper:
        return sorted_values[lower]

    weight = position - lower

    return (
        sorted_values[lower] * (1.0 - weight)
        + sorted_values[upper] * weight
    )


def summarize(values):
    """Return statistical summary."""
    if not values:
        return {
            "count": 0,
            "min": None,
            "max": None,
            "mean": None,
            "median": None,
            "p75": None,
            "p90": None,
            "p95": None,
            "p99": None,
        }

    values_sorted = sorted(values)

    count = len(values_sorted)

    return {
        "count": count,
        "min": values_sorted[0],
        "max": values_sorted[-1],
        "mean": sum(values_sorted) / count,
        "median": percentile(values_sorted, 50),
        "p75": percentile(values_sorted, 75),
        "p90": percentile(values_sorted, 90),
        "p95": percentile(values_sorted, 95),
        "p99": percentile(values_sorted, 99),
    }


def print_summary(name, stats):
    print(f"\n{name}")
    print("-" * 70)

    for key, value in stats.items():
        if isinstance(value, float):
            print(f"{key:12}: {value:.6f}")
        else:
            print(f"{key:12}: {value}")


# ============================================================
# MAIN AUDIT
# ============================================================

def main():

    print("=" * 70)
    print(" RouteCast Dataset Audit")
    print("=" * 70)

    print(f"\nDataset:")
    print(DATASET_PATH)

    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(
            f"\nDataset not found:\n{DATASET_PATH}"
        )

    print("\nStarting full dataset scan...")
    print("This may take a little while.\n")

    # --------------------------------------------------------
    # Storage
    # --------------------------------------------------------

    total_rows = 0

    missing_counts = Counter()
    invalid_counts = Counter()
    zero_counts = Counter()
    negative_counts = Counter()

    numeric_values = {
        column: []
        for column in TARGET_COLUMNS
    }

    scenario_type_counts = Counter()
    scenario_id_counts = Counter()
    horizon_counts = Counter()
    road_type_counts = Counter()
    congestion_counts = Counter()

    # ETA-specific target groups
    target_by_scenario = defaultdict(list)
    target_by_horizon = defaultdict(list)

    current_target_pairs = []

    # Physical plausibility checks
    ratio_values = []
    absolute_difference_values = []

    # Threshold counts for future travel time
    travel_time_thresholds = [
        0,
        1,
        5,
        10,
        30,
        60,
        120,
        300,
        600,
        1200,
        1800,
        3600,
    ]

    future_travel_time_threshold_counts = Counter()

    # --------------------------------------------------------
    # Open compressed CSV
    # --------------------------------------------------------

    with gzip.open(
        DATASET_PATH,
        mode="rt",
        encoding="utf-8",
        newline="",
    ) as file:

        reader = csv.DictReader(file)

        columns = reader.fieldnames

        if columns is None:
            raise RuntimeError("CSV has no header.")

        print(f"Columns found: {len(columns)}")

        # ----------------------------------------------------
        # Validate required columns
        # ----------------------------------------------------

        missing_required = [
            column
            for column in REQUIRED_COLUMNS
            if column not in columns
        ]

        if missing_required:
            raise RuntimeError(
                "\nMissing required columns:\n"
                + "\n".join(missing_required)
            )

        print("Required columns: OK")

        # ----------------------------------------------------
        # Scan rows
        # ----------------------------------------------------

        for row in reader:

            total_rows += 1

            # -----------------------------------------------
            # Categorical fields
            # -----------------------------------------------

            scenario_type = (
                row.get("scenario_type") or "UNKNOWN"
            ).strip()

            scenario_id = (
                row.get("scenario_id") or "UNKNOWN"
            ).strip()

            road_type = (
                row.get("road_type") or "UNKNOWN"
            ).strip()

            future_congestion = (
                row.get("future_congestion") or "UNKNOWN"
            ).strip()

            scenario_type_counts[scenario_type] += 1
            scenario_id_counts[scenario_id] += 1
            road_type_counts[road_type] += 1
            congestion_counts[future_congestion] += 1

            # -----------------------------------------------
            # Numeric fields
            # -----------------------------------------------

            parsed = {}

            for column in TARGET_COLUMNS:

                raw = row.get(column)

                if raw is None or str(raw).strip() == "":
                    missing_counts[column] += 1
                    parsed[column] = None
                    continue

                value = safe_float(raw)

                if value is None:
                    invalid_counts[column] += 1
                    parsed[column] = None
                    continue

                parsed[column] = value

                numeric_values[column].append(value)

                if value == 0:
                    zero_counts[column] += 1

                if value < 0:
                    negative_counts[column] += 1

            # -----------------------------------------------
            # Horizon distribution
            # -----------------------------------------------

            horizon = parsed["horizon_minutes"]

            if horizon is not None:
                horizon_counts[horizon] += 1

            # -----------------------------------------------
            # Future travel time
            # -----------------------------------------------

            future_tt = parsed["future_travel_time"]

            if future_tt is not None:

                target_by_scenario[
                    scenario_type
                ].append(future_tt)

                if horizon is not None:
                    target_by_horizon[
                        horizon
                    ].append(future_tt)

                for threshold in travel_time_thresholds:
                    if future_tt > threshold:
                        future_travel_time_threshold_counts[
                            threshold
                        ] += 1

            # -----------------------------------------------
            # Current vs future travel time
            # -----------------------------------------------

            current_tt = parsed["current_travel_time"]

            if (
                current_tt is not None
                and future_tt is not None
                and current_tt > 0
                and future_tt > 0
            ):

                current_target_pairs.append(
                    (current_tt, future_tt)
                )

                ratio_values.append(
                    future_tt / current_tt
                )

                absolute_difference_values.append(
                    future_tt - current_tt
                )

            # -----------------------------------------------
            # Progress indicator
            # -----------------------------------------------

            if total_rows % 100_000 == 0:
                print(
                    f"Scanned {total_rows:,} rows..."
                )

    # ========================================================
    # STATISTICS
    # ========================================================

    print("\n")
    print("=" * 70)
    print(" AUDIT COMPLETE")
    print("=" * 70)

    print(f"\nTotal rows: {total_rows:,}")
    print(f"Unique scenarios: {len(scenario_id_counts):,}")

    # --------------------------------------------------------
    # Basic distributions
    # --------------------------------------------------------

    print("\nScenario types:")
    for key, count in scenario_type_counts.items():
        pct = 100.0 * count / total_rows
        print(
            f"  {key:15} {count:10,} ({pct:6.2f}%)"
        )

    print("\nHorizons:")

    for horizon, count in sorted(
        horizon_counts.items(),
        key=lambda x: x[0],
    ):
        pct = 100.0 * count / total_rows

        print(
            f"  {horizon:8.0f} min"
            f" {count:10,}"
            f" ({pct:6.2f}%)"
        )

    # --------------------------------------------------------
    # Numeric statistics
    # --------------------------------------------------------

    summaries = {}

    for column in TARGET_COLUMNS:

        stats = summarize(
            numeric_values[column]
        )

        summaries[column] = stats

        print_summary(column, stats)

    # --------------------------------------------------------
    # Invalid / zero / negative
    # --------------------------------------------------------

    print("\n")
    print("=" * 70)
    print(" DATA QUALITY COUNTS")
    print("=" * 70)

    for column in TARGET_COLUMNS:

        print(f"\n{column}")

        print(
            f"  Missing : {missing_counts[column]:,}"
        )

        print(
            f"  Invalid : {invalid_counts[column]:,}"
        )

        print(
            f"  Zero    : {zero_counts[column]:,}"
        )

        print(
            f"  Negative: {negative_counts[column]:,}"
        )

    # --------------------------------------------------------
    # Travel-time thresholds
    # --------------------------------------------------------

    print("\n")
    print("=" * 70)
    print(" FUTURE TRAVEL TIME THRESHOLDS")
    print("=" * 70)

    future_tt_total = len(
        numeric_values["future_travel_time"]
    )

    for threshold in travel_time_thresholds:

        count = future_travel_time_threshold_counts[
            threshold
        ]

        if future_tt_total > 0:
            pct = 100.0 * count / future_tt_total
        else:
            pct = 0.0

        print(
            f"  > {threshold:5} sec:"
            f" {count:10,}"
            f" ({pct:6.2f}%)"
        )

    # --------------------------------------------------------
    # Current vs future ratio
    # --------------------------------------------------------

    ratio_summary = summarize(ratio_values)

    difference_summary = summarize(
        absolute_difference_values
    )

    print_summary(
        "Future / Current Travel-Time Ratio",
        ratio_summary,
    )

    print_summary(
        "Future - Current Travel-Time Difference",
        difference_summary,
    )

    # --------------------------------------------------------
    # Scenario target distributions
    # --------------------------------------------------------

    print("\n")
    print("=" * 70)
    print(" FUTURE TRAVEL TIME BY SCENARIO TYPE")
    print("=" * 70)

    scenario_summaries = {}

    for scenario_type in sorted(
        target_by_scenario
    ):

        stats = summarize(
            target_by_scenario[scenario_type]
        )

        scenario_summaries[scenario_type] = stats

        print_summary(
            scenario_type,
            stats,
        )

    # --------------------------------------------------------
    # Horizon target distributions
    # --------------------------------------------------------

    print("\n")
    print("=" * 70)
    print(" FUTURE TRAVEL TIME BY HORIZON")
    print("=" * 70)

    horizon_summaries = {}

    for horizon in sorted(
        target_by_horizon
    ):

        stats = summarize(
            target_by_horizon[horizon]
        )

        horizon_summaries[
            str(horizon)
        ] = stats

        print(
            f"\nHorizon: {horizon} minutes"
        )

        print(
            f"  Count  : {stats['count']:,}"
        )

        if stats["count"] > 0:
            print(
                f"  Median : {stats['median']:.4f}"
            )
            print(
                f"  P90    : {stats['p90']:.4f}"
            )
            print(
                f"  P95    : {stats['p95']:.4f}"
            )
            print(
                f"  P99    : {stats['p99']:.4f}"
            )
            print(
                f"  Max    : {stats['max']:.4f}"
            )

    # --------------------------------------------------------
    # Top scenario sizes
    # --------------------------------------------------------

    print("\n")
    print("=" * 70)
    print(" SCENARIO COUNTS")
    print("=" * 70)

    for scenario_id, count in sorted(
        scenario_id_counts.items(),
        key=lambda x: x[1],
        reverse=True,
    )[:20]:

        print(
            f"  {scenario_id:20}"
            f" {count:,}"
        )

    # --------------------------------------------------------
    # Road types
    # --------------------------------------------------------

    print("\n")
    print("=" * 70)
    print(" ROAD TYPES")
    print("=" * 70)

    for road_type, count in sorted(
        road_type_counts.items(),
        key=lambda x: x[1],
        reverse=True,
    ):

        pct = 100.0 * count / total_rows

        print(
            f"  {road_type:25}"
            f" {count:10,}"
            f" ({pct:6.2f}%)"
        )

    # --------------------------------------------------------
    # Congestion labels
    # --------------------------------------------------------

    print("\n")
    print("=" * 70)
    print(" FUTURE CONGESTION LABELS")
    print("=" * 70)

    for label, count in sorted(
        congestion_counts.items(),
        key=lambda x: x[1],
        reverse=True,
    ):

        pct = 100.0 * count / total_rows

        print(
            f"  {label:20}"
            f" {count:10,}"
            f" ({pct:6.2f}%)"
        )

    # ========================================================
    # PHYSICAL PLAUSIBILITY CHECK
    # ========================================================

    print("\n")
    print("=" * 70)
    print(" PHYSICAL TRAVEL-TIME CHECK")
    print("=" * 70)

    print(
        """
We compare:

    expected_time = length / speed

against:

    current_travel_time
    future_travel_time

This helps determine whether travel time is likely
stored in seconds, minutes, or another unit.
"""
    )

    # Re-scan only the columns required for this calculation.
    physical_ratios_current = []
    physical_ratios_future = []

    physical_samples = []

    with gzip.open(
        DATASET_PATH,
        mode="rt",
        encoding="utf-8",
        newline="",
    ) as file:

        reader = csv.DictReader(file)

        for row in reader:

            length = safe_float(
                row.get("length")
            )

            current_speed = safe_float(
                row.get("current_speed")
            )

            future_speed = safe_float(
                row.get("future_speed")
            )

            current_tt = safe_float(
                row.get("current_travel_time")
            )

            future_tt = safe_float(
                row.get("future_travel_time")
            )

            if (
                length is None
                or current_speed is None
                or current_speed <= 0
                or current_tt is None
                or current_tt <= 0
            ):
                continue

            # IMPORTANT:
            # We do not assume the unit yet.
            #
            # length / speed gives the mathematical
            # travel time in whatever compatible units
            # the dataset uses.

            expected_current = (
                length / current_speed
            )

            if expected_current > 0:

                ratio = (
                    current_tt
                    / expected_current
                )

                if math.isfinite(ratio):
                    physical_ratios_current.append(
                        ratio
                    )

            if (
                future_speed is not None
                and future_speed > 0
                and future_tt is not None
                and future_tt > 0
            ):

                expected_future = (
                    length / future_speed
                )

                if expected_future > 0:

                    ratio = (
                        future_tt
                        / expected_future
                    )

                    if math.isfinite(ratio):
                        physical_ratios_future.append(
                            ratio
                        )

            # Keep a small number of examples.
            if len(physical_samples) < 20:

                physical_samples.append(
                    {
                        "edge_id": row.get("edge_id"),
                        "length": length,
                        "current_speed": current_speed,
                        "current_travel_time": current_tt,
                        "future_speed": future_speed,
                        "future_travel_time": future_tt,
                        "expected_current_time": expected_current,
                    }
                )

    physical_current_summary = summarize(
        physical_ratios_current
    )

    physical_future_summary = summarize(
        physical_ratios_future
    )

    print_summary(
        "Current TT / (Length / Current Speed)",
        physical_current_summary,
    )

    print_summary(
        "Future TT / (Length / Future Speed)",
        physical_future_summary,
    )

    # ========================================================
    # BUILD JSON REPORT
    # ========================================================

    audit_report = {

        "dataset": {
            "path": DATASET_PATH,
            "total_rows": total_rows,
            "unique_scenarios": len(
                scenario_id_counts
            ),
        },

        "scenario_types": dict(
            scenario_type_counts
        ),

        "horizons": {
            str(k): v
            for k, v in sorted(
                horizon_counts.items()
            )
        },

        "numeric_summaries": summaries,

        "data_quality": {

            "missing": dict(
                missing_counts
            ),

            "invalid": dict(
                invalid_counts
            ),

            "zero": dict(
                zero_counts
            ),

            "negative": dict(
                negative_counts
            ),
        },

        "future_travel_time_thresholds": {
            str(k): v
            for k, v in sorted(
                future_travel_time_threshold_counts.items()
            )
        },

        "future_current_ratio": ratio_summary,

        "future_minus_current": difference_summary,

        "by_scenario_type": scenario_summaries,

        "by_horizon": horizon_summaries,

        "road_types": dict(
            road_type_counts
        ),

        "future_congestion_labels": dict(
            congestion_counts
        ),

        "physical_plausibility": {

            "current_ratio": physical_current_summary,

            "future_ratio": physical_future_summary,

            "samples": physical_samples,
        },
    }

    # ========================================================
    # SAVE JSON
    # ========================================================

    os.makedirs(
        os.path.dirname(OUTPUT_PATH),
        exist_ok=True,
    )

    with open(
        OUTPUT_PATH,
        "w",
        encoding="utf-8",
    ) as file:

        json.dump(
            audit_report,
            file,
            indent=2,
        )

    print("\n")
    print("=" * 70)
    print(" REPORT SAVED")
    print("=" * 70)

    print(
        f"\n{OUTPUT_PATH}"
    )

    print("\nAudit finished successfully.")


if __name__ == "__main__":
    main()