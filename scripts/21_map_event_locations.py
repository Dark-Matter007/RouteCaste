import xml.etree.ElementTree as ET
import math
from pathlib import Path

NET = Path("data/raw/sumo_network/guntur_city.net.xml")
NET_OFFSET_X = -422360.99
NET_OFFSET_Y = -1794034.46

LOCATIONS = [
    ("E01", "NTR Indoor Sports Complex", "sports", 16.3120020, 80.4230386),
    ("E02", "Harihar Mahal Theatre", "entertainment", 16.3097006, 80.4342287),
    ("E03", "Nazz Theater", "entertainment", 16.2975716, 80.4463283),
    ("E04", "S Convention", "convention", 16.3329101, 80.4863194),
    ("E05", "URBAN MAIDAAN SPORTS CENTER", "sports", 16.2965951, 80.4005133),
    ("E06", "Mirchi yard", "marketplace", 16.2940052, 80.4131596),
    ("E07", "Chalapathi Ground", "ground", 16.3188233, 80.4183114),
    ("E08", "Garden Function Hall", "community", 16.3608181, 80.4052677),
]

ELIGIBLE = {
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


def latlon_to_utm(lat, lon):
    """WGS84 latitude/longitude -> UTM zone 44N."""

    a = 6378137.0
    ecc_sq = 0.00669438
    k0 = 0.9996

    zone = 44
    lon_origin = (zone - 1) * 6 - 180 + 3

    lat_rad = math.radians(lat)
    lon_rad = math.radians(lon)
    lon_origin_rad = math.radians(lon_origin)

    ecc_prime_sq = ecc_sq / (1 - ecc_sq)

    N = a / math.sqrt(
        1 - ecc_sq * math.sin(lat_rad) ** 2
    )

    T = math.tan(lat_rad) ** 2
    C = ecc_prime_sq * math.cos(lat_rad) ** 2

    A = (
        math.cos(lat_rad)
        * (lon_rad - lon_origin_rad)
    )

    M = a * (
        (
            1
            - ecc_sq / 4
            - 3 * ecc_sq**2 / 64
            - 5 * ecc_sq**3 / 256
        )
        * lat_rad
        - (
            3 * ecc_sq / 8
            + 3 * ecc_sq**2 / 32
            + 45 * ecc_sq**3 / 1024
        )
        * math.sin(2 * lat_rad)
        + (
            15 * ecc_sq**2 / 256
            + 45 * ecc_sq**3 / 1024
        )
        * math.sin(4 * lat_rad)
        - (
            35 * ecc_sq**3 / 3072
        )
        * math.sin(6 * lat_rad)
    )

    x = (
        k0
        * N
        * (
            A
            + (1 - T + C) * A**3 / 6
            + (
                5
                - 18 * T
                + T**2
                + 72 * C
                - 58 * ecc_prime_sq
            )
            * A**5
            / 120
        )
        + 500000.0
    )

    y = k0 * (
        M
        + N
        * math.tan(lat_rad)
        * (
            A**2 / 2
            + (
                5
                - T
                + 9 * C
                + 4 * C**2
            )
            * A**4
            / 24
            + (
                61
                - 58 * T
                + T**2
                + 600 * C
                - 330 * ecc_prime_sq
            )
            * A**6
            / 720
        )
    )

    return x, y


def point_segment_distance(px, py, ax, ay, bx, by):

    dx = bx - ax
    dy = by - ay

    if dx == 0 and dy == 0:
        return math.hypot(
            px - ax,
            py - ay
        )

    t = (
        (px - ax) * dx
        + (py - ay) * dy
    ) / (dx * dx + dy * dy)

    t = max(0.0, min(1.0, t))

    cx = ax + t * dx
    cy = ay + t * dy

    return math.hypot(
        px - cx,
        py - cy
    )


print("Reading SUMO network...")

# ---------------------------------------------------------
# STEP 1: Load junction coordinates
# ---------------------------------------------------------

junctions = {}

for event, elem in ET.iterparse(NET, events=("end",)):

    if elem.tag == "junction":

        jid = elem.get("id")
        x = elem.get("x")
        y = elem.get("y")

        if jid and x is not None and y is not None:

            # Ignore internal junctions
            if not jid.startswith(":"):
                junctions[jid] = (
                    float(x),
                    float(y)
                )

    elem.clear()


print("SUMO junctions loaded:", len(junctions))


# ---------------------------------------------------------
# STEP 2: Load eligible edges
# ---------------------------------------------------------

edges = []

for event, elem in ET.iterparse(NET, events=("end",)):

    if elem.tag != "edge":
        continue

    edge_id = elem.get("id", "")

    if edge_id.startswith(":"):
        elem.clear()
        continue

    road_type = elem.get("type", "")

    if road_type not in ELIGIBLE:
        elem.clear()
        continue

    frm = elem.get("from")
    to = elem.get("to")

    if frm not in junctions or to not in junctions:
        elem.clear()
        continue

    edges.append(
        (
            edge_id,
            frm,
            to,
            road_type,
            junctions[frm],
            junctions[to],
        )
    )

    elem.clear()


print("Eligible edges loaded:", len(edges))

if not junctions:
    raise RuntimeError(
        "No SUMO junctions found."
    )

if not edges:
    raise RuntimeError(
        "No eligible SUMO edges found."
    )


# ---------------------------------------------------------
# STEP 3: Map event locations
# ---------------------------------------------------------

print()
print("=" * 120)
print("EVENT LOCATION → SUMO ROAD EDGE MAPPING")
print("=" * 120)

results = []

for event_id, name, category, lat, lon in LOCATIONS:

    utm_x, utm_y = latlon_to_utm(lat, lon)
    px = utm_x + NET_OFFSET_X
    py = utm_y + NET_OFFSET_Y

    best_distance = float("inf")
    best_edge = None

    for edge in edges:

        (
            edge_id,
            frm,
            to,
            road_type,
            a,
            b,
        ) = edge

        distance = point_segment_distance(
            px,
            py,
            a[0],
            a[1],
            b[0],
            b[1],
        )

        if distance < best_distance:

            best_distance = distance
            best_edge = edge

    if best_edge is None:

        print(
            f"{event_id} | {name} | NO MATCH"
        )

        continue

    (
        edge_id,
        frm,
        to,
        road_type,
        a,
        b,
    ) = best_edge

    results.append(
        (
            event_id,
            name,
            category,
            lat,
            lon,
            edge_id,
            road_type,
            best_distance,
        )
    )

    print(
        f"{event_id} | "
        f"{name} | "
        f"{category} | "
        f"edge={edge_id} | "
        f"type={road_type} | "
        f"distance={best_distance:.1f}m"
    )


# ---------------------------------------------------------
# STEP 4: Summary
# ---------------------------------------------------------

print()
print("=" * 120)
print("MAPPING SUMMARY")
print("=" * 120)

print(f"Event locations : {len(LOCATIONS)}")
print(f"Successful       : {len(results)}")
print(f"Failed           : {len(LOCATIONS) - len(results)}")

if results:

    distances = [
        r[7]
        for r in results
    ]

    print(
        f"Nearest distance : "
        f"{min(distances):.1f}m - "
        f"{max(distances):.1f}m"
    )

print()
print("Mapping complete.")
