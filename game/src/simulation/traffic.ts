import * as T from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Vehicle } from './vehicle';
import { Materials } from '../render/materials';
import { CharacterLibrary,CharacterView } from '../render/characters';
import { SEGMENTS,surfaceHeight,nearestRoad } from '../world/layout.mjs';
import { rng,angleDelta,pointSegment } from '../core/math.mjs';
import type { ActorState } from '../types';
type TrafficCar={car:Vehicle;segment:number;direction:number;target:number};
type Walker={view:CharacterView;x:number;z:number;yaw:number;segment:number;t:number;direction:number;speed:number};
export class Traffic {
  readonly cars:TrafficCar[]=[];readonly walkers:Walker[]=[];
  private random=rng(46006);private accumulator=0;private serial=0;
  constructor(readonly scene:T.Scene,readonly physics:RAPIER.World,readonly materials:Materials,readonly characters:CharacterLibrary){}
  private spawnCar(actor:ActorState,forcePolice=false){
    // Project onto nearby segments rather than sampling their distant endpoints.
    const nearby=SEGMENTS.map((s,i)=>({s,i,hit:pointSegment(actor.x,actor.z,...s.a,...s.b)})).filter(({hit})=>hit.distance<260);
    if(!nearby.length)return;
    const {s,i,hit}=nearby[Math.floor(this.random()*nearby.length)],direction=this.random()>.5?1:-1;
    const t=Math.max(.025,Math.min(.975,hit.t+(this.random()>.5?1:-1)*(75+this.random()*100)/s.length));
    const x=s.a[0]+(s.b[0]-s.a[0])*t-Math.cos(s.yaw)*direction*s.width*.24,z=s.a[1]+(s.b[1]-s.a[1])*t+Math.sin(s.yaw)*direction*s.width*.24;
    const distance=Math.hypot(x-actor.x,z-actor.z);
    if(distance<35||distance>300||this.cars.some(v=>Math.hypot(v.car.position.x-x,v.car.position.z-z)<12))return;
    const index=this.serial++,police=forcePolice||index%6===5;
    const color=police?0xe7e5dc:[0x58787b,0xad624b,0xd3ccad,0x27353e,0x7b8776,0xc5b7b2][index%6];
    const car=new Vehicle(this.physics,this.scene,this.materials,x,z,s.yaw+(direction<0?Math.PI:0),color,police);
    this.cars.push({car,segment:i,direction,target:direction>0?1:0});
  }
  private spawnWalker(actor:ActorState,index:number){
    const hit=nearestRoad(actor.x+(this.random()-.5)*180,actor.z+(this.random()-.5)*180);if(!hit||hit.segment.kind!=='urban')return;
    const s=hit.segment,segment=SEGMENTS.findIndex(v=>v.id===s.id),direction=this.random()>.5?1:-1;
    const x=hit.x-Math.cos(s.yaw)*(s.width/2+2.4),z=hit.z+Math.sin(s.yaw)*(s.width/2+2.4);
    const view=this.characters.make(index);this.scene.add(view.root);this.walkers.push({view,x,z,segment,t:hit.t,direction,yaw:s.yaw+(direction<0?Math.PI:0),speed:.85+this.random()*.6});
  }
  tick(dt:number,actor:ActorState,heat:number,enabled:boolean,budget=10){
    this.accumulator+=dt;
    for(let i=this.cars.length-1;i>=0;i--){const e=this.cars[i],p=e.car.position;if(!e.car.controlled&&((!enabled&&!e.car.police)||Math.hypot(p.x-actor.x,p.z-actor.z)>450||p.y< -3)){e.car.dispose();this.cars.splice(i,1);}}
    for(let i=this.walkers.length-1;i>=0;i--){const w=this.walkers[i];if(!enabled||Math.hypot(w.x-actor.x,w.z-actor.z)>270){w.view.dispose();this.walkers.splice(i,1);}}
    if(this.accumulator>.3){
      this.accumulator=0;
      if(heat>0&&!this.cars.some(e=>e.car.police&&!e.car.controlled))this.spawnCar(actor,true);
      else if(enabled&&this.cars.length<budget)this.spawnCar(actor);
      if(enabled&&this.walkers.length<budget+4)this.spawnWalker(actor,this.walkers.length);
    }
    let seen=false;
    for(const e of this.cars){
      if(e.car.controlled)continue;
      const p=e.car.position,s=SEGMENTS[e.segment],point=e.target?s.b:s.a;
      let tx=point[0]-Math.cos(s.yaw)*e.direction*s.width*.24,tz=point[1]+Math.sin(s.yaw)*e.direction*s.width*.24;
      let speed=e.car.police&&heat>0?22:s.kind==='highway'?24:12;
      if(e.car.police&&heat>0){
        const distance=Math.hypot(p.x-actor.x,p.z-actor.z);
        if(distance<170){
          tx=actor.x;tz=actor.z;
          const dir={x:(actor.x-p.x)/Math.max(1,distance),y:0,z:(actor.z-p.z)/Math.max(1,distance)};
          const hit=this.physics.castRay(new RAPIER.Ray({x:p.x,y:p.y+.6,z:p.z},dir),Math.max(0,distance-3),true,undefined,undefined,e.car.collider);
          if(!hit)seen=true;
        }
      }
      for(const other of this.cars){
        if(other===e)continue;const op=other.car.position,dx=op.x-p.x,dz=op.z-p.z,forward=dx*Math.sin(e.car.yaw)+dz*Math.cos(e.car.yaw),side=Math.abs(dx*Math.cos(e.car.yaw)-dz*Math.sin(e.car.yaw));
        if(forward>0&&forward<15&&side<2.6)speed=Math.min(speed,Math.max(0,(forward-5)*1.4));
      }
      if(Math.hypot(tx-p.x,tz-p.z)<13){
        const junction=point;
        const choices=SEGMENTS.map((next,i)=>({next,i})).filter(({next,i})=>i!==e.segment&&(
          Math.hypot(next.a[0]-junction[0],next.a[1]-junction[1])<1||Math.hypot(next.b[0]-junction[0],next.b[1]-junction[1])<1));
        if(choices.length){const c=choices[Math.floor(this.random()*choices.length)];e.segment=c.i;e.direction=Math.hypot(c.next.a[0]-junction[0],c.next.a[1]-junction[1])<1?1:-1;e.target=e.direction>0?1:0;}
        else{e.direction*=-1;e.target=1-e.target;}
      }
      e.car.follow(dt,tx,tz,speed);
    }
    for(const w of this.walkers){
      const s=SEGMENTS[w.segment];w.t+=w.direction*w.speed*dt/s.length;
      if(w.t<.01||w.t>.99){w.direction*=-1;w.t=Math.max(.01,Math.min(.99,w.t));}
      const side=s.width/2+2.5;w.x=s.a[0]+(s.b[0]-s.a[0])*w.t-Math.cos(s.yaw)*side;w.z=s.a[1]+(s.b[1]-s.a[1])*w.t+Math.sin(s.yaw)*side;
      w.yaw+=angleDelta(w.yaw,s.yaw+(w.direction<0?Math.PI:0))*Math.min(1,dt*7);
      if(actor.driving&&Math.hypot(actor.x-w.x,actor.z-w.z)<7)w.t+=w.direction*dt*3/s.length;
    }
    return seen;
  }
  render(dt:number,night:number){for(const e of this.cars)e.car.render(dt,night);for(const w of this.walkers){w.view.root.position.set(w.x,surfaceHeight(w.x,w.z)+.2,w.z);w.view.root.rotation.y=w.yaw;w.view.update(dt,w.speed);}}
  dispose(){for(const e of this.cars)e.car.dispose();for(const w of this.walkers)w.view.dispose();this.cars.length=this.walkers.length=0;}
}
