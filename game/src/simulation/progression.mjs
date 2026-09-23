import { clamp } from '../core/math.mjs';
export const JOBS = [
  { id:'first-light', title:'First Light', contact:'Mara', type:'delivery', description:'Pick up the coupe and deliver a sealed envelope to Bayfront. Keep the car in one piece.', reward:650, time:240, points:[[2000,-420],[1995,-1020],[120,-1020],[120,420]] },
  { id:'shore-run', title:'The Shore Run', contact:'Street circuit', type:'race', description:'A sunset sprint up the coast. Hit every checkpoint before the timer runs out.', reward:950, time:110, points:[[1995,-420],[1995,-1020],[1995,-1450],[1850,-2200],[1610,-3000]] },
  { id:'port-shift', title:'Port Shift', contact:'Santos', type:'delivery', description:'Take the expressway to Port Gellhorn. A long-distance run pays more.', reward:1800, time:540, points:[[2000,-420],[1520,-1020],[-1000,-1020],[-2700,-1750],[-4500,-2300],[-6100,-2850],[-7300,-3650]] },
  { id:'keys-after-dark', title:'Keys After Dark', contact:'Mara', type:'delivery', description:'Head south across the causeways to the last marina in the Keys.', reward:2400, time:720, points:[[2000,-420],[120,-1020],[-1250,1700],[-1500,3200],[-2330,4200],[-3100,5100],[-4150,5820],[-4760,6530],[-5380,7330]] },
  { id:'clean-getaway', title:'Clean Getaway', contact:'Santos', type:'escape', description:'Draw a patrol, then lose it. Stay out of sight until the heat drops.', reward:1100, time:240, points:[[2000,-420],[1520,-780]] }
];
export function newProgress() { return { version:1, money:0, completed:[], bestTimes:{}, discovered:[], mission:null, heat:0, unseen:0, playSeconds:0 }; }
export function startJob(progress,id) {
  const job=JOBS.find(j=>j.id===id);
  if(!job) throw new Error('Unknown job');
  progress.mission={id,checkpoint:1,remaining:job.time,elapsed:0};
  if(job.type==='escape') {progress.heat=2;progress.unseen=0;}
}
export function updateProgress(p, dt, actor, policeVisible=false) {
  p.playSeconds+=dt;
  p.unseen=policeVisible?0:p.unseen+dt;
  if(p.heat>0 && p.unseen>12) p.heat=Math.max(0,p.heat-dt*.075);
  const m=p.mission;
  if(!m) return null;
  const job=JOBS.find(j=>j.id===m.id);
  if(!job) { p.mission=null; return null; }
  m.elapsed+=dt; m.remaining=Math.max(0,m.remaining-dt);
  if(m.remaining<=0 || actor.health<=0) {p.mission=null;return {type:'failed',title:job.title};}
  const target=job.points[m.checkpoint];
  if(job.type==='escape' ? p.heat<=0 : target && actor.driving && Math.hypot(actor.x-target[0],actor.z-target[1])<24) {
    if(job.type!=='escape' && m.checkpoint<job.points.length-1) {m.checkpoint++;return {type:'checkpoint',index:m.checkpoint};}
    p.money+=job.reward;
    if(!p.completed.includes(job.id)) p.completed.push(job.id);
    p.bestTimes[job.id]=Math.min(p.bestTimes[job.id]??Infinity,m.elapsed);
    p.mission=null;
    return {type:'complete',title:job.title,reward:job.reward};
  }
  return null;
}
export function addHeat(p,amount) {p.heat=clamp(p.heat+amount,0,5);p.unseen=0;}
export function serializeSave(progress,actor,settings) {
  return JSON.stringify({version:1,progress:{...progress,mission:null},actor:{x:actor.x,z:actor.z,yaw:actor.yaw},settings});
}
export function parseSave(text) {
  try {
    const v=JSON.parse(text);
    if(v.version!==1 || !v.actor || ![v.actor.x,v.actor.z,v.actor.yaw].every(Number.isFinite)) return null;
    if(Math.abs(v.actor.x)>16000 || Math.abs(v.actor.z)>16000) return null;
    const p=v.progress;
    if(!p || !Number.isFinite(p.money) || p.money<0 || !Array.isArray(p.completed)) return null;
    return {version:1,actor:v.actor,progress:{...newProgress(),money:p.money,completed:p.completed.filter(id=>JOBS.some(j=>j.id===id)),bestTimes:p.bestTimes&&typeof p.bestTimes==='object'?p.bestTimes:{},discovered:Array.isArray(p.discovered)?p.discovered.filter(x=>typeof x==='string'):[],playSeconds:Number.isFinite(p.playSeconds)?p.playSeconds:0},settings:v.settings&&typeof v.settings==='object'?v.settings:{}};
  } catch {return null;}
}
