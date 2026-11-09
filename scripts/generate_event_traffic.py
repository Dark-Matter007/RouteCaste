"""Route aggregated event vehicle demand over the real directed OSM graph."""
from collections import defaultdict
from datetime import datetime,timedelta
from guntur_common import DATA,cfg,ensure_dirs,read_csv,write_csv,n,haversine_m
from guntur_routing import build_graph,route
FIELDS=["event_id","road_id","timestamp","direction","event_vehicle_volume","arrival_or_departure","assigned_zone_ids","assignment_method","modal_split_version","assumption_flag"]
def nearest(nodes,lat,lon):return min(nodes,key=lambda x:haversine_m(lat,lon,n(x['latitude']),n(x['longitude'])))['node_id']
def hourly_weights(hours,departure=False):
 raw=[i+1 if departure else hours-i for i in range(hours)]; total=sum(raw);return [x/total for x in raw]
def main():
 ensure_dirs();c=cfg();roads=read_csv(DATA/"processed/guntur_roads.csv");nodes=read_csv(DATA/"processed/guntur_nodes.csv");zones=read_csv(DATA/"processed/zones.csv");events=read_csv(DATA/"processed/events.csv");graph=build_graph(roads,nodes);rows=[]
 motor=sum(c['modal_split'][m]/c['occupancy'][m] for m in ['car','bike','bus','auto_rickshaw'])
 for ev in events:
  venue=nearest(nodes,n(ev['latitude']),n(ev['longitude'])); st=datetime.fromisoformat(ev['start_timestamp']);en=datetime.fromisoformat(ev['end_timestamp']);arr_start=datetime.fromisoformat(ev['arrival_window_start']);dep_end=datetime.fromisoformat(ev['departure_window_end'])
  for kind, begin, finish, target_from_zone in [('arrival',arr_start,st,True),('departure',en,dep_end,False)]:
   # Two batches capture early/late arrival (or departure) concentration without
   # routing individual travelers; total demand is conserved exactly.
   span=max(1,math_ceil((finish-begin).total_seconds()/3600));hours=min(2,span);weights=hourly_weights(hours,kind=='departure')
   for z in zones:
    # attendees assigned to zones, then converted to motorized vehicles by configurable split/occupancy.
    vehicles=n(ev['expected_attendance'])*n(z['vehicle_share'])*motor
    start,goal=(z['nearest_node_id'],venue) if target_from_zone else (venue,z['nearest_node_id'])
    node_path,road_path,cost=route(graph,'dijkstra',start,goal)
    if not road_path: print(f"unreachable: {ev['event_id']} {z['zone_id']}");continue
    for h,w in enumerate(weights):
     offset=0 if h==0 else max(0,span-1)
     timestamp=(begin+timedelta(hours=offset)).replace(minute=0,second=0).isoformat(timespec='seconds');vph=vehicles*w
     for road_id in road_path: rows.append({"event_id":ev['event_id'],"road_id":road_id,"timestamp":timestamp,"direction":"to_venue" if target_from_zone else "from_venue","event_vehicle_volume":round(vph,6),"arrival_or_departure":kind,"assigned_zone_ids":z['zone_id'],"assignment_method":"aggregated_zone_shortest_path_dijkstra","modal_split_version":c['modal_split']['version'],"assumption_flag":"modeled demand from attendance/modal split/occupancy"})
 # preserve direction and aggregate only identical road/time/direction demand.
 out=defaultdict(float);meta={}
 for r in rows:
  key=(r['event_id'],r['road_id'],r['timestamp'],r['direction'],r['arrival_or_departure']);out[key]+=n(r['event_vehicle_volume']);meta[key]=r
 result=[]
 for key,val in out.items():x=dict(meta[key]);x['event_vehicle_volume']=round(val,4);result.append(x)
 write_csv(DATA/"processed/event_traffic.csv",result,FIELDS);print(f"event traffic rows: {len(result)}")
def math_ceil(x):
 import math;return math.ceil(x)
if __name__=="__main__":main()
