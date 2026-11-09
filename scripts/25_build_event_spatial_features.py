import csv
import math
import xml.etree.ElementTree as ET
from pathlib import Path

NET_FILE = Path("data/raw/sumo_network/guntur_city.net.xml")
EVENT_LOCATIONS = Path("data/scenarios/events/event_locations.csv")
OUTPUT = Path("data/processed/event_spatial_features.csv")

RADIUS_M = 1000.0


def midpoint(shape):
    points = []

    for pair in shape.strip().split():
        x, y = pair.split(",")
        points.append((float(x), float(y)))

    if not points:
        return None

    return points[len(points) // 2]


def load_edges():
    tree = ET.parse(NET_FILE)
    root = tree.getroot()

    edges = {}

    for edge in root.findall("edge"):
        edge_id = edge.attrib.get("id")

        if not edge_id:
            continue

        if edge.attrib.get("function") == "internal":
            continue

        lanes = edge.findall("lane")

        if not lanes:
            continue

        shape = lanes[0].attrib.get("shape")

        if not shape:
            continue

        point = midpoint(shape)

        if point:
            edges[edge_id] = point

    return edges


def distance(a, b):
    return math.hypot(
        a[0] - b[0],
        a[1] - b[1]
    )


def main():

    print("Loading network...")
    edges = load_edges()

    print(f"Road edges : {len(edges):,}")

    locations = {}

    with EVENT_LOCATIONS.open(
        "r",
        encoding="utf-8",
        newline=""
    ) as f:

        for row in csv.DictReader(f):

            event_edge = row["sumo_edge_id"]

            if event_edge not in edges:
                raise RuntimeError(
                    f"Event edge not found: {event_edge}"
                )

            locations[row["event_location_id"]] = row

    results = []

    for location_id, location in locations.items():

        event_point = edges[
            location["sumo_edge_id"]
        ]

        nearby = 0

        for edge_id, edge_point in edges.items():

            d = distance(
                event_point,
                edge_point
            )

            if d <= RADIUS_M:

                nearby += 1

                results.append({
                    "event_location_id": location_id,
                    "event_name": location["name"],
                    "event_edge": location["sumo_edge_id"],
                    "edge_id": edge_id,
                    "distance_to_event_m": round(d, 2),

                    "within_250m": int(d <= 250),
                    "within_500m": int(d <= 500),
                    "within_1000m": int(d <= 1000),

                    "distance_weight": round(
                        max(0.0, 1.0 - d / RADIUS_M),
                        6
                    )
                })

        print(
            f"{location_id} | "
            f"nearby edges: {nearby:,}"
        )

    OUTPUT.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    with OUTPUT.open(
        "w",
        encoding="utf-8",
        newline=""
    ) as f:

        writer = csv.DictWriter(
            f,
            fieldnames=list(results[0].keys())
        )

        writer.writeheader()
        writer.writerows(results)

    print()
    print("=" * 70)
    print("EVENT SPATIAL FEATURE DATASET")
    print("=" * 70)
    print(f"Locations : {len(locations)}")
    print(f"Rows      : {len(results):,}")
    print(f"Output    : {OUTPUT}")


if __name__ == "__main__":
    main()
