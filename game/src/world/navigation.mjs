import { SEGMENTS } from './layout.mjs';
export function buildRoadGraph(segments=SEGMENTS){
  const cuts=segments.map(()=>[0,1]);
  for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
    const a=segments[i],b=segments[j],ax=a.b[0]-a.a[0],az=a.b[1]-a.a[1],bx=b.b[0]-b.a[0],bz=b.b[1]-b.a[1],det=ax*bz-az*bx;
    if(Math.abs(det)<1e-8)continue;
    const dx=b.a[0]-a.a[0],dz=b.a[1]-a.a[1],t=(dx*bz-dz*bx)/det,u=(dx*az-dz*ax)/det;
    if(t>=0&&t<=1&&u>=0&&u<=1){cuts[i].push(t);cuts[j].push(u);}
  }
  const nodes=[],lookup=new Map();
  const node=(x,z)=>{const key=`${x.toFixed(3)},${z.toFixed(3)}`;if(lookup.has(key))return lookup.get(key);const id=nodes.length;nodes.push({id,x,z,edges:[]});lookup.set(key,id);return id;};
  segments.forEach((s,i)=>{
    const ts=[...new Set(cuts[i])].sort((a,b)=>a-b);
    for(let j=1;j<ts.length;j++){
      const a=node(s.a[0]+(s.b[0]-s.a[0])*ts[j-1],s.a[1]+(s.b[1]-s.a[1])*ts[j-1]);
      const b=node(s.a[0]+(s.b[0]-s.a[0])*ts[j],s.a[1]+(s.b[1]-s.a[1])*ts[j]);
      if(a===b)continue;const cost=Math.hypot(nodes[a].x-nodes[b].x,nodes[a].z-nodes[b].z);
      nodes[a].edges.push({to:b,cost});nodes[b].edges.push({to:a,cost});
    }
  });return nodes;
}
export const ROAD_GRAPH=buildRoadGraph();
export function nearestNode(x,z,nodes=ROAD_GRAPH){let best=0,d=Infinity;for(const n of nodes){const v=Math.hypot(n.x-x,n.z-z);if(v<d){d=v;best=n.id;}}return best;}
export function routeBetween(start,end,nodes=ROAD_GRAPH){
  if(!nodes.length)return [];
  const source=nearestNode(start.x,start.z,nodes),target=nearestNode(end.x,end.z,nodes),distance=nodes.map(()=>Infinity),prev=nodes.map(()=>-1),visited=new Set();distance[source]=0;
  for(let step=0;step<nodes.length;step++){
    let at=-1,best=Infinity;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&distance[i]<best){at=i;best=distance[i];}
    if(at<0||at===target)break;visited.add(at);
    for(const edge of nodes[at].edges){const cost=distance[at]+edge.cost;if(cost<distance[edge.to]){distance[edge.to]=cost;prev[edge.to]=at;}}
  }
  if(!Number.isFinite(distance[target]))return [];
  const points=[];for(let at=target;at>=0;at=prev[at]){points.push({x:nodes[at].x,z:nodes[at].z});if(at===source)break;}
  return [{x:start.x,z:start.z},...points.reverse(),{x:end.x,z:end.z}];
}
