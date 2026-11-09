import osmnx as ox
from pathlib import Path

OUTPUT_DIR = Path("data/raw/osm")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

print("Downloading Guntur road network...")

G = ox.graph_from_place(
    "Guntur, Andhra Pradesh, India",
    network_type="drive",
    simplify=True
)

print(f"Nodes: {len(G.nodes)}")
print(f"Edges: {len(G.edges)}")

ox.save_graphml(
    G,
    OUTPUT_DIR / "guntur_drive.graphml"
)

print("Saved:")
print(OUTPUT_DIR / "guntur_drive.graphml")