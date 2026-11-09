import random
import xml.etree.ElementTree as ET
from pathlib import Path


# ============================================================
# Configuration
# ============================================================

NETWORK = Path(
    "data/raw/sumo_network/guntur_city.net.xml"
)

OUTPUT_DIR = Path(
    "data/scenarios/baseline"
)

OUTPUT_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# ============================================================
# Demand
# ============================================================

DEMAND_LEVELS = {
    "low": 1500,
    "normal": 3000,
    "high": 5000,
}


# ============================================================
# Simulation periods
# ============================================================

TIME_PERIODS = {
    "morning_peak": (
        7 * 3600,
        10 * 3600
    ),

    "midday": (
        11 * 3600,
        14 * 3600
    ),

    "evening_peak": (
        17 * 3600,
        20 * 3600
    ),

    "night": (
        21 * 3600,
        24 * 3600
    ),
}


# ============================================================
# Random seeds
# ============================================================

SEEDS = [
    101,
    202,
    303,
]


# ============================================================
# Vehicle proportions
# ============================================================

VEHICLE_TYPES = [
    ("car", 0.55),
    ("motorcycle", 0.30),
    ("bus", 0.05),
    ("truck", 0.10),
]


# ============================================================
# Vehicle classes
# ============================================================

VEHICLE_CLASSES = {
    "car": "passenger",
    "motorcycle": "motorcycle",
    "bus": "bus",
    "truck": "truck",
}


# ============================================================
# Vehicle parameters
# ============================================================

VEHICLE_PARAMS = {

    "car": {
        "vClass": "passenger",
        "accel": "2.6",
        "decel": "4.5",
        "length": "5.0",
        "minGap": "2.5",
        "maxSpeed": "13.89",
    },

    "motorcycle": {
        "vClass": "motorcycle",
        "accel": "3.0",
        "decel": "4.5",
        "length": "2.5",
        "minGap": "1.5",
        "maxSpeed": "13.89",
    },

    "bus": {
        "vClass": "bus",
        "accel": "1.2",
        "decel": "3.0",
        "length": "12.0",
        "minGap": "3.0",
        "maxSpeed": "13.89",
    },

    "truck": {
        "vClass": "truck",
        "accel": "1.3",
        "decel": "3.0",
        "length": "10.0",
        "minGap": "3.0",
        "maxSpeed": "11.11",
    },
}


# ============================================================
# Road hierarchy used for OD generation
# ============================================================

ELIGIBLE_ROAD_TYPES = {
    "highway.primary",
    "highway.secondary",
    "highway.tertiary",
    "highway.residential",
    "highway.unclassified",
    "highway.living_street",

    "highway.primary_link",
    "highway.secondary_link",
    "highway.tertiary_link",
    "highway.trunk_link",
}


# ============================================================
# Minimum OD distance
# ============================================================

MIN_TRIP_DISTANCE = 500.0


# ============================================================
# Maximum OD sampling attempts
# ============================================================

MAX_OD_ATTEMPTS = 100


# ============================================================
# Load network edges
# ============================================================

def load_edges():

    print()
    print("=" * 70)
    print("LOADING SUMO NETWORK")
    print("=" * 70)

    root = ET.parse(NETWORK).getroot()

    edge_pools = {
        vehicle_type: []
        for vehicle_type, _ in VEHICLE_TYPES
    }

    edge_info = {}

    for edge in root.findall("edge"):

        edge_id = edge.get("id")

        if not edge_id:
            continue

        # Ignore SUMO internal junction edges.
        if edge_id.startswith(":"):
            continue

        lanes = edge.findall("lane")

        if not lanes:
            continue

        road_type = edge.get("type", "unknown")

        # Only use normal urban roads for OD generation.
        if road_type not in ELIGIBLE_ROAD_TYPES:
            continue

        # Use the longest lane as representative edge length.
        edge_length = max(
            float(
                lane.get(
                    "length",
                    "0"
                )
            )
            for lane in lanes
        )

        if edge_length <= 0:
            continue

        edge_info[edge_id] = {
            "type": road_type,
            "length": edge_length,
        }

        # ----------------------------------------------------
        # Determine vehicle compatibility
        # ----------------------------------------------------

        for vehicle_type, vclass in VEHICLE_CLASSES.items():

            compatible = False

            for lane in lanes:

                allow = lane.get("allow")
                disallow = lane.get("disallow")

                if allow:

                    allowed = set(
                        allow.split()
                    )

                    if vclass in allowed:
                        compatible = True
                        break

                elif disallow:

                    blocked = set(
                        disallow.split()
                    )

                    if vclass not in blocked:
                        compatible = True
                        break

                else:

                    # No explicit restrictions.
                    compatible = True
                    break

            if compatible:

                edge_pools[
                    vehicle_type
                ].append(edge_id)

    print()
    print("Eligible road network:")

    print(
        f"Total eligible edges: "
        f"{len(edge_info):,}"
    )

    for vehicle_type in edge_pools:

        print(
            f"{vehicle_type:12}: "
            f"{len(edge_pools[vehicle_type]):,}"
        )

    return edge_pools, edge_info


# ============================================================
# Vehicle selection
# ============================================================

def choose_vehicle_type(rng):

    value = rng.random()

    cumulative = 0.0

    for vehicle_type, probability in VEHICLE_TYPES:

        cumulative += probability

        if value <= cumulative:

            return vehicle_type

    return "car"


# ============================================================
# Generate valid OD pair
# ============================================================

