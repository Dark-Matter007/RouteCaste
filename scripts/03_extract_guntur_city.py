import osmnx as ox
from pathlib import Path

INPUT = Path("data/raw/osm/guntur_drive.graphml")
OUTPUT_DIR = Path("data/raw/osm")
OUTPUT = OUTPUT_DIR / "guntur_city_drive.graphml"

# Approximate Guntur urban study area
WEST = 80.38
EAST = 80.55
SOUTH = 16.25
NORTH = 16.40

print("Loading original Guntur network...")
G = ox.load_graphml(INPUT)

print(f"Original nodes: {len(G.nodes)}")
print(f"Original edges: {len(G.edges)}")

# Extract nodes inside bounding box
nodes_gdf, _ = ox.graph_to_gdfs(G, nodes=True, edges=True)

mask = (
    (nodes_gdf.geometry.x >= WEST) &
    (nodes_gdf.geometry.x <= EAST) &
    (nodes_gdf.geometry.y >= SOUTH) &
    (nodes_gdf.geometry.y <= NORTH)
)

city_node_ids = nodes_gdf.loc[mask].index

print(f"Nodes inside study area: {len(city_node_ids)}")

# Keep only those nodes and their connecting edges
G_city = G.subgraph(city_node_ids).copy()

# Remove isolated nodes/components where appropriate
G_city = ox.truncate.largest_component(G_city, strongly=False)

print(f"City network nodes: {len(G_city.nodes)}")
print(f"City network edges: {len(G_city.edges)}")

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

ox.save_graphml(G_city, OUTPUT)

print()
print("Saved:")
print(OUTPUT)