import pandas as pd
import numpy as np

DATA_PATH = "../data/processed/routecast_ml_dataset.csv.gz"

FEATURES = [
    "current_density",
    "current_occupancy",
    "current_flow",
    "capacity",
    "lanes",
    "speed_limit",
    "length",
    "horizon_minutes",
    "distance_to_event_m",
    "distance_weight",
    "event_size",
    "attendance",
    "event_duration_min",
    "event_arrival_rate",
    "event_departure_rate",
]

CATEGORICAL = [
    "road_type",
    "event_type",
    "event_category",
    "demand_level",
    "time_period",
    "scenario_type",
]


def percentile(series, q):
    return series.quantile(q)


print("=" * 80)
print("RouteCast Feature Distribution Audit")
print("=" * 80)

print("\nLoading dataset...")

df = pd.read_csv(
    DATA_PATH,
    compression="gzip",
    usecols=FEATURES + CATEGORICAL,
)

print(f"Rows loaded: {len(df):,}")

print("\n" + "=" * 80)
print("NUMERIC FEATURES")
print("=" * 80)

for col in FEATURES:
    s = pd.to_numeric(df[col], errors="coerce")

    print(f"\n--- {col} ---")
    print(f"dtype      : {df[col].dtype}")
    print(f"missing    : {s.isna().sum():,}")
    print(f"zeros      : {(s == 0).sum():,}")
    print(f"unique     : {s.nunique():,}")
    print(f"min        : {s.min():.6f}")
    print(f"max        : {s.max():.6f}")
    print(f"mean       : {s.mean():.6f}")
    print(f"median     : {s.median():.6f}")
    print(f"P90        : {percentile(s, 0.90):.6f}")
    print(f"P95        : {percentile(s, 0.95):.6f}")
    print(f"P99        : {percentile(s, 0.99):.6f}")


print("\n" + "=" * 80)
print("CATEGORICAL FEATURES")
print("=" * 80)

for col in CATEGORICAL:
    print(f"\n--- {col} ---")

    counts = df[col].value_counts(dropna=False)

    print(f"unique: {df[col].nunique(dropna=False)}")

    for value, count in counts.items():
        percentage = count / len(df) * 100
        print(f"  {str(value):30s} {count:10,} ({percentage:6.2f}%)")


print("\n" + "=" * 80)
print("EVENT-ONLY NUMERIC DISTRIBUTIONS")
print("=" * 80)

event_df = df[df["scenario_type"].astype(str).str.lower() == "event"]

print(f"Event rows: {len(event_df):,}")

for col in [
    "distance_to_event_m",
    "distance_weight",
    "event_size",
    "attendance",
    "event_duration_min",
    "event_arrival_rate",
    "event_departure_rate",
]:
    if col not in event_df.columns:
        continue

    s = pd.to_numeric(event_df[col], errors="coerce")

    print(f"\n--- {col} ---")
    print(f"missing    : {s.isna().sum():,}")
    print(f"zeros      : {(s == 0).sum():,}")
    print(f"min        : {s.min():.6f}")
    print(f"max        : {s.max():.6f}")
    print(f"mean       : {s.mean():.6f}")
    print(f"median     : {s.median():.6f}")
    print(f"P90        : {s.quantile(0.90):.6f}")
    print(f"P95        : {s.quantile(0.95):.6f}")
    print(f"P99        : {s.quantile(0.99):.6f}")


print("\n" + "=" * 80)
print("AUDIT COMPLETE")
print("=" * 80)