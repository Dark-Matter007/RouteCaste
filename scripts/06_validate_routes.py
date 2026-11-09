import random
import subprocess
from concurrent.futures import ProcessPoolExecutor
import xml.etree.ElementTree as ET
from pathlib import Path


# ============================================================
# Configuration
# ============================================================

DUAROUTER = Path(
    r"C:\Program Files (x86)\Eclipse\Sumo\bin\duarouter.exe"
)

NETWORK = Path(
    "data/raw/sumo_network/guntur_city.net.xml"
)

ROUTE_DIR = Path(
    "data/scenarios/baseline"
)


DEMAND_LEVELS = {
    "low": 1500,
    "normal": 3000,
    "high": 5000,
}


# Generate this many extra candidates whenever repair
# is required.
REPAIR_MULTIPLIER = 1.25

MAX_REPAIR_ROUNDS = 5

# Number of scenarios to process at the same time.
# Your laptop has 4 physical cores / 8 logical processors.
# Start with 3; increase to 4 only if temperatures and RAM stay healthy.
MAX_WORKERS = 3


VEHICLE_TYPES = [
    ("car", 0.55),
    ("motorcycle", 0.30),
    ("bus", 0.05),
    ("truck", 0.10),
]


# ============================================================
# Identify target demand from scenario name
# ============================================================

def get_target_demand(scenario_name):

    for demand_name, demand in DEMAND_LEVELS.items():

        if f"baseline_{demand_name}_" in scenario_name:

            return demand

    raise ValueError(
        f"Could not determine demand for {scenario_name}"
    )


# ============================================================
# Count trips
# ============================================================

def count_trips(route_file):

    count = 0

    for _, elem in ET.iterparse(
        route_file,
        events=("end",)
    ):

        if elem.tag == "trip":

            count += 1

        elem.clear()

    return count


# ============================================================
# Count validated vehicles
# ============================================================

def count_validated_vehicles(route_file):

    count = 0

    for _, elem in ET.iterparse(
        route_file,
        events=("end",)
    ):

        if elem.tag == "vehicle":

            count += 1

        elem.clear()

    return count


# ============================================================
# Read rejected trip IDs from DUAROUTER output
# ============================================================

def extract_valid_ids(route_file):

    valid_ids = set()

    for _, elem in ET.iterparse(
        route_file,
        events=("end",)
    ):

        if elem.tag == "vehicle":

            vehicle_id = elem.get("id")

            if vehicle_id:

                valid_ids.add(vehicle_id)

        elem.clear()

    return valid_ids


# ============================================================
# Load original trips
# ============================================================

def load_trips(route_file):

    tree = ET.parse(route_file)

    root = tree.getroot()

    trips = []

    for elem in root:

        if elem.tag != "trip":

            continue

        trips.append(
            {
                "id": elem.get("id"),
                "type": elem.get("type"),
                "depart": elem.get("depart"),
                "from": elem.get("from"),
                "to": elem.get("to"),
            }
        )

    return trips


# ============================================================
# Write a route file containing selected trips
# ============================================================

def write_route_file(
    output_file,
    trips,
):

    root = ET.Element(
        "routes",
        {
            "xmlns:xsi":
                "http://www.w3.org/2001/XMLSchema-instance",

            "xsi:noNamespaceSchemaLocation":
                "http://sumo.dlr.de/xsd/routes_file.xsd"
        }
    )

    # --------------------------------------------------------
    # Vehicle types
    # --------------------------------------------------------

    vehicle_params = {

        "car": {
            "id": "car",
            "vClass": "passenger",
            "accel": "2.6",
            "decel": "4.5",
            "length": "5.0",
            "minGap": "2.5",
            "maxSpeed": "13.89",
        },

        "motorcycle": {
            "id": "motorcycle",
            "vClass": "motorcycle",
            "accel": "3.0",
            "decel": "4.5",
            "length": "2.5",
            "minGap": "1.5",
            "maxSpeed": "13.89",
        },

        "bus": {
            "id": "bus",
            "vClass": "bus",
            "accel": "1.2",
            "decel": "3.0",
            "length": "12.0",
            "minGap": "3.0",
            "maxSpeed": "13.89",
        },

        "truck": {
            "id": "truck",
            "vClass": "truck",
            "accel": "1.3",
            "decel": "3.0",
            "length": "10.0",
            "minGap": "3.0",
            "maxSpeed": "11.11",
        },
    }

    for params in vehicle_params.values():

        ET.SubElement(
            root,
            "vType",
            params
        )

    # --------------------------------------------------------
    # Trips
    # --------------------------------------------------------

    for trip in trips:

        ET.SubElement(
            root,
            "trip",
            trip
            | {
                "departLane": "best",
                "departSpeed": "max",
            }
        )

    ET.ElementTree(root).write(
        output_file,
        encoding="utf-8",
        xml_declaration=True
    )


