"""Repository-owned directed routing algorithms for CSV road graphs.
No NetworkX shortest-path routine is used here: Dijkstra, A*, and
bidirectional Dijkstra all return a continuous node and road path."""
from __future__ import annotations
import heapq, math
from collections import defaultdict
from guntur_common import n, haversine_m

def build_graph(roads, nodes, weight="free_flow_time_sec"):
    adj=defaultdict(list); rev=defaultdict(list); coords={r["node_id"]:(n(r["latitude"]),n(r["longitude"])) for r in nodes}
    max_speed=max([n(r.get("free_flow_speed_kph"),5) for r in roads] or [5])
    for r in roads:
        cost=max(0.001,n(r.get(weight), n(r.get("free_flow_time_sec"),1)))
        e=(r["to_node"],cost,r["road_id"],n(r.get("length_m")))
        adj[r["from_node"]].append(e); rev[r["to_node"]].append((r["from_node"],cost,r["road_id"],n(r.get("length_m"))))
    return adj,rev,coords,max_speed
def _reconstruct(prev,start,goal):
    nodes=[]; roads=[]; cur=goal
    while cur!=start:
        if cur not in prev:return [],[]
        p,r=prev[cur]; nodes.append(cur);roads.append(r);cur=p
    return [start]+nodes[::-1],roads[::-1]
def dijkstra(adj,start,goal):
    q=[(0,start)]; dist={start:0}; prev={}
    while q:
        d,u=heapq.heappop(q)
        if d!=dist.get(u):continue
        if u==goal:return (*_reconstruct(prev,start,goal),d)
        for v,w,r,_ in adj.get(u,[]):
            nd=d+w
            if nd<dist.get(v,math.inf):dist[v]=nd;prev[v]=(u,r);heapq.heappush(q,(nd,v))
    return [],[],math.inf
def astar(adj,coords,max_speed,start,goal):
    def h(u):
        a,b=coords.get(u),coords.get(goal)
        return haversine_m(*a,*b)/(max_speed/3.6) if a and b else 0
    q=[(h(start),0,start)]; dist={start:0};prev={}
    while q:
        _,d,u=heapq.heappop(q)
        if d!=dist.get(u):continue
        if u==goal:return (*_reconstruct(prev,start,goal),d)
        for v,w,r,_ in adj.get(u,[]):
            nd=d+w
            if nd<dist.get(v,math.inf):dist[v]=nd;prev[v]=(u,r);heapq.heappush(q,(nd+h(v),nd,v))
    return [],[],math.inf
def bidirectional(adj,rev,start,goal):
    if start==goal:return [start],[],0
    fq=[(0,start)];bq=[(0,goal)];fd={start:0};bd={goal:0};fp={};bp={};best=math.inf;meet=None
    while fq and bq:
        if fq[0][0]+bq[0][0]>=best:break
        if fq[0][0]<=bq[0][0]:
            d,u=heapq.heappop(fq)
            if d!=fd.get(u):continue
            if u in bd and d+bd[u]<best:best=d+bd[u];meet=u
            for v,w,r,_ in adj.get(u,[]):
                nd=d+w
                if nd<fd.get(v,math.inf):fd[v]=nd;fp[v]=(u,r);heapq.heappush(fq,(nd,v))
        else:
            d,u=heapq.heappop(bq)
            if d!=bd.get(u):continue
            if u in fd and d+fd[u]<best:best=d+fd[u];meet=u
            for v,w,r,_ in rev.get(u,[]):
                nd=d+w
                if nd<bd.get(v,math.inf):bd[v]=nd;bp[v]=(u,r);heapq.heappush(bq,(nd,v))
    if meet is None:return [],[],math.inf
    left_nodes,left_roads=_reconstruct(fp,start,meet); right_nodes=[];right_roads=[];cur=meet
    while cur!=goal:
        if cur not in bp:return [],[],math.inf
        nxt,r=bp[cur];right_nodes.append(nxt);right_roads.append(r);cur=nxt
    return left_nodes+right_nodes,left_roads+right_roads,best
def route(graph,algorithm,start,goal):
    adj,rev,coords,max_speed=graph
    if algorithm=="astar":return astar(adj,coords,max_speed,start,goal)
    if algorithm=="bidirectional":return bidirectional(adj,rev,start,goal)
    return dijkstra(adj,start,goal)
