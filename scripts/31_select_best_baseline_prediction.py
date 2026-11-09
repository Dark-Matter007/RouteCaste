import sqlite3
import csv
import gzip
import os
from collections import defaultdict


# ============================================================
# CONFIGURATION
# ============================================================

DB_PATH = "data/processed/traffic_state.db"

OUTPUT_PATH = (
    "data/processed/"
    "baseline_prediction_targets_reduced.csv.gz"
)

TARGET_PER_CLASS = 1000

# Simulation duration:
# 17:00–20:00 = 180 minutes
TIME_BUCKETS = 18
BUCKET_SIZE_SECONDS = 600

CONGESTION_ORDER = [
    "free",
    "light",
    "moderate",
    "heavy",
    "severe",
]


# ============================================================
# OUTPUT COLUMNS
# ============================================================

COLUMNS = [
    "scenario_id",
    "demand_level",
    "time_period",
    "seed",
    "edge_id",
    "current_time",
    "horizon_minutes",
    "future_time",
    "current_speed",
    "current_density",
    "current_occupancy",
    "current_flow",
    "current_travel_time",
    "current_waiting_time",
    "current_time_loss",
    "length",
    "lanes",
    "speed_limit",
    "road_type",
    "capacity",
    "future_speed",
    "future_density",
    "future_occupancy",
    "future_flow",
    "future_travel_time",
    "future_waiting_time",
    "future_time_loss",
    "future_speed_relative",
    "future_departed",
    "future_arrived",
    "future_entered",
    "future_left",
    "future_congestion",
]


# ============================================================
# QUALITY SCORE
# ============================================================

def quality_score(row):
    """
    Score an observation for data quality.

    Higher score means:
      - valid current/future traffic values
      - realistic speeds
      - realistic travel times
      - valid occupancy
      - valid waiting/time-loss values

    sampled_seconds is NOT used because it does not exist
    in prediction_targets.
    """

    score = 0

    # Future state
    future_speed = float(row["future_speed"])
    future_density = float(row["future_density"])
    future_occupancy = float(row["future_occupancy"])
    future_flow = float(row["future_flow"])
    future_travel_time = float(row["future_travel_time"])
    future_waiting_time = float(row["future_waiting_time"])
    future_time_loss = float(row["future_time_loss"])

    if 0 <= future_speed <= 40:
        score += 100

    if future_density >= 0:
        score += 50

    if 0 <= future_occupancy <= 100:
        score += 50

    if future_flow >= 0:
        score += 50

    if 0 <= future_travel_time <= 3600:
        score += 100

    if 0 <= future_waiting_time <= 3600:
        score += 50

    if 0 <= future_time_loss <= 3600:
        score += 50

    # Current state
    current_speed = float(row["current_speed"])
    current_density = float(row["current_density"])
    current_occupancy = float(row["current_occupancy"])
    current_flow = float(row["current_flow"])
    current_travel_time = float(row["current_travel_time"])
    current_waiting_time = float(row["current_waiting_time"])
    current_time_loss = float(row["current_time_loss"])

    if 0 <= current_speed <= 40:
        score += 50

    if current_density >= 0:
        score += 25

    if 0 <= current_occupancy <= 100:
        score += 25

    if current_flow >= 0:
        score += 25

    if 0 <= current_travel_time <= 3600:
        score += 50

    if 0 <= current_waiting_time <= 3600:
        score += 25

    if 0 <= current_time_loss <= 3600:
        score += 25

    return score


# ============================================================
# DIVERSE SELECTION
# ============================================================

