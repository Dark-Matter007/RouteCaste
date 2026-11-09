import csv
import random
import xml.etree.ElementTree as ET
from pathlib import Path


BASELINE_FILE = Path(
    "data/scenarios/baseline/"
    "baseline_normal_evening_peak_seed101.validated.rou.xml"
)

EVENT_LOCATIONS_FILE = Path(
    "data/scenarios/events/event_locations.csv"
)

OUTPUT_FILE = Path(
    "data/scenarios/events/"
    "event_E01_concert_large_normal_evening_seed101.rou.xml"
)

EVENT_ID = "E01"
EVENT_TYPE = "concert"
EVENT_SIZE = "large"
ATTENDANCE = 5000
SEED = 101

EVENT_START = 18 * 3600
EVENT_END = 20 * 3600

ARRIVAL_START = 17 * 3600
ARRIVAL_END = EVENT_START

DEPARTURE_START = EVENT_END
DEPARTURE_END = 21 * 3600

EVENT_EDGE = "-847952300#1"

# Real edges immediately entering the E01 zone.
INCOMING_EDGES = [
    "-411288632",
    "-411288669",
    "-847952300#3",
]

# Real edges immediately leaving the E01 zone.
OUTGOING_EDGES = [
    "-847952300#0",
    "418875041",
    "847952300#1",
]

# Modelling assumptions.
# These are NOT measured Guntur traffic statistics.
MODE_COUNTS = {
    "car": 1023,
    "motorcycle": 1042,
    "bus": 15,
    "truck": 0,
}


def load_baseline():
    tree = ET.parse(BASELINE_FILE)
    root = tree.getroot()

    trips = root.findall("trip")

    if not trips:
        raise RuntimeError("Baseline contains no trips.")

    return tree, root, trips


def load_event_edge():
    with EVENT_LOCATIONS_FILE.open(
        "r",
        encoding="utf-8",
        newline=""
    ) as f:
        rows = list(csv.DictReader(f))

    for row in rows:
        if row["event_location_id"] == EVENT_ID:
            return row["sumo_edge_id"]

    raise RuntimeError(
        f"Event location {EVENT_ID} not found."
    )


def weighted_time(rng, start, end):
    """
    Generates a time concentrated around the middle
    of the event arrival/departure window.
    """
    midpoint = (start + end) / 2
    spread = (end - start) / 5

    value = rng.gauss(midpoint, spread)

    return max(start, min(end - 1, value))


def create_trip(
    trip_id,
    vehicle_type,
    depart,
    origin,
    destination
):
    return ET.Element(
        "trip",
        {
            "id": trip_id,
            "type": vehicle_type,
            "depart": f"{depart:.2f}",
            "from": origin,
            "to": destination,
            "departLane": "best",
            "departSpeed": "max",
        }
    )


def main():

    print("=" * 70)
    print("RouteCast Event Scenario Generator")
    print("=" * 70)

    rng = random.Random(SEED)

    # --------------------------------------------------------
    # Load baseline
    # --------------------------------------------------------

    tree, root, baseline_trips = load_baseline()

    print(f"Baseline trips: {len(baseline_trips)}")

    # --------------------------------------------------------
    # Verify event location
    # --------------------------------------------------------

    mapped_event_edge = load_event_edge()

    if mapped_event_edge != EVENT_EDGE:
        raise RuntimeError(
            f"Expected {EVENT_EDGE}, "
            f"but event_locations.csv contains "
            f"{mapped_event_edge}"
        )

    print(f"Event edge: {EVENT_EDGE}")

    # --------------------------------------------------------
    # Validate mode counts
    # --------------------------------------------------------

    total_event_vehicles = sum(MODE_COUNTS.values())

    print()
    print("Event vehicle demand:")
    for mode, count in MODE_COUNTS.items():
        print(f"  {mode:12s}: {count}")

    print(f"  {'TOTAL':12s}: {total_event_vehicles}")

    # --------------------------------------------------------
    # Create event arrivals
    # --------------------------------------------------------

    arrivals = []

    print()
    print("Generating event arrivals...")

    counter = 0

    for vehicle_type, count in MODE_COUNTS.items():

        for _ in range(count):

            origin = rng.choice(INCOMING_EDGES)

            depart = weighted_time(
                rng,
                ARRIVAL_START,
                ARRIVAL_END
            )

            trip_id = (
                f"event_{EVENT_ID}_{EVENT_TYPE}_"
                f"arrival_{SEED}_{counter:05d}"
            )

            arrivals.append(
                create_trip(
                    trip_id,
                    vehicle_type,
                    depart,
                    origin,
                    EVENT_EDGE
                )
            )

            counter += 1

    print(f"Arrivals generated: {len(arrivals)}")

    # --------------------------------------------------------
    # Create event departures
    # --------------------------------------------------------

    departures = []

    print("Generating event departures...")

    counter = 0

    for vehicle_type, count in MODE_COUNTS.items():

        for _ in range(count):

            destination = rng.choice(OUTGOING_EDGES)

            depart = weighted_time(
                rng,
                DEPARTURE_START,
                DEPARTURE_END
            )

            trip_id = (
                f"event_{EVENT_ID}_{EVENT_TYPE}_"
                f"departure_{SEED}_{counter:05d}"
            )

            departures.append(
                create_trip(
                    trip_id,
                    vehicle_type,
                    depart,
                    EVENT_EDGE,
                    destination
                )
            )

            counter += 1

    print(f"Departures generated: {len(departures)}")

    # --------------------------------------------------------
    # Combine
    # --------------------------------------------------------

    all_trips = (
        list(baseline_trips)
        + arrivals
        + departures
    )

    all_trips.sort(
        key=lambda x: float(x.get("depart", "0"))
    )

    # Remove existing trips.
    for child in list(root):
        if child.tag == "trip":
            root.remove(child)

    # Add sorted trips.
    for trip in all_trips:
        root.append(trip)

    # --------------------------------------------------------
    # Metadata
    # --------------------------------------------------------

    root.insert(
        0,
        ET.Comment(
            f"RouteCast event scenario | "
            f"{EVENT_ID} | {EVENT_TYPE} | {EVENT_SIZE} | "
            f"attendance={ATTENDANCE} | seed={SEED}"
        )
    )

    # --------------------------------------------------------
    # Write
    # --------------------------------------------------------

    OUTPUT_FILE.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    tree.write(
        OUTPUT_FILE,
        encoding="UTF-8",
        xml_declaration=True
    )

    print()
    print("=" * 70)
    print("EVENT SCENARIO CREATED")
    print("=" * 70)
    print(f"Output          : {OUTPUT_FILE}")
    print(f"Baseline trips  : {len(baseline_trips)}")
    print(f"Event arrivals  : {len(arrivals)}")
    print(f"Event departures : {len(departures)}")
    print(f"Total trips     : {len(all_trips)}")
    print("=" * 70)


if __name__ == "__main__":
    main()