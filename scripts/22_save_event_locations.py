import csv
from pathlib import Path

OUTPUT = Path("data/scenarios/events/event_locations.csv")
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

rows = [
    ["E01", "NTR Indoor Sports Complex", "sports", 16.3120020, 80.4230386, "-847952300#1", "highway.tertiary", 44.8],
    ["E02", "Harihar Mahal Theatre", "entertainment", 16.3097006, 80.4342287, "-120288277#15", "highway.residential", 27.3],
    ["E03", "Nazz Theater", "entertainment", 16.2975716, 80.4463283, "849717013", "highway.tertiary", 19.6],
    ["E04", "S Convention", "convention", 16.3329101, 80.4863194, "219016634#0", "highway.tertiary", 37.5],
    ["E05", "URBAN MAIDAAN SPORTS CENTER", "sports", 16.2965951, 80.4005133, "-409953319#0", "highway.residential", 112.2],
    ["E06", "Mirchi yard", "marketplace", 16.2940052, 80.4131596, "-427799608#1", "highway.residential", 37.6],
    ["E07", "Chalapathi Ground", "ground", 16.3188233, 80.4183114, "-410463957#0", "highway.residential", 45.5],
    ["E08", "Garden Function Hall", "community", 16.3608181, 80.4052677, "-847846956#0", "highway.unclassified", 26.8],
]

with OUTPUT.open("w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow([
        "event_location_id",
        "name",
        "category",
        "latitude",
        "longitude",
        "sumo_edge_id",
        "road_type",
        "mapping_distance_m",
    ])
    writer.writerows(rows)

print(f"Created: {OUTPUT}")
print(f"Locations: {len(rows)}")
