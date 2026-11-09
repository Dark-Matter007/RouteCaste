import csv
import gzip
from collections import Counter

FILE = "data/processed/event_prediction_targets.csv.gz"

HORIZONS = {5, 10, 15, 30, 45, 60}

rows = 0
scenarios = set()
horizons = Counter()
duplicates = set()
seen = set()

missing = Counter()
invalid = Counter()

with gzip.open(FILE, "rt", encoding="utf-8", newline="") as f:

    reader = csv.DictReader(f)

    for r in reader:

        rows += 1

        scenario = r["scenario_id"]
        edge = r["edge_id"]

        current = int(r["current_time"])
        future = int(r["future_time"])
        horizon = int(r["horizon_minutes"])

        scenarios.add(scenario)
        horizons[horizon] += 1

        key = (
            scenario,
            edge,
            current,
            horizon
        )

        if key in seen:
            duplicates.add(key)

        seen.add(key)

        if future != current + horizon * 60:
            invalid["future_time"] += 1

        if horizon not in HORIZONS:
            invalid["horizon"] += 1

        for field in [
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
            "distance_weight",
            "attendance",
            "event_duration_min",
            "event_start_minute",
            "event_arrival_rate",
            "event_departure_rate",
        ]:

            value = r[field]

            if value == "":
                missing[field] += 1
                continue

            try:
                x = float(value)

                if x != x:
                    invalid[field] += 1

            except ValueError:
                invalid[field] += 1


print("=" * 70)
print("EVENT PREDICTION DATASET VALIDATION")
print("=" * 70)

print(f"Rows              : {rows:,}")
print(f"Scenarios         : {len(scenarios)}")
print(f"Duplicates        : {len(duplicates):,}")
print(f"Missing values    : {sum(missing.values()):,}")
print(f"Invalid values    : {sum(invalid.values()):,}")
print()

print("HORIZON COVERAGE")

for h in sorted(HORIZONS):
    print(
        f"{h:2d} min : "
        f"{horizons[h]:,} rows"
    )

print()

print("RESULT")

if (
    rows == 0
    or len(scenarios) != 24
    or set(horizons) != HORIZONS
    or duplicates
    or missing
    or invalid
):
    print("FAIL")
else:
    print("PASS - EVENT PREDICTION DATASET VALID")
