import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ResourceCache} from '../src/core/resource-cache.mjs';
import {planStreaming} from '../src/world/stream-plan.mjs';
const cells=n=>Array.from({length:n},(_,i)=>({key:String(i),x:i,z:0,priority:i}));
test('shared signs are disposed only when their last chunk releases them',()=>{
 const disposed=[],cache=new ResourceCache(v=>disposed.push(v));
 const a=cache.acquire('hotel',()=>({id:1})),b=cache.acquire('hotel',()=>assert.fail('must reuse'));
 assert.equal(a,b);cache.release(a);assert.equal(disposed.length,0);cache.release(b);assert.deepEqual(disposed,[a]);assert.equal(cache.size,0);
});
test('streaming through unique districts cannot leave an unbounded sign cache',()=>{
 let count=0;const cache=new ResourceCache(()=>count++);
 for(let i=0;i<1000;i++){const sign=cache.acquire(String(i),()=>({id:i}));cache.release(sign);}
 assert.equal(cache.size,0);assert.equal(count,1000);
});
test('unknown or repeated releases cannot double-dispose a texture',()=>{
 let count=0;const cache=new ResourceCache(()=>count++),a=cache.acquire('a',()=>({}));
 assert.equal(cache.release({}),false);cache.release(a);assert.equal(cache.release(a),false);cache.clear();assert.equal(count,1);
});
test('failed resource factories do not poison future acquisitions',()=>{
 const cache=new ResourceCache(()=>{});assert.throws(()=>cache.acquire('bad',()=>{throw new Error('failed');}));
 assert.equal(cache.size,0);assert.equal(cache.acquire('bad',()=>17),17);
});
test('clearing shared resources disposes each exactly once',()=>{
 let n=0;const cache=new ResourceCache(()=>n++);cache.acquire('a',()=>({}));cache.acquire('a',()=>({}));cache.acquire('b',()=>({}));cache.clear();cache.clear();assert.equal(n,2);
});
test('increasing quality replaces nearby low-detail cells before adding distant cells',()=>{
 const needed=cells(25),loaded=new Map(cells(9).map(c=>[c.key,{detail:false}]));
 const p=planStreaming(loaded,needed,true);assert.deepEqual(p.remove,[]);assert.deepEqual(p.pending,needed);assert.equal(loaded.size,9);
});
test('lowering quality retires far cells and replaces retained high-detail cells',()=>{
 const loaded=new Map(cells(25).map(c=>[c.key,{detail:true}])),p=planStreaming(loaded,cells(9),false);
 assert.equal(p.remove.length,16);assert.equal(p.pending.length,9);
});
test('unchanged streaming cells require no rebuild; replacement ordering stays deterministic',()=>{
 const needed=cells(25),loaded=new Map(needed.map(c=>[c.key,{detail:true}]));
 assert.deepEqual(planStreaming(loaded,needed,true),{remove:[],pending:[]});
 loaded.delete('3');assert.deepEqual(planStreaming(loaded,needed,true).pending,[needed[3]]);
});
