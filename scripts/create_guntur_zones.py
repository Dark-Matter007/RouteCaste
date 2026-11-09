"""Derive configurable Guntur origin zones from real graph extent."""
from guntur_common import DATA,cfg,ensure_dirs,read_csv,write_csv,n,haversine_m
FIELDS=["zone_id","zone_name","latitude","longitude","vehicle_share","nearest_node_id","share_source"]
def near(nodes,lat,lon):return min(nodes,key=lambda x:haversine_m(lat,lon,n(x['latitude']),n(x['longitude'])))['node_id']
def main():
 ensure_dirs(); c=cfg();nodes=read_csv(DATA/"processed/guntur_nodes.csv");lats=[n(x['latitude']) for x in nodes];lons=[n(x['longitude']) for x in nodes];lat0=sum(lats)/len(lats);lon0=sum(lons)/len(lons)
 targets={"north":(max(lats),lon0),"south":(min(lats),lon0),"east":(lat0,max(lons)),"west":(lat0,min(lons)),"central":(lat0,lon0)};rows=[]
 for zid,(lat,lon) in targets.items(): rows.append({"zone_id":zid,"zone_name":f"{zid.title()} Guntur","latitude":round(lat,7),"longitude":round(lon,7),"vehicle_share":c['zone_vehicle_shares'][zid],"nearest_node_id":near(nodes,lat,lon),"share_source":"modeled configurable assumption"})
 write_csv(DATA/"processed/zones.csv",rows,FIELDS);print(f"zones: {len(rows)}")
if __name__=="__main__":main()
