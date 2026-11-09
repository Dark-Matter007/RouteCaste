import csv
import os
import xml.etree.ElementTree as ET

NET_FILE = "data/raw/sumo_network/guntur_city.net.xml"
OUTPUT_FILE = "data/processed/road_features.csv"

os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

print("=" * 80)
print("EXTRACTING SUMO ROAD FEATURES")
print("=" * 80)
print(f"Network : {NET_FILE}")
print(f"Output  : {OUTPUT_FILE}")
print()

with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as out:

    writer = csv.writer(out)

    writer.writerow([
        "edge_id",
        "from_node",
        "to_node",
        "length",
        "lanes",
        "speed_limit",
        "road_type",
        "capacity",
    ])

    count = 0

    for event, elem in ET.iterparse(NET_FILE, events=("end",)):

        if elem.tag != "edge":
            continue

        edge_id = elem.get("id")

        # Skip SUMO internal edges
        if edge_id.startswith(":"):
            elem.clear()
            continue

        from_node = elem.get("from", "")
        to_node = elem.get("to", "")

        lanes = elem.findall("lane")

        if not lanes:
            elem.clear()
            continue

        # SUMO edge-level length
        try:
            length = float(lanes[0].get("length", 0))
        except (TypeError, ValueError):
            length = 0.0

        # Number of lanes
        lane_count = len(lanes)

        # Speed limit
        try:
            speed_limit = float(lanes[0].get("speed", 0))
        except (TypeError, ValueError):
            speed_limit = 0.0

        # Road type
        road_type = elem.get("type", "")

        # Capacity proxy:
        # approximate hourly capacity using lane count.
        #
        # This is a modeling assumption, not measured Guntur
        # traffic capacity.
        capacity = lane_count * 1800.0

        writer.writerow([
            edge_id,
            from_node,
            to_node,
            round(length, 3),
            lane_count,
            round(speed_limit, 3),
            road_type,
            round(capacity, 1),
        ])

        count += 1

        if count % 10000 == 0:
            print(f"Processed edges: {count:,}")

        elem.clear()

print()
print("=" * 80)
print("ROAD FEATURE EXTRACTION COMPLETE")
print("=" * 80)
print(f"Edges written : {count:,}")
print(f"Output        : {OUTPUT_FILE}")
print("=" * 80)