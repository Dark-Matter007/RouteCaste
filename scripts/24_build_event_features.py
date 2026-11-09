import csv
from pathlib import Path

MATRIX = Path("data/scenarios/events/event_scenario_matrix_pilot.csv")
LOCATIONS = Path("data/scenarios/events/event_locations.csv")
OUTPUT = Path("data/processed/event_scenario_features.csv")

locations = {}

with LOCATIONS.open("r", encoding="utf-8", newline="") as f:
    for row in csv.DictReader(f):
        locations[row["event_location_id"]] = row

results = []

with MATRIX.open("r", encoding="utf-8", newline="") as f:
    for row in csv.DictReader(f):

        location_id = row["event_location_id"]
        location = locations[location_id]

        results.append({
            "scenario_id": row["scenario_id"],
            "baseline_scenario": row["baseline_scenario"],
            "event_location_id": location_id,
            "event_name": location["name"],
            "event_category": location["category"],
            "latitude": location["latitude"],
            "longitude": location["longitude"],
            "event_edge": location["sumo_edge_id"],
            "event_road_type": location["road_type"],
            "mapping_distance_m": location["mapping_distance_m"],

            "event_type": row["event_type"],
            "event_size": row["event_size"],
            "attendance": row["attendance"],
            "time_period": row["time_period"],
            "seed": row["seed"],
            "event_duration_min": row["event_duration_min"],
            "event_start_minute": row["event_start_minute"],
            "event_arrival_rate": row["event_arrival_rate"],
            "event_departure_rate": row["event_departure_rate"],
        })

OUTPUT.parent.mkdir(parents=True, exist_ok=True)

with OUTPUT.open("w", encoding="utf-8", newline="") as f:
    writer = csv.DictWriter(
        f,
        fieldnames=list(results[0].keys())
    )
    writer.writeheader()
    writer.writerows(results)

print("=" * 70)
print("EVENT SCENARIO FEATURE DATASET")
print("=" * 70)
print(f"Scenarios : {len(results)}")
print(f"Locations : {len(set(r['event_location_id'] for r in results))}")
print(f"Output    : {OUTPUT}")
print()

for r in results[:3]:
    print(
        f"{r['scenario_id']} | "
        f"{r['event_location_id']} | "
        f"{r['event_type']} | "
        f"{r['attendance']} people | "
        f"seed{r['seed']}"
    )
