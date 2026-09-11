"""Download a real, directed Guntur drivable graph from OpenStreetMap."""
from pathlib import Path
import json
from guntur_common import DATA, cfg, ensure_dirs, iso_now

def main():
    import osmnx as ox
    ensure_dirs(); c=cfg(); out=DATA/"raw/guntur_osm"; graph_file=out/"guntur_drive.graphml"
    ox.settings.use_cache=True; ox.settings.log_console=True
    params={"place_query":c["place_query"],"network_type":"drive","simplify":True,"retrieved_at":iso_now()}
    # The Nominatim place result can be the much larger Guntur administrative
    # boundary. The configured 7 km centre-point study boundary is therefore
    # the default, bounded and reproducible city-scale query.
    fc=c["fallback_center"]
    params.update({"query_method":"graph_from_point_central_guntur","fallback_center":fc})
    try:
        graph=ox.graph_from_point((fc["latitude"],fc["longitude"]), dist=fc["dist_m"], network_type="drive", simplify=True)
    except Exception as exc:
        params["download_error"]=str(exc)
        raise
    ox.save_graphml(graph, graph_file)
    (out/"retrieval_metadata.json").write_text(json.dumps(params,indent=2), encoding="utf-8")
    print(f"Saved real OSM graph: {graph_file} ({len(graph.nodes)} nodes, {len(graph.edges)} directed edges)")
if __name__=="__main__": main()
