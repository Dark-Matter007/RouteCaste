import csv
import os
from collections import defaultdict

FILE = "data/processed/traffic_state.csv"

scenario_rows = defaultdict(int)
scenario_intervals = defaultdict(set)

total_rows = 0
missing_values = 0

with open(FILE, "r", encoding="utf-8", newline="") as f:

    reader = csv.DictReader(f)

    required = [
        "scenario_id",
        "demand_level",
        "time_period",
        "seed",
        "interval_begin",
        "interval_end",
        "edge_id",
        "speed",
        "density",
        "occupancy",
        "flow",
    ]

    missing_columns = [
        c for c in required
        if c not in reader.fieldnames
    ]

    if missing_columns:
        raise RuntimeError(
            f"Missing columns: {missing_columns}"
        )

    for row in reader:

        total_rows += 1

        scenario = row["scenario_id"]

        scenario_rows[scenario] += 1

        scenario_intervals[scenario].add(
            row["interval_begin"]
        )

        for column in required:
            if row[column] == "":
                missing_values += 1

print()
print("=" * 80)
print("TRAFFIC STATE VALIDATION")
print("=" * 80)

print(f"Total rows       : {total_rows:,}")
print(f"Scenarios        : {len(scenario_rows)}")
print(f"Missing values   : {missing_values:,}")

print()
print("Scenario validation:")
print("-" * 80)

failed = 0

for scenario in sorted(scenario_rows):

    rows = scenario_rows[scenario]
    intervals = len(scenario_intervals[scenario])

    status = "OK"

    if intervals != 180:
        status = "FAILED"
        failed += 1

    print(
        f"{scenario:<40} "
        f"rows={rows:>8,} "
        f"intervals={intervals:>3} "
        f"{status}"
    )

print()
print("=" * 80)

if len(scenario_rows) != 36:
    print("FAILED: Expected 36 scenarios")
    failed += 1

if failed == 0:
    print("RESULT: ALL TRAFFIC STATE DATA VALID")
else:
    print(f"RESULT: {failed} validation failures")

print("=" * 80)