def select_diverse(rows, target):
    """
    Select high-quality observations while preserving:

      1. Time diversity
      2. Road-type diversity
      3. Edge diversity

    Selection happens within one:
        scenario × horizon × congestion class
    group.
    """

    if len(rows) <= target:
        return rows

    buckets = defaultdict(list)

    for row in rows:

        try:
            current_time = float(row["current_time"])
        except (TypeError, ValueError):
            continue

        # 17:00 = 61200 seconds
        bucket = int(
            (current_time - 61200)
            // BUCKET_SIZE_SECONDS
        )

        bucket = max(
            0,
            min(TIME_BUCKETS - 1, bucket)
        )

        road_type = row["road_type"]

        if not road_type:
            road_type = "unknown"

        buckets[
            (bucket, road_type)
        ].append(row)

    # Sort each time × road-type bucket by quality.
    for key in buckets:

        buckets[key].sort(
            key=lambda row: (
                quality_score(row),

                # Prefer reasonable travel times
                -float(row["current_travel_time"]),

                # Stable ordering
                row["edge_id"],
            ),
            reverse=True,
        )

    selected = []
    used_edges = set()

    # --------------------------------------------------------
    # PASS 1
    # Spread observations across time and road types.
    # Prefer different edges.
    # --------------------------------------------------------

    for key in sorted(buckets.keys()):

        for row in buckets[key]:

            edge_id = row["edge_id"]

            if edge_id not in used_edges:

                selected.append(row)
                used_edges.add(edge_id)

                if len(selected) >= target:
                    return selected[:target]

    # --------------------------------------------------------
    # PASS 2
    # Fill remaining slots with highest-quality rows.
    # --------------------------------------------------------

    remaining = []

    for bucket_rows in buckets.values():
        remaining.extend(bucket_rows)

    remaining.sort(
        key=lambda row: (
            quality_score(row),
            row["edge_id"],
            float(row["current_time"]),
        ),
        reverse=True,
    )

    selected_keys = {
        (
            row["edge_id"],
            row["current_time"],
        )
        for row in selected
    }

    for row in remaining:

        key = (
            row["edge_id"],
            row["current_time"],
        )

        if key not in selected_keys:

            selected.append(row)
            selected_keys.add(key)

            if len(selected) >= target:
                break

    return selected[:target]


# ============================================================
# MAIN
# ============================================================

