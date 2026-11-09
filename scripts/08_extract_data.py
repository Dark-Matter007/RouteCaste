import csv
import os
import re
import xml.etree.ElementTree as ET

# ============================================================
# RouteCast - EdgeData -> traffic_state.csv
# Streaming extractor for 36 baseline SUMO simulations
# ============================================================

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

EDGE_DIR = os.path.join(
    PROJECT_ROOT,
    "data",
    "simulation",
    "edge"
)

OUTPUT_DIR = os.path.join(
    PROJECT_ROOT,
    "data",
    "processed"
)

OUTPUT_FILE = os.path.join(
    OUTPUT_DIR,
    "traffic_state.csv"
)

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ------------------------------------------------------------
# Scenario filename pattern
# ------------------------------------------------------------

PATTERN = re.compile(
    r"^baseline_"
    r"(low|normal|high)_"
    r"(morning_peak|midday|evening_peak|night)_"
    r"seed(\d+)"
    r"\.edge\.xml$"
)

# ------------------------------------------------------------
# CSV schema
# ------------------------------------------------------------

FIELDS = [
    "scenario_id",
    "demand_level",
    "time_period",
    "seed",

    "interval_begin",
    "interval_end",

    "edge_id",

    "sampled_seconds",
    "travel_time",
    "overlap_travel_time",

    "density",
    "overlap_density",
    "lane_density",

    "occupancy",

    "waiting_time",
    "time_loss",

    "speed",
    "speed_relative",

    "flow",

    "departed",
    "arrived",
    "entered",
    "left",

    "lane_changed_from",
    "lane_changed_to",
]


def number(value, default=0.0):
    """Safely convert SUMO numeric attributes."""
    if value is None or value == "":
        return default

    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def integer(value, default=0):
    """Safely convert integer SUMO attributes."""
    if value is None or value == "":
        return default

    try:
        return int(float(value))
    except (ValueError, TypeError):
        return default


def process_file(xml_file, writer):

    filename = os.path.basename(xml_file)

    match = PATTERN.match(filename)

    if not match:
        print(f"SKIP: {filename}")
        return 0

    demand_level = match.group(1)
    time_period = match.group(2)
    seed = int(match.group(3))

    scenario_id = (
        f"{demand_level}_{time_period}_seed{seed}"
    )

    print()
    print("=" * 80)
    print(f"Processing: {filename}")
    print(f"Scenario : {scenario_id}")
    print("=" * 80)

    rows = 0
    intervals = 0

    # --------------------------------------------------------
    # Streaming XML parser
    # --------------------------------------------------------

    try:

        for event, elem in ET.iterparse(
            xml_file,
            events=("end",)
        ):

            if elem.tag != "interval":
                continue

            intervals += 1

            interval_begin = number(
                elem.attrib.get("begin")
            )

            interval_end = number(
                elem.attrib.get("end")
            )

            # ------------------------------------------------
            # Every <edge> inside this interval
            # ------------------------------------------------

            for edge in elem.findall("edge"):

                attrs = edge.attrib

                writer.writerow({
                    "scenario_id": scenario_id,

                    "demand_level": demand_level,

                    "time_period": time_period,

                    "seed": seed,

                    "interval_begin": interval_begin,

                    "interval_end": interval_end,

                    "edge_id": attrs.get(
                        "id",
                        ""
                    ),

                    "sampled_seconds": number(
                        attrs.get("sampledSeconds")
                    ),

                    "travel_time": number(
                        attrs.get("traveltime")
                    ),

                    "overlap_travel_time": number(
                        attrs.get(
                            "overlapTraveltime"
                        )
                    ),

                    "density": number(
                        attrs.get("density")
                    ),

                    "overlap_density": number(
                        attrs.get(
                            "overlapDensity"
                        )
                    ),

                    "lane_density": number(
                        attrs.get(
                            "laneDensity"
                        )
                    ),

                    "occupancy": number(
                        attrs.get("occupancy")
                    ),

                    "waiting_time": number(
                        attrs.get(
                            "waitingTime"
                        )
                    ),

                    "time_loss": number(
                        attrs.get("timeLoss")
                    ),

                    "speed": number(
                        attrs.get("speed")
                    ),

                    "speed_relative": number(
                        attrs.get(
                            "speedRelative"
                        )
                    ),

                    "flow": number(
                        attrs.get("flow")
                    ),

                    "departed": integer(
                        attrs.get("departed")
                    ),

                    "arrived": integer(
                        attrs.get("arrived")
                    ),

                    "entered": integer(
                        attrs.get("entered")
                    ),

                    "left": integer(
                        attrs.get("left")
                    ),

                    "lane_changed_from": integer(
                        attrs.get(
                            "laneChangedFrom"
                        )
                    ),

                    "lane_changed_to": integer(
                        attrs.get(
                            "laneChangedTo"
                        )
                    ),
                })

                rows += 1

            # ------------------------------------------------
            # Clear processed interval from memory
            # ------------------------------------------------

            elem.clear()

    except ET.ParseError as error:

        print(
            f"ERROR: Corrupted XML: {filename}"
        )

        print(error)

        raise

    print(
        f"Intervals: {intervals}"
    )

    print(
        f"Rows:      {rows:,}"
    )

    return rows


def main():

    print()
    print("=" * 80)
    print("ROUTECAST TRAFFIC STATE EXTRACTION")
    print("=" * 80)

    files = sorted(
        f
        for f in os.listdir(EDGE_DIR)
        if f.endswith(".edge.xml")
    )

    print(
        f"Found EdgeData files: {len(files)}"
    )

    if len(files) != 36:

        raise RuntimeError(
            f"Expected 36 EdgeData files, "
            f"found {len(files)}"
        )

    # --------------------------------------------------------
    # Create CSV
    # --------------------------------------------------------

    total_rows = 0

    with open(
        OUTPUT_FILE,
        "w",
        newline="",
        encoding="utf-8"
    ) as csv_file:

        writer = csv.DictWriter(
            csv_file,
            fieldnames=FIELDS
        )

        writer.writeheader()

        for index, filename in enumerate(
            files,
            start=1
        ):

            print()
            print(
                f"[{index}/36] {filename}"
            )

            xml_file = os.path.join(
                EDGE_DIR,
                filename
            )

            rows = process_file(
                xml_file,
                writer
            )

            total_rows += rows

    print()
    print("=" * 80)
    print("EXTRACTION COMPLETE")
    print("=" * 80)

    print(
        f"Scenarios processed : {len(files)}"
    )

    print(
        f"Total rows          : {total_rows:,}"
    )

    print(
        f"Output              : {OUTPUT_FILE}"
    )

    if os.path.exists(OUTPUT_FILE):

        size_mb = (
            os.path.getsize(OUTPUT_FILE)
            / (1024 * 1024)
        )

        print(
            f"CSV size            : {size_mb:.2f} MB"
        )

    print("=" * 80)


if __name__ == "__main__":
    main()