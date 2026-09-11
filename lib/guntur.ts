import fs from "node:fs"
import path from "node:path"

type CsvRow = Record<string, string>
export type GunturRoute = { nodePath: string[]; roadPath: string[]; distanceM: number; travelTimeSec: number; executionMs: number; continuous: boolean }
type Edge = { to: string; roadId: string; time: number; length: number }
type Node = { id: string; lat: number; lng: number }
const root = path.join(process.cwd(), "data", "processed")
const csvCache = new Map<string, CsvRow[]>()

function csv(name: string): CsvRow[] {
  const cached=csvCache.get(name); if(cached) return cached
  const file = path.join(root, name)
  if (!fs.existsSync(file)) return []
  const rows = fs.readFileSync(file, "utf8").trim().split(/\r?\n/)
  if (rows.length < 2) return []
  const split = (line: string) => { const out: string[] = []; let v = ""; let q = false; for (let i=0;i<line.length;i++) { const c=line[i]; if (c==='"') { if(q && line[i+1]==='"'){v+='"';i++} else q=!q } else if(c===','&&!q){out.push(v);v=""} else v+=c } out.push(v); return out }
  const headers = split(rows[0]); const parsed=rows.slice(1).map(line => Object.fromEntries(headers.map((h,i)=>[h,split(line)[i] ?? ""]))); csvCache.set(name,parsed); return parsed
}
function num(v: string | undefined) { const n = Number(v); return Number.isFinite(n) ? n : 0 }
// Binary min-heap prevents the real 56k-edge graph from degrading to the
// synthetic grid's former sort-on-every-pop behaviour.
function heapPush<T extends [number, ...unknown[]]>(q: T[], value: T) { q.push(value); let i=q.length-1; while(i){const p=(i-1)>>1;if(q[p][0]<=value[0])break;q[i]=q[p];i=p}q[i]=value }
function heapPop<T extends [number, ...unknown[]]>(q: T[]): T { const top=q[0], last=q.pop()!; if(q.length){let i=0;while(true){let l=i*2+1,r=l+1,s=l;if(l>=q.length)break;if(r<q.length&&q[r][0]<q[l][0])s=r;if(q[s][0]>=last[0])break;q[i]=q[s];i=s}q[i]=last}return top }
function haversine(a: Node, b: Node) { const r=6371000,p=Math.PI/180,dl=(b.lat-a.lat)*p,dn=(b.lng-a.lng)*p; const x=Math.sin(dl/2)**2+Math.cos(a.lat*p)*Math.cos(b.lat*p)*Math.sin(dn/2)**2;return 2*r*Math.asin(Math.sqrt(x)) }
function reconstruct(prev: Map<string,[string,string]>, start: string, goal: string) { const nodes:string[]=[];const roads:string[]=[];let c=goal;while(c!==start){const p=prev.get(c);if(!p)return {nodes:[],roads:[]};nodes.push(c);roads.push(p[1]);c=p[0]}return {nodes:[start,...nodes.reverse()],roads:roads.reverse()} }
function run(algorithm: string, adj: Map<string,Edge[]>, rev: Map<string,Edge[]>, nodes: Map<string,Node>, maxSpeed: number, start: string, goal: string) {
  const startAt=performance.now(); const h=(id:string)=> {const a=nodes.get(id),b=nodes.get(goal);return a&&b?haversine(a,b)/(maxSpeed/3.6):0}
  if(algorithm==="bidirectional") {
    const fq:[number,string][]=[[0,start]],bq:[number,string][]=[[0,goal]];const fd=new Map([[start,0]]),bd=new Map([[goal,0]]),fp=new Map<string,[string,string]>(),bp=new Map<string,[string,string]>();let best=Infinity,meet=""
    while(fq.length&&bq.length){if(fq[0][0]+bq[0][0]>=best)break;const forward=fq[0][0]<=bq[0][0];const [d,u]=heapPop(forward?fq:bq);const cur=forward?fd:bd,other=forward?bd:fd,edges=forward?adj:rev,parents=forward?fp:bp;if(d!==cur.get(u))continue;if(other.has(u)&&d+other.get(u)!<best){best=d+other.get(u)!;meet=u}for(const e of edges.get(u)??[]){const nd=d+e.time;if(nd<(cur.get(e.to)??Infinity)){cur.set(e.to,nd);parents.set(e.to,[u,e.roadId]);heapPush(forward?fq:bq,[nd,e.to])}}}
    if(!meet)return {nodePath:[],roadPath:[],distanceM:0,travelTimeSec:Infinity,executionMs:performance.now()-startAt,continuous:false};const left=reconstruct(fp,start,meet);const rightN:string[]=[];const rightR:string[]=[];let c=meet;while(c!==goal){const p=bp.get(c);if(!p)return {nodePath:[],roadPath:[],distanceM:0,travelTimeSec:Infinity,executionMs:performance.now()-startAt,continuous:false};rightN.push(p[0]);rightR.push(p[1]);c=p[0]}const roadPath=[...left.roads,...rightR];return {nodePath:[...left.nodes,...rightN],roadPath,distanceM:roadPath.reduce((s,r)=>s+(edgeById.get(r)?.length??0),0),travelTimeSec:best,executionMs:performance.now()-startAt,continuous:roadPath.length+1===left.nodes.length+rightN.length}
  }
  const pq:[number,number,string][]=[[algorithm==="astar"?h(start):0,0,start]];const dist=new Map([[start,0]]),prev=new Map<string,[string,string]>();while(pq.length){const [,d,u]=heapPop(pq);if(d!==dist.get(u))continue;if(u===goal){const p=reconstruct(prev,start,goal);return {nodePath:p.nodes,roadPath:p.roads,distanceM:p.roads.reduce((s,r)=>s+(edgeById.get(r)?.length??0),0),travelTimeSec:d,executionMs:performance.now()-startAt,continuous:p.roads.length+1===p.nodes.length}}for(const e of adj.get(u)??[]){const nd=d+e.time;if(nd<(dist.get(e.to)??Infinity)){dist.set(e.to,nd);prev.set(e.to,[u,e.roadId]);heapPush(pq,[nd+(algorithm==="astar"?h(e.to):0),nd,e.to])}}}return {nodePath:[],roadPath:[],distanceM:0,travelTimeSec:Infinity,executionMs:performance.now()-startAt,continuous:false}
}
let edgeById = new Map<string,Edge>()
export function gunturInfo() { return { available: fs.existsSync(path.join(root,"guntur_roads.csv")), events: csv("events.csv"), zones: csv("zones.csv"), disclaimer:"Modeled traffic; not measured Guntur road-sensor data. Road geometry is OpenStreetMap-sourced." } }
export function routeGuntur(eventId: string, timestamp: string, algorithm: string, sourceNode?: string, destinationNode?: string) {
  const roads=csv("guntur_roads.csv"), ns=csv("guntur_nodes.csv"), events=csv("events.csv"), zones=csv("zones.csv");const event=events.find(e=>e.event_id===eventId)??events[0];if(!event)throw new Error("No Guntur event dataset is available")
  const nodes=new Map(ns.map(n=>[n.node_id,{id:n.node_id,lat:num(n.latitude),lng:num(n.longitude)}]));const score=(p:Node)=>(p.lat-num(event.latitude))**2+(p.lng-num(event.longitude))**2;const destination=destinationNode??[...nodes.values()].sort((a,b)=>score(a)-score(b))[0]?.id;const source=sourceNode??zones[0]?.nearest_node_id;if(!source||!destination)throw new Error("Missing route endpoints")
  const shard=`dynamic_index/${event.event_id}__${timestamp.replaceAll(':','-')}.csv`;const dynamic=csv(shard);const weights=new Map(dynamic.map(r=>[r.road_id,num(r.event_travel_time_sec)]));const make=(eventAware:boolean)=>{const a=new Map<string,Edge[]>(),r=new Map<string,Edge[]>();edgeById=new Map();let max=5;for(const x of roads){const e={to:x.to_node,roadId:x.road_id,time:eventAware?(weights.get(x.road_id)??num(x.free_flow_time_sec)):num(x.free_flow_time_sec),length:num(x.length_m)};max=Math.max(max,num(x.free_flow_speed_kph));edgeById.set(x.road_id,e);a.set(x.from_node,[...(a.get(x.from_node)??[]),e]);r.set(x.to_node,[...(r.get(x.to_node)??[]),{...e,to:x.from_node}])}return run(algorithm,a,r,nodes,max,source,destination)}
  const normal=make(false), eventAware=make(true);return {event,sourceNode:source,destinationNode:destination,timestamp,algorithm,normal,eventAware,delaySec:eventAware.travelTimeSec-normal.travelTimeSec,roadsAvoided:normal.roadPath.filter(x=>!eventAware.roadPath.includes(x)),roadsSelected:eventAware.roadPath.filter(x=>!normal.roadPath.includes(x)),disclaimer:"Modeled baseline/event traffic and BPR travel times—not measured road-sensor data."}
}
