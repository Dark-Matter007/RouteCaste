"""Generate temporally coherent modeled baseline traffic, never sensor data."""
from datetime import datetime, timedelta
import math, random
from guntur_common import DATA,cfg,ensure_dirs,read_csv,write_csv,n
FIELDS=["road_id","timestamp","day_of_week","hour","is_weekend","road_type","lanes","free_flow_speed_kph","capacity_vph","baseline_volume_vph","baseline_speed_kph","volume_capacity_ratio","congestion_level","weather","incident_count","data_origin","generation_version","random_seed"]
def profile(hour, weekend, road_type):
    morning=math.exp(-((hour-8)/2.0)**2); evening=math.exp(-((hour-18)/2.4)**2); midday=math.exp(-((hour-13)/3.0)**2)
    arterial=1.15 if road_type in {"primary","trunk","secondary"} else .85
    return (0.10 + arterial*((.48 if not weekend else .30)*morning+(.60 if not weekend else .40)*evening+.20*midday))
def congestion(vcr): return "free" if vcr<.35 else "moderate" if vcr<.65 else "heavy" if vcr<.9 else "severe"
def main():
    ensure_dirs(); c=cfg(); seed=c["random_seed"]; rng=random.Random(seed); roads=read_csv(DATA/"processed/guntur_roads.csv"); rows=[]
    for date in c["baseline_dates"]:
      base=datetime.fromisoformat(date)
      for hour in c.get("baseline_hours", range(24)):
       ts=(base+timedelta(hours=hour)); weekend=ts.weekday()>=5
       for r in roads:
        import hashlib
        cap=n(r["capacity_vph"]); trend=profile(hour,weekend,r["road_type"]); stable=(int(hashlib.sha256(r["road_id"].encode()).hexdigest()[:4],16)/65535-.5)*.12
        # small hourly noise shared deterministically by segment/day; profile drives continuity
        noise=rng.uniform(-.035,.035); weather="clear"; incidents=0
        volume=max(0,cap*min(1.15,trend+stable+noise)); vcr=volume/cap
        speed=max(5,n(r["free_flow_speed_kph"])/(1+.55*max(0,vcr-.25)**1.7))
        rows.append({"road_id":r["road_id"],"timestamp":ts.isoformat(timespec="seconds"),"day_of_week":ts.strftime("%A"),"hour":hour,"is_weekend":str(weekend).lower(),"road_type":r["road_type"],"lanes":r["lanes"],"free_flow_speed_kph":r["free_flow_speed_kph"],"capacity_vph":round(cap,2),"baseline_volume_vph":round(volume,2),"baseline_speed_kph":round(min(speed,n(r["free_flow_speed_kph"])),2),"volume_capacity_ratio":round(vcr,4),"congestion_level":congestion(vcr),"weather":weather,"incident_count":incidents,"data_origin":"Modeled baseline traffic — not measured road-sensor data","generation_version":c["version"],"random_seed":seed})
    write_csv(DATA/"processed/traffic_baseline.csv",rows,FIELDS);print(f"baseline rows: {len(rows)}")
if __name__=="__main__":main()
