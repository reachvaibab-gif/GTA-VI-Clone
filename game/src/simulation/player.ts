import * as T from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Input } from '../core/input';
import { CharacterLibrary,CharacterView } from '../render/characters';
import { damp,angleDelta } from '../core/math.mjs';
import { surfaceHeight,SPAWN } from '../world/layout.mjs';
import type { ActorState } from '../types';
export class Player {
  readonly body:RAPIER.RigidBody;
  readonly collider:RAPIER.Collider;
  readonly controller:RAPIER.KinematicCharacterController;
  readonly view:CharacterView;
  state:ActorState={x:SPAWN.x,y:3.3,z:SPAWN.z,yaw:SPAWN.yaw,speed:0,driving:false,health:100,grounded:false};
  private vy=0;private vx=0;private vz=0;
  constructor(readonly physics:RAPIER.World,scene:T.Scene,library:CharacterLibrary){
    this.body=physics.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(SPAWN.x,4.3,SPAWN.z));
    this.collider=physics.createCollider(RAPIER.ColliderDesc.capsule(.54,.32).setMass(75),this.body);
    this.controller=physics.createCharacterController(.02);this.controller.enableAutostep(.45,.2,true);this.controller.enableSnapToGround(.4);this.controller.setApplyImpulsesToDynamicBodies(true);this.controller.setCharacterMass(75);
    this.view=library.make(0);scene.add(this.view.root);
  }
  teleport(x:number,z:number,yaw=this.state.yaw){
    const y=Math.max(3.5,surfaceHeight(x,z)+1.5);this.body.setTranslation({x,y,z},true);this.body.setNextKinematicTranslation({x,y,z});
    this.state={...this.state,x,y:y-.86,z,yaw,speed:0};this.vx=this.vy=this.vz=0;
  }
  tick(dt:number,input:Input){
    if(this.state.driving)return;
    let f=input.forward,r=input.strafe;const n=Math.hypot(f,r);if(n>1){f/=n;r/=n;}
    const speed=input.down('ShiftLeft')||input.down('ShiftRight')?5.8:2.3;
    const x=(Math.sin(input.yaw)*f-Math.cos(input.yaw)*r)*speed,z=(Math.cos(input.yaw)*f+Math.sin(input.yaw)*r)*speed;
    this.vx=damp(this.vx,x,12,dt);this.vz=damp(this.vz,z,12,dt);
    if(input.consume('Space')&&this.state.grounded)this.vy=5.2;
    this.vy=Math.max(-30,this.vy-18*dt);
    const current=this.body.translation();this.controller.computeColliderMovement(this.collider,{x:this.vx*dt,y:this.vy*dt,z:this.vz*dt});
    const move=this.controller.computedMovement();this.body.setNextKinematicTranslation({x:current.x+move.x,y:current.y+move.y,z:current.z+move.z});
    this.state.grounded=this.controller.computedGrounded();if(this.state.grounded&&this.vy<0)this.vy=-.4;
    this.state.speed=Math.hypot(move.x,move.z)/dt;
    if(this.state.speed>.15)this.state.yaw+=angleDelta(this.state.yaw,Math.atan2(move.x,move.z))*Math.min(1,dt*12);
  }
  sync(){if(this.state.driving)return;const p=this.body.translation();this.state.x=p.x;this.state.y=p.y-.86;this.state.z=p.z;}
  render(dt:number){this.view.root.visible=!this.state.driving;this.view.root.position.set(this.state.x,this.state.y,this.state.z);this.view.root.rotation.y=this.state.yaw;this.view.update(dt,this.state.speed,this.state.grounded);}
  setDriving(active:boolean){this.state.driving=active;this.collider.setEnabled(!active);this.view.root.visible=!active;}
  dispose(){this.view.dispose();this.physics.removeCharacterController(this.controller);this.physics.removeRigidBody(this.body);}
}
