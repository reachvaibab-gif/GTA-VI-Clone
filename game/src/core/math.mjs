export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const wrapAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
export const angleDelta = (from, to) => wrapAngle(to - from);
export const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function rng(seed) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(x, z, salt = 0) {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ salt;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}
export function referenceToWorld(gameX, gameY, elevation = 0) {
  if (![gameX, gameY, elevation].every(Number.isFinite)) throw new TypeError('Invalid map coordinate');
  return { x: gameX, y: elevation, z: -gameY };
}
export function worldToReference(x, z) { return { game_x: x, game_y: -z }; }
export function pointSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz;
  const t = len2 ? clamp(((px - ax) * dx + (pz - az) * dz) / len2, 0, 1) : 0;
  const x = ax + dx * t, z = az + dz * t;
  return { x, z, t, distance: Math.hypot(px - x, pz - z) };
}
export function pointInPolygon(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
