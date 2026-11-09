import csv
import gzip
from pathlib import Path

TRAFFIC = Path("data/processed/event_traffic_1km.csv.gz")
SPATIAL = Path("data/processed/event_spatial_features.csv")
SCENARIOS = Path("data/processed/event_scenario_features.csv")
OUTPUT = Path("data/processed/event_prediction_targets.csv.gz")

HORIZONS = [5, 10, 15, 30, 45, 60]

# ------------------------------------------------------------
# Load spatial features
# ------------------------------------------------------------

spatial = {}

with SPATIAL.open("r", encoding="utf-8", newline="") as f:
    for row in csv.DictReader(f):
        key = (
            row["event_location_id"],
            row["edge_id"]
        )

        spatial[key] = row

print(f"Spatial mappings: {len(spatial):,}")


# ------------------------------------------------------------
# Load scenario features
# ------------------------------------------------------------

scenario_features = {}

with SCENARIOS.open("r", encoding="utf-8", newline="") as f:
    for row in csv.DictReader(f):
        scenario_features[row["scenario_id"]] = row

print(f"Scenario features: {len(scenario_features):,}")


# ------------------------------------------------------------
# Load event traffic into memory
#
# 366k rows is small enough for this.
# ------------------------------------------------------------

traffic = {}

with gzip.open(
    TRAFFIC,
    "rt",
    encoding="utf-8",
    newline=""
) as f:

    for row in csv.DictReader(f):

        key = (
            row["scenario_id"],
            row["edge_id"],
            int(float(row["interval_begin"]))
        )

        traffic[key] = row

print(f"Traffic observations: {len(traffic):,}")


# ------------------------------------------------------------
# Build prediction rows
# ------------------------------------------------------------

fields = [
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


OUTPUT.parent.mkdir(parents=True, exist_ok=True)

total = 0
by_horizon = {h: 0 for h in HORIZONS}

with gzip.open(
    OUTPUT,
    "wt",
    encoding="utf-8",
    newline=""
) as out:

    writer = csv.DictWriter(
        out,
        fieldnames=fields
    )

    writer.writeheader()

    for key, current in traffic.items():

        scenario_id, edge_id, current_time = key

        event_location_id = scenario_id.split("_")[1]

        sf = spatial.get(
            (event_location_id, edge_id)
        )

        if sf is None:
            continue

        scenario = scenario_features.get(
            scenario_id
        )

        if scenario is None:
            continue

        for horizon in HORIZONS:

            future_time = current_time + horizon * 60

            future_key = (
                scenario_id,
                edge_id,
                future_time
            )

            future = traffic.get(future_key)

            if future is None:
                continue

            writer.writerow({

                "scenario_id": scenario_id,
                "event_location_id": event_location_id,
                "seed": scenario["seed"],
                "edge_id": edge_id,

                "current_time": current_time,
                "future_time": future_time,
                "horizon_minutes": horizon,

                "current_speed": current["speed"],
                "current_density": current["density"],
                "current_occupancy": current["occupancy"],
                "current_flow": current["flow"],
                "current_travel_time": current["travel_time"],
                "current_waiting_time": current["waiting_time"],
                "current_time_loss": current["time_loss"],

                "future_speed": future["speed"],
                "future_density": future["density"],
                "future_occupancy": future["occupancy"],
                "future_flow": future["flow"],
                "future_travel_time": future["travel_time"],
                "future_waiting_time": future["waiting_time"],
                "future_time_loss": future["time_loss"],

                "distance_to_event_m":
                    sf["distance_to_event_m"],

                "within_250m":
                    sf["within_250m"],

                "within_500m":
                    sf["within_500m"],

                "within_1000m":
                    sf["within_1000m"],

                "distance_weight":
                    sf["distance_weight"],

                "event_type":
                    scenario["event_type"],

                "event_size":
                    scenario["event_size"],

                "attendance":
                    scenario["attendance"],

                "event_duration_min":
                    scenario["event_duration_min"],

                "event_start_minute":
                    scenario["event_start_minute"],

                "event_arrival_rate":
                    scenario["event_arrival_rate"],

                "event_departure_rate":
                    scenario["event_departure_rate"],
            })

            total += 1
            by_horizon[horizon] += 1


print()
print("=" * 70)
print("EVENT PREDICTION DATASET")
print("=" * 70)
print(f"Rows : {total:,}")

for h in HORIZONS:
    print(
        f"Horizon {h:2d} min : "
        f"{by_horizon[h]:,}"
    )

print(f"Output: {OUTPUT}")

size_mb = OUTPUT.stat().st_size / (1024 * 1024)

print(f"File size: {size_mb:.2f} MB")
