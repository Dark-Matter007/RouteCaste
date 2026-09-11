"""Create documented-venue records only when Nominatim verifies coordinates.
Synthetic scenarios are explicitly marked and snapped to real graph nodes."""
from datetime import datetime
import requests
from guntur_common import DATA,cfg,ensure_dirs,read_csv,write_csv,n,haversine_m
FIELDS=["event_id","event_name","event_type","venue_name","latitude","longitude","expected_attendance","start_timestamp","end_timestamp","arrival_window_start","departure_window_end","venue_source","event_source","is_synthetic_scenario"]
VENUES=[("Shree Conventions","Concert",10000,"2026-09-11T18:00:00","2026-09-11T22:00:00"),("Vedika Grand Convention Hall","Conference",2500,"2026-09-12T10:00:00","2026-09-12T17:00:00"),("Brahmananda Reddy Stadium","Sports",8000,"2026-09-12T18:00:00","2026-09-12T21:00:00")]
def nearest(nodes,lat,lon): return min(nodes,key=lambda x:haversine_m(lat,lon,n(x['latitude']),n(x['longitude'])))
def lookup(name):
 try:
  r=requests.get("https://nominatim.openstreetmap.org/search",params={"q":f"{name}, Guntur, Andhra Pradesh, India","format":"jsonv2","limit":1},headers={"User-Agent":"RouteCast-Guntur-Dataset/1.0 (educational)"},timeout=20); r.raise_for_status(); x=r.json()
  return (float(x[0]['lat']),float(x[0]['lon'])) if x else None
 except requests.RequestException:return None
def main():
 ensure_dirs(); nodes=read_csv(DATA/"processed/guntur_nodes.csv"); c=cfg();rows=[]
 for index,(name,etype,attendance,start,end) in enumerate(VENUES,1):
  point=lookup(name)
  if point:
   lat,lon=point;source="OpenStreetMap Nominatim geocoding query (retrieved at generation)";synthetic=False
  else:
   # Retain venue-name scenarios but do not present coordinates as verified.
   fc=c['fallback_center']; node=nearest(nodes,fc['latitude'],fc['longitude']);lat,lon=n(node['latitude']),n(node['longitude']);source="Modeled central-Guntur graph-node fallback; venue coordinate not verified";synthetic=True
  st=datetime.fromisoformat(start); en=datetime.fromisoformat(end)
  rows.append({"event_id":f"gtr_evt_{index:03d}","event_name":f"{etype} at {name}","event_type":etype,"venue_name":name,"latitude":lat,"longitude":lon,"expected_attendance":attendance,"start_timestamp":start,"end_timestamp":end,"arrival_window_start":st.replace(hour=max(0,st.hour-3)).isoformat(timespec='seconds'),"departure_window_end":en.replace(hour=min(23,en.hour+2)).isoformat(timespec='seconds'),"venue_source":source,"event_source":"documented venue + generated demonstration scenario","is_synthetic_scenario":str(synthetic).lower()})
 # Always available, graph-grounded fallback for reproducible use without external lookup.
 node=nearest(nodes,sum(n(x['latitude']) for x in nodes)/len(nodes),sum(n(x['longitude']) for x in nodes)/len(nodes))
 rows.append({"event_id":"gtr_evt_004","event_name":"Central Guntur demonstration concert","event_type":"Concert","venue_name":"Central Guntur modeled event node","latitude":node['latitude'],"longitude":node['longitude'],"expected_attendance":10000,"start_timestamp":"2026-09-11T18:00:00","end_timestamp":"2026-09-11T22:00:00","arrival_window_start":"2026-09-11T15:00:00","departure_window_end":"2026-09-12T00:00:00","venue_source":"real OSM road node selected from downloaded graph","event_source":"generated demonstration scenario","is_synthetic_scenario":"true"})
 write_csv(DATA/"processed/events.csv",rows,FIELDS);print(f"events: {len(rows)}")
if __name__=="__main__":main()
