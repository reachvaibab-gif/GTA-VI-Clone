import test from 'node:test';import assert from 'node:assert/strict';
import {setHeadlights} from '../src/render/light-budget.mjs';
test('traffic does not add zero-intensity spotlights to compiled material shaders',()=>{
  const fleet=Array.from({length:24},()=>[{visible:true,intensity:0},{visible:true,intensity:0}]);
  for(const lights of fleet)setHeadlights(lights,false,1);
  assert.equal(fleet.flat().filter(l=>l.visible).length,0);
  setHeadlights(fleet[0],true,1);assert.equal(fleet.flat().filter(l=>l.visible).length,2);
});
test('daytime and invalid night values cannot activate headlights',()=>{
  const lights=[{visible:true,intensity:38}];setHeadlights(lights,true,0);assert.equal(lights[0].visible,false);
  setHeadlights(lights,true,NaN);assert.equal(lights[0].intensity,0);
});
