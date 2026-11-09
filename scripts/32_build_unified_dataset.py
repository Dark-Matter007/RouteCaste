import pandas as pd
from pathlib import Path

# ============================================================
# ROUTECAST UNIFIED ML DATASET BUILDER
# ============================================================

BASELINE = Path(
    "data/processed/baseline_prediction_targets_reduced.csv.gz"
)

EVENT = Path(
    "data/processed/event_prediction_targets_reduced.csv.gz"
)

ROAD = Path(
    "data/processed/road_features.csv"
)

EVENT_FEATURES = Path(
    "data/processed/event_scenario_features.csv"
)

OUTPUT = Path(
    "data/processed/routecast_ml_dataset.csv.gz"
)

CHUNK_SIZE = 200_000


# ============================================================
# START
# ============================================================

print("=" * 70)
print("ROUTECAST UNIFIED ML DATASET")
print("=" * 70)


# ============================================================
# LOAD ROAD FEATURES
# ============================================================

print("\nLoading road features...")

road = pd.read_csv(ROAD)

road = road[
    [
        "edge_id",
        "length",
        "lanes",
        "speed_limit",
        "road_type",
        "capacity",
    ]
].drop_duplicates("edge_id")

print(f"Road features: {len(road):,}")


# ============================================================
# LOAD EVENT SCENARIO FEATURES
# ============================================================

print("\nLoading event scenario features...")

event_features = pd.read_csv(EVENT_FEATURES)

event_features = event_features[
    [
        "scenario_id",
        "baseline_scenario",
        "event_location_id",
        "event_name",
        "event_category",
        "latitude",
        "longitude",
        "event_edge",
        "event_road_type",
        "mapping_distance_m",
        "event_type",
        "event_size",
        "attendance",
        "time_period",
        "event_duration_min",
        "event_start_minute",
        "event_arrival_rate",
        "event_departure_rate",
    ]
].drop_duplicates("scenario_id")

print(f"Event scenarios: {len(event_features):,}")


# ============================================================
# FINAL COMMON SCHEMA
# ============================================================

final_columns = [
    "scenario_type",
    "scenario_id",
    "baseline_scenario",
    "demand_level",
    "time_period",
    "seed",

    "edge_id",
    "current_time",
    "future_time",
    "horizon_minutes",

    "current_speed",
    "current_density",
    "current_occupancy",
    "current_flow",
    "current_travel_time",
    "current_waiting_time",
    "current_time_loss",

    "future_speed",
    "future_density",
    "future_occupancy",
    "future_flow",
    "future_travel_time",
    "future_waiting_time",
    "future_time_loss",

    "length",
    "lanes",
    "speed_limit",
    "road_type",
    "capacity",

    "event_location_id",
    "event_name",
    "event_category",
    "latitude",
    "longitude",
    "event_edge",
    "event_road_type",
    "mapping_distance_m",

    "distance_to_event_m",
    "within_250m",
    "within_500m",
    "within_1000m",
    "distance_weight",

    "event_type",
    "event_size",
    "attendance",
    "event_duration_min",
    "event_start_minute",
    "event_arrival_rate",
    "event_departure_rate",

    "future_congestion",
]


# ============================================================
# REMOVE OLD PARTIAL OUTPUT
# ============================================================

if OUTPUT.exists():
    print("\nRemoving previous partial output...")
    OUTPUT.unlink()


# ============================================================
# BASELINE DATASET
# ============================================================

print("\n" + "=" * 70)
print("PROCESSING BASELINE DATASET")
print("=" * 70)

baseline_rows = 0
first_chunk = True

