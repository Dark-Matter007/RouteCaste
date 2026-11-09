import csv
from pathlib import Path

OUTPUT = Path("data/scenarios/events/event_scenario_matrix_pilot.csv")
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

locations = [f"E{i:02d}" for i in range(1, 9)]

# One representative event type and size first.
event_type = "concert"
event_size = "large"

# Evening peak is the most useful first pilot.
time_period = "evening_peak"

seeds = [101, 202, 303]

rows = []

for location in locations:
    for seed in seeds:
        rows.append({
            "scenario_id": f"event_{location}_{event_type}_{event_size}_normal_{time_period}_seed{seed}",
            "baseline_scenario": f"baseline_normal_{time_period}_seed{seed}",
            "event_location_id": location,
            "event_type": event_type,
            "event_size": event_size,
            "attendance": 5000,
            "time_period": time_period,
            "seed": seed,
            "event_duration_min": 120,
            "event_start_minute": 60,
            "event_arrival_rate": 0.35,
            "event_departure_rate": 0.35
        })

with OUTPUT.open("w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)

print(f"Created: {OUTPUT}")
print(f"Scenarios: {len(rows)}")
