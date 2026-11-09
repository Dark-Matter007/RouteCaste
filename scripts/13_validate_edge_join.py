import csv

TRAFFIC_FILE = "data/processed/traffic_state.csv"
ROAD_FILE = "data/processed/road_features.csv"

print("=" * 80)
print("EDGE JOIN VALIDATION")
print("=" * 80)

# ------------------------------------------------------------------
# Load road edge IDs
# ------------------------------------------------------------------

road_edges = set()

with open(ROAD_FILE, "r", encoding="utf-8", newline="") as f:

    reader = csv.DictReader(f)

    for row in reader:
        road_edges.add(row["edge_id"])

print(f"Road feature edges : {len(road_edges):,}")

# ------------------------------------------------------------------
# Scan traffic state
# ------------------------------------------------------------------

traffic_edges = set()
missing_edges = set()

total_rows = 0

with open(TRAFFIC_FILE, "r", encoding="utf-8", newline="") as f:

    reader = csv.DictReader(f)

    for row in reader:

        total_rows += 1

        edge_id = row["edge_id"]

        traffic_edges.add(edge_id)

        if edge_id not in road_edges:
            missing_edges.add(edge_id)

print()
print(f"Traffic rows       : {total_rows:,}")
print(f"Unique traffic edges: {len(traffic_edges):,}")
print(f"Missing road edges : {len(missing_edges):,}")

print()
print("=" * 80)

if missing_edges:

    print("RESULT: EDGE JOIN FAILED")
    print()
    print("First missing edges:")

    for edge in sorted(missing_edges)[:20]:
        print(f"  {edge}")

else:

    print("RESULT: EDGE JOIN VALID")
    print("All traffic-state edges exist in road_features.csv")

print("=" * 80)