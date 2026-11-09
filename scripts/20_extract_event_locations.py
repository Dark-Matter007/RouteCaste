import xml.etree.ElementTree as ET
from pathlib import Path

osm = Path("data/raw/sumo_network/guntur_city_bbox.osm.xml")

TAGS = {
    "stadium", "sports_centre", "pitch",
    "theatre", "cinema", "conference_centre",
    "marketplace", "market",
    "place_of_worship",
    "school", "college", "university",
    "hospital",
    "community_centre",
    "townhall",
    "park", "public_building",
}

results = []

for event, elem in ET.iterparse(osm, events=("end",)):
    if elem.tag not in ("node", "way", "relation"):
        continue

    tags = {}
    for child in elem:
        if child.tag == "tag":
            tags[child.attrib.get("k")] = child.attrib.get("v", "")

    amenity = tags.get("amenity", "")
    leisure = tags.get("leisure", "")
    tourism = tags.get("tourism", "")
    building = tags.get("building", "")
    shop = tags.get("shop", "")

    category = (
        amenity or leisure or tourism or building or shop
    ).lower()

    if category in TAGS or any(t in category for t in TAGS):
        name = tags.get("name") or tags.get("name:en") or ""

        if name:
            results.append({
                "type": elem.tag,
                "id": elem.attrib.get("id"),
                "name": name,
                "category": category,
                "lat": elem.attrib.get("lat", ""),
                "lon": elem.attrib.get("lon", ""),
            })

    elem.clear()

seen = set()

print()
print("=" * 90)
print("CANDIDATE EVENT LOCATIONS")
print("=" * 90)

for r in results:
    key = (r["name"], r["category"])
    if key in seen:
        continue
    seen.add(key)

    print(
        f'{r["name"]} | '
        f'{r["category"]} | '
        f'{r["lat"]},{r["lon"]}'
    )

print()
print("Unique named candidates:", len(seen))
