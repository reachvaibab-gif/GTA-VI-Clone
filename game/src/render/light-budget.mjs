// A zero-intensity Three.js light still enters the shader's light array when visible.
// Only the player's active night headlights should be real lights; traffic uses emissive lenses.
export function setHeadlights(lights,controlled,night){
  const enabled=controlled&&Number.isFinite(night)&&night>.05;
  for(const light of lights){light.visible=enabled;light.intensity=enabled?Math.min(1,night)*38:0;}
}
