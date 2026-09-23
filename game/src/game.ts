import * as T from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { FixedClock } from './core/clock.mjs';
import { Input } from './core/input';
import { damp,clamp,angleDelta } from './core/math.mjs';
import { Materials } from './render/materials';
import { Environment } from './render/environment';
import { CharacterLibrary } from './render/characters';
import { GameAudio } from './render/audio';
import { Player } from './simulation/player';
import { Vehicle } from './simulation/vehicle';
import { Traffic } from './simulation/traffic';
import { WorldStream } from './world/stream';
import { SPAWN,nearestRoad,surfaceHeight,districtAt } from './world/layout.mjs';
import { routeBetween } from './world/navigation.mjs';
import { newProgress,startJob,updateProgress,serializeSave,parseSave,JOBS,addHeat } from './simulation/progression.mjs';
import { Interface,type Panel,type Progress } from './ui/interface';
import { DEFAULT_SETTINGS,type Settings,type WorldData,type AssetData } from './types';
const SAVE_KEY='leonida.after-hours.v1';
export class Game {
  readonly scene=new T.Scene();readonly camera=new T.PerspectiveCamera(66,innerWidth/innerHeight,.12,26000);
  readonly renderer:T.WebGLRenderer;readonly input:Input;readonly materials=new Materials();readonly characters=new CharacterLibrary(this.materials);readonly audio=new GameAudio();readonly ui:Interface;
  readonly clock=new FixedClock();readonly fly=new T.Vector3();
  readonly environment:Environment;
  physics!:RAPIER.World;world!:WorldStream;player!:Player;homeCar!:Vehicle;traffic!:Traffic;active:Vehicle|null=null;
  settings:Settings={...DEFAULT_SETTINGS};progress:Progress=newProgress();started=false;paused=true;photo=false;ready=false;
  private last=0;private elapsed=0;private frameMs=16.7;private routeTime=0;private saveTime=0;private bustTime=0;private cameraMode=0;private nextCapture=false;private request=0;private deadNotice=false;
  private destination:{x:number;z:number}|null=null;private marker:T.Mesh;private saved:ReturnType<typeof parseSave>=null;
  private abort=new AbortController();
  constructor(readonly canvas:HTMLCanvasElement,root:HTMLElement,readonly data:WorldData,readonly assets:AssetData){
    this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.input=new Input(canvas);this.environment=new Environment(this.scene,this.renderer);
    const markerMaterial=new T.MeshStandardMaterial({color:0xf6c898,emissive:0xe7ae72,emissiveIntensity:1.3,roughness:.5});
    this.marker=new T.Mesh(new T.TorusGeometry(11,.16,8,64),markerMaterial);this.marker.rotation.x=-Math.PI/2;this.marker.visible=false;this.scene.add(this.marker);
    try{this.saved=parseSave(localStorage.getItem(SAVE_KEY)??'');}catch{/* storage may be disabled in private embeds */}
    if(this.saved){this.progress=this.saved.progress as Progress;this.settings={...DEFAULT_SETTINGS,...this.validSettings(this.saved.settings)};}
    const quality=new URLSearchParams(location.search).get('quality');if(quality==='low'||quality==='balanced'||quality==='high')this.settings.quality=quality;
    this.ui=new Interface(root,data,{
      start:()=>this.start(),resume:()=>this.resume(),panel:p=>this.openPanel(p),job:id=>this.beginJob(id),
      waypoint:p=>{this.destination=p;this.routeTime=10;this.ui.waypoint=p;this.ui.notify('Waypoint set. Follow the GPS.');},
      travel:(x,z)=>this.travel(x,z),settings:s=>this.applySettings(s),reset:()=>{this.recover();this.resume();},photo:()=>this.togglePhoto(),capture:()=>this.nextCapture=true,
      touch:(code,down)=>{if(down){if(!this.input.keys.has(code))this.input.pressed.add(code);this.input.keys.add(code);}else this.input.keys.delete(code);},
      stick:(x,y)=>{this.input.touchMove={x,y};},look:(dx,dy)=>{this.input.yaw-=dx*.004*this.settings.sensitivity;this.input.pitch=clamp(this.input.pitch+dy*.003*this.settings.sensitivity,-.25,1.1);this.input.lastMouse=performance.now();}
    });
    this.applySettings(this.settings);
    window.addEventListener('resize',()=>this.resize(),{signal:this.abort.signal});
    window.addEventListener('blur',()=>{if(this.started&&!this.photo)this.openPanel('pause');},{signal:this.abort.signal});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.started)this.openPanel('pause');},{signal:this.abort.signal});
    document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&this.started&&!this.paused&&!this.photo&&!matchMedia('(pointer:coarse)').matches)this.openPanel('pause');},{signal:this.abort.signal});
    window.addEventListener('pagehide',()=>this.save(),{signal:this.abort.signal});
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.openPanel('pause');this.ui.notify('Graphics context lost. Reload the page to restore the renderer.',15000);},{signal:this.abort.signal});
  }
  async initialize(){
    this.ui.loading('Starting the physics world…');await RAPIER.init();this.physics=new RAPIER.World({x:0,y:-18,z:0});this.physics.timestep=1/60;
    this.ui.loading('Loading materials and character animation…');await Promise.all([this.materials.load(this.assets),this.characters.load(this.assets)]);
    this.ui.loading('Building Ocean Beach and collision geometry…');this.world=new WorldStream(this.scene,this.physics,this.materials,this.data,this.settings.quality);
    const initial=this.saved?.actor??SPAWN;this.world.ensure(initial.x,initial.z);
    this.player=new Player(this.physics,this.scene,this.characters);this.player.teleport(initial.x,initial.z,initial.yaw);this.input.yaw=initial.yaw;
    this.homeCar=new Vehicle(this.physics,this.scene,this.materials,initial.x-2,initial.z-5,initial.yaw,0x608e91);this.traffic=new Traffic(this.scene,this.physics,this.materials,this.characters);
    this.environment.update(this.settings.time,0,new T.Vector3(initial.x,4,initial.z));this.positionCamera(1/60);
    this.ui.loading('Compiling shaders…');await this.renderer.compileAsync(this.scene,this.camera);
    this.ready=true;this.ui.ready(Boolean(this.saved));this.last=performance.now();this.request=requestAnimationFrame(this.frame);
  }
  private validSettings(s:Partial<Settings>):Partial<Settings>{
    const out:Partial<Settings>={};if(['low','balanced','high'].includes(String(s.quality)))out.quality=s.quality;
    if(typeof s.audio==='boolean')out.audio=s.audio;if(typeof s.traffic==='boolean')out.traffic=s.traffic;
    if(Number.isFinite(s.time))out.time=clamp(s.time!,0,23.9);if(Number.isFinite(s.sensitivity))out.sensitivity=clamp(s.sensitivity!,.3,2);return out;
  }
  applySettings(settings:Partial<Settings>){
    this.settings={...this.settings,...this.validSettings(settings)};this.input.sensitivity=this.settings.sensitivity;
    this.renderer.shadowMap.enabled=this.settings.quality!=='low';this.renderer.setPixelRatio(this.settings.quality==='low'?Math.min(1,devicePixelRatio):this.settings.quality==='balanced'?Math.min(1.35,devicePixelRatio):Math.min(2,devicePixelRatio));
    if(this.world)this.world.quality=this.settings.quality;this.audio.enabled(this.settings.audio);this.ui?.settings(this.settings);this.resize();
  }
  private resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight,false);}
  start(){if(!this.ready)return;this.started=true;this.resume();this.ui.notify('Your coupe is nearby. Press E to get in. J opens available jobs.',6500);}
  resume(){if(!this.ready)return;if(!this.started){this.ui.show('menu');return;}this.paused=false;this.photo=false;this.ui.setPhoto(false);this.ui.show(null);this.input.enabled=true;this.input.clear();if(!matchMedia('(pointer:coarse)').matches)this.input.lock();this.clock.reset();this.audio.start().then(()=>this.audio.enabled(this.settings.audio)).catch(()=>{});}
  openPanel(panel:Panel){if(panel===null){this.resume();return;}this.photo=false;this.paused=true;this.input.enabled=false;this.input.unlock();this.ui.setPhoto(false);this.ui.show(panel);this.clock.reset();this.audio.suspend();this.save();}
  beginJob(id:string){if(!this.ready){this.ui.notify('The world is still loading.');return;}this.started=true;startJob(this.progress,id);this.routeTime=10;this.resume();const job=JOBS.find(j=>j.id===id)!;this.ui.notify(`${job.title} — ${job.description}`,6500);this.audio.tone(540,.2);}
  private enterExit(){
    if(this.active){
      if(Math.abs(this.active.speed)>3){this.ui.notify('Stop the vehicle before getting out.');return;}
      const car=this.active,p=car.position,yaw=car.yaw;let exit:{x:number;z:number}|null=null;
      for(const side of [1,-1]){
        const dx=Math.cos(yaw)*side,dz=-Math.sin(yaw)*side;
        const hit=this.physics.castRay(new RAPIER.Ray({x:p.x,y:p.y+.4,z:p.z},{x:dx,y:0,z:dz}),2.5,true,undefined,undefined,this.player.collider,car.body);
        if(!hit){exit={x:p.x+dx*2.3,z:p.z+dz*2.3};break;}
      }
      if(!exit){this.ui.notify('Both doors are blocked. Move to a clear space.');return;}
      car.controlled=false;car.doorTime=.9;car.body.resetForces(true);this.active=null;this.player.setDriving(false);this.player.teleport(exit.x,exit.z,yaw);this.input.yaw=yaw;this.input.clear();return;
    }
    const a=this.player.state,cars=[this.homeCar,...this.traffic.cars.map(e=>e.car)];
    const nearest=cars.filter(c=>Math.abs(c.speed)<5).map(car=>({car,d:Math.hypot(car.position.x-a.x,car.position.z-a.z)})).sort((a,b)=>a.d-b.d)[0];
    if(!nearest||nearest.d>6){this.ui.notify('Get closer to a stopped vehicle.');return;}
    this.active=nearest.car;this.active.controlled=true;this.active.doorTime=.85;this.player.setDriving(true);this.input.yaw=this.active.yaw;this.input.pitch=.24;this.input.clear();if(this.active.police)addHeat(this.progress,1.5);
  }
  recover(){
    if(!this.ready)return;const a=this.player.state,r=nearestRoad(a.x,a.z);const x=r?.x??SPAWN.x,z=r?.z??SPAWN.z,yaw=r?.segment.yaw??SPAWN.yaw;
    this.world.ensure(x,z);const car=this.active??this.homeCar;car.teleport(x,z-7,yaw);car.health=100;
    if(!this.active)this.player.teleport(x+3,z+1,yaw);this.player.state.health=100;this.deadNotice=false;this.ui.notify('Vehicle recovered to the nearest road.');
  }
  travel(x:number,z:number){
    if(!this.ready||![x,z].every(Number.isFinite))return;
    this.world.ensure(x,z);if(this.active)this.active.teleport(x,z,Math.PI);else{this.player.teleport(x,z,Math.PI);this.homeCar.teleport(x-2,z-5,Math.PI);}
    this.progress.mission=null;this.progress.heat=0;this.destination=null;this.ui.route=[];this.ui.waypoint=null;this.input.yaw=Math.PI;this.started=true;this.resume();this.ui.notify('Travel assist used. Active jobs were cancelled.');
  }
  togglePhoto(){
    if(!this.ready)return;if(this.photo){this.resume();return;}if(!this.started)this.started=true;
    this.fly.copy(this.camera.position);const dir=this.camera.getWorldDirection(new T.Vector3());this.input.yaw=Math.atan2(dir.x,dir.z);this.input.pitch=Math.asin(clamp(-dir.y,-1,1));
    this.photo=true;this.paused=true;this.ui.setPhoto(true);this.input.enabled=true;this.input.clear();if(!matchMedia('(pointer:coarse)').matches)this.input.lock();
  }
  private inputActions(){
    if(this.input.consume('Escape')){this.openPanel('pause');return;}
    if(this.input.consume('KeyM'))this.ui.panel==='map'?this.resume():this.openPanel('map');
    if(this.input.consume('KeyJ'))this.ui.panel==='jobs'?this.resume():this.openPanel('jobs');
    if(this.input.consume('KeyF'))this.togglePhoto();
    if(this.photo||this.paused)return;
    if(this.input.consume('KeyE'))this.enterExit();if(this.input.consume('KeyR'))this.recover();if(this.input.consume('KeyC'))this.cameraMode=(this.cameraMode+1)%3;if(this.input.consume('KeyH'))this.audio.tone(180,.24,.1);
  }
  tick(dt:number){
    if(!this.ready||this.paused)return;
    const previousHealth=this.active?.health??100;
    if(this.active)this.active.drive(dt,this.input.forward,-this.input.strafe,this.input.down('Space'));else this.player.tick(dt,this.input);
    const visible=this.traffic.tick(dt,this.player.state,this.progress.heat,this.settings.traffic,this.settings.quality==='low'?6:12);
    this.physics.timestep=dt;this.physics.step();this.player.sync();
    const actor=this.player.state;
    if(this.active){const p=this.active.position,v=this.active.body.linvel(),yaw=this.active.yaw;Object.assign(actor,{x:p.x,y:p.y-.55,z:p.z,yaw,speed:v.x*Math.sin(yaw)+v.z*Math.cos(yaw),health:this.active.health,grounded:true});
      if(previousHealth-this.active.health>4&&this.traffic.cars.some(e=>e.car!==this.active&&Math.hypot(e.car.position.x-p.x,e.car.position.z-p.z)<7))addHeat(this.progress,.7);
    }
    const event=updateProgress(this.progress,dt,actor,visible);
    if(event?.type==='checkpoint'){this.routeTime=10;this.audio.tone(660,.09);}
    if(event?.type==='complete'){this.ui.notify(`${event.title} complete · +$${event.reward}`,6000);this.audio.tone(880,.3);this.destination=null;this.ui.route=[];this.ui.waypoint=null;this.save();}
    if(event?.type==='failed'){this.ui.notify('Job failed. Open J to try again.');this.destination=null;this.ui.route=[];this.ui.waypoint=null;}
    const region=districtAt(actor.x,actor.z);if(!this.progress.discovered.includes(region)){this.progress.discovered.push(region);if(this.progress.discovered.length>1)this.ui.notify(region);}
    this.bustTime=visible&&this.progress.heat>0&&Math.abs(actor.speed)<1&&this.traffic.cars.some(e=>e.car.police&&Math.hypot(e.car.position.x-actor.x,e.car.position.z-actor.z)<9)?this.bustTime+dt:0;
    if(this.bustTime>5){this.progress.money=Math.max(0,this.progress.money-350);this.progress.heat=0;this.progress.mission=null;this.bustTime=0;this.ui.notify('Busted · $350 impound fee');this.recover();}
    if(actor.y< -2||actor.health<=0){if(!this.deadNotice){this.ui.notify('Vehicle disabled. Press R to recover.',15000);this.deadNotice=true;}if(actor.y< -40)this.recover();}
    this.routeTime+=dt;this.saveTime+=dt;
    if(this.routeTime>1){this.routeTime=0;const job=JOBS.find(j=>j.id===this.progress.mission?.id);if(job&&this.progress.mission){const p=job.points[this.progress.mission.checkpoint];if(p)this.destination={x:p[0],z:p[1]};}
      if(this.destination){this.ui.route=routeBetween(actor,this.destination);this.ui.waypoint=this.destination;}else this.ui.route=[];
    }
    if(this.saveTime>30){this.saveTime=0;this.save();}
    this.audio.update(dt,actor);
  }
  private positionCamera(dt:number){
    const actor=this.player?.state??{x:SPAWN.x,y:3,z:SPAWN.z,speed:0,yaw:Math.PI};
    if(!this.started){this.camera.position.set(actor.x+65+Math.sin(this.elapsed*.035)*6,23,actor.z+72);this.camera.lookAt(actor.x-70,10,actor.z-180);return;}
    if(this.photo){
      const speed=this.input.down('ShiftLeft')?80:14,f=this.input.forward,r=this.input.strafe;
      const forward=new T.Vector3(Math.sin(this.input.yaw)*Math.cos(this.input.pitch),-Math.sin(this.input.pitch),Math.cos(this.input.yaw)*Math.cos(this.input.pitch));
      this.fly.addScaledVector(forward,f*speed*dt);this.fly.x-=Math.cos(this.input.yaw)*r*speed*dt;this.fly.z+=Math.sin(this.input.yaw)*r*speed*dt;this.fly.y+=this.input.axis('KeyQ','KeyE')*speed*dt;this.fly.y=Math.max(.4,this.fly.y);
      this.camera.position.copy(this.fly);this.camera.lookAt(this.fly.clone().add(forward));return;
    }
    if(this.active&&performance.now()-this.input.lastMouse>1800&&Math.abs(actor.speed)>2)this.input.yaw+=angleDelta(this.input.yaw,actor.yaw)*(1-Math.exp(-2.4*dt));
    const yaw=this.input.yaw,pitch=this.input.pitch,distance=this.active?(this.cameraMode===1?15:this.cameraMode===2?.3:9):(this.cameraMode===1?10:6.4);
    const target=new T.Vector3(actor.x,actor.y+(this.active?1.1:1.35),actor.z);
    const desired=new T.Vector3(target.x-Math.sin(yaw)*Math.cos(pitch)*distance,target.y+Math.sin(pitch)*distance,target.z-Math.cos(yaw)*Math.cos(pitch)*distance);
    if(this.physics){const dir=desired.clone().sub(target),len=dir.length();dir.normalize();const hit=this.physics.castRay(new RAPIER.Ray(target,dir),len,true,undefined,undefined,this.player.collider,this.active?.body);if(hit)desired.copy(target).addScaledVector(dir,Math.max(.35,hit.timeOfImpact-.3));}
    this.camera.position.lerp(desired,1-Math.exp(-10*dt));this.camera.lookAt(target);
    this.camera.fov=damp(this.camera.fov,this.active?68+Math.min(9,Math.abs(actor.speed)*.15):66,3,dt);this.camera.updateProjectionMatrix();
  }
  private render(dt:number){
    const actor=this.player.state,focus=new T.Vector3(actor.x,actor.y,actor.z);
    this.environment.update(this.settings.time,this.elapsed,focus);this.materials.setNight(this.environment.night);
    const animDt=this.paused?0:dt;this.player.render(animDt);this.homeCar.render(animDt,this.environment.night);this.traffic.render(animDt,this.environment.night);
    this.positionCamera(dt);this.marker.visible=Boolean(this.destination)&&!this.photo;
    if(this.destination)this.marker.position.set(this.destination.x,Math.max(.3,surfaceHeight(this.destination.x,this.destination.z)+.3),this.destination.z);
    if(!this.active){const cars=[this.homeCar,...this.traffic.cars.map(e=>e.car)],near=cars.some(c=>Math.abs(c.speed)<5&&Math.hypot(c.position.x-actor.x,c.position.z-actor.z)<6);this.ui.hint(near?'Enter vehicle':null);}else this.ui.hint(Math.abs(actor.speed)<3?'Exit vehicle':null);
    this.renderer.render(this.scene,this.camera);
    if(this.nextCapture){this.nextCapture=false;this.canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='leonida-photo.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);},'image/png');}
    this.ui.update(actor,this.progress,this.frameMs,this.renderer.info.render.calls,this.renderer.info.render.triangles,this.world.chunks.size);
  }
  private frame=(now:number)=>{
    const dt=Math.min(.15,(now-this.last)/1000);this.last=now;this.elapsed+=dt;this.frameMs=damp(this.frameMs,dt*1000,.9,dt);
    this.inputActions();this.world.update(this.player.state.x,this.player.state.z,1);
    if(!this.paused)this.clock.advance(dt,(fixed:number)=>this.tick(fixed));else this.clock.reset();
    this.render(dt);this.request=requestAnimationFrame(this.frame);
  };
  save(){if(!this.ready||!this.player)return;try{localStorage.setItem(SAVE_KEY,serializeSave(this.progress,this.player.state,this.settings));}catch{this.ui.notify('Local save unavailable in this browser session.');}}
  snapshot(){return {ready:this.ready,started:this.started,paused:this.paused,photo:this.photo,actor:{...this.player.state},car:{x:this.homeCar.position.x,y:this.homeCar.position.y,z:this.homeCar.position.z,health:this.homeCar.health},progress:structuredClone(this.progress),world:this.world.stats,assets:{characters:this.characters.templates.length,landmarks:this.data.landmarks.length},traffic:{cars:this.traffic.cars.length,pedestrians:this.traffic.walkers.length},render:{calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,frameMs:this.frameMs}};}
  debugStep(frames:number){for(let i=0;i<Math.min(1800,frames);i++){this.world.update(this.player.state.x,this.player.state.z,1);this.tick(1/60);}this.render(1/60);}
  debugView(x:number,y:number,z:number,lookX:number,lookY:number,lookZ:number){this.photo=true;this.paused=true;this.fly.set(x,y,z);const dir=new T.Vector3(lookX-x,lookY-y,lookZ-z).normalize();this.input.yaw=Math.atan2(dir.x,dir.z);this.input.pitch=Math.asin(-dir.y);this.ui.setPhoto(true);this.render(1/60);}
  dispose(){cancelAnimationFrame(this.request);this.abort.abort();this.input.dispose();this.audio.dispose();this.traffic?.dispose();this.homeCar?.dispose();this.player?.dispose();this.world?.dispose();this.environment.dispose();this.materials.dispose();this.marker.geometry.dispose();(this.marker.material as T.Material).dispose();this.renderer.dispose();this.physics?.free();}
}
