"""Reproducible normal vs event-aware route comparison using repository algorithms."""
from datetime import datetime
from collections import defaultdict
import time
from guntur_common import DATA,read_csv,n,write_csv
from guntur_routing import build_graph,route
FIELDS=['event_id','timestamp','algorithm','condition','source_node','destination_node','node_path','road_path','distance_m','travel_time_sec','delay_sec','execution_ms','continuous']
def main():
 roads=read_csv(DATA/'processed/guntur_roads.csv');nodes=read_csv(DATA/'processed/guntur_nodes.csv');zones=read_csv(DATA/'processed/zones.csv');events=read_csv(DATA/'processed/events.csv');ev=next(x for x in events if x['event_id']=='gtr_evt_004');ts='2026-09-11T17:00:00';src=next(x for x in zones if x['zone_id']=='north')['nearest_node_id'];dst=min(nodes,key=lambda x:(n(x['latitude'])-n(ev['latitude']))**2+(n(x['longitude'])-n(ev['longitude']))**2)['node_id'];dyn={(r['road_id'],r['timestamp']):r for r in read_csv(DATA/'processed/dynamic_roads.csv') if r['event_id']==ev['event_id']};normal=[dict(r,free_flow_time_sec=r['free_flow_time_sec']) for r in roads];event=[dict(r,free_flow_time_sec=dyn.get((r['road_id'],ts),{}).get('event_travel_time_sec',r['free_flow_time_sec'])) for r in roads];out=[]
 for algorithm in ['dijkstra','astar','bidirectional']:
  times={}
  for condition,rs in [('normal',normal),('event_aware',event)]:
   started=time.perf_counter();np,rp,cost=route(build_graph(rs,nodes),algorithm,src,dst);ms=(time.perf_counter()-started)*1000;dist=sum(n(next(r for r in roads if r['road_id']==rid)['length_m']) for rid in rp);times[condition]=cost
   out.append({'event_id':ev['event_id'],'timestamp':ts,'algorithm':algorithm,'condition':condition,'source_node':src,'destination_node':dst,'node_path':'|'.join(np),'road_path':'|'.join(rp),'distance_m':round(dist,2),'travel_time_sec':round(cost,3),'delay_sec':0,'execution_ms':round(ms,4),'continuous':str(len(np)==len(rp)+1).lower()})
  out[-1]['delay_sec']=round(times['event_aware']-times['normal'],3)
 write_csv(DATA/'processed/route_results.csv',out,FIELDS);print('\n'.join(str(x) for x in out))
if __name__=='__main__':main()
