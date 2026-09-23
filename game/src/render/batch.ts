import * as T from 'three';
import type { Materials } from './materials';
type Instance={matrix:T.Matrix4;color:T.Color};
function frondGeometry(){
  const p:number[]=[],idx:number[]=[];
  const triangle=(a:number[],b:number[],c:number[])=>{const k=p.length/3;p.push(...a,...b,...c);idx.push(k,k+1,k+2);};
  const spine=(t:number)=>[0,Math.sin(t*Math.PI)*.7-t*t*.8,t*4.5];
  for(let i=1;i<19;i++){
    const t=i/20,a=spine(t),b=spine(t+.065),w=Math.sin(t*Math.PI)*.86;
    for(const side of [-1,1]){const tip=[side*w,a[1]-.18,a[2]+.7];triangle(a,tip,b);triangle([side*.015,a[1]+.015,a[2]],b,tip);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
export class Primitives {
  readonly box=new T.BoxGeometry(1,1,1);
  readonly cylinder=new T.CylinderGeometry(.72,1,1,10);
  readonly round=new T.CylinderGeometry(1,1,1,20);
  readonly leaf=frondGeometry();
  readonly sphere=new T.SphereGeometry(1,12,8);
  dispose(){for(const g of [this.box,this.cylinder,this.round,this.leaf,this.sphere])g.dispose();}
}
export class Batch {
  readonly group=new T.Group();
  private bins=new Map<string,Instance[]>();
  private objects:T.InstancedMesh[]=[];
  private transform=new T.Object3D();
  private disposed=false;
  constructor(readonly primitives:Primitives,readonly materials:Materials,readonly originX:number,readonly originZ:number){this.group.position.set(originX,0,originZ);}
  add(shape:keyof Primitives,material:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,color:T.ColorRepresentation=0xffffff,ry=0,rx=0,rz=0){
    const key=String(shape)+'|'+material;if(!this.bins.has(key))this.bins.set(key,[]);
    const o=this.transform;o.position.set(x-this.originX,y,z-this.originZ);o.rotation.set(rx,ry,rz);o.scale.set(sx,sy,sz);o.updateMatrix();
    this.bins.get(key)!.push({matrix:o.matrix.clone(),color:new T.Color(color)});
  }
  box(material:string,x:number,y:number,z:number,w:number,h:number,d:number,color:T.ColorRepresentation=0xffffff,ry=0){this.add('box',material,x,y,z,w,h,d,color,ry);}
  finish(){
    for(const [key,entries] of this.bins){
      const [shape,mat]=key.split('|');const g=this.primitives[shape as keyof Primitives] as T.BufferGeometry;
      const m=new T.InstancedMesh(g,this.materials.values[mat],entries.length);
      entries.forEach((e,i)=>{m.setMatrixAt(i,e.matrix);m.setColorAt(i,e.color);});m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;
      m.castShadow=!['asphalt','sand','grass','stripe','sidewalk'].includes(mat);m.receiveShadow=true;m.computeBoundingSphere();this.group.add(m);this.objects.push(m);
    }
    this.bins.clear();return this.group;
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;
    // Sign planes are chunk-owned; instanced meshes borrow shared primitive geometry.
    this.group.traverse(object=>{if(object instanceof T.Mesh&&!(object instanceof T.InstancedMesh))object.geometry.dispose();});
    for(const mesh of this.objects)mesh.dispose();
    this.group.removeFromParent();this.group.clear();this.objects.length=0;this.bins.clear();
  }
}
