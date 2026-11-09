import csv
import gzip
import random
from collections import defaultdict
from pathlib import Path

INPUT = Path("data/processed/event_prediction_targets.csv.gz")
OUTPUT = Path("data/processed/event_prediction_targets_reduced.csv.gz")

MAX_PER_GROUP = 1000
SEED = 42

random.seed(SEED)

groups = defaultdict(list)

print("Loading event prediction dataset...")

with gzip.open(INPUT, "rt", encoding="utf-8", newline="") as f:

    reader = csv.DictReader(f)

    for row in reader:

        try:
            speed = float(row["current_speed"])
            density = float(row["current_density"])
            occupancy = float(row["current_occupancy"])
            flow = float(row["current_flow"])
            travel_time = float(row["current_travel_time"])
            waiting = float(row["current_waiting_time"])
            time_loss = float(row["current_time_loss"])

            future_speed = float(row["future_speed"])
            future_density = float(row["future_density"])
            future_occupancy = float(row["future_occupancy"])
            future_flow = float(row["future_flow"])
            future_travel_time = float(row["future_travel_time"])
            future_waiting = float(row["future_waiting_time"])
            future_time_loss = float(row["future_time_loss"])

            sampled = float(row["sampled_seconds"]) if "sampled_seconds" in row else 1.0

        except (ValueError, KeyError):
            continue

        values = [
            speed, density, occupancy, flow,
            travel_time, waiting, time_loss,
            future_speed, future_density, future_occupancy,
            future_flow, future_travel_time,
            future_waiting, future_time_loss
        ]

        if any(v != v for v in values):
            continue

        # Remove clearly unusable observations.
        if speed < 0 or speed > 40:
            continue

        if future_speed < 0 or future_speed > 40:
            continue

        if density < 0 or future_density < 0:
            continue

        if occupancy < 0 or occupancy > 100:
            continue

        if future_occupancy < 0 or future_occupancy > 100:
            continue

        if flow < 0 or future_flow < 0:
            continue

        if travel_time < 0 or travel_time > 3600:
            continue

        if future_travel_time < 0 or future_travel_time > 3600:
            continue

        if waiting < 0 or waiting > 3600:
            continue

        if future_waiting < 0 or future_waiting > 3600:
            continue

        if time_loss < 0 or time_loss > 3600:
            continue

        if future_time_loss < 0 or future_time_loss > 3600:
            continue

        # Prefer observations with stronger sampling support.
        row["_sample_score"] = sampled

        key = (
            row["scenario_id"],
            row["horizon_minutes"]
        )

        groups[key].append(row)


print(f"Valid quality groups: {len(groups)}")

selected = []

for key, rows in sorted(groups.items()):

    # Sort by sampling quality first.
    rows.sort(
        key=lambda r: float(r["_sample_score"]),
        reverse=True
    )

    if len(rows) <= MAX_PER_GROUP:
        chosen = rows
    else:
        # Divide candidates into time buckets so selection
        # does not concentrate on only one part of the event.
        buckets = defaultdict(list)

        for row in rows:
            current_time = int(row["current_time"])
            bucket = current_time // 600
            buckets[bucket].append(row)

        chosen = []

        bucket_items = list(buckets.items())

        # Round-robin through time buckets.
        index = 0

        while len(chosen) < MAX_PER_GROUP:

            added = False

            for _, bucket_rows in bucket_items:

                if index < len(bucket_rows):

                    chosen.append(bucket_rows[index])
                    added = True

                    if len(chosen) >= MAX_PER_GROUP:
                        break

            if not added:
                break

            index += 1

    selected.extend(chosen)

    print(
        f"{key[0]} | {key[1]} min | "
        f"quality rows={len(rows):,} | "
        f"selected={len(chosen):,}"
    )


# Remove internal field.
for row in selected:
    row.pop("_sample_score", None)


# Deterministic ordering.
selected.sort(
    key=lambda r: (
        r["scenario_id"],
        int(r["horizon_minutes"]),
        int(r["current_time"]),
        r["edge_id"]
    )
)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)

with gzip.open(
    OUTPUT,
    "wt",
    encoding="utf-8",
    newline=""
) as f:

    writer = csv.DictWriter(
        f,
        fieldnames=selected[0].keys()
    )

    writer.writeheader()
    writer.writerows(selected)


print()
print("=" * 70)
print("BEST EVENT PREDICTION DATASET")
print("=" * 70)
print(f"Original rows : 1,020,885")
print(f"Selected rows : {len(selected):,}")
print(f"Target/group  : {MAX_PER_GROUP:,}")
print(f"Groups        : {len(groups):,}")
print(f"Output        : {OUTPUT}")

size_mb = OUTPUT.stat().st_size / (1024 * 1024)

print(f"File size     : {size_mb:.2f} MB")