# ============================================================
# Validate using DUAROUTER
# ============================================================

def run_duarouter(
    input_file,
    output_file,
):

    command = [

        str(DUAROUTER),

        "-n",
        str(NETWORK),

        "-r",
        str(input_file),

        "-o",
        str(output_file),

        "--ignore-errors",
    ]

    result = subprocess.run(
        command,
        capture_output=True,
        text=True
    )

    if result.stdout:

        print(result.stdout)

    if result.stderr:

        print(result.stderr)

    return result.returncode == 0


# ============================================================
# Generate replacement candidates
# ============================================================

def generate_replacements(
    source_trips,
    number,
    scenario_name,
    round_number,
):

    rng = random.Random(
        hash(
            (
                scenario_name,
                round_number
            )
        )
    )

    replacements = []

    # Reuse the same statistical distribution as the
    # original generator.

    for i in range(number):

        value = rng.random()

        cumulative = 0

        vehicle_type = "car"

        for vtype, probability in VEHICLE_TYPES:

            cumulative += probability

            if value <= cumulative:

                vehicle_type = vtype

                break

        # Pick a valid-looking OD from an existing trip
        # of the same vehicle class.
        compatible = [
            trip
            for trip in source_trips
            if trip["type"] == vehicle_type
        ]

        if not compatible:

            compatible = source_trips

        template = rng.choice(
            compatible
        )

        new_trip = template.copy()

        new_trip["id"] = (
            f"{scenario_name}_repair"
            f"{round_number}_"
            f"{i:06d}"
        )

        # Small departure-time variation around the
        # existing demand distribution.
        depart = int(
            template["depart"]
        )

        variation = rng.randint(
            -300,
            300
        )

        new_trip["depart"] = str(
            max(
                0,
                depart + variation
            )
        )

        replacements.append(
            new_trip
        )

    return replacements


# ============================================================
# Repair one scenario
# ============================================================

