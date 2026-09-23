import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTrafficNetwork, outgoingRoads, chooseNextRoad, lanePoint, trafficGuidance, followControls } from '../src/simulation/traffic-routing.mjs';
const road = (a,b,id='road',kind='urban') => ({a,b,id,width:16,kind});
const cross = () => createTrafficNetwork([road([-100,0],[100,0],'ew'),road([0,-100],[0,100],'ns')]);
test('traffic sees all three onward choices at a middle-of-segment crossing', () => {
 const n=cross(), i=n.segments.findIndex(s=>s.a[0]===-100), r={segment:i,direction:1};
 assert.equal(outgoingRoads(n,r).length,3);
 for(const c of outgoingRoads(n,r))assert.notEqual(c.segment,i);
 const choices=new Set(Array.from({length:100},(_,i)=>JSON.stringify(chooseNextRoad(n,r,i/100))));assert.equal(choices.size,3);
});
test('duplicate definitions do not multiply traffic lanes',()=>{
 const n=createTrafficNetwork([road([0,0],[100,0]),road([100,0],[0,0])]);assert.equal(n.segments.length,1);
});
test('opposite directions use separated right-hand lanes',()=>{
 const s=createTrafficNetwork([road([0,0],[0,100])]).segments[0];
 assert.deepEqual(lanePoint(s,.5,1),{x:-3.84,z:50});assert.deepEqual(lanePoint(s,.5,-1),{x:3.84,z:50});
});
test('long roads target a nearby look-ahead point, not a kilometre-away endpoint',()=>{
 const n=createTrafficNetwork([road([0,0],[0,1000])]), r={segment:0,direction:1};
 const g=trafficGuidance(n,r,null,{x:-3.84,z:400},12);assert.ok(g.z>406&&g.z<424);assert.equal(g.x,-3.84);assert.equal(g.advance,false);
});
test('turn preview slows before a corner and connects to the outgoing lane',()=>{
 const n=createTrafficNetwork([road([0,-100],[0,0]),road([0,0],[100,0])]), r={segment:0,direction:1}, next=chooseNextRoad(n,r,.5);
 const far=trafficGuidance(n,r,next,{x:-3.84,z:-80},12), near=trafficGuidance(n,r,next,{x:-3.84,z:-4},12);
 assert.ok(near.targetSpeed<far.targetSpeed);assert.ok(near.x>0);assert.equal(near.advance,true);
});
test('dead ends alone permit a turnaround',()=>{
 const n=createTrafficNetwork([road([0,0],[0,100])]);assert.deepEqual(chooseNextRoad(n,{segment:0,direction:1},.4),{segment:0,direction:-1});
});
test('queued vehicles hold stationary rather than reversing into followers',()=>{
 for(const speed of [0,.1,-.1,-1]){const c=followControls(speed,0,0);assert.equal(c.throttle,0);assert.equal(c.handbrake,true);}
 assert.ok(followControls(10,0,0).throttle<0);assert.ok(followControls(0,12,0).throttle>0);
});
test('empty topology and non-finite control data fail safely',()=>{
 const n=createTrafficNetwork([]);assert.deepEqual(outgoingRoads(n,{segment:0,direction:1}),[]);
 assert.equal(chooseNextRoad(n,{segment:0,direction:1},.5),null);assert.equal(trafficGuidance(n,{segment:0,direction:1},null,{x:0,z:0},0),null);
 assert.deepEqual(followControls(NaN,NaN,NaN),{throttle:0,steering:0,handbrake:true});
});
