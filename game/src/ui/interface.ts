import { JOBS } from '../simulation/progression.mjs';
import { LAND,ROADS,WORLD_BOUNDS,districtAt } from '../world/layout.mjs';
import type { ActorState,Settings,WorldData } from '../types';
export type Panel='menu'|'pause'|'jobs'|'map'|'settings'|null;
export interface Progress {version:number;money:number;completed:string[];bestTimes:Record<string,number>;discovered:string[];mission:{id:string;checkpoint:number;remaining:number;elapsed:number}|null;heat:number;unseen:number;playSeconds:number}
export interface UIActions {start:()=>void;resume:()=>void;panel:(p:Panel)=>void;job:(id:string)=>void;waypoint:(p:{x:number;z:number})=>void;travel:(x:number,z:number)=>void;settings:(s:Partial<Settings>)=>void;reset:()=>void;photo:()=>void;capture:()=>void;touch:(code:string,down:boolean)=>void;stick:(x:number,y:number)=>void;look:(dx:number,dy:number)=>void}
const money=(n:number)=>'$'+Math.round(n).toLocaleString('en-US');
export class Interface {
  panel:Panel='menu';route:{x:number;z:number}[]=[];waypoint:{x:number;z:number}|null=null;photo=false;
  private minimap:HTMLCanvasElement;private map:HTMLCanvasElement;private atlas=false;
  private mapView={x:-3250,z:-500,zoom:1};private lastActor?:ActorState;private lastMap=0;private toastTimer=0;
  private action:UIActions;
  constructor(readonly root:HTMLElement,readonly world:WorldData,actions:UIActions){
    this.action=actions;
    root.innerHTML=`
      <div id="vignette" aria-hidden="true"></div>
      <section id="menu" class="panel title-panel">
        <div class="title-content"><p class="eyebrow">A SOUTH FLORIDA OPEN WORLD</p><h1>LEONIDA<span>AFTER HOURS</span></h1><p class="tagline">A long coast. A late night. One more job.</p>
          <button id="start" class="primary" disabled>Preparing the world… <span>↗</span></button>
          <div class="title-links"><button data-panel="settings">Settings</button><button data-panel="jobs">The jobs</button></div>
          <p id="loading-detail" role="status">Loading licensed assets and coastal geometry</p>
        </div><div class="title-footer"><span>UNOFFICIAL · DEVELOPMENT BUILD</span><span>METRE-SCALE WORLD / ORIGINAL GAMEPLAY</span></div>
      </section>
      <div id="hud" hidden>
        <section class="objective"><p id="district" class="eyebrow">OCEAN BEACH</p><h2 id="objective-title">Explore Leonida</h2><p id="objective-detail">J for jobs · M for the map</p><span id="timer"></span></section>
        <div class="player-status"><span id="heat" aria-label="Wanted level"></span><span id="cash">$0</span></div>
        <div class="minimap-shell"><canvas id="minimap" width="240" height="170" aria-label="Local street map"></canvas><div class="vitals"><i id="health"></i></div><div class="map-caption"><span>N ↑</span><span id="road-label">SHORE DRIVE</span><button data-panel="map" aria-label="Open map">M</button></div></div>
        <div id="speedometer" hidden><strong id="speed">0</strong><span>MPH</span><small id="gear">D</small></div>
        <div id="interaction" hidden><kbd>E</kbd><span>Enter vehicle</span></div>
        <div class="hud-shortcuts"><button data-panel="jobs">J <span>JOBS</span></button><button data-panel="pause">ESC <span>PAUSE</span></button></div>
      </div>
      <div id="photo-label" hidden><span class="eyebrow">PHOTO MODE</span><span>WASD move · Q/E elevation · Shift fast · F return</span><button id="capture">Save photo</button></div>
      <section id="pause" class="panel modal" hidden><div class="modal-inner pause-inner"><p class="eyebrow">TAKE A BREATH</p><h2>After hours.</h2><button id="resume" class="primary">Back to Leonida <span>↗</span></button><nav class="pause-links"><button data-panel="map">Map & destinations</button><button data-panel="jobs">The jobs</button><button id="photo">Photo mode</button><button data-panel="settings">Settings</button><button id="recover">Recover vehicle</button></nav><details><summary>Controls</summary><p>WASD — move / drive<br>Mouse — look<br>E — enter / exit a nearby car<br>Shift — sprint<br>Space — jump / handbrake<br>C — change camera<br>J — jobs · M — map · F — photo mode<br>R — recover vehicle · H — horn<br>Escape — pause</p></details><p class="muted">Progress saves locally when paused and after a completed job.</p></div></section>
      <section id="jobs" class="panel modal" hidden><div class="modal-inner"><header><div><p class="eyebrow">A LITTLE WORK ON THE SIDE</p><h2>The jobs.</h2></div><button class="close" data-close aria-label="Close jobs">×</button></header><p class="muted">Original missions. Drive the route, keep your wheels, collect your pay.</p><div id="job-list"></div></div></section>
      <section id="map" class="panel modal map-panel" hidden><header><div><p class="eyebrow">THE STATE IS YOURS</p><h2>Leonida.</h2></div><div><button id="atlas-toggle">Reference atlas</button><button id="map-fit">Fit world</button><button class="close" data-close aria-label="Close map">×</button></div></header><div class="map-frame"><canvas id="world-map" aria-label="Interactive world map. Click to set a waypoint; drag to pan; scroll to zoom."></canvas><img id="atlas" hidden src="${import.meta.env.BASE_URL}generated/reference-map.webp" alt="Yanis community reference atlas, not calibrated to the estimated road geometry" /></div><footer><span id="map-help">Click for GPS · Drag to pan · Scroll to zoom</span><label>Travel assist <select id="travel"><option value="">Choose a district</option><option value="2000,-420">Ocean Beach</option><option value="120,-1020">Downtown / Bayfront</option><option value="-7300,-3650">Port Gellhorn</option><option value="-5100,-5800">Ambrosia</option><option value="-6900,-7250">Mount Kalaga</option><option value="-5380,7330">Leonida Keys</option></select></label></footer><p class="map-note">Estimated roads and terrain. Source landmark coordinates preserved. Atlas: gtadb.org and all contributors / CC BY 4.0.</p></section>
      <section id="settings" class="panel modal" hidden><div class="modal-inner settings-inner"><header><div><p class="eyebrow">MAKE YOURSELF AT HOME</p><h2>Settings.</h2></div><button class="close" data-close aria-label="Close settings">×</button></header><label>Graphics<select id="quality"><option value="low">Performance — shorter detail radius</option><option value="balanced" selected>Balanced — shadows & streamed detail</option><option value="high">High — native-resolution detail</option></select></label><label>Look sensitivity<input id="sensitivity" type="range" min="0.3" max="2" step="0.1" value="1"></label><label>Time of day<input id="time" type="range" min="0" max="23.9" step="0.1" value="17.2"><output id="time-output">17:12</output></label><label class="switch">Ambient sound & engine<input id="audio" type="checkbox" checked></label><label class="switch">Civilian traffic & pedestrians<input id="traffic" type="checkbox" checked></label><details><summary>Credits & build information</summary><p>Characters: Quaternius (CC0). Selected materials: Poly Haven (CC0). Landmark data and reference atlas: gtadb.org and all contributors (CC BY 4.0). Additional environments, vehicles and audio are project-authored.</p><p>This development build is not an official Rockstar release or a verified 1:1 reconstruction. Authored environments and estimated geography require further reference matching.</p><p id="stats">Waiting for renderer…</p></details></div></section>
      <div id="toast" role="status" aria-live="polite" hidden></div>
      <div id="touch-controls" hidden><div id="stick" aria-label="Movement joystick"><i></i></div><div id="look-zone" aria-label="Drag to look"></div><div class="touch-buttons"><button data-touch="KeyE">E</button><button data-touch="Space">↑</button><button data-touch="ShiftLeft">RUN</button><button data-panel="pause">Ⅱ</button></div></div>
    `;
    this.minimap=root.querySelector('#minimap')!;this.map=root.querySelector('#world-map')!;
    root.querySelector('#start')!.addEventListener('click',actions.start);root.querySelector('#resume')!.addEventListener('click',actions.resume);
    root.querySelectorAll<HTMLElement>('[data-panel]').forEach(e=>e.addEventListener('click',()=>actions.panel(e.dataset.panel as Panel)));
    root.querySelectorAll('[data-close]').forEach(e=>e.addEventListener('click',actions.resume));
    root.querySelector('#recover')!.addEventListener('click',actions.reset);root.querySelector('#photo')!.addEventListener('click',actions.photo);root.querySelector('#capture')!.addEventListener('click',actions.capture);
    const jobs=root.querySelector('#job-list')!;
    for(const job of JOBS){const row=document.createElement('button');row.className='job-row';row.dataset.job=job.id;row.innerHTML=`<div><span class="eyebrow">${job.contact} / ${job.type}</span><h3>${job.title}</h3><p>${job.description}</p></div><strong>${money(job.reward)} <span>↗</span></strong>`;row.addEventListener('click',()=>actions.job(job.id));jobs.append(row);}
    for(const id of ['quality','audio','traffic','time','sensitivity'])root.querySelector('#'+id)!.addEventListener('input',e=>{
      const input=e.target as HTMLInputElement;let value:string|number|boolean=input.type==='checkbox'?input.checked:['time','sensitivity'].includes(id)?Number(input.value):input.value;
      actions.settings({[id]:value} as Partial<Settings>);
    });
    root.querySelector('#travel')!.addEventListener('change',e=>{const el=e.target as HTMLSelectElement;if(el.value){const [x,z]=el.value.split(',').map(Number);actions.travel(x,z);el.value='';}});
    root.querySelector('#atlas-toggle')!.addEventListener('click',()=>{this.atlas=!this.atlas;this.map.hidden=this.atlas;(root.querySelector('#atlas') as HTMLElement).hidden=!this.atlas;root.querySelector('#atlas-toggle')!.textContent=this.atlas?'Playable map':'Reference atlas';root.querySelector('#map-help')!.textContent=this.atlas?'Display-only community atlas; coordinate origin not yet calibrated':'Click for GPS · Drag to pan · Scroll to zoom';});
    root.querySelector('#map-fit')!.addEventListener('click',()=>{this.mapView={x:-3250,z:-500,zoom:1};});
    this.bindMap();this.bindTouch();
  }
  private bindMap(){
    let pointer:{x:number;y:number;cx:number;cz:number;moved:boolean}|null=null;
    this.map.addEventListener('pointerdown',e=>{this.map.setPointerCapture(e.pointerId);pointer={x:e.clientX,y:e.clientY,cx:this.mapView.x,cz:this.mapView.z,moved:false};});
    this.map.addEventListener('pointermove',e=>{if(!pointer)return;const s=this.mapScale();const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;pointer.moved ||= Math.hypot(dx,dy)>4;this.mapView.x=pointer.cx-dx/s;this.mapView.z=pointer.cz-dy/s;});
    this.map.addEventListener('pointerup',e=>{if(!pointer)return;if(!pointer.moved){const r=this.map.getBoundingClientRect(),s=this.mapScale();const x=this.mapView.x+(e.clientX-r.left-r.width/2)/s,z=this.mapView.z+(e.clientY-r.top-r.height/2)/s;this.action.waypoint({x,z});}pointer=null;});
    this.map.addEventListener('pointercancel',()=>pointer=null);
    this.map.addEventListener('wheel',e=>{e.preventDefault();this.mapView.zoom=Math.max(.75,Math.min(18,this.mapView.zoom*Math.exp(-e.deltaY*.001)));},{passive:false});
  }
  private bindTouch(){
    const stick=this.root.querySelector('#stick') as HTMLElement,knob=stick.querySelector('i')!;let start:{x:number;y:number}|null=null;
    stick.addEventListener('pointerdown',e=>{stick.setPointerCapture(e.pointerId);start={x:e.clientX,y:e.clientY};e.preventDefault();});
    stick.addEventListener('pointermove',e=>{if(!start)return;let x=(e.clientX-start.x)/40,y=(e.clientY-start.y)/40;const n=Math.max(1,Math.hypot(x,y));x/=n;y/=n;knob.style.transform=`translate(${x*32}px,${y*32}px)`;this.action.stick(x,y);});
    const reset=()=>{start=null;knob.style.transform='';this.action.stick(0,0);};stick.addEventListener('pointerup',reset);stick.addEventListener('pointercancel',reset);
    this.root.querySelectorAll<HTMLElement>('[data-touch]').forEach(b=>{b.addEventListener('pointerdown',e=>{b.setPointerCapture(e.pointerId);e.preventDefault();this.action.touch(b.dataset.touch!,true);});for(const event of ['pointerup','pointercancel'])b.addEventListener(event,()=>this.action.touch(b.dataset.touch!,false));});
    const look=this.root.querySelector('#look-zone') as HTMLElement;let last:{x:number;y:number}|null=null;
    look.addEventListener('pointerdown',e=>{look.setPointerCapture(e.pointerId);last={x:e.clientX,y:e.clientY};});look.addEventListener('pointermove',e=>{if(last){this.action.look(e.clientX-last.x,e.clientY-last.y);last={x:e.clientX,y:e.clientY};}});for(const event of ['pointerup','pointercancel'])look.addEventListener(event,()=>last=null);
  }
  ready(saved=false){const b=this.root.querySelector('#start') as HTMLButtonElement;b.disabled=false;b.innerHTML=`${saved?'Continue in Leonida':'Enter Leonida'} <span>↗</span>`;this.root.querySelector('#loading-detail')!.textContent='WASD to move · Mouse to look · E to enter a car';}
  loading(text:string){this.root.querySelector('#loading-detail')!.textContent=text;}
  show(panel:Panel){this.panel=panel;for(const name of ['menu','pause','jobs','map','settings'])(this.root.querySelector('#'+name) as HTMLElement).hidden=panel!==name;
    (this.root.querySelector('#hud') as HTMLElement).hidden=panel!==null||this.photo;
    (this.root.querySelector('#touch-controls') as HTMLElement).hidden=panel!==null||this.photo;
    if(panel==='map'&&this.lastActor)this.mapView={x:this.lastActor.x,z:this.lastActor.z,zoom:5};
  }
  setPhoto(value:boolean){this.photo=value;(this.root.querySelector('#photo-label') as HTMLElement).hidden=!value;this.show(null);}
  hint(text:string|null){const e=this.root.querySelector('#interaction') as HTMLElement;e.hidden=!text;e.querySelector('span')!.textContent=text??'';}
  notify(text:string,duration=4500){const e=this.root.querySelector('#toast') as HTMLElement;e.textContent=text;e.hidden=false;window.clearTimeout(this.toastTimer);this.toastTimer=window.setTimeout(()=>e.hidden=true,duration);}
  settings(s:Settings){for(const key of ['quality','audio','traffic','time','sensitivity']as const){const el=this.root.querySelector('#'+key) as HTMLInputElement;if(typeof s[key]==='boolean')el.checked=s[key] as boolean;else el.value=String(s[key]);}this.root.querySelector('#time-output')!.textContent=`${String(Math.floor(s.time)).padStart(2,'0')}:${String(Math.floor(s.time%1*60)).padStart(2,'0')}`;}
  update(actor:ActorState,p:Progress,ms:number,draws:number,triangles:number,chunks:number){
    this.lastActor=actor;const job=JOBS.find(j=>j.id===p.mission?.id);
    this.root.querySelector('#district')!.textContent=districtAt(actor.x,actor.z).toUpperCase();
    this.root.querySelector('#objective-title')!.textContent=job?.title??'Explore Leonida';
    this.root.querySelector('#objective-detail')!.textContent=job?(job.type==='escape'?'Lose the patrol and stay out of sight':`Checkpoint ${p.mission!.checkpoint} / ${job.points.length-1} · Follow the GPS`):'J for jobs · M for the map';
    this.root.querySelector('#timer')!.textContent=p.mission?`${Math.floor(p.mission.remaining/60)}:${String(Math.floor(p.mission.remaining%60)).padStart(2,'0')}`:'';
    this.root.querySelector('#cash')!.textContent=money(p.money);this.root.querySelector('#heat')!.textContent=p.heat>.05?'★'.repeat(Math.ceil(p.heat)):'';
    (this.root.querySelector('#health') as HTMLElement).style.width=`${Math.max(0,actor.health)}%`;
    (this.root.querySelector('#speedometer') as HTMLElement).hidden=!actor.driving;
    this.root.querySelector('#speed')!.textContent=String(Math.round(Math.abs(actor.speed)*2.23694));this.root.querySelector('#gear')!.textContent=actor.speed<-.2?'R':String(Math.min(6,1+Math.floor(Math.abs(actor.speed)/10)));
    this.root.querySelector('#road-label')!.textContent=districtAt(actor.x,actor.z).toUpperCase();
    this.root.querySelector('#stats')!.textContent=`Frame ${ms.toFixed(1)} ms · ${draws} draw calls · ${Math.round(triangles/1000)}k triangles · ${chunks} detail cells. Live measurements, not target-device benchmarks.`;
    if(performance.now()-this.lastMap>150){this.lastMap=performance.now();this.drawMap(this.minimap,actor,false);if(this.panel==='map'&&!this.atlas)this.drawMap(this.map,actor,true);}
  }
  private mapScale(){const r=this.map.getBoundingClientRect();return Math.min(r.width/(WORLD_BOUNDS.maxX-WORLD_BOUNDS.minX),r.height/(WORLD_BOUNDS.maxZ-WORLD_BOUNDS.minZ))*this.mapView.zoom;}
  private drawMap(canvas:HTMLCanvasElement,a:ActorState,full:boolean){
    const rect=canvas.getBoundingClientRect();if(rect.width<1||rect.height<1)return;const dpr=Math.min(2,devicePixelRatio);if(canvas.width!==Math.floor(rect.width*dpr)||canvas.height!==Math.floor(rect.height*dpr)){canvas.width=Math.floor(rect.width*dpr);canvas.height=Math.floor(rect.height*dpr);}
    const ctx=canvas.getContext('2d')!;ctx.setTransform(dpr,0,0,dpr,0,0);const w=rect.width,h=rect.height,cx=full?this.mapView.x:a.x,cz=full?this.mapView.z:a.z;
    const scale=full?this.mapScale():w/(a.driving?700:430),px=(x:number)=>w/2+(x-cx)*scale,py=(z:number)=>h/2+(z-cz)*scale;
    ctx.fillStyle='#193138';ctx.fillRect(0,0,w,h);ctx.fillStyle='#344542';
    for(const ring of LAND){ctx.beginPath();ring.forEach((p,i)=>i?ctx.lineTo(px(p[0]),py(p[1])):ctx.moveTo(px(p[0]),py(p[1])));ctx.closePath();ctx.fill();}
    ctx.lineCap='round';ctx.lineJoin='round';
    for(const road of ROADS){ctx.beginPath();road.points.forEach((p,i)=>i?ctx.lineTo(px(p[0]),py(p[1])):ctx.moveTo(px(p[0]),py(p[1])));ctx.strokeStyle='#162526';ctx.lineWidth=Math.max(full?2.5:3,road.width*scale+2);ctx.stroke();ctx.strokeStyle=road.kind==='highway'?'#b5a47d':'#8b9690';ctx.lineWidth=Math.max(1,road.width*scale);ctx.stroke();}
    if(full&&this.mapView.zoom>2){ctx.fillStyle='#c8b5a2';for(const lm of this.world.landmarks){const x=px(lm.x),y=py(lm.z);if(x<0||y<0||x>w||y>h)continue;ctx.fillRect(x-1,y-1,2,2);}}
    if(this.route.length){ctx.strokeStyle='#dcb88a';ctx.lineWidth=full?3:2.8;ctx.beginPath();this.route.forEach((p,i)=>i?ctx.lineTo(px(p.x),py(p.z)):ctx.moveTo(px(p.x),py(p.z)));ctx.stroke();}
    if(full){ctx.font='500 11px sans-serif';ctx.textAlign='center';for(const region of this.world.regions.filter(r=>r.count>40)){const x=px(region.x),y=py(region.z);if(x<20||x>w-20||y<20||y>h-10)continue;ctx.fillStyle='#eee5d5';ctx.fillText(region.name.toUpperCase(),x,y);}}
    if(this.waypoint){ctx.strokeStyle='#f4cb98';ctx.lineWidth=2;ctx.beginPath();ctx.arc(px(this.waypoint.x),py(this.waypoint.z),6,0,Math.PI*2);ctx.stroke();}
    ctx.save();ctx.translate(px(a.x),py(a.z));ctx.rotate(Math.PI-a.yaw);ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(5,6);ctx.lineTo(0,3);ctx.lineTo(-5,6);ctx.closePath();ctx.fillStyle='#f7f1dc';ctx.fill();ctx.strokeStyle='#12292f';ctx.lineWidth=1.5;ctx.stroke();ctx.restore();
    if(full){const meters=1000;ctx.strokeStyle='#ded9c8';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(24,h-23);ctx.lineTo(24+meters*scale,h-23);ctx.stroke();ctx.textAlign='left';ctx.fillStyle='#ded9c8';ctx.font='11px sans-serif';ctx.fillText('1 km',24,h-31);}
  }
}
