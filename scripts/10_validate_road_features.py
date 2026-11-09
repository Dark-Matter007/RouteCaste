import csv
from collections import Counter

FILE = "data/processed/road_features.csv"

required = [
    "edge_id",
    "from_node",
    "to_node",
    "length",
    "lanes",
    "speed_limit",
    "road_type",
    "capacity",
]

rows = 0
edge_ids = set()

missing = Counter()
invalid_length = 0
invalid_lanes = 0
invalid_speed = 0
invalid_capacity = 0

road_types = Counter()

with open(FILE, "r", encoding="utf-8", newline="") as f:

    reader = csv.DictReader(f)

    if not reader.fieldnames:
        raise RuntimeError("CSV has no header")

    missing_columns = [
        c for c in required
        if c not in reader.fieldnames
    ]

    if missing_columns:
        raise RuntimeError(
            f"Missing columns: {missing_columns}"
        )

    for row in reader:

        rows += 1

        edge_id = row["edge_id"]

        if edge_id in edge_ids:
            print(f"WARNING: duplicate edge_id: {edge_id}")

        edge_ids.add(edge_id)

        for column in required:
            if row[column] == "":
                missing[column] += 1

        try:
            length = float(row["length"])
            if length <= 0:
                invalid_length += 1
        except ValueError:
            invalid_length += 1

        try:
            lanes = int(row["lanes"])
            if lanes <= 0:
                invalid_lanes += 1
        except ValueError:
            invalid_lanes += 1

        try:
            speed = float(row["speed_limit"])
            if speed <= 0:
                invalid_speed += 1
        except ValueError:
            invalid_speed += 1

        try:
            capacity = float(row["capacity"])
            if capacity <= 0:
                invalid_capacity += 1
        except ValueError:
            invalid_capacity += 1

        road_types[row["road_type"]] += 1


print()
print("=" * 80)
print("ROAD FEATURE VALIDATION")
print("=" * 80)

print(f"Rows              : {rows:,}")
print(f"Unique edge IDs   : {len(edge_ids):,}")

print()
print("Missing values:")
print("-" * 80)

for column in required:
    print(f"{column:<20}: {missing[column]:,}")

print()
print("Numeric validation:")
print("-" * 80)

print(f"Invalid length    : {invalid_length:,}")
print(f"Invalid lanes     : {invalid_lanes:,}")
print(f"Invalid speed     : {invalid_speed:,}")
print(f"Invalid capacity  : {invalid_capacity:,}")

print()
print("Top road types:")
print("-" * 80)

for road_type, count in road_types.most_common(20):
    print(f"{road_type:<35} {count:>8,}")

print()
print("=" * 80)

failed = False

if rows != 66597:
    print("FAILED: Expected 66,597 road edges")
    failed = True

if len(edge_ids) != rows:
    print("FAILED: Duplicate edge IDs detected")
    failed = True

if sum(missing.values()) > 0:
    print("FAILED: Missing values detected")
    failed = True

if invalid_length > 0:
    print("FAILED: Invalid edge lengths detected")
    failed = True

if invalid_lanes > 0:
    print("FAILED: Invalid lane counts detected")
    failed = True

if invalid_speed > 0:
    print("FAILED: Invalid speed limits detected")
    failed = True

if invalid_capacity > 0:
    print("FAILED: Invalid capacities detected")
    failed = True

if not failed:
    print("RESULT: ROAD FEATURES VALID")
else:
    print("RESULT: ROAD FEATURE VALIDATION FAILED")

print("=" * 80)