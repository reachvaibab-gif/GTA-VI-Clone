import RAPIER from '@dimforge/rapier3d-compat';
export const VEHICLE_MASS=1250;
export const ENGINE_ACCELERATION=6.2;
export function createVehicleBody(physics,x,y,z,yaw){
  const body=physics.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(x,y,z).setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)})
    .enabledRotations(false,true,false).setLinearDamping(.1).setAngularDamping(3).setCcdEnabled(true));
  // This arcade controller supplies directional tire grip itself. Averaging road friction into the
  // chassis made its static friction exceed engine force, effectively leaving the parking brake on.
  const collider=physics.createCollider(RAPIER.ColliderDesc.cuboid(.92,.55,2.05)
    .setMass(VEHICLE_MASS).setFriction(.02).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
    .setRestitution(.12),body);
  return {body,collider};
}
