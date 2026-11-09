import csv
import gzip
import xml.etree.ElementTree as ET
from pathlib import Path

SPATIAL = Path("data/processed/event_spatial_features.csv")
EDGE_DIR = Path("data/simulation/edge")
OUTPUT = Path("data/processed/event_traffic_1km.csv.gz")


# ------------------------------------------------------------
# Load event -> relevant edges
# ------------------------------------------------------------

event_edges = {}

with SPATIAL.open("r", encoding="utf-8", newline="") as f:
    for row in csv.DictReader(f):
        event_id = row["event_location_id"]
        edge_id = row["edge_id"]

        event_edges.setdefault(event_id, set()).add(edge_id)

print("=" * 70)
print("EVENT TRAFFIC EXTRACTION")
print("=" * 70)

for event_id, edges in event_edges.items():
    print(f"{event_id}: {len(edges):,} edges")


# ------------------------------------------------------------
# Find event EdgeData files
# ------------------------------------------------------------

files = sorted(
    EDGE_DIR.glob(
        "event_E*_concert_large_normal_evening_peak_seed*.edge.xml"
    )
)

if len(files) != 24:
    raise RuntimeError(
        f"Expected 24 event EdgeData files, found {len(files)}"
    )

print()
print(f"Event simulations: {len(files)}")


# ------------------------------------------------------------
# Extract only needed edges and metrics
# ------------------------------------------------------------

fields = [
    "scenario_id",
    "event_location_id",
    "seed",
    "interval_begin",
    "interval_end",
    "edge_id",
    "sampled_seconds",
    "speed",
    "density",
    "occupancy",
    "flow",
    "travel_time",
    "waiting_time",
    "time_loss",
]


OUTPUT.parent.mkdir(parents=True, exist_ok=True)

total_rows = 0

with gzip.open(
    OUTPUT,
    "wt",
    encoding="utf-8",
    newline=""
) as out:

    writer = csv.DictWriter(out, fieldnames=fields)
    writer.writeheader()

    for index, xml_file in enumerate(files, 1):

        name = xml_file.name

        # event_E01_..._seed101.edge.xml
        parts = name.split("_")

        event_location_id = parts[1]

        seed_part = [
            p for p in parts
            if p.startswith("seed")
        ][0]

        seed = seed_part.replace("seed", "")

        scenario_id = name.replace(".edge.xml", "")

        allowed_edges = event_edges[event_location_id]

        print(
            f"[{index:02d}/24] "
            f"{event_location_id} seed{seed} | "
            f"allowed edges: {len(allowed_edges):,}"
        )

        file_rows = 0

        context = ET.iterparse(
            xml_file,
            events=("end",)
        )

        for _, elem in context:

            if elem.tag != "interval":
                continue

            begin = elem.attrib.get("begin", "")
            end = elem.attrib.get("end", "")

            for edge in elem.findall("edge"):

                edge_id = edge.attrib.get("id")

                if edge_id not in allowed_edges:
                    continue

                row = {
                    "scenario_id": scenario_id,
                    "event_location_id": event_location_id,
                    "seed": seed,
                    "interval_begin": begin,
                    "interval_end": end,
                    "edge_id": edge_id,
                    "sampled_seconds": edge.attrib.get(
                        "sampledSeconds", "0"
                    ),
                    "speed": edge.attrib.get("speed", "0"),
                    "density": edge.attrib.get("density", "0"),
                    "occupancy": edge.attrib.get("occupancy", "0"),
                    "flow": edge.attrib.get("entered", "0"),
                    "travel_time": edge.attrib.get(
                        "traveltime", "0"
                    ),
                    "waiting_time": edge.attrib.get(
                        "waitingTime", "0"
                    ),
                    "time_loss": edge.attrib.get(
                        "timeLoss", "0"
                    ),
                }

                writer.writerow(row)

                file_rows += 1
                total_rows += 1

            elem.clear()

        print(
            f"       extracted: {file_rows:,} rows"
        )

print()
print("=" * 70)
print("EXTRACTION COMPLETE")
print("=" * 70)
print(f"Total rows : {total_rows:,}")
print(f"Output     : {OUTPUT}")

size_mb = OUTPUT.stat().st_size / (1024 * 1024)

print(f"File size  : {size_mb:.2f} MB")
