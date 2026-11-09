import sys
import sys
import csv
import random
import xml.etree.ElementTree as ET
from pathlib import Path

BASE = Path("data/scenarios/baseline")
EVENTS = Path("data/scenarios/events")
LOCATIONS_FILE = EVENTS / "event_locations.csv"

BASELINE_TRIPS = 3000
ATTENDANCE = 5000
EVENT_DURATION = 120

EVENT_START_MINUTE = 60
ARRIVAL_WINDOW_MINUTES = 60
DEPARTURE_WINDOW_MINUTES = 60

VEHICLE_OCCUPANCY = {
    "car": 2.2,
    "motorcycle": 1.2,
    "bus": 35.0,
}

VEHICLE_SHARE = {
    "car": 0.45,
    "motorcycle": 0.25,
    "bus": 0.30,
}


def load_locations():
    with LOCATIONS_FILE.open(encoding="utf-8") as f:
        return {
            row["event_location_id"]: row
            for row in csv.DictReader(f)
        }


def calculate_event_vehicles(attendance):
    return {
        vehicle_type: round(
            attendance
            * VEHICLE_SHARE[vehicle_type]
            / VEHICLE_OCCUPANCY[vehicle_type]
        )
        for vehicle_type in VEHICLE_SHARE
    }


def read_baseline(path):
    tree = ET.parse(path)
    root = tree.getroot()

    trips = root.findall("trip")

    if len(trips) != BASELINE_TRIPS:
        raise RuntimeError(
            f"{path.name}: expected {BASELINE_TRIPS} trips, "
            f"found {len(trips)}"
        )

    return root, trips


def generate_scenario(location_id, seed):
    locations = load_locations()

    if location_id not in locations:
        raise RuntimeError(
            f"Unknown event location: {location_id}"
        )

    location = locations[location_id]
    event_edge = location["sumo_edge_id"]

    baseline_path = (
        BASE
        / f"baseline_normal_evening_peak_seed{seed}.validated.rou.xml"
    )

    if not baseline_path.exists():
        raise FileNotFoundError(baseline_path)

    root, baseline_trips = read_baseline(baseline_path)

    # Group baseline trips by vehicle type.
    trips_by_type = {}

    for trip in baseline_trips:
        vehicle_type = trip.attrib["type"]
        trips_by_type.setdefault(vehicle_type, []).append(trip)

    counts = calculate_event_vehicles(ATTENDANCE)

    scenario_id = (
        f"event_{location_id}_concert_large_normal_"
        f"evening_peak_seed{seed}"
    )

    output = EVENTS / f"{scenario_id}.trips.xml"

    out_root = ET.Element("routes")

    # Preserve original vehicle definitions.
    for vtype in root.findall("vType"):
        out_root.append(
            ET.fromstring(ET.tostring(vtype))
        )

    # Preserve all validated baseline trips exactly.
    for trip in baseline_trips:
        out_root.append(
            ET.fromstring(ET.tostring(trip))
        )

    rng = random.Random(seed)

    event_arrivals = 0
    event_departures = 0

    for vehicle_type, count in counts.items():

        compatible_trips = trips_by_type.get(vehicle_type, [])

        if not compatible_trips:
            raise RuntimeError(
                f"No validated baseline trips for type={vehicle_type}"
            )

        # -------------------------
        # Event arrivals
        # -------------------------
        for i in range(count):

            source = rng.choice(compatible_trips)

            depart = (
                17 * 3600
                + EVENT_START_MINUTE * 60
                + rng.randint(
                    0,
                    ARRIVAL_WINDOW_MINUTES * 60 - 1
                )
            )

            trip = ET.Element(
                "trip",
                {
                    "id": (
                        f"{scenario_id}_arrival_"
                        f"{vehicle_type}_{i:05d}"
                    ),
                    "type": vehicle_type,
                    "depart": str(depart),
                    "from": source.attrib["from"],
                    "to": event_edge,
                },
            )

            out_root.append(trip)
            event_arrivals += 1

        # -------------------------
        # Event departures
        # -------------------------
        for i in range(count):

            source = rng.choice(compatible_trips)

            depart = (
                17 * 3600
                + (
                    EVENT_START_MINUTE
                    + ARRIVAL_WINDOW_MINUTES
                ) * 60
                + rng.randint(
                    0,
                    DEPARTURE_WINDOW_MINUTES * 60 - 1
                )
            )

            trip = ET.Element(
                "trip",
                {
                    "id": (
                        f"{scenario_id}_departure_"
                        f"{vehicle_type}_{i:05d}"
                    ),
                    "type": vehicle_type,
                    "depart": str(depart),
                    "from": event_edge,
                    "to": source.attrib["to"],
                },
            )

            out_root.append(trip)
            event_departures += 1

    # Sort every trip by departure time.
    out_root[:] = sorted(
        out_root,
        key=lambda x: float(x.attrib.get("depart", "0"))
    )

    ET.ElementTree(out_root).write(
        output,
        encoding="utf-8",
        xml_declaration=True
    )

    print()
    print(f"Created          : {output}")
    print(f"Event location   : {location_id}")
    print(f"Event edge       : {event_edge}")
    print(f"Attendance       : {ATTENDANCE}")
    print(f"Vehicle counts   : {counts}")
    print(f"Event arrivals   : {event_arrivals}")
    print(f"Event departures : {event_departures}")
    print(
        f"Event trips      : "
        f"{event_arrivals + event_departures}"
    )
    print(f"Baseline trips   : {len(baseline_trips)}")
    print(
        f"Total trips      : "
        f"{len(baseline_trips) + event_arrivals + event_departures}"
    )


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(
            "Usage: python scripts/22_generate_event_trips.py "
            "<event_location_id> <seed>"
        )

    generate_scenario(
        sys.argv[1],
        int(sys.argv[2])
    )