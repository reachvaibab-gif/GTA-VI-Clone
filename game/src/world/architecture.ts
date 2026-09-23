import * as T from 'three';
import { Batch } from '../render/batch';
import { rng } from '../core/math.mjs';
export type Building={x:number;z:number;width:number;depth:number;height:number;yaw:number;seed:number;style:'deco'|'tower'|'house'|'warehouse';name?:string};
export type BoxCollider={x:number;y:number;z:number;hx:number;hy:number;hz:number;yaw:number};
const paint=[0xf2d3bb,0xd8e4dd,0xe8d7c5,0xd0d7cf,0xf1c3b4,0xe8e1cb,0xc4d9d5,0xd8cec3];
export function building(batch:Batch,b:Building,base=2.4,detail=true):BoxCollider {
  const random=rng(b.seed),w=b.width,d=b.depth,h=b.height,c=paint[Math.floor(random()*paint.length)];
  const s=Math.sin(b.yaw),co=Math.cos(b.yaw);
  const place=(mat:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,color:T.ColorRepresentation=0xffffff)=>batch.box(mat,b.x+x*co+z*s,base+y,b.z-x*s+z*co,sx,sy,sz,color,b.yaw);
  place('stucco',0,h/2,0,w,h,d,c);
  place('roof',0,h+.12,0,w+.35,.28,d+.35);
  place('stone',0,.4,d*.5+.05,w+.35,.8,.22);
  if(b.style==='warehouse'){
    for(let x=-w*.36;x<w*.45;x+=5){place('dark',x,2.4,d*.5+.13,3.5,4.4,.2);for(let yy=.5;yy<4.7;yy+=.45)place('metal',x,yy,d*.5+.26,3.4,.04,.03);}
  }else{
    const floors=Math.max(1,Math.floor((h-4)/3.25));
    for(let floor=0;floor<floors;floor++){
      const yy=5.3+floor*3.25;
      if(yy+1>h)break;
      for(let x=-w/2+2;x<w/2-1;x+=3.6){
        place('dark',x,yy,d/2+.1,1.95,2.05,.18);
        place(random()>.83?'windowLight':'glass',x,yy,d/2+.22,1.7,1.83,.1);
        if(detail){place('trim',x,yy-1.04,d/2+.35,2.15,.14,.54);place('trim',x,yy,d/2+.3,.07,1.95,.07);}
      }
      // Side windows keep buildings believable from cross streets and elevated cameras.
      for(let z=-d/2+2;z<d/2-1;z+=4){
        place('glass',w/2+.06,yy,z,.14,1.65,1.55);
        place('glass',-w/2-.06,yy,z,.14,1.65,1.55);
      }
      if(b.style==='tower' || b.style==='deco')place('trim',0,yy-1.3,d/2+.33,w+.45,.22,.85);
      if(b.style==='tower' && floor%2===0 && detail){
        place('glass',0,yy-1,d/2+1.03,w-.6,.82,.07);
        place('metal',0,yy-.55,d/2+1.05,w-.6,.045,.045);
      }
    }
    // Recessed entrance, large storefront glazing, metal mullions, shade canopy.
    place('dark',0,1.7,d/2+.15,w-.9,3.4,.16);
    for(let x=-w/2+1.8;x<w/2;x+=3){place('glass',x,1.7,d/2+.27,2.75,2.7,.08);place('trim',x-1.43,1.7,d/2+.35,.15,3.2,.24);}
    place('trim',0,3.55,d/2+.7,w+1.4,.3,2);
    if(b.style==='deco'){
      place('stucco',w*.25,h+1.2,d*.28,w*.24,2.4,d*.32,c);
      for(let k=0;k<3;k++)place('trim',0,h-.5-k*.55,d*.5+.2,w+.8-k*.5,.13,.4);
      place('neon',w*.26,h*.57,d*.5+.49,.12,h*.7,.12,new T.Color(c).multiplyScalar(1.15));
      place('neon',0,3.83,d*.5+.58,w-.4,.07,.09,0xffa66d);
      // Vertical ribs, deep parapets and curved corner balconies, not bare boxes.
      for(const x of [-w*.46,w*.46])place('trim',x,h*.52,d*.5+.25,.38,h-.8,.55);
      batch.add('round','stucco',b.x+(w*.5-2)*co+(d*.5-1)*s,base+h*.5,b.z-(w*.5-2)*s+(d*.5-1)*co,2.2,h,2.2,c);
    }
    if(b.name && detail){
      const sign=new T.Mesh(new T.PlaneGeometry(Math.min(w-2,13),2.6),batch.materials.sign(b.name));
      sign.position.set(b.x+(d/2+.48)*s-batch.originX,base+4.4,b.z+(d/2+.48)*co-batch.originZ);sign.rotation.y=b.yaw;batch.group.add(sign);
    }
  }
  // Roof plant, louvres, parapet, antenna; the skyline should survive an aerial view.
  for(const z of [-d/2,d/2])place('trim',0,h+.6,z,w+.5,1.05,.23);
  for(const x of [-w/2,w/2])place('trim',x,h+.6,0,.23,1.05,d);
  for(let i=0;i<Math.min(3,Math.floor(w/9));i++){const x=-w*.3+i*4.3;place('metal',x,h+.7,-d*.2,2.5,1.1,1.5);if(detail)for(let k=0;k<5;k++)place('dark',x,h+.72,-d*.2-.77+k*.014,1.9,.07,.04);}
  return {x:b.x,y:base+h/2,z:b.z,hx:w/2,hy:h/2,hz:d/2,yaw:b.yaw};
}
export function palm(batch:Batch,x:number,z:number,y:number,seed:number,scale=1){
  const r=rng(seed),h=(7+r()*4)*scale,lean=(r()-.5)*.7;
  for(let i=0;i<4;i++)batch.add('cylinder','trunk',x+lean*i/4,y+h*(i+.5)/4,z,.18*scale,h/4+.04,.18*scale,0xffffff,0,0,-lean/h);
  for(let i=0;i<8;i++)batch.add('round','trunk',x+lean*i/8,y+h*i/8,z,.19*scale,.07,.19*scale,0x655b48);
  const topX=x+lean;
  for(let i=0;i<9;i++)batch.add('leaf','leaf',topX,y+h,z,scale*(.9+r()*.25),scale,scale, new T.Color().setHSL(.23+r()*.045,.38,.27+r()*.06),i*Math.PI*2/9+r()*.15,-.1+r()*.28);
  batch.add('sphere','leaf',topX,y+h,z,.36,.38,.36,0x596332);
}
export function streetLamp(batch:Batch,x:number,z:number,y:number,yaw:number){
  batch.add('round','metal',x,y+3.8,z,.075,7.6,.075,0x686e68);
  const dx=Math.sin(yaw)*1.5,dz=Math.cos(yaw)*1.5;
  batch.box('metal',x+dx*.5,y+7.55,z+dz*.5,.07,.08,1.6,0x69716c,yaw);
  batch.box('dark',x+dx,y+7.5,z+dz,.5,.15,1,0xffffff,yaw);
  batch.box('neon',x+dx,y+7.4,z+dz,.36,.045,.74,0xffd99b,yaw);
}
export function bench(batch:Batch,x:number,z:number,y:number,yaw=0){
  for(let i=0;i<4;i++)batch.box('trunk',x,y+.48,z+i*.11-.17,1.8,.065,.085,0xab8662,yaw);
  for(const dx of [-.65,.65])batch.box('metal',x+dx,y+.25,z,.06,.5,.4,0x3c4541,yaw);
  batch.box('trunk',x,y+.9,z+.22,1.8,.5,.08,0x987753,yaw);
}
