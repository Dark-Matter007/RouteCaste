"""Schema, provenance, mathematical, and directed-integrity checks."""
from datetime import datetime
from collections import Counter
from guntur_common import DATA,read_csv,n
def check(ok,msg):
 if not ok:raise AssertionError(msg)
def main():
 nodes=read_csv(DATA/'processed/guntur_nodes.csv');roads=read_csv(DATA/'processed/guntur_roads.csv');base=read_csv(DATA/'processed/traffic_baseline.csv');zones=read_csv(DATA/'processed/zones.csv');events=read_csv(DATA/'processed/events.csv');impact=read_csv(DATA/'processed/event_traffic.csv');dynamic=read_csv(DATA/'processed/dynamic_roads.csv');ids={x['node_id'] for x in nodes}
 check(len(ids)==len(nodes),'unique node IDs');check(len({x['road_id'] for x in roads})==len(roads),'unique road IDs');check(all(r['from_node'] in ids and r['to_node'] in ids and n(r['length_m'])>0 and n(r['free_flow_speed_kph'])>0 and n(r['free_flow_time_sec'])>0 for r in roads),'road integrity');check(all(-90<=n(x['latitude'])<=90 and -180<=n(x['longitude'])<=180 for x in nodes),'valid coordinates');check(all(n(x['baseline_volume_vph'])>=0 and n(x['baseline_speed_kph'])>0 and n(x['capacity_vph'])>0 and x['data_origin'].startswith('Modeled baseline') for x in base),'baseline constraints');check(abs(sum(n(x['vehicle_share']) for x in zones)-1)<1e-6,'zone shares');check(len({x['event_id'] for x in events})==len(events),'unique events');check(all(n(x['expected_attendance'])>0 and datetime.fromisoformat(x['start_timestamp'])<datetime.fromisoformat(x['end_timestamp']) for x in events),'event constraints');check(all(n(x['event_vehicle_volume'])>=0 for x in impact),'event traffic constraints');check(all(n(x['event_travel_time_sec'])>=n(x['baseline_travel_time_sec']) and n(x['total_volume_vph'])>=n(x['baseline_volume_vph']) for x in dynamic),'BPR dynamic constraints');print(f'VALID: {len(nodes)} nodes, {len(roads)} roads, {len(base)} baseline, {len(events)} events, {len(impact)} event traffic, {len(dynamic)} dynamic')
if __name__=='__main__':main()
