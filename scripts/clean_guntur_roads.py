"""Export source-preserving CSVs and transparently impute only missing tags."""
import json
from guntur_common import DATA,cfg,ensure_dirs,parse_first_number,write_csv

NODE_FIELDS=["node_id","latitude","longitude","street_count"]
ROAD_FIELDS=["road_id","osm_way_id","from_node","to_node","road_name","length_m","lanes","max_speed_kph","road_type","oneway","geometry_wkt","free_flow_speed_kph","free_flow_time_sec","capacity_vph","capacity_source","lanes_source","speed_source"]

def norm_highway(v):
    if isinstance(v,(list,tuple)): v=v[0] if v else "unclassified"
    return str(v or "unclassified").lower()
def main():
    import osmnx as ox
    ensure_dirs(); c=cfg(); graph=ox.load_graphml(DATA/"raw/guntur_osm"/"guntur_drive.graphml")
    nodes_gdf, edges_gdf=ox.graph_to_gdfs(graph, nodes=True, edges=True, fill_edge_geometry=True)
    nodes=[]
    for node_id,row in nodes_gdf.iterrows(): nodes.append({"node_id":str(node_id),"latitude":round(float(row.y),7),"longitude":round(float(row.x),7),"street_count":int(row.get("street_count",0) or 0)})
    roads=[]; assumptions=c["road_assumptions"]
    for (u,v,key),row in edges_gdf.iterrows():
        road_type=norm_highway(row.get("highway")); a=assumptions.get(road_type,assumptions["unclassified"])
        lanes_raw=parse_first_number(row.get("lanes")); speed_raw=parse_first_number(row.get("maxspeed"))
        lanes=max(1,int(round(lanes_raw if lanes_raw else a["lanes"]))); speed=max(5.0,float(speed_raw if speed_raw else a["speed_kph"]))
        osmid=row.get("osmid",""); osmid=";".join(map(str,osmid)) if isinstance(osmid,(list,tuple)) else str(osmid)
        name=row.get("name",""); name=";".join(map(str,name)) if isinstance(name,(list,tuple)) else str(name or "Unnamed road")
        length=max(0.1,float(row.get("length",0.1))); road_id=f"osm:{u}:{v}:{key}"
        roads.append({"road_id":road_id,"osm_way_id":osmid,"from_node":str(u),"to_node":str(v),"road_name":name,"length_m":round(length,2),"lanes":lanes,"max_speed_kph":round(speed,2),"road_type":road_type,"oneway":str(bool(row.get("oneway",False))).lower(),"geometry_wkt":row.geometry.wkt,"free_flow_speed_kph":round(speed,2),"free_flow_time_sec":round(length/speed*3.6,3),"capacity_vph":int(lanes*a["capacity_per_lane_vph"]),"capacity_source":"modeled_road_class_assumption","lanes_source":"osm" if lanes_raw else "imputed_road_class","speed_source":"osm" if speed_raw else "imputed_road_class"})
    write_csv(DATA/"processed/guntur_nodes.csv",nodes,NODE_FIELDS); write_csv(DATA/"processed/guntur_roads.csv",roads,ROAD_FIELDS)
    summary={"nodes":len(nodes),"roads":len(roads),"road_types":{},"imputed_lanes_pct":round(100*sum(r['lanes_source']!='osm' for r in roads)/max(len(roads),1),2),"imputed_speeds_pct":round(100*sum(r['speed_source']!='osm' for r in roads)/max(len(roads),1),2)}
    for r in roads: summary["road_types"][r["road_type"]]=summary["road_types"].get(r["road_type"],0)+1
    (DATA/"processed/road_summary.json").write_text(json.dumps(summary,indent=2),encoding="utf-8"); print(json.dumps(summary,indent=2))
if __name__=="__main__": main()
