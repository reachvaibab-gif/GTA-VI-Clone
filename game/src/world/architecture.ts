import * as T from 'three';
import { Batch } from '../render/batch';
import { rng } from '../core/math.mjs';
import { planBuilding } from './building-plan.mjs';
export type Building={x:number;z:number;width:number;depth:number;height:number;yaw:number;seed:number;style:'deco'|'tower'|'house'|'warehouse';name?:string};
export type BoxCollider={x:number;y:number;z:number;hx:number;hy:number;hz:number;yaw:number};
export function building(batch:Batch,b:Building,base=2.4,detail=true):BoxCollider {
  const plan=planBuilding(b,detail),s=Math.sin(b.yaw),c=Math.cos(b.yaw);
  for(const p of plan.parts){
    const [x,y,z]=p.position,[sx,sy,sz]=p.size;
    batch.add(p.shape,p.material,b.x+x*c+z*s,base+y,b.z-x*s+z*c,sx,sy,sz,p.color,b.yaw+p.ry);
  }
  if(b.name&&detail&&b.style!=='house'){
    const sign=new T.Mesh(new T.PlaneGeometry(Math.min(b.width-2,13),1.65),batch.materials.sign(b.name));
    sign.position.set(b.x+(b.depth/2+.48)*s-batch.originX,base+4.35,b.z+(b.depth/2+.48)*c-batch.originZ);sign.rotation.y=b.yaw;batch.group.add(sign);
  }
  // Exterior-only building collision proxy. Interiors require authored room colliders.
  return {x:b.x,y:base+b.height/2,z:b.z,hx:b.width/2,hy:b.height/2,hz:b.depth/2,yaw:b.yaw};
}
export function palm(batch:Batch,x:number,z:number,y:number,seed:number,scale=1){
  const r=rng(seed),h=(7+r()*4)*scale,lean=(r()-.5)*1.25;
  for(let i=0;i<5;i++)batch.add('cylinder','palmBark',x+lean*i/5,y+h*(i+.5)/5,z,.18*scale,h/5+.05,.18*scale,0xffffff,0,0,-lean/h);
  for(let i=0;i<10;i++)batch.add('round','palmBark',x+lean*i/10,y+h*i/10,z,.19*scale,.06,.19*scale,0x76694d);
  const topX=x+lean;
  for(let i=0;i<11;i++)batch.add('leaf','leaf',topX,y+h,z,scale*(.9+r()*.3),scale,scale,new T.Color().setHSL(.23+r()*.045,.34,.36+r()*.08),i*Math.PI*2/11+r()*.15,-.1+r()*.28);
  for(let i=0;i<4;i++)batch.add('leaf','leaf',topX,y+h+.1,z,scale*.62,scale*.7,scale*.75,0xb4bd83,i*Math.PI*.5+r(),-.65);
  batch.add('sphere','leaf',topX,y+h,z,.36*scale,.38*scale,.36*scale,0x84904b);
}
export function streetLamp(batch:Batch,x:number,z:number,y:number,yaw:number){
  batch.add('round','metal',x,y+.13,z,.18,.26,.18,0x475454);
  batch.add('round','metal',x,y+3.8,z,.075,7.6,.075,0x686e68);
  const dx=Math.sin(yaw)*1.5,dz=Math.cos(yaw)*1.5;
  batch.box('metal',x+dx*.5,y+7.55,z+dz*.5,.07,.08,1.6,0x69716c,yaw);
  batch.box('dark',x+dx,y+7.5,z+dz,.5,.15,1,0xffffff,yaw);
  batch.box('neon',x+dx,y+7.4,z+dz,.36,.045,.74,0xffd99b,yaw);
}
export function bench(batch:Batch,x:number,z:number,y:number,yaw=0){
  const c=Math.cos(yaw),s=Math.sin(yaw);
  const box=(material:string,xx:number,yy:number,zz:number,w:number,h:number,d:number,color:number)=>batch.box(material,x+xx*c+zz*s,y+yy,z-xx*s+zz*c,w,h,d,color,yaw);
  for(let i=0;i<4;i++)box('trunk',0,.48,i*.11-.17,1.8,.065,.085,0xab8662);
  for(const side of [-1,1]){box('metal',side*.65,.25,0,.065,.5,.4,0x3c4541);box('metal',side*.8,.66,0,.055,.38,.4,0x3c4541);}
  for(let i=0;i<3;i++)box('trunk',0,.74+i*.12,.22,1.8,.09,.065,0x987753);
}