for chunk_number, df in enumerate(
    pd.read_csv(
        BASELINE,
        compression="gzip",
        chunksize=CHUNK_SIZE,
    ),
    start=1,
):

    print(
        f"Baseline chunk {chunk_number}: "
        f"{len(df):,} rows"
    )

    # --------------------------------------------------------
    # Basic required columns
    # --------------------------------------------------------

    required = [
        "scenario_id",
        "demand_level",
        "time_period",
        "seed",
        "edge_id",
        "current_time",
        "future_time",
        "horizon_minutes",

        "current_speed",
        "current_density",
        "current_occupancy",
        "current_flow",
        "current_travel_time",
        "current_waiting_time",
        "current_time_loss",

        "future_speed",
        "future_density",
        "future_occupancy",
        "future_flow",
        "future_travel_time",
        "future_waiting_time",
        "future_time_loss",

        "length",
        "lanes",
        "speed_limit",
        "road_type",
        "capacity",

        "future_congestion",
    ]

    missing = [
        column
        for column in required
        if column not in df.columns
    ]

    if missing:
        raise ValueError(
            "Baseline dataset is missing columns: "
            + ", ".join(missing)
        )

    # --------------------------------------------------------
    # Metadata
    # --------------------------------------------------------

    df["scenario_type"] = "baseline"

    df["baseline_scenario"] = df["scenario_id"]

    # --------------------------------------------------------
    # Event columns
    # --------------------------------------------------------

    df["event_location_id"] = "NONE"
    df["event_name"] = "NONE"
    df["event_category"] = "NONE"

    df["latitude"] = 0.0
    df["longitude"] = 0.0

    df["event_edge"] = "NONE"
    df["event_road_type"] = "NONE"

    df["mapping_distance_m"] = 0.0

    df["distance_to_event_m"] = 0.0
    df["within_250m"] = 0
    df["within_500m"] = 0
    df["within_1000m"] = 0
    df["distance_weight"] = 0.0

    df["event_type"] = "NONE"
    df["event_size"] = "NONE"

    df["attendance"] = 0
    df["event_duration_min"] = 0
    df["event_start_minute"] = 0

    df["event_arrival_rate"] = 0.0
    df["event_departure_rate"] = 0.0

    # --------------------------------------------------------
    # Validate road features
    # --------------------------------------------------------

    road_columns = [
        "length",
        "lanes",
        "speed_limit",
        "road_type",
        "capacity",
    ]

    missing_road = (
        df[road_columns]
        .isna()
        .any(axis=1)
        .sum()
    )

    if missing_road:
        raise ValueError(
            f"Baseline chunk contains "
            f"{missing_road:,} rows with missing "
            f"road features."
        )

    # --------------------------------------------------------
    # Select final schema
    # --------------------------------------------------------

    df = df[final_columns]

    # --------------------------------------------------------
    # Write
    # --------------------------------------------------------

    df.to_csv(
        OUTPUT,
        mode="wt" if first_chunk else "at",
        index=False,
        header=first_chunk,
        compression="gzip",
    )

    first_chunk = False
    baseline_rows += len(df)


print(
    f"\nBaseline rows written: "
    f"{baseline_rows:,}"
)


# ============================================================
# EVENT DATASET
# ============================================================

print("\n" + "=" * 70)
print("PROCESSING EVENT DATASET")
print("=" * 70)

event_df = pd.read_csv(
    EVENT,
    compression="gzip",
)

print(
    f"Event rows loaded: "
    f"{len(event_df):,}"
)


# ============================================================
# VALIDATE EVENT INPUT
# ============================================================

event_required = [
    "scenario_id",
    "event_location_id",
    "seed",
    "edge_id",
    "current_time",
    "future_time",
    "horizon_minutes",

    "current_speed",
    "current_density",
    "current_occupancy",
    "current_flow",
    "current_travel_time",
    "current_waiting_time",
    "current_time_loss",

    "future_speed",
    "future_density",
    "future_occupancy",
    "future_flow",
    "future_travel_time",
    "future_waiting_time",
    "future_time_loss",

    "distance_to_event_m",
    "within_250m",
    "within_500m",
    "within_1000m",
    "distance_weight",

    "event_type",
    "event_size",
    "attendance",
    "event_duration_min",
    "event_start_minute",
    "event_arrival_rate",
    "event_departure_rate",
]


missing = [
    column
    for column in event_required
    if column not in event_df.columns
]

if missing:
    raise ValueError(
        "Event dataset is missing columns: "
        + ", ".join(missing)
    )


