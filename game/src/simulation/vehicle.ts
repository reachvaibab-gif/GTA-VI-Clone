import * as T from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { carModel,type CarModel } from '../render/vehicle-model';
import { Materials } from '../render/materials';
import { clamp,damp,angleDelta } from '../core/math.mjs';
import { surfaceHeight } from '../world/layout.mjs';
import { createVehicleBody,VEHICLE_MASS,ENGINE_ACCELERATION } from './vehicle-body.mjs';
export class Vehicle {
  readonly body:RAPIER.RigidBody;readonly collider:RAPIER.Collider;readonly model:CarModel;
  health=100;speed=0;steer=0;doorTime=0;controlled=false;traveled=0;private lastSpeed=0;
  constructor(readonly physics:RAPIER.World,scene:T.Scene,materials:Materials,x:number,z:number,yaw:number,color:T.ColorRepresentation,readonly police=false){
    const rigid=createVehicleBody(physics,x,surfaceHeight(x,z)+.85,z,yaw);this.body=rigid.body;this.collider=rigid.collider;
    this.model=carModel(materials,color,police);scene.add(this.model.root);
  }
  get position(){return this.body.translation();}
  get yaw(){const q=this.body.rotation();return Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.y*q.y+q.z*q.z));}
  teleport(x:number,z:number,yaw=this.yaw){this.body.setTranslation({x,y:surfaceHeight(x,z)+.85,z},true);this.body.setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)},true);this.body.setLinvel({x:0,y:0,z:0},true);this.body.setAngvel({x:0,y:0,z:0},true);this.speed=this.lastSpeed=0;}
  drive(dt:number,throttle:number,steering:number,handbrake=false){
    const yaw=this.yaw,fx=Math.sin(yaw),fz=Math.cos(yaw),v=this.body.linvel(),long=v.x*fx+v.z*fz;
    const lateral=v.x*fz-v.z*fx,grip=handbrake?1.7:10;
    this.speed=long;this.steer=damp(this.steer,steering*.48/(1+Math.abs(long)*.018),10,dt);
    let acceleration=throttle*(throttle*long<-.5?13:ENGINE_ACCELERATION)-long*.04-long*Math.abs(long)*.0018;
    if(handbrake)acceleration-=Math.sign(long)*Math.min(Math.abs(long)/dt,13);
    if(long>58&&acceleration>0||long< -15&&acceleration<0)acceleration=0;
    const sideImpulse=-lateral*(1-Math.exp(-grip*dt));
    this.body.setLinvel({x:v.x+fz*sideImpulse,y:v.y,z:v.z-fx*sideImpulse},true);
    this.body.resetForces(true);this.body.addForce({x:fx*acceleration*VEHICLE_MASS,y:0,z:fz*acceleration*VEHICLE_MASS},true);
    this.body.setAngvel({x:0,y:clamp(long/2.85*Math.tan(this.steer),-1.65,1.65),z:0},true);
    this.traveled+=Math.abs(long)*dt;
    if(Math.abs(this.lastSpeed)-Math.abs(long)>7)this.health=Math.max(0,this.health-(Math.abs(this.lastSpeed)-Math.abs(long))*1.2);
    this.lastSpeed=long;this.model.brake.emissiveIntensity=handbrake||throttle*long<-.3?2.4:.4;
  }
  follow(dt:number,x:number,z:number,targetSpeed=14){
    const p=this.position,heading=Math.atan2(x-p.x,z-p.z),delta=angleDelta(this.yaw,heading);
    this.drive(dt,clamp((targetSpeed-this.speed)*.35,-1,1),clamp(delta*1.9,-1,1));
  }
  render(dt:number,night:number){
    const p=this.body.translation(),q=this.body.rotation();this.model.root.position.set(p.x,p.y-.55,p.z);this.model.root.quaternion.set(q.x,q.y,q.z,q.w);
    this.model.wheels.forEach((wheel,i)=>{wheel.rotation.y=i<2?this.steer:0;});this.model.spins.forEach(spin=>spin.rotation.x+=this.speed*dt/.365);
    this.doorTime=Math.max(0,this.doorTime-dt);this.model.door.rotation.y=damp(this.model.door.rotation.y,this.doorTime>.25?.95:0,8,dt);
    this.model.lights.forEach(light=>light.intensity=this.controlled?night*38:0);
  }
  dispose(){this.model.dispose();this.physics.removeRigidBody(this.body);}
}
