import * as T from 'three';
import { Materials } from './materials';
export interface CarModel {root:T.Group;wheels:T.Group[];spins:T.Group[];door:T.Group;brake:T.MeshStandardMaterial;paint:T.MeshStandardMaterial;lights:T.SpotLight[];dispose:()=>void}
function shell(){
  const rings=[[-2.23,.78,.69],[-1.9,1,.86],[-.95,1.02,.93],[.8,1.01,.91],[1.75,.94,.79],[2.2,.79,.64]],p:number[]=[],idx:number[]=[];
  for(const [z,w,h]of rings)for(const [x,y]of [[w,.42],[w,.66],[w*.84,h],[0,h+.035],[-w*.84,h],[-w,.66],[-w,.42],[0,.38]])p.push(x,y,z);
  for(let r=0;r<rings.length-1;r++)for(let i=0;i<8;i++){const a=r*8+i,b=r*8+(i+1)%8,c=(r+1)*8+i,d=(r+1)*8+(i+1)%8;idx.push(a,b,c,b,d,c);}
  for(let i=1;i<7;i++){idx.push(0,i+1,i);const b=(rings.length-1)*8;idx.push(b,b+i,b+i+1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
export function carModel(materials:Materials,color:T.ColorRepresentation,police=false):CarModel {
  const root=new T.Group(),geometries:T.BufferGeometry[]=[],paint=materials.values.paint.clone();paint.color.set(color);
  const brake=materials.values.red.clone();brake.emissive.set(0xff2015);brake.emissiveIntensity=.35;
  const mesh=(geo:T.BufferGeometry,mat:T.Material,x=0,y=0,z=0,parent:T.Object3D=root)=>{geometries.push(geo);const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const box=(mat:T.Material,x:number,y:number,z:number,w:number,h:number,d:number,parent:T.Object3D=root)=>mesh(new T.BoxGeometry(w,h,d),mat,x,y,z,parent);
  mesh(shell(),paint);
  box(materials.values.dark,0,.42,0,1.68,.2,3.75);
  // Tapered cabin glazing and metal roof rather than a rectangular vehicle silhouette.
  const p=[-.78,.93,.76,.78,.93,.76,-.64,1.47,.13,.64,1.47,.13,-.64,1.47,-.98,.64,1.47,-.98,-.81,.93,-1.48,.81,.93,-1.48];
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex([0,1,2,1,3,2,2,3,4,3,5,4,4,5,6,5,7,6,0,2,6,2,4,6,1,7,3,3,7,5]);g.computeVertexNormals();mesh(g,materials.values.glass);
  box(paint,0,1.49,-.43,1.34,.075,1.14);
  for(const side of [-1,1]){
    box(materials.values.dark,side*.807,1.05,-.15,.045,.29,.065);
    box(materials.values.metal,side*.87,.87,-.08,.05,.025,2.14);
    box(paint,side*1.035,1.01,.33,.25,.16,.36);
    box(materials.values.glass,side*1.041,1.01,.19,.24,.12,.015);
    box(materials.values.white,side*.56,.71,2.085,.44,.12,.08);
    box(brake,side*.60,.76,-2.13,.52,.115,.055);
    box(materials.values.metal,side*.74,.39,-2.14,.14,.10,.14);
  }
  box(materials.values.dark,0,.52,2.19,.94,.15,.05);
  for(let i=-3;i<=3;i++)box(materials.values.metal,i*.115,.53,2.22,.032,.1,.017);
  box(materials.values.white,0,.66,-2.22,.34,.13,.025);
  box(materials.values.dark,-.38,.9,-.57,.58,.66,.52);box(materials.values.dark,.38,.9,-.57,.58,.66,.52);
  const wheel=new T.TorusGeometry(.15,.018,7,18);mesh(wheel,materials.values.dark,-.4,1.0,.22).rotation.x=-.3;
  const wheels:T.Group[]=[],spins:T.Group[]=[];
  for(const z of [1.38,-1.4])for(const side of [-1,1]){
    const joint=new T.Group();joint.position.set(side*.94,.38,z);root.add(joint);wheels.push(joint);
    const spin=new T.Group();joint.add(spin);spins.push(spin);
    mesh(new T.CylinderGeometry(.365,.365,.255,24),materials.values.rubber,0,0,0,spin).rotation.z=Math.PI/2;
    mesh(new T.CylinderGeometry(.238,.238,.266,18),materials.values.metal,0,0,0,spin).rotation.z=Math.PI/2;
    mesh(new T.CylinderGeometry(.18,.18,.271,16),materials.values.dark,0,0,0,spin).rotation.z=Math.PI/2;
    for(let k=0;k<5;k++){const a=k*Math.PI*2/5;const spoke=box(materials.values.metal,side*.14,Math.cos(a)*.1,Math.sin(a)*.1,.03,.24,.037,spin);spoke.rotation.x=a;}
    mesh(new T.CylinderGeometry(.05,.05,.28,10),materials.values.metal,0,0,0,spin).rotation.z=Math.PI/2;
  }
  const door=new T.Group();door.position.set(-.96,.66,.64);root.add(door);box(paint,0,.12,-.53,.035,.43,1.12,door);box(materials.values.metal,-.03,.28,-.62,.025,.025,.19,door);
  const lights:T.SpotLight[]=[];
  for(const side of [-1,1]){
    const l=new T.SpotLight(0xfff1d6,0,85,.37,.5,1.4);l.position.set(side*.57,.75,2.15);l.target.position.set(side*.6,.3,40);root.add(l,l.target);lights.push(l);
  }
  if(police){box(materials.values.white,0,.92,-.15,2.02,.08,1.9);box(materials.values.dark,0,1.59,-.45,1.23,.1,.3);box(materials.values.neon,-.36,1.67,-.45,.48,.12,.26);box(brake,.36,1.67,-.45,.48,.12,.26);}
  return {root,wheels,spins,door,brake,paint,lights,dispose(){root.removeFromParent();geometries.forEach(g=>g.dispose());paint.dispose();brake.dispose();}};
}
