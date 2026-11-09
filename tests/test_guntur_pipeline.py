import sys, unittest, tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from guntur_routing import build_graph,route
from guntur_common import cfg,n,DATA,read_csv
from build_dynamic_graph import bpr

# Tiny geometric separation keeps the A* straight-line/max-speed heuristic
# admissible for this deliberately short-time toy fixture.
NODES=[{'node_id':'a','latitude':'16.30000','longitude':'80.40000'},{'node_id':'b','latitude':'16.30001','longitude':'80.40001'},{'node_id':'c','latitude':'16.30002','longitude':'80.40002'}]
ROADS=[{'road_id':'ab','from_node':'a','to_node':'b','free_flow_time_sec':'10','length_m':'100','free_flow_speed_kph':'40'},{'road_id':'bc','from_node':'b','to_node':'c','free_flow_time_sec':'10','length_m':'100','free_flow_speed_kph':'40'},{'road_id':'ac','from_node':'a','to_node':'c','free_flow_time_sec':'30','length_m':'250','free_flow_speed_kph':'40'}]
class GunturPipelineTests(unittest.TestCase):
 def test_all_owned_algorithms_find_continuous_shortest_path(self):
  g=build_graph(ROADS,NODES)
  for alg in ('dijkstra','astar','bidirectional'):
   nodes,roads,cost=route(g,alg,'a','c');self.assertEqual(nodes,['a','b','c']);self.assertEqual(roads,['ab','bc']);self.assertEqual(cost,20)
 def test_bpr_is_monotonic_and_positive(self):
  self.assertGreater(bpr(10,100,100,.15,4,4),10);self.assertGreater(bpr(10,200,100,.15,4,4),bpr(10,100,100,.15,4,4))
 def test_road_schema_and_node_integrity(self):
  import json
  roads=read_csv(DATA/'processed/guntur_roads.csv');nodes={x['node_id'] for x in read_csv(DATA/'processed/guntur_nodes.csv')};summary=json.loads((DATA/'processed/road_summary.json').read_text());self.assertEqual(len(roads),len({x['road_id'] for x in roads}));self.assertTrue(all(x['from_node'] in nodes and x['to_node'] in nodes and n(x['length_m'])>0 and n(x['capacity_vph'])>0 for x in roads));self.assertGreater(summary['imputed_lanes_pct'],0);self.assertGreater(summary['imputed_speeds_pct'],0)
 def test_baseline_constraints_and_label(self):
  rows=read_csv(DATA/'processed/traffic_baseline.csv');self.assertTrue(all(n(x['baseline_volume_vph'])>=0 and 0<n(x['baseline_speed_kph'])<=n(x['free_flow_speed_kph']) and x['data_origin'].startswith('Modeled baseline') for x in rows))
 def test_zone_shares_and_event_times(self):
  zones=read_csv(DATA/'processed/zones.csv');events=read_csv(DATA/'processed/events.csv');self.assertAlmostEqual(sum(n(x['vehicle_share']) for x in zones),1.0,places=6);self.assertTrue(all(x['nearest_node_id'] for x in zones));self.assertTrue(all(n(x['expected_attendance'])>0 and x['start_timestamp']<x['end_timestamp'] for x in events))
 def test_event_vehicle_conversion_and_assignment(self):
  c=cfg();motor=sum(c['modal_split'][m]/c['occupancy'][m] for m in ('car','bike','bus','auto_rickshaw'));events={x['event_id']:x for x in read_csv(DATA/'processed/events.csv')};impacts=read_csv(DATA/'processed/event_traffic.csv');self.assertTrue(all(n(x['event_vehicle_volume'])>=0 and x['assignment_method'].startswith('aggregated_zone') for x in impacts));event=events['gtr_evt_004'];expected=n(event['expected_attendance'])*motor*c['zone_vehicle_shares']['north'];north=[n(x['event_vehicle_volume']) for x in impacts if x['event_id']=='gtr_evt_004' and x['assigned_zone_ids']=='north' and x['arrival_or_departure']=='arrival'];self.assertAlmostEqual(min(north)+max(north),expected,places=2)
 def test_dynamic_weights_and_route_experiment(self):
  dynamic=read_csv(DATA/'processed/dynamic_roads.csv');self.assertTrue(all(n(x['event_travel_time_sec'])>=n(x['baseline_travel_time_sec']) and n(x['total_volume_vph'])>=n(x['baseline_volume_vph']) for x in dynamic));results=read_csv(DATA/'processed/route_results.csv');self.assertEqual({x['algorithm'] for x in results},{'dijkstra','astar','bidirectional'});self.assertTrue(all(x['continuous']=='true' for x in results));self.assertTrue(any(n(x['delay_sec'])>0 for x in results))
 def test_model_artifact_and_held_out_events(self):
  import joblib,json,pandas as pd
  model=joblib.load(Path(__file__).resolve().parents[1]/'models/artifacts/guntur_hist_gradient_boosting.joblib');report=json.loads((Path(__file__).resolve().parents[1]/'models/reports/guntur_traffic_model_report.json').read_text());self.assertNotIn(report['split']['test_event'],report['split']['train_events']);self.assertEqual(report['selected_model'],'hist_gradient_boosting');sample={k:(30 if k in {'length_m','free_flow_speed_kph','baseline_speed_kph'} else 1) for k in report['features']};sample.update({'road_type':'primary','event_type':'Concert','weather':'clear'});self.assertGreater(model.predict(pd.DataFrame([sample]))[0],0)
if __name__=='__main__':unittest.main()