def main():

    print("=" * 70)
    print("BEST BASELINE PREDICTION DATASET SELECTION")
    print("=" * 70)
    print()

    # --------------------------------------------------------
    # Safety checks
    # --------------------------------------------------------

    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(
            f"Database not found:\n{DB_PATH}"
        )

    if os.path.exists(OUTPUT_PATH):
        raise FileExistsError(
            f"\nOutput already exists:\n{OUTPUT_PATH}\n\n"
            "Delete or rename the existing output before "
            "running the selection again."
        )

    os.makedirs(
        os.path.dirname(OUTPUT_PATH),
        exist_ok=True,
    )

    # --------------------------------------------------------
    # Connect to SQLite
    # --------------------------------------------------------

    conn = sqlite3.connect(DB_PATH)

    conn.row_factory = sqlite3.Row

    # Read-only mode for safety.
    conn.execute("PRAGMA query_only = ON")

    # --------------------------------------------------------
    # Find all scenario × horizon groups
    # --------------------------------------------------------

    groups = conn.execute(
        """
        SELECT DISTINCT
            scenario_id,
            horizon_minutes
        FROM prediction_targets
        ORDER BY
            scenario_id,
            horizon_minutes
        """
    ).fetchall()

    print(f"Groups found:    {len(groups)}")
    print("Expected groups: 216")
    print()

    if len(groups) != 216:
        conn.close()

        raise RuntimeError(
            f"Expected 216 scenario/horizon groups, "
            f"but found {len(groups)}."
        )

    total_selected = 0
    total_available = 0

    # --------------------------------------------------------
    # Query
    # --------------------------------------------------------

    query = """
        SELECT
            scenario_id,
            demand_level,
            time_period,
            seed,
            edge_id,
            [current_time],
            horizon_minutes,
            future_time,

            current_speed,
            current_density,
            current_occupancy,
            current_flow,
            current_travel_time,
            current_waiting_time,
            current_time_loss,

            length,
            lanes,
            speed_limit,
            road_type,
            capacity,

            future_speed,
            future_density,
            future_occupancy,
            future_flow,
            future_travel_time,
            future_waiting_time,
            future_time_loss,
            future_speed_relative,

            future_departed,
            future_arrived,
            future_entered,
            future_left,

            future_congestion

        FROM prediction_targets

        WHERE scenario_id = ?
          AND horizon_minutes = ?
          AND future_congestion = ?

          AND future_speed IS NOT NULL
          AND future_density IS NOT NULL
          AND future_occupancy IS NOT NULL
          AND future_flow IS NOT NULL
          AND future_travel_time IS NOT NULL
          AND future_waiting_time IS NOT NULL
          AND future_time_loss IS NOT NULL

          AND current_speed IS NOT NULL
          AND current_density IS NOT NULL
          AND current_occupancy IS NOT NULL
          AND current_flow IS NOT NULL
          AND current_travel_time IS NOT NULL
          AND current_waiting_time IS NOT NULL
          AND current_time_loss IS NOT NULL

          AND future_speed BETWEEN 0 AND 40
          AND future_density >= 0
          AND future_occupancy BETWEEN 0 AND 100
          AND future_flow >= 0
          AND future_travel_time BETWEEN 0 AND 3600
          AND future_waiting_time BETWEEN 0 AND 3600
          AND future_time_loss BETWEEN 0 AND 3600

          AND current_speed BETWEEN 0 AND 40
          AND current_density >= 0
          AND current_occupancy BETWEEN 0 AND 100
          AND current_flow >= 0
          AND current_travel_time BETWEEN 0 AND 3600
          AND current_waiting_time BETWEEN 0 AND 3600
          AND current_time_loss BETWEEN 0 AND 3600

        ORDER BY
            [current_time],
            edge_id
    """

    # --------------------------------------------------------
    # Create compressed output
    # --------------------------------------------------------

    with gzip.open(
        OUTPUT_PATH,
        mode="wt",
        newline="",
        encoding="utf-8",
        compresslevel=6,
    ) as gz:

        writer = csv.writer(gz)

        writer.writerow(COLUMNS)

        # ----------------------------------------------------
        # Process all 216 groups
        # ----------------------------------------------------

        for group_index, group in enumerate(
            groups,
            1,
        ):

            scenario = group["scenario_id"]
            horizon = group["horizon_minutes"]

            print(
                f"[{group_index:3d}/216] "
                f"{scenario} | horizon={horizon}"
            )

            group_selected = 0

            # ------------------------------------------------
            # Process five congestion classes separately.
            # ------------------------------------------------

            for congestion in CONGESTION_ORDER:

                rows = conn.execute(
                    query,
                    (
                        scenario,
                        horizon,
                        congestion,
                    ),
                ).fetchall()

                available = len(rows)

                total_available += available

                selected = select_diverse(
                    rows,
                    TARGET_PER_CLASS,
                )

                selected_count = len(selected)

                group_selected += selected_count
                total_selected += selected_count

                print(
                    f"    "
                    f"{congestion:8s}: "
                    f"{available:8,d} available "
                    f"-> "
                    f"{selected_count:4,d} selected"
                )

                if selected_count < TARGET_PER_CLASS:

                    print(
                        f"    WARNING: "
                        f"{scenario} | "
                        f"horizon={horizon} | "
                        f"{congestion} "
                        f"has fewer than "
                        f"{TARGET_PER_CLASS} valid rows."
                    )

                # --------------------------------------------
                # Write selected rows
                # --------------------------------------------

                for row in selected:

                    writer.writerow(
                        [
                            row[column]
                            for column in COLUMNS
                        ]
                    )

            print(
                f"    Group total: "
                f"{group_selected:,} selected"
            )
            print()

    conn.close()

    # --------------------------------------------------------
    # Final summary
    # --------------------------------------------------------

    print("=" * 70)
    print("SELECTION COMPLETE")
    print("=" * 70)

    print(
        f"Total available examined: "
        f"{total_available:,}"
    )

    print(
        f"Total selected:           "
        f"{total_selected:,}"
    )

    print(
        "Expected selected:        "
        "1,080,000"
    )

    print(
        f"Output:                   "
        f"{OUTPUT_PATH}"
    )

    if total_selected == 1_080_000:

        print()
        print("STATUS: EXACT TARGET ACHIEVED")
        print(
            "All 216 scenario/horizon groups "
            "contributed exactly 5,000 rows."
        )

    else:

        print()
        print("STATUS: CHECK WARNINGS")
        print(
            "The exact 1,080,000-row target "
            "was not achieved."
        )


if __name__ == "__main__":
    main()