def choose_od_pair(
    rng,
    compatible_edges,
    edge_info,
):

    for _ in range(MAX_OD_ATTEMPTS):

        origin = rng.choice(
            compatible_edges
        )

        destination = rng.choice(
            compatible_edges
        )

        if origin == destination:
            continue

        # We use edge lengths as a conservative
        # minimum-distance filter.
        #
        # Actual route distance is calculated later
        # by DUAROUTER.

        estimated_distance = (
            edge_info[origin]["length"]
            +
            edge_info[destination]["length"]
        )

        if estimated_distance < MIN_TRIP_DISTANCE:
            continue

        return origin, destination

    return None, None


# ============================================================
# Generate scenario
# ============================================================

def generate_scenario(
    edge_pools,
    edge_info,
    demand_name,
    trip_count,
    period_name,
    seed,
):

    rng = random.Random(seed)

    start_time, end_time = (
        TIME_PERIODS[period_name]
    )

    root = ET.Element(
        "routes",
        {
            "xmlns:xsi":
                "http://www.w3.org/2001/XMLSchema-instance",

            "xsi:noNamespaceSchemaLocation":
                "http://sumo.dlr.de/xsd/routes_file.xsd"
        }
    )

    # ========================================================
    # Vehicle definitions
    # ========================================================

    for vehicle_type, params in VEHICLE_PARAMS.items():

        ET.SubElement(
            root,
            "vType",
            params | {
                "id": vehicle_type
            }
        )

    # ========================================================
    # Generate EXACT requested number of trips
    # ========================================================

    trips = []

    vehicle_counts = {
        vehicle_type: 0
        for vehicle_type, _ in VEHICLE_TYPES
    }

    attempts = 0

    while len(trips) < trip_count:

        attempts += 1

        if attempts > trip_count * 20:

            raise RuntimeError(
                f"Unable to generate {trip_count:,} "
                f"valid OD trips for "
                f"{demand_name}/{period_name}/seed{seed}. "
                f"Generated only {len(trips):,}."
            )

        vehicle_type = choose_vehicle_type(
            rng
        )

        compatible_edges = (
            edge_pools[vehicle_type]
        )

        if not compatible_edges:

            raise RuntimeError(
                f"No compatible edges for "
                f"vehicle type: {vehicle_type}"
            )

        origin, destination = choose_od_pair(
            rng,
            compatible_edges,
            edge_info,
        )

        if origin is None:

            continue

        depart = rng.randint(
            start_time,
            end_time - 1
        )

        trip_id = (
            f"{demand_name}_"
            f"{period_name}_"
            f"{seed}_"
            f"{len(trips):05d}"
        )

        trips.append(
            {
                "id": trip_id,
                "type": vehicle_type,
                "depart": depart,
                "from": origin,
                "to": destination,
            }
        )

        vehicle_counts[
            vehicle_type
        ] += 1

    # ========================================================
    # Sort by departure time
    # ========================================================

    trips.sort(
        key=lambda x: x["depart"]
    )

    # ========================================================
    # Write trips
    # ========================================================

    for trip in trips:

        ET.SubElement(
            root,
            "trip",
            {
                "id": trip["id"],
                "type": trip["type"],
                "depart": str(
                    trip["depart"]
                ),
                "from": trip["from"],
                "to": trip["to"],
                "departLane": "best",
                "departSpeed": "max",
            }
        )

    # ========================================================
    # Output
    # ========================================================

    output = (
        OUTPUT_DIR
        / f"baseline_{demand_name}_"
          f"{period_name}_seed{seed}.rou.xml"
    )

    ET.ElementTree(root).write(
        output,
        encoding="utf-8",
        xml_declaration=True
    )

    # ========================================================
    # Report
    # ========================================================

    print()
    print(
        f"{demand_name.upper():6} | "
        f"{period_name:14} | "
        f"seed={seed}"
    )

    print(
        f"Requested trips : {trip_count:,}"
    )

    print(
        f"Generated trips : {len(trips):,}"
    )

    print(
        f"Cars            : "
        f"{vehicle_counts['car']:,}"
    )

    print(
        f"Motorcycles     : "
        f"{vehicle_counts['motorcycle']:,}"
    )

    print(
        f"Buses           : "
        f"{vehicle_counts['bus']:,}"
    )

    print(
        f"Trucks          : "
        f"{vehicle_counts['truck']:,}"
    )

    print(
        f"Created         : {output}"
    )

    return output


# ============================================================
# Main
# ============================================================

def main():

    print()
    print("=" * 70)
    print("ROUTECAST BASELINE DEMAND GENERATOR")
    print("=" * 70)

    edge_pools, edge_info = load_edges()

    print()
    print("=" * 70)
    print("GENERATING BASELINE SCENARIOS")
    print("=" * 70)

    for demand_name, trip_count in DEMAND_LEVELS.items():

        for period_name in TIME_PERIODS:

            for seed in SEEDS:

                generate_scenario(
                    edge_pools=edge_pools,
                    edge_info=edge_info,
                    demand_name=demand_name,
                    trip_count=trip_count,
                    period_name=period_name,
                    seed=seed,
                )

    print()
    print("=" * 70)
    print("BASELINE GENERATION COMPLETE")
    print("=" * 70)

    total = (
        len(DEMAND_LEVELS)
        * len(TIME_PERIODS)
        * len(SEEDS)
    )

    print(
        f"Scenario files generated: {total}"
    )


# ============================================================
# Entry point
# ============================================================

if __name__ == "__main__":
    main()