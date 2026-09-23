import './style.css';
import { Game } from './game';
import type { WorldData,AssetData } from './types';
async function json<T>(path:string):Promise<T>{const response=await fetch(`${import.meta.env.BASE_URL}${path}`);if(!response.ok)throw new Error(`${path}: HTTP ${response.status}. Run npm run assets before serving the game.`);return response.json() as Promise<T>;}
async function boot(){
  const [world,assets]=await Promise.all([json<WorldData>('generated/world.json'),json<AssetData>('generated/assets.json')]);
  if(!Array.isArray(world.landmarks)||!world.landmarks.length)throw new Error('Landmark package is empty or invalid.');
  const game=new Game(document.querySelector('#world')!,document.querySelector('#ui')!,world,assets);await game.initialize();
  // Explicit opt-in diagnostics exercise the real game systems; absent from the normal window surface.
  if(new URLSearchParams(location.search).has('test'))Object.assign(window,{__game:{snapshot:()=>game.snapshot(),step:(n:number)=>game.debugStep(n),view:(...args:[number,number,number,number,number,number])=>game.debugView(...args),setTime:(n:number)=>game.applySettings({time:n}),recover:()=>game.recover(),save:()=>game.save()}});
}
boot().catch(error=>{
  console.error(error);const root=document.querySelector('#ui')!;root.textContent='';const panel=document.createElement('section');panel.className='fatal';
  const title=document.createElement('h1');title.textContent='The world could not start.';const message=document.createElement('p');message.textContent='Check that hardware acceleration and WebGL 2 are enabled. For a local checkout, run npm install and npm run assets from game/, then npm run dev.';
  const detail=document.createElement('pre');detail.textContent=error instanceof Error?error.message:String(error);panel.append(title,message,detail);root.append(panel);
});
