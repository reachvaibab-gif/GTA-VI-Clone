import test from 'node:test';
import assert from 'node:assert/strict';
import { referenceToWorld, worldToReference, pointSegment, pointInPolygon, rng, angleDelta, damp } from '../src/core/math.mjs';
test('reference units preserve metre distances and north maps to negative Z', () => {
  const a = referenceToWorld(1500, 2500, 12);
  assert.deepEqual(a, { x: 1500, y: 12, z: -2500 });
  assert.deepEqual(worldToReference(a.x, a.z), { game_x: 1500, game_y: 2500 });
  assert.equal(referenceToWorld(1501, 2500).x - a.x, 1);
  assert.throws(() => referenceToWorld(NaN, 1));
});
test('segment projection is safe for zero length segments and end points', () => {
  assert.equal(pointSegment(2, 0, 0, 0, 0, 0).distance, 2);
  assert.equal(pointSegment(5, 3, 0, 0, 10, 0).distance, 3);
  assert.equal(pointSegment(20, 0, 0, 0, 10, 0).t, 1);
});
test('polygon classifier excludes water outside land ring', () => {
  const ring = [[0, 0], [10, 0], [10, 10], [0, 10]];
  assert.equal(pointInPolygon(5, 5, ring), true);
  assert.equal(pointInPolygon(15, 5, ring), false);
});
test('procedural content is stable across streaming order', () => {
  const a = rng(572), b = rng(572);
  assert.deepEqual(Array.from({ length: 64 }, a), Array.from({ length: 64 }, b));
});
test('angle interpolation takes short arc', () => assert.ok(Math.abs(angleDelta(3.13, -3.13)) < 0.03));
test('exponential damping is frame-rate independent', () => {
  assert.ok(Math.abs(damp(damp(0, 1, 4, 0.5), 1, 4, 0.5) - damp(0, 1, 4, 1)) < 1e-10);
});