# ============================================================
# MERGE EVENT SCENARIO METADATA
# ============================================================

event_df = event_df.merge(
    event_features,
    on="scenario_id",
    how="left",
    suffixes=("", "_scenario"),
    validate="many_to_one",
)


# ============================================================
# CHECK EVENT SCENARIO METADATA
# ============================================================

event_metadata_required = [
    "baseline_scenario",
    "event_name",
    "event_category",
    "latitude",
    "longitude",
    "event_edge",
    "event_road_type",
]

missing_metadata = [
    column
    for column in event_metadata_required
    if column not in event_df.columns
]

if missing_metadata:
    raise ValueError(
        "Missing event scenario metadata: "
        + ", ".join(missing_metadata)
    )


# ============================================================
# ADD DEMAND LEVEL
# ============================================================

# Event scenarios are based on normal baseline traffic.
event_df["demand_level"] = "normal"

event_df["scenario_type"] = "event"


# ============================================================
# BUILD FUTURE CONGESTION
# ============================================================

print("\nBuilding event congestion target...")

if (event_df["speed_limit"] if "speed_limit" in event_df.columns else pd.Series()).empty:
    pass


# Event dataset does not contain road speed limit.
# Merge it from road features.

event_df = event_df.merge(
    road,
    on="edge_id",
    how="left",
    validate="many_to_one",
    suffixes=("", "_road"),
)


# ------------------------------------------------------------
# Validate road features
# ------------------------------------------------------------

missing_road = (
    event_df[
        [
            "length",
            "lanes",
            "speed_limit",
            "road_type",
            "capacity",
        ]
    ]
    .isna()
    .any(axis=1)
    .sum()
)

if missing_road:
    raise ValueError(
        f"Event dataset contains "
        f"{missing_road:,} rows with missing "
        f"road features."
    )


# ============================================================
# SAME CONGESTION DEFINITION
# ============================================================

# Congestion classification uses future speed relative
# to the road speed limit.

event_df["future_speed_relative"] = (
    event_df["future_speed"]
    / event_df["speed_limit"]
)

# Protect against invalid speed limits.
event_df.loc[
    event_df["speed_limit"] <= 0,
    "future_speed_relative"
] = 0.0


def classify_congestion(relative_speed):
    if relative_speed >= 0.80:
        return "free"

    if relative_speed >= 0.60:
        return "light"

    if relative_speed >= 0.40:
        return "moderate"

    if relative_speed >= 0.20:
        return "heavy"

    return "severe"


event_df["future_congestion"] = (
    event_df["future_speed_relative"]
    .apply(classify_congestion)
)


# ============================================================
# FINAL EVENT SCHEMA
# ============================================================

event_df = event_df[final_columns]


# ============================================================
# WRITE EVENT DATA
# ============================================================

event_df.to_csv(
    OUTPUT,
    mode="at",
    index=False,
    header=False,
    compression="gzip",
)


event_rows = len(event_df)


# ============================================================
# FINAL VALIDATION
# ============================================================

total_rows = baseline_rows + event_rows

print("\n" + "=" * 70)
print("UNIFIED DATASET COMPLETE")
print("=" * 70)

print(
    f"Baseline rows: {baseline_rows:,}"
)

print(
    f"Event rows:    {event_rows:,}"
)

print(
    f"Total rows:    {total_rows:,}"
)

print(
    f"Columns:       {len(final_columns)}"
)

print(
    f"Output:        {OUTPUT}"
)

print("\nExpected:")
print("Baseline = 1,080,000")
print("Event    =   144,000")
print("Total    = 1,224,000")


if baseline_rows != 1_080_000:
    raise ValueError(
        f"Unexpected baseline row count: "
        f"{baseline_rows:,}"
    )

if event_rows != 144_000:
    raise ValueError(
        f"Unexpected event row count: "
        f"{event_rows:,}"
    )

if total_rows != 1_224_000:
    raise ValueError(
        f"Unexpected total row count: "
        f"{total_rows:,}"
    )


print("\nSTATUS: EXACT TARGET ACHIEVED")