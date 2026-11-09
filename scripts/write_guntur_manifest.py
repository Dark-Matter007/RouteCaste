from guntur_common import DATA,cfg,write_manifest
def main():
 c=cfg();p=DATA/'processed';seed=c['random_seed'];write_manifest([
 ('guntur_nodes',p/'guntur_nodes.csv','OpenStreetMap via OSMnx','ODbL 1.0','python scripts/build_guntur_dataset.py',seed),
 ('guntur_roads',p/'guntur_roads.csv','OpenStreetMap via OSMnx','ODbL 1.0','python scripts/build_guntur_dataset.py',seed),
 ('traffic_baseline',p/'traffic_baseline.csv','Modeled baseline traffic — not measured road-sensor data','CC0-1.0 assumptions/code','python scripts/generate_baseline_traffic.py',seed),
 ('events',p/'events.csv','OSM Nominatim verified venue lookup where available; otherwise marked scenario','ODbL for OSM-derived coordinates','python scripts/create_guntur_events.py',seed),
 ('event_traffic',p/'event_traffic.csv','Modeled route assignment over OSM graph','CC0-1.0 assumptions/code','python scripts/generate_event_traffic.py',seed),
 ('dynamic_roads',p/'dynamic_roads.csv','Modeled BPR dynamic weights','CC0-1.0 assumptions/code','python scripts/build_dynamic_graph.py',seed),
 ('route_results',p/'route_results.csv','Repository-owned routing algorithms over OSM graph','CC0-1.0 assumptions/code','python scripts/run_guntur_experiment.py',seed)])
if __name__=='__main__':main()
