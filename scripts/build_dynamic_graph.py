"""Combine aligned baseline and assigned event volume using the configured BPR rule."""
from collections import defaultdict
from guntur_common import DATA,cfg,ensure_dirs,read_csv,write_csv,n
FIELDS=["event_id","road_id","timestamp","baseline_volume_vph","event_volume_vph","total_volume_vph","capacity_vph","volume_capacity_ratio","free_flow_time_sec","baseline_travel_time_sec","event_travel_time_sec","delay_sec","congestion_level"]
def level(v):return 'free' if v<.35 else 'moderate' if v<.65 else 'heavy' if v<.9 else 'severe'
def bpr(t0,v,c,a,b,cap):return t0*(1+a*min(v/c,cap)**b)
def main():
 ensure_dirs();c=cfg();roads={r['road_id']:r for r in read_csv(DATA/'processed/guntur_roads.csv')};base={(r['road_id'],r['timestamp']):r for r in read_csv(DATA/'processed/traffic_baseline.csv')};events=read_csv(DATA/'processed/events.csv');impact=defaultdict(float)
 for r in read_csv(DATA/'processed/event_traffic.csv'):impact[(r['event_id'],r['road_id'],r['timestamp'])]+=n(r['event_vehicle_volume'])
 out=[];p=c['bpr']
 for ev in events:
  times=sorted({t for e,r,t in impact if e==ev['event_id']})
  for ts in times:
   for road_id,road in roads.items():
    br=base.get((road_id,ts));
    if not br:continue
    bv=n(br['baseline_volume_vph']);evv=impact[(ev['event_id'],road_id,ts)];cap=n(road['capacity_vph']);t0=n(road['free_flow_time_sec']);bt=bpr(t0,bv,cap,p['alpha'],p['beta'],p['v_c_cap']);et=bpr(t0,bv+evv,cap,p['alpha'],p['beta'],p['v_c_cap']);ratio=(bv+evv)/cap
    out.append({'event_id':ev['event_id'],'road_id':road_id,'timestamp':ts,'baseline_volume_vph':round(bv,3),'event_volume_vph':round(evv,3),'total_volume_vph':round(bv+evv,3),'capacity_vph':cap,'volume_capacity_ratio':round(ratio,5),'free_flow_time_sec':t0,'baseline_travel_time_sec':round(bt,4),'event_travel_time_sec':round(et,4),'delay_sec':round(et-bt,4),'congestion_level':level(ratio)})
 write_csv(DATA/'processed/dynamic_roads.csv',out,FIELDS);print(f'dynamic rows: {len(out)}')
if __name__=='__main__':main()