def repair_scenario(
    route_file
):

    scenario_name = (
        route_file
        .name
        .replace(
            ".rou.xml",
            ""
        )
    )

    target = get_target_demand(
        scenario_name
    )

    print()
    print("=" * 70)
    print(
        f"REPAIRING: {scenario_name}"
    )
    print("=" * 70)

    original_trips = load_trips(
        route_file
    )

    # --------------------------------------------------------
    # Initial validation
    # --------------------------------------------------------

    validated_file = (
        ROUTE_DIR
        / f"{scenario_name}.validated.rou.xml"
    )

    print(
        f"Target demand: {target:,}"
    )

    print(
        f"Initial trips: "
        f"{len(original_trips):,}"
    )

    success = run_duarouter(
        route_file,
        validated_file
    )

    if not success:

        raise RuntimeError(
            "DUAROUTER failed."
        )

    valid_ids = extract_valid_ids(
        validated_file
    )

    valid_trips = [
        trip
        for trip in original_trips
        if trip["id"] in valid_ids
    ]

    print(
        f"Initially valid: "
        f"{len(valid_trips):,}"
    )

    # --------------------------------------------------------
    # Already complete
    # --------------------------------------------------------

    if len(valid_trips) >= target:

        valid_trips = valid_trips[:target]

        write_route_file(
            validated_file,
            valid_trips
        )

        print(
            "Already sufficient."
        )

        return True

    # --------------------------------------------------------
    # Repair rounds
    # --------------------------------------------------------

    for round_number in range(
        1,
        MAX_REPAIR_ROUNDS + 1
    ):

        missing = (
            target
            - len(valid_trips)
        )

        if missing <= 0:

            break

        candidates_needed = max(
            missing + 100,
            int(
                missing
                * REPAIR_MULTIPLIER
            )
        )

        print()
        print(
            f"Repair round {round_number}"
        )

        print(
            f"Missing valid trips: "
            f"{missing:,}"
        )

        print(
            f"Generating candidates: "
            f"{candidates_needed:,}"
        )

        replacements = (
            generate_replacements(
                original_trips,
                candidates_needed,
                scenario_name,
                round_number,
            )
        )

        repair_input = (
            ROUTE_DIR
            / f"{scenario_name}."
              f"repair{round_number}.rou.xml"
        )

        repair_output = (
            ROUTE_DIR
            / f"{scenario_name}."
              f"repair{round_number}."
              f"validated.rou.xml"
        )

        write_route_file(
            repair_input,
            replacements
        )

        success = run_duarouter(
            repair_input,
            repair_output
        )

        if not success:

            print(
                "Repair DUAROUTER run failed."
            )

            continue

        repair_valid_ids = (
            extract_valid_ids(
                repair_output
            )
        )

        repair_valid = [
            trip
            for trip in replacements
            if trip["id"]
            in repair_valid_ids
        ]

        print(
            f"Repair candidates valid: "
            f"{len(repair_valid):,}"
        )

        valid_trips.extend(
            repair_valid
        )

        # Avoid duplicate IDs.
        unique = {}

        for trip in valid_trips:

            unique[
                trip["id"]
            ] = trip

        valid_trips = list(
            unique.values()
        )

        print(
            f"Total valid now: "
            f"{len(valid_trips):,}"
        )

    # --------------------------------------------------------
    # Final result
    # --------------------------------------------------------

    if len(valid_trips) < target:

        print()
        print(
            f"FAILED TO REACH TARGET: "
            f"{len(valid_trips):,}/{target:,}"
        )

        return False

    # Exactly target number.
    valid_trips = valid_trips[:target]

    # Sort by departure time.
    valid_trips.sort(
        key=lambda x: int(
            x["depart"]
        )
    )

    write_route_file(
        validated_file,
        valid_trips
    )

    # Verify final count.
    final_count = count_trips(
        validated_file
    )

    print()
    print(
        f"FINAL VALID TRIPS: "
        f"{final_count:,}/{target:,}"
    )

    if final_count == target:

        print(
            "STATUS: PASS"
        )

        return True

    print(
        "STATUS: FAILED"
    )

    return False



# ============================================================
# Parallel scenario worker
# ============================================================

def process_one(route_file):
    try:
        success = repair_scenario(route_file)
        return (
            route_file.name,
            success,
            None
        )
    except Exception as exc:
        return (
            route_file.name,
            False,
            str(exc)
        )


# ============================================================
# Main
# ============================================================

def main():

    print()
    print("=" * 70)
    print("ROUTECAST EXACT-DEMAND ROUTE VALIDATOR")
    print("=" * 70)

    route_files = sorted(
        ROUTE_DIR.glob(
            "baseline_*.rou.xml"
        )
    )

    # Exclude every generated validation/repair file.
    route_files = [
        f
        for f in route_files
        if ".validated." not in f.name
        and ".repair" not in f.name
    ]

    print()
    print(
        f"Scenarios found: "
        f"{len(route_files)}"
    )

    results = []

    # ------------------------------------------------------------
    # Process scenarios in parallel.
    # Each worker gets a different scenario, so their generated
    # files do not conflict with each other.
    # ------------------------------------------------------------
    worker_count = min(
        MAX_WORKERS,
        len(route_files)
    )

    print()
    print(
        f"Parallel workers: {worker_count}"
    )
    print(
        "Each worker runs an independent DUAROUTER validation."
    )
    print()

    with ProcessPoolExecutor(
        max_workers=worker_count
    ) as executor:

        for name, success, error in executor.map(
            process_one,
            route_files
        ):

            if error:
                print()
                print(
                    f"ERROR: {name}"
                )
                print(error)

            results.append(
                (
                    name,
                    success
                )
            )

    # ========================================================
    # Summary
    # ========================================================

    print()
    print("=" * 70)
    print("FINAL SUMMARY")
    print("=" * 70)

    passed = sum(
        success
        for _, success in results
    )

    failed = (
        len(results)
        - passed
    )

    print(
        f"Scenarios : {len(results)}"
    )

    print(
        f"PASS      : {passed}"
    )

    print(
        f"FAILED    : {failed}"
    )

    print()

    for name, success in results:

        status = (
            "PASS"
            if success
            else "FAILED"
        )

        print(
            f"{status:8} {name}"
        )


if __name__ == "__main__":
    main()