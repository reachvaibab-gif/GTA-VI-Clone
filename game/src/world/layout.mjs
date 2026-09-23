import { clamp, pointInPolygon, pointSegment } from '../core/math.mjs';

export const CHUNK_SIZE = 256;
export const SPAWN = Object.freeze({ x: 2000, z: -420, yaw: Math.PI });
export const WORLD_BOUNDS = Object.freeze({ minX: -11000, maxX: 4500, minZ: -10000, maxZ: 9000 });
// Original estimated coastline, explicitly not an exact traced Rockstar map.
// Landmark coordinates are loaded independently and are never rescaled to fit this geometry.
export const LAND = [
  [[-9700,-4700],[-9000,-7200],[-7700,-8600],[-5200,-9000],[-2800,-8500],[-1100,-7700],[850,-6200],[2100,-4800],[1800,-3500],[850,-2600],[540,-1700],[600,-700],[350,350],[-100,1300],[-700,2050],[-1100,3200],[-2100,4300],[-3700,4900],[-5000,4100],[-6700,2400],[-8100,800],[-8500,-1100],[-9700,-2800]],
  [[1320,-3500],[1660,-3330],[1930,-2780],[1980,-2150],[2140,-1680],[2250,-940],[2260,-180],[2170,390],[1800,590],[1480,250],[1410,-650],[1260,-1650],[1160,-2460]],
  [[-1100,2900],[-1600,2800],[-2150,3500],[-2580,4300],[-2800,4700],[-2520,4910],[-2090,4300],[-1690,3540]],
  [[-2700,4600],[-3190,4640],[-3870,5410],[-4300,5670],[-4550,6100],[-4220,6240],[-3560,5880],[-2940,5270]],
  [[-4440,6020],[-4840,6220],[-5350,6880],[-5620,7400],[-5220,7580],[-4770,7090]],
  [[700,650],[1050,480],[1250,1100],[1410,1900],[1190,2250],[920,1870],[710,1260]],
  [[920,-760],[1160,-850],[1350,-700],[1260,-480],[1010,-510]],
  [[710,-1290],[890,-1360],[1110,-1290],[1270,-1110],[1080,-1000],[850,-1080]]
];
const road = (name, width, points, kind = 'urban') => ({ name, width, points, kind });
export const ROADS = [
  road('Shore Drive', 16, [[1995,300],[1995,-1450],[1850,-2200],[1610,-3000]]),
  road('Collins Avenue', 12, [[1860,300],[1860,-1450],[1710,-2220]]),
  road('Thompson Avenue', 16, [[1730,350],[1730,-1500],[1590,-2410]]),
  road('Bayshore Boulevard', 14, [[1520,200],[1520,-1550],[1420,-2520],[1610,-3000]]),
  ...[-80,-300,-540,-780,-1020,-1260].map((z,i) => road(`${5+i*2}th Street`, 12, [[1520,z],[1995,z]])),
  road('Rialto Causeway', 20, [[1995,-1020],[1520,-1020],[850,-1020],[200,-1020],[-900,-1020]], 'bridge'),
  road('Bayfront Avenue', 22, [[120,850],[120,-700],[200,-1020],[120,-1900],[120,-2600]]),
  ...[-500,-1000,-1500,-2000].map((x,i) => road(`Downtown ${i+1}`, 16, [[x,800],[x,-2600]])),
  ...[500,0,-500,-1500,-2000,-2500].map((z,i) => road(`Central ${i+1}`, 16, [[-2250,z],[120,z]])),
  road('Interstate 97', 26, [[-1500,3200],[-1250,1700],[-1200,700],[-1000,-1020],[-1200,-3000],[-1900,-4700],[-3000,-6500],[-4000,-8100]], 'highway'),
  road('Gellhorn Expressway', 24, [[-1000,-1020],[-2700,-1750],[-4500,-2300],[-6100,-2850],[-7800,-3400]], 'highway'),
  road('Port Loop', 18, [[-7300,-3650],[-6400,-3650],[-5800,-2950],[-6300,-2050],[-7300,-2050],[-7900,-2800],[-7300,-3650]]),
  road('Ambrosia Route', 18, [[-6100,-2850],[-5600,-4700],[-5100,-5800],[-3900,-6500],[-3000,-6500]], 'rural'),
  road('Kalaga Scenic Road', 12, [[-3900,-6500],[-5400,-7100],[-6900,-7250],[-7800,-6500],[-8350,-5350]], 'rural'),
  road('US Route 1', 18, [[-1250,1700],[-1500,3200],[-2330,4200],[-3100,5100],[-4150,5820],[-4760,6530],[-5380,7330]], 'bridge'),
  road('Grassrivers Trail', 10, [[-1500,3200],[-3300,2500],[-4500,1700],[-5400,1000],[-6300,-200],[-6100,-2850]], 'rural'),
  road('Catalan Causeway', 16, [[120,500],[800,720],[1130,1600]], 'bridge')
];
export const SEGMENTS = ROADS.flatMap((r, ri) => r.points.slice(1).map((b,i) => {
  const a = r.points[i];
  return { ...r, id: `${ri}:${i}`, a, b, length: Math.hypot(b[0]-a[0],b[1]-a[1]), yaw: Math.atan2(b[0]-a[0],b[1]-a[1]) };
}));
export function nearestRoad(x, z) {
  let best = null, distance = Infinity;
  for (const segment of SEGMENTS) {
    const hit = pointSegment(x,z,...segment.a,...segment.b);
    if (hit.distance < distance) { distance = hit.distance; best = { ...hit, segment }; }
  }
  return best;
}
export function isLand(x,z) { return LAND.some(ring => pointInPolygon(x,z,ring)); }
export function terrainHeight(x,z) {
  if (!isLand(x,z)) return -5;
  // Height is inferred art direction. The source relief image is a side profile, not a usable height field.
  const mountain = 290 * Math.exp(-((x+6800)**2 / 2300000 + (z+7000)**2 / 1900000));
  const hills = z < -4800 ? (Math.sin(x*.003)*Math.cos(z*.002)+1)*12 : 0;
  return 2.4 + mountain + hills;
}
export function surfaceHeight(x,z) {
  const r = nearestRoad(x,z);
  const h = terrainHeight(x,z);
  return r && r.distance < r.segment.width/2 + 5 ? Math.max(3.1, h) : h;
}
export function districtAt(x,z) {
  if (x > 1250 && z > -3500 && z < 700) return z < -1600 ? 'Washington Beach' : 'Ocean Beach';
  if (z > 2800) return 'Leonida Keys';
  if (x < -5500 && z > -4300 && z < -1200) return 'Port Gellhorn';
  if (z < -6200) return 'Mount Kalaga';
  if (x < -3500 && z < -4200) return 'Ambrosia';
  if (x < -2900 && z > -1000) return 'Grassrivers';
  return 'Vice City';
}
export function chunkKey(x,z) { return `${Math.floor(x/CHUNK_SIZE)},${Math.floor(z/CHUNK_SIZE)}`; }
export function wantedChunks(x,z,radius) {
  const cx=Math.floor(x/CHUNK_SIZE), cz=Math.floor(z/CHUNK_SIZE), result=[];
  for(let dz=-radius;dz<=radius;dz++) for(let dx=-radius;dx<=radius;dx++) result.push({ key:`${cx+dx},${cz+dz}`, x:cx+dx, z:cz+dz, priority:dx*dx+dz*dz });
  return result.sort((a,b)=>a.priority-b.priority);
}
export function clampToWorld(x,z) { return {x:clamp(x,WORLD_BOUNDS.minX,WORLD_BOUNDS.maxX),z:clamp(z,WORLD_BOUNDS.minZ,WORLD_BOUNDS.maxZ)}; }
