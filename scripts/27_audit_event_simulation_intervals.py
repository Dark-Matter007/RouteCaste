import xml.etree.ElementTree as ET
from pathlib import Path

EDGE_DIR = Path("data/simulation/edge")

files = sorted(
    EDGE_DIR.glob(
        "event_E*_concert_large_normal_evening_peak_seed*.edge.xml"
    )
)

print("=" * 70)
print("EVENT SIMULATION INTERVAL AUDIT")
print("=" * 70)

for path in files:

    intervals = set()

    for event, elem in ET.iterparse(
        path,
        events=("end",)
    ):
        if elem.tag == "interval":
            intervals.add(elem.attrib.get("begin"))
            elem.clear()

    print(
        f"{path.stem} | "
        f"intervals={len(intervals)} | "
        f"range={min(intervals, key=float)}-{max(intervals, key=float)}"
    )

print()
print(f"Files checked: {len(files)}")
