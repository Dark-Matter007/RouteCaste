from pathlib import Path
import pandas as pd

DATA_PATH = (
    Path(__file__).resolve().parent.parent
    / "data"
    / "processed"
    / "routecast_ml_dataset.csv.gz"
)

print("=" * 70)
print("RouteCast Congestion Target Audit")
print("=" * 70)

usecols = [
    "scenario_type",
    "scenario_id",
    "current_speed",
    "future_speed",
    "speed_limit",
    "future_congestion",
]

# ============================================================
# READ ONLY THE CONGESTION TARGET
# ============================================================

print("\nReading future_congestion values...")

chunks = []

for chunk in pd.read_csv(
    DATA_PATH,
    compression="gzip",
    usecols=usecols,
    chunksize=50_000,
    low_memory=False,
):
    chunks.append(chunk)

df = pd.concat(
    chunks,
    ignore_index=True,
)

print(
    f"\nRows: {len(df):,}"
)

# ============================================================
# RAW VALUES
# ============================================================

target = df["future_congestion"]

print("\n" + "=" * 70)
print("RAW future_congestion")
print("=" * 70)

print(
    "\nData type:",
    target.dtype,
)

print(
    "\nMissing values:",
    target.isna().sum(),
)

print(
    "\nUnique values:",
    target.nunique(),
)

print(
    "\nUnique labels:"
)

print(
    target.dropna()
    .astype(str)
    .value_counts()
)

# ============================================================
# BY SCENARIO
# ============================================================

print("\n" + "=" * 70)
print("CONGESTION LABELS BY SCENARIO TYPE")
print("=" * 70)

print(
    pd.crosstab(
        df["scenario_type"],
        target,
        normalize="index",
    )
)

# ============================================================
# SAMPLE ROWS
# ============================================================

print("\n" + "=" * 70)
print("SAMPLE ROWS")
print("=" * 70)

print(
    df[
        [
            "scenario_type",
            "scenario_id",
            "current_speed",
            "future_speed",
            "speed_limit",
            "future_congestion",
        ]
    ]
    .head(30)
    .to_string(index=False)
)

# ============================================================
# CALCULATE CONTINUOUS FUTURE CONGESTION
# ============================================================

print("\n" + "=" * 70)
print("CALCULATED FUTURE CONGESTION")
print("=" * 70)

current_speed = pd.to_numeric(
    df["current_speed"],
    errors="coerce",
)

future_speed = pd.to_numeric(
    df["future_speed"],
    errors="coerce",
)

speed_limit = pd.to_numeric(
    df["speed_limit"],
    errors="coerce",
)

calculated_future = (
    1.0
    - (
        future_speed
        / speed_limit
    )
)

calculated_future = calculated_future.clip(
    0.0,
    1.0,
)

print(
    calculated_future.describe(
        percentiles=[
            0.01,
            0.05,
            0.10,
            0.25,
            0.50,
            0.75,
            0.90,
            0.95,
            0.99,
        ]
    )
)

print(
    "\nUnique calculated values:",
    calculated_future.nunique(),
)

# ============================================================
# MAP NUMERIC CONGESTION INTO LABELS
# ============================================================

def congestion_label(value):

    if pd.isna(value):
        return "unknown"

    if value < 0.20:
        return "free"

    if value < 0.40:
        return "light"

    if value < 0.60:
        return "moderate"

    if value < 0.80:
        return "heavy"

    return "severe"


calculated_labels = calculated_future.map(
    congestion_label
)

print("\n" + "=" * 70)
print("CALCULATED CONGESTION LABEL DISTRIBUTION")
print("=" * 70)

print(
    calculated_labels.value_counts()
)

# ============================================================
# STORED VS CALCULATED
# ============================================================

print("\n" + "=" * 70)
print("STORED LABEL vs CALCULATED LABEL")
print("=" * 70)

comparison = pd.crosstab(
    target,
    calculated_labels,
)

print(
    comparison
)

print("\nRow-normalized comparison:")

print(
    pd.crosstab(
        target,
        calculated_labels,
        normalize="index",
    ).round(4)
)

print("\n" + "=" * 70)
print("AUDIT COMPLETE")
print("=" * 70)