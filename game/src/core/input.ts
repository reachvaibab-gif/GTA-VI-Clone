import { clamp } from './math.mjs';
export class Input {
  readonly keys=new Set<string>();
  readonly pressed=new Set<string>();
  yaw=Math.PI;pitch=.22;lastMouse=0;enabled=false;sensitivity=1;
  touchMove={x:0,y:0};
  private abort=new AbortController();
  constructor(readonly canvas:HTMLCanvasElement){
    const opts={signal:this.abort.signal};
    window.addEventListener('keydown',e=>{
      if((e.target as HTMLElement)?.matches('input,select,textarea'))return;
      if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code)&&this.enabled)e.preventDefault();
      if(!this.keys.has(e.code))this.pressed.add(e.code);this.keys.add(e.code);
    },opts);
    window.addEventListener('keyup',e=>this.keys.delete(e.code),opts);
    window.addEventListener('blur',()=>this.clear(),opts);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear();},opts);
    document.addEventListener('mousemove',e=>{
      if(!this.enabled||document.pointerLockElement!==canvas)return;
      this.yaw-=e.movementX*.002*this.sensitivity;this.pitch=clamp(this.pitch+e.movementY*.0018*this.sensitivity,-.25,1.1);this.lastMouse=performance.now();
    },opts);
    canvas.addEventListener('click',()=>{if(this.enabled)this.lock();},opts);
    canvas.addEventListener('contextmenu',e=>e.preventDefault(),opts);
  }
  down(code:string){return this.keys.has(code);}
  consume(code:string){const v=this.pressed.has(code);this.pressed.delete(code);return v;}
  axis(negative:string,positive:string){return Number(this.down(positive))-Number(this.down(negative));}
  get forward(){return clamp(this.axis('KeyS','KeyW')-this.touchMove.y,-1,1);}
  get strafe(){return clamp(this.axis('KeyA','KeyD')+this.touchMove.x,-1,1);}
  clear(){this.keys.clear();this.pressed.clear();this.touchMove.x=this.touchMove.y=0;}
  lock(){try{const p=this.canvas.requestPointerLock();if(p&&'catch'in p)p.catch(()=>{});}catch{/* touch and restricted frames use drag controls */}}
  unlock(){if(document.pointerLockElement)document.exitPointerLock();this.clear();}
  dispose(){this.abort.abort();this.unlock();}
}
