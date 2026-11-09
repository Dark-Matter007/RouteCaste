from pathlib import Path
import csv
import math
import sys

INPUT = Path("data/processed/traffic_state_clean.csv")

EXPECTED_SCENARIOS = 36
EXPECTED_INTERVALS = 180

REQUIRED_COLUMNS = [
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
    "data_quality",
    "travel_time_valid",
]

NUMERIC_COLUMNS = [
    "speed",
    "density",
    "occupancy",
    "flow",
    "travel_time",
    "sampled_seconds",
]


def to_float(value):
    try:
        x = float(value)
        return x if math.isfinite(x) else None
    except (ValueError, TypeError):
        return None


def main():
    if not INPUT.exists():
        print(f"ERROR: File not found: {INPUT}")
        sys.exit(1)

    total_rows = 0
    scenarios = {}
    missing_values = 0
    invalid_numeric = 0
    invalid_occupancy = 0
    invalid_quality = 0
    invalid_travel_target = 0

    with INPUT.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)

        if reader.fieldnames is None:
            print("ERROR: Missing CSV header.")
            sys.exit(1)

        missing_columns = [
            c for c in REQUIRED_COLUMNS
            if c not in reader.fieldnames
        ]

        if missing_columns:
            print("ERROR: Missing columns:")
            for c in missing_columns:
                print(f"  {c}")
            sys.exit(1)

        for row in reader:
            total_rows += 1

            scenario = row["scenario_id"]

            if scenario not in scenarios:
                scenarios[scenario] = {
                    "rows": 0,
                    "intervals": set(),
                }

            scenarios[scenario]["rows"] += 1

            try:
                begin = float(row["interval_begin"])
                scenarios[scenario]["intervals"].add(begin)
            except (ValueError, TypeError):
                invalid_numeric += 1

            # Required text fields
            for col in [
                "scenario_id",
                "demand_level",
                "time_period",
                "edge_id",
                "data_quality",
            ]:
                if not row[col]:
                    missing_values += 1

            # Numeric checks
            for col in NUMERIC_COLUMNS:
                value = to_float(row[col])

                if value is None:
                    invalid_numeric += 1

            # Physical checks
            occupancy = to_float(row["occupancy"])
            speed = to_float(row["speed"])
            density = to_float(row["density"])
            flow = to_float(row["flow"])

            if (
                occupancy is not None
                and (occupancy < 0 or occupancy > 100)
            ):
                invalid_occupancy += 1

            for value in [speed, density, flow]:
                if value is not None and value < 0:
                    invalid_numeric += 1

            # Quality flag
            if row["data_quality"] not in {
                "normal",
                "low_sample",
            }:
                invalid_quality += 1

            # Target flag
            if row["travel_time_valid"] not in {"0", "1"}:
                invalid_travel_target += 1

    print()
    print("=" * 75)
    print("CLEAN TRAFFIC STATE VALIDATION")
    print("=" * 75)

    print(f"Rows              : {total_rows:,}")
    print(f"Scenarios         : {len(scenarios):,}")
    print(f"Missing values    : {missing_values:,}")
    print(f"Invalid numeric   : {invalid_numeric:,}")
    print(f"Invalid occupancy : {invalid_occupancy:,}")
    print(f"Invalid quality   : {invalid_quality:,}")
    print(f"Invalid target flag: {invalid_travel_target:,}")

    print()
    print("Scenario coverage")
    print("-" * 75)

    coverage_ok = True

    for scenario in sorted(scenarios):
        row_count = scenarios[scenario]["rows"]
        interval_count = len(scenarios[scenario]["intervals"])

        status = "OK"

        if interval_count != EXPECTED_INTERVALS:
            status = "BAD"
            coverage_ok = False

        print(
            f"{scenario:<40} "
            f"rows={row_count:>9,} "
            f"intervals={interval_count:>3} "
            f"{status}"
        )

    print()
    print("=" * 75)

    all_ok = (
        total_rows > 0
        and len(scenarios) == EXPECTED_SCENARIOS
        and coverage_ok
        and missing_values == 0
        and invalid_numeric == 0
        and invalid_occupancy == 0
        and invalid_quality == 0
        and invalid_travel_target == 0
    )

    if all_ok:
        print("RESULT: CLEAN TRAFFIC STATE VALID")
    else:
        print("RESULT: VALIDATION FAILED")

    print("=" * 75)


if __name__ == "__main__":
    main()