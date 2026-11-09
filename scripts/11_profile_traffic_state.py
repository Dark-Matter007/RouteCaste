import csv
import math

FILE = "data/processed/traffic_state.csv"

NUMERIC_COLUMNS = [
    "speed",
    "density",
    "occupancy",
    "flow",
    "waiting_time",
    "time_loss",
    "speed_relative",
    "travel_time",
]

stats = {
    column: {
        "count": 0,
        "min": float("inf"),
        "max": float("-inf"),
        "sum": 0.0,
        "invalid": 0,
    }
    for column in NUMERIC_COLUMNS
}

scenario_count = 0
scenarios = set()

intervals = set()

with open(FILE, "r", encoding="utf-8", newline="") as f:

    reader = csv.DictReader(f)

    for row in reader:

        scenario = row["scenario_id"]
        scenarios.add(scenario)

        intervals.add(
            (scenario, row["interval_begin"])
        )

        for column in NUMERIC_COLUMNS:

            value_text = row[column]

            try:
                value = float(value_text)

                if not math.isfinite(value):
                    raise ValueError

                s = stats[column]

                s["count"] += 1
                s["sum"] += value

                if value < s["min"]:
                    s["min"] = value

                if value > s["max"]:
                    s["max"] = value

            except (ValueError, TypeError):

                stats[column]["invalid"] += 1


print()
print("=" * 90)
print("TRAFFIC STATE NUMERIC PROFILE")
print("=" * 90)

print(f"Scenarios          : {len(scenarios)}")
print(f"Scenario intervals : {len(intervals):,}")

print()
print(
    f"{'Column':<22}"
    f"{'Count':>15}"
    f"{'Min':>15}"
    f"{'Max':>15}"
    f"{'Mean':>15}"
    f"{'Invalid':>12}"
)

print("-" * 90)

failed = False

for column in NUMERIC_COLUMNS:

    s = stats[column]

    mean = (
        s["sum"] / s["count"]
        if s["count"] > 0
        else float("nan")
    )

    print(
        f"{column:<22}"
        f"{s['count']:>15,}"
        f"{s['min']:>15.4f}"
        f"{s['max']:>15.4f}"
        f"{mean:>15.4f}"
        f"{s['invalid']:>12,}"
    )

    if s["invalid"] > 0:
        failed = True


print()
print("=" * 90)

if failed:
    print("RESULT: INVALID NUMERIC VALUES FOUND")
else:
    print("RESULT: NUMERIC PROFILE COMPLETE")

print("=" * 90)