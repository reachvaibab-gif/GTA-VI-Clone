import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planBuilding} from '../src/world/building-plan.mjs';
const spec={width:28,depth:31,height:24,style:'deco',seed:46006};
test('architectural geometry is deterministic regardless of chunk creation order',()=>{
 const a=planBuilding(spec);planBuilding({...spec,seed:999});assert.deepEqual(planBuilding(spec),a);
});
test('all styles produce finite positive geometry in metre-scale bounds',()=>{
 for(const style of ['deco','tower','house','warehouse'])for(const height of [8,24,98]){
  const p=planBuilding({...spec,style,height});assert.ok(p.parts.length>15);
  for(const part of p.parts){assert.ok(part.position.every(Number.isFinite));assert.ok(part.size.every(n=>Number.isFinite(n)&&n>0));assert.ok(Math.abs(part.position[0])<spec.width);assert.ok(Math.abs(part.position[2])<spec.depth);assert.ok(part.position[1]<height+5);}
 }
});
test('low detail removes small trim and bounds tall-building window density',()=>{
 const full=planBuilding({...spec,height:98,style:'tower'}),low=planBuilding({...spec,height:98,style:'tower'},false);
 assert.ok(low.parts.length<full.parts.length*.4);assert.ok(low.parts.length<700);
});
test('houses use pitched tile roofs rather than the commercial building silhouette',()=>{
 const p=planBuilding({...spec,style:'house',height:10});assert.ok(p.parts.some(p=>p.shape==='gable'&&p.material==='roofTile'));
 assert.equal(p.parts.some(p=>p.material==='neon'),false);
});
test('warehouse loading doors, bollards and roof use an industrial kit',()=>{
 const p=planBuilding({...spec,style:'warehouse'});assert.ok(p.parts.some(p=>p.shape==='gable'&&p.material==='metal'));
 assert.ok(p.parts.some(p=>p.shape==='round'&&p.color===0xd1a253));
});
test('deco variants have different silhouette parts and maintain façade detail',()=>{
 const plans=Array.from({length:40},(_,i)=>planBuilding({...spec,seed:i*4981}));
 assert.equal(new Set(plans.map(p=>p.variant)).size,4);
 for(const p of plans){assert.ok(p.parts.some(p=>p.material==='glass'));assert.ok(p.parts.some(p=>p.position[2]<-spec.depth/2));}
});
test('invalid dimensions are rejected instead of poisoning instanced matrices',()=>{
 for(const width of [0,-5,NaN,Infinity])assert.throws(()=>planBuilding({...spec,width}),RangeError);
});
