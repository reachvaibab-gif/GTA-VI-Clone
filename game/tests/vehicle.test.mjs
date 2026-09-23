import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {createVehicleBody,VEHICLE_MASS,ENGINE_ACCELERATION} from '../src/simulation/vehicle-body.mjs';
test('actual vehicle collider can accelerate on a high-friction road',async()=>{
  await RAPIER.init();const physics=new RAPIER.World({x:0,y:-18,z:0});physics.timestep=1/60;
  try{
    physics.createCollider(RAPIER.ColliderDesc.cuboid(20,.25,100).setTranslation(0,-.25,0).setFriction(.9));
    const {body}=createVehicleBody(physics,0,1,0,Math.PI);
    for(let i=0;i<60;i++)physics.step();
    const start=body.translation().z;
    for(let i=0;i<180;i++){body.resetForces(true);body.addForce({x:0,y:0,z:-ENGINE_ACCELERATION*VEHICLE_MASS},true);physics.step();}
    assert.ok(start-body.translation().z>15,'Engine must overcome chassis contact friction');
    assert.ok(body.translation().y>.45,'Vehicle must remain supported by the road');
    assert.ok(body.linvel().z< -10,'Forward velocity must point north at the initial heading');
  }finally{physics.free();}
});
