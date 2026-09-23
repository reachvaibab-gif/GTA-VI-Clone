import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lampPlacement,buildStreetLights,selectStreetLights} from '../src/world/street-lights.mjs';
const road={id:'main',a:[0,0],b:[0,160],length:160,yaw:0,width:16,kind:'urban'};
test('fixtures and point lights share the same globally anchored road placement',()=>{
 const p=lampPlacement(road,4,1);assert.equal(p.x,11.4);assert.equal(p.roadZ,72);assert.equal(p.z,72);assert.equal(p.lightX,9.9);assert.equal(p.lightZ,72);
 const opposite=lampPlacement(road,4,-1);assert.equal(opposite.x,-11.4);assert.equal(opposite.lightX,-9.9);
});
test('urban lamps use the fixture cadence and preserve the terrain height',()=>{
 const list=buildStreetLights([road],()=>2.4,()=>null);assert.equal(list.length,6);assert.ok(list.every(p=>p.y===10.5));assert.equal(new Set(list.map(p=>p.id)).size,6);
});
test('cross-street mouths suppress both the fixture and its invisible light',()=>{
 const list=buildStreetLights([road],()=>2.4,()=>({segment:{id:'cross',width:16},distance:2}));assert.deepEqual(list,[]);
 assert.deepEqual(buildStreetLights([{...road,kind:'highway'}],()=>2.4,()=>null),[]);
});
test('local light selection has a fixed budget and never reaches across the map',()=>{
 const lamps=Array.from({length:100},(_,i)=>({id:String(i),x:i*10,z:0}));
 assert.deepEqual(selectStreetLights(lamps,{x:0,z:0},[],4,80).map(l=>l.id),['0','1','2','3']);
 assert.deepEqual(selectStreetLights(lamps,{x:10000,z:0}),[]);
});
test('retention bias keeps equivalent neighbors from swapping at every frame',()=>{
 const lamps=[{id:'a',x:-10,z:0},{id:'b',x:10,z:0}];
 assert.equal(selectStreetLights(lamps,{x:.1,z:0},['a'],1)[0].id,'a');
 assert.equal(selectStreetLights(lamps,{x:5,z:0},['a'],1)[0].id,'b');
});
test('invalid road indices and focus coordinates are rejected without NaN matrices',()=>{
 assert.equal(lampPlacement(road,-1,1),null);assert.equal(lampPlacement(road,0,0),null);assert.equal(lampPlacement({...road,length:0},0,1),null);
 assert.deepEqual(selectStreetLights([],{x:NaN,z:0}),[]);
});
