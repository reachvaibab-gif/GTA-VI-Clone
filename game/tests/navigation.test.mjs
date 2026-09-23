import test from 'node:test';import assert from 'node:assert/strict';
import {buildRoadGraph,routeBetween,ROAD_GRAPH} from '../src/world/navigation.mjs';
test('crossing roads split into a shared traversable intersection',()=>{const g=buildRoadGraph([{a:[-10,0],b:[10,0]},{a:[0,-10],b:[0,10]}]);const center=g.find(n=>n.x===0&&n.z===0);assert.equal(center.edges.length,4);const r=routeBetween({x:-10,z:0},{x:0,z:10},g);assert.ok(r.some(p=>p.x===0&&p.z===0));});
test('shore-to-Keys route connects through the causeway and highway',()=>{const r=routeBetween({x:1995,z:-420},{x:-5380,z:7330});assert.ok(r.length>10);assert.ok(r.some(p=>p.x===1520&&p.z===-1020));assert.ok(ROAD_GRAPH.length>40);});
test('disconnected road networks return no fabricated GPS route',()=>{const g=buildRoadGraph([{a:[0,0],b:[10,0]},{a:[100,0],b:[110,0]}]);assert.deepEqual(routeBetween({x:0,z:0},{x:110,z:0},g),[]);});
