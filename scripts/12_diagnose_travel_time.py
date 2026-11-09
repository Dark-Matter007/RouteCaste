import csv

FILE = "data/processed/traffic_state.csv"

TRAVEL_TIME_THRESHOLD = 300
MAX_EXAMPLES = 100

count = 0
examples = []

with open(FILE, "r", encoding="utf-8", newline="") as f:

    reader = csv.DictReader(f)

    for row in reader:

        travel_time = float(row["travel_time"])

        if travel_time <= TRAVEL_TIME_THRESHOLD:
            continue

        count += 1

        if len(examples) < MAX_EXAMPLES:

            examples.append({
                "scenario": row["scenario_id"],
                "time": float(row["interval_begin"]),
                "edge": row["edge_id"],
                "sampled_seconds": float(row["sampled_seconds"]),
                "travel_time": travel_time,
                "speed": float(row["speed"]),
                "density": float(row["density"]),
                "occupancy": float(row["occupancy"]),
                "flow": float(row["flow"]),
            })


print()
print("=" * 120)
print("TRAVEL TIME DIAGNOSTIC")
print("=" * 120)

print(f"Rows with travel_time > {TRAVEL_TIME_THRESHOLD}s : {count:,}")
print()

print(
    f"{'Scenario':<32}"
    f"{'Time':>10}"
    f"{'Edge':<20}"
    f"{'SampleSec':>12}"
    f"{'TravelTime':>12}"
    f"{'Speed':>10}"
    f"{'Density':>12}"
    f"{'Occupancy':>12}"
    f"{'Flow':>10}"
)

print("-" * 120)

for x in examples:

    print(
        f"{x['scenario']:<32}"
        f"{x['time']:>10.0f}"
        f"{x['edge']:<20}"
        f"{x['sampled_seconds']:>12.2f}"
        f"{x['travel_time']:>12.2f}"
        f"{x['speed']:>10.2f}"
        f"{x['density']:>12.2f}"
        f"{x['occupancy']:>12.2f}"
        f"{x['flow']:>10.2f}"
    )

print()
print("=" * 120)
print("RESULT: DIAGNOSTIC COMPLETE")
print(f"Showing first {len(examples)} extreme rows.")
print("=" * 120)