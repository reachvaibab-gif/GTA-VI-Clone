import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRoadGraph, splitRoadSegments, routeBetween, nearestNode, projectToSegment } from '../src/world/road-graph.mjs';
const road = (a,b,id='road') => ({ a,b,id,width:16,kind:'urban' });
const length = points => points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-points[i].x,p.z-points[i].z),0);

test('mid-block GPS takes the direct road, never a nearest-junction detour', () => {
  const graph=buildRoadGraph([road([0,0],[1000,0])]);
  const path=routeBetween({x:480,z:0},{x:520,z:0},graph);
  assert.equal(length(path),40); assert.deepEqual(path,[{x:480,z:0},{x:520,z:0}]);
});
test('off-road endpoints join perpendicularly rather than cutting diagonally across blocks', () => {
  const graph=buildRoadGraph([road([0,0],[1000,0])]);
  const path=routeBetween({x:480,z:20},{x:520,z:-20},graph);
  assert.deepEqual(path,[{x:480,z:20},{x:480,z:0},{x:520,z:0},{x:520,z:-20}]);
  assert.equal(length(path),80);
});
test('crossing roads have four traffic edges and a connected GPS turn', () => {
  const roads=[road([-100,0],[100,0],'ew'),road([0,-100],[0,100],'ns')];
  const pieces=splitRoadSegments(roads), graph=buildRoadGraph(roads);
  assert.equal(pieces.length,4);assert.equal(graph.find(n=>n.x===0&&n.z===0).edges.length,4);
  assert.equal(length(routeBetween({x:-60,z:0},{x:0,z:80},graph)),140);
  assert.equal(pieces.filter(s=>s.sourceId==='ns').length,2);
  assert.ok(pieces.every(s=>s.width===16&&s.kind==='urban'));
});
test('collinear T-junction and overlapping roads connect without duplicate edges', () => {
  const graph=buildRoadGraph([road([0,0],[100,0],'main'),road([30,0],[70,0],'overlap'),road([50,0],[50,60],'branch')]);
  assert.equal(length(routeBetween({x:20,z:0},{x:50,z:40},graph)),70);
  for(const n of graph)assert.equal(new Set(n.edges.map(e=>e.to)).size,n.edges.length);
});
test('disconnected roads do not fabricate a path over water', () => {
  const graph=buildRoadGraph([road([0,0],[100,0]),road([500,500],[600,500])]);
  assert.deepEqual(routeBetween({x:40,z:0},{x:550,z:500},graph),[]);
});
test('reverse driving yields the reverse route length', () => {
  const graph=buildRoadGraph([road([0,0],[100,0]),road([100,0],[100,100])]);
  const a={x:30,z:0}, b={x:100,z:70};
  assert.equal(length(routeBetween(a,b,graph)),140);
  assert.deepEqual(routeBetween(a,b,graph),routeBetween(b,a,graph).reverse());
});
test('bad coordinates, zero-length roads and empty graphs fail safely', () => {
  assert.deepEqual(buildRoadGraph([road([0,0],[0,0])]),[]);
  assert.deepEqual(buildRoadGraph([road([NaN,0],[10,0])]),[]);
  assert.equal(nearestNode(0,0,[]),-1);
  assert.deepEqual(routeBetween({x:NaN,z:0},{x:0,z:0},[]),[]);
  assert.deepEqual(projectToSegment({x:3,z:4},{x:0,z:0},{x:0,z:0}),{x:0,z:0,t:0,distance:5});
});
test('large negative map coordinates retain scale and shared intersections', () => {
  const graph=buildRoadGraph([road([-9000,-6000],[-8000,-6000]),road([-8500,-6500],[-8500,-5500])]);
  assert.equal(length(routeBetween({x:-8900,z:-6000},{x:-8500,z:-5700},graph)),700);
});
test('split topology is deterministic and does not mutate reference geometry', () => {
  const roads=[road([0,0],[100,0]),road([50,-50],[50,50])], original=structuredClone(roads);
  assert.deepEqual(splitRoadSegments(roads),splitRoadSegments(roads));assert.deepEqual(roads,original);
});
