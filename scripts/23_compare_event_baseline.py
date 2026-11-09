import xml.etree.ElementTree as ET
from pathlib import Path
import csv
import statistics
import math
import re

EDGE_DIR = Path("data/simulation/edge")
NET_FILE = Path("data/raw/sumo_network/guntur_city.net.xml")
EVENT_LOCATIONS = Path("data/scenarios/events/event_locations.csv")
OUTPUT = Path("data/processed/event_baseline_paired_impact.csv")

EVENT_PATTERN = "event_E*_concert_large_normal_evening_peak_seed*.edge.xml"
RADIUS_M = 1000.0


def midpoint_from_shape(shape):
    points = []

    for pair in shape.strip().split():
        x, y = pair.split(",")
        points.append((float(x), float(y)))

    if not points:
        return None

    return points[len(points) // 2]


def load_edge_midpoints():
    tree = ET.parse(NET_FILE)
    root = tree.getroot()

    edge_midpoints = {}

    for edge in root.findall("edge"):
        edge_id = edge.attrib.get("id")

        if not edge_id or edge.attrib.get("function") == "internal":
            continue

        lanes = edge.findall("lane")

        if not lanes:
            continue

        shape = lanes[0].attrib.get("shape")

        if not shape:
            continue

        midpoint = midpoint_from_shape(shape)

        if midpoint:
            edge_midpoints[edge_id] = midpoint

    return edge_midpoints


def distance(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def find_nearby_edges(edge_midpoints, event_edge):
    if event_edge not in edge_midpoints:
        raise RuntimeError(
            f"Event edge not found: {event_edge}"
        )

    event_point = edge_midpoints[event_edge]

    return {
        edge_id
        for edge_id, point in edge_midpoints.items()
        if distance(event_point, point) <= RADIUS_M
    }


def read_edge_data(path, allowed_edges):
    tree = ET.parse(path)
    root = tree.getroot()

    rows = {}

    for interval in root.findall("interval"):
        begin = float(interval.attrib["begin"])

        for edge in interval.findall("edge"):
            edge_id = edge.attrib["id"]

            if edge_id not in allowed_edges:
                continue

            key = (begin, edge_id)

            rows[key] = {
                "speed": float(edge.attrib.get("speed", 0)),
                "density": float(edge.attrib.get("density", 0)),
                "occupancy": float(edge.attrib.get("occupancy", 0)),
                "flow": float(
                    edge.attrib.get(
                        "entered",
                        edge.attrib.get("flow", 0)
                    )
                ),
                "traveltime": float(
                    edge.attrib.get("traveltime", 0)
                ),
                "waitingTime": float(
                    edge.attrib.get("waitingTime", 0)
                ),
                "timeLoss": float(
                    edge.attrib.get("timeLoss", 0)
                ),
            }

    return rows


def paired_impact(event_rows, baseline_rows):
    common_keys = set(event_rows) & set(baseline_rows)

    if not common_keys:
        raise RuntimeError(
            "No common edge-minute observations found"
        )

    metrics = [
        "speed",
        "density",
        "occupancy",
        "flow",
        "traveltime",
        "waitingTime",
        "timeLoss",
    ]

    deltas = {metric: [] for metric in metrics}

    for key in common_keys:
        event = event_rows[key]
        baseline = baseline_rows[key]

        for metric in metrics:
            deltas[metric].append(
                event[metric] - baseline[metric]
            )

    return {
        metric: statistics.mean(values)
        for metric, values in deltas.items()
    }, len(common_keys)


def main():
    print("Loading SUMO network...")
    edge_midpoints = load_edge_midpoints()

    print(f"Road edges loaded : {len(edge_midpoints):,}")
    print(f"Analysis radius   : {RADIUS_M:.0f} m")
    print()

    event_locations = {}

    with EVENT_LOCATIONS.open(
        newline="",
        encoding="utf-8"
    ) as f:
        for row in csv.DictReader(f):
            event_locations[row["event_location_id"]] = row

    event_files = sorted(EDGE_DIR.glob(EVENT_PATTERN))

    if len(event_files) != 24:
        raise RuntimeError(
            f"Expected 24 event files, found {len(event_files)}"
        )

    results = []

    for i, event_file in enumerate(event_files, 1):

        match = re.search(
            r"event_(E\d+)_.*_seed(\d+)\.edge\.xml$",
            event_file.name
        )

        if not match:
            raise RuntimeError(
                f"Could not parse filename: {event_file.name}"
            )

        location = match.group(1)
        seed = match.group(2)

        event_edge = event_locations[location]["sumo_edge_id"]

        nearby_edges = find_nearby_edges(
            edge_midpoints,
            event_edge
        )

        baseline_file = (
            EDGE_DIR /
            f"baseline_normal_evening_peak_seed{seed}.edge.xml"
        )

        if not baseline_file.exists():
            raise FileNotFoundError(
                baseline_file
            )

        print(
            f"[{i:02d}/24] {location} seed{seed} | "
            f"loading..."
        )

        event_rows = read_edge_data(
            event_file,
            nearby_edges
        )

        baseline_rows = read_edge_data(
            baseline_file,
            nearby_edges
        )

        impact, common_records = paired_impact(
            event_rows,
            baseline_rows
        )

        results.append({
            "event_location_id": location,
            "seed": seed,
            "event_edge": event_edge,
            "radius_m": RADIUS_M,
            "nearby_edges": len(nearby_edges),
            "event_records": len(event_rows),
            "baseline_records": len(baseline_rows),
            "paired_records": common_records,

            "speed_change": impact["speed"],
            "density_change": impact["density"],
            "occupancy_change": impact["occupancy"],
            "flow_change": impact["flow"],
            "travel_time_change": impact["traveltime"],
            "waiting_time_change": impact["waitingTime"],
            "time_loss_change": impact["timeLoss"],
        })

    OUTPUT.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    with OUTPUT.open(
        "w",
        newline="",
        encoding="utf-8"
    ) as f:
        writer = csv.DictWriter(
            f,
            fieldnames=list(results[0].keys())
        )
        writer.writeheader()
        writer.writerows(results)

    print()
    print("=" * 75)
    print("PAIRED LOCAL EVENT IMPACT ANALYSIS")
    print("=" * 75)
    print(f"Scenarios          : {len(results)}")
    print(f"Radius             : {RADIUS_M:.0f} m")
    print(f"Output             : {OUTPUT}")
    print()

    for r in results:
        print(
            f"{r['event_location_id']} seed{r['seed']} | "
            f"paired {r['paired_records']:,} | "
            f"speed {r['speed_change']:+.2f} | "
            f"density {r['density_change']:+.2f} | "
            f"flow {r['flow_change']:+.2f} | "
            f"travel time {r['travel_time_change']:+.2f}"
        )


if __name__ == "__main__":
    main()
