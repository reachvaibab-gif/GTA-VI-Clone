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
function gableGeometry(){
  const p:number[]=[],uv:number[]=[];
  const tri=(a:number[],b:number[],c:number[])=>{p.push(...a,...b,...c);uv.push(0,0,1,0,.5,1);};
  const quad=(a:number[],b:number[],c:number[],d:number[])=>{p.push(...a,...b,...c,...a,...c,...d);uv.push(0,0,1,0,1,1,0,0,1,1,0,1);};
  tri([-.5,-.5,.5],[.5,-.5,.5],[0,.5,.5]);tri([.5,-.5,-.5],[-.5,-.5,-.5],[0,.5,-.5]);
  quad([-.5,-.5,-.5],[-.5,-.5,.5],[0,.5,.5],[0,.5,-.5]);
  quad([0,.5,-.5],[0,.5,.5],[.5,-.5,.5],[.5,-.5,-.5]);
  quad([-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}
export class Primitives {
  readonly box=new T.BoxGeometry(1,1,1);
  readonly cylinder=new T.CylinderGeometry(.72,1,1,10);
  readonly round=new T.CylinderGeometry(1,1,1,20);
  readonly leaf=frondGeometry();readonly gable=gableGeometry();
  readonly sphere=new T.SphereGeometry(1,12,8);
  dispose(){for(const g of [this.box,this.cylinder,this.round,this.leaf,this.gable,this.sphere])g.dispose();}
}
export class Batch {
  readonly group=new T.Group();
  private bins=new Map<string,Instance[]>();
  private objects:T.InstancedMesh[]=[];private originals:T.Matrix4[][]=[];
  private transform=new T.Object3D();private disposed=false;
  constructor(readonly primitives:Primitives,readonly materials:Materials,readonly originX:number,readonly originZ:number,private retainTransforms=false){this.group.position.set(originX,0,originZ);}
  add(shape:keyof Primitives,material:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,color:T.ColorRepresentation=0xffffff,ry=0,rx=0,rz=0){
    const key=String(shape)+'|'+material;if(!this.bins.has(key))this.bins.set(key,[]);
    const o=this.transform;o.position.set(x-this.originX,y,z-this.originZ);o.rotation.set(rx,ry,rz);o.scale.set(sx,sy,sz);o.updateMatrix();
    this.bins.get(key)!.push({matrix:o.matrix.clone(),color:new T.Color(color)});
  }
  box(material:string,x:number,y:number,z:number,w:number,h:number,d:number,color:T.ColorRepresentation=0xffffff,ry=0){this.add('box',material,x,y,z,w,h,d,color,ry);}
  finish(){
    for(const [key,entries] of this.bins){
      const [shape,mat]=key.split('|');const g=this.primitives[shape as keyof Primitives] as T.BufferGeometry;
      if(!this.materials.values[mat])throw new Error(`Missing architectural material: ${mat}`);
      const m=new T.InstancedMesh(g,this.materials.values[mat],entries.length);
      entries.forEach((e,i)=>{m.setMatrixAt(i,e.matrix);m.setColorAt(i,e.color);});m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;
      m.castShadow=!['asphalt','sand','grass','stripe','sidewalk'].includes(mat);m.receiveShadow=true;m.computeBoundingSphere();this.group.add(m);this.objects.push(m);if(this.retainTransforms)this.originals.push(entries.map(e=>e.matrix));
    }
    this.bins.clear();return this.group;
  }
  hideCells(keys:Set<string>,size:number){
    if(!this.retainTransforms)return;
    const hidden=new T.Matrix4();
    this.objects.forEach((mesh,index)=>{
      this.originals[index].forEach((matrix,i)=>{
        const e=matrix.elements,key=`${Math.floor((e[12]+this.originX)/size)},${Math.floor((e[14]+this.originZ)/size)}`;
        if(keys.has(key)){hidden.makeScale(.000001,.000001,.000001);hidden.setPosition(e[12],e[13],e[14]);mesh.setMatrixAt(i,hidden);}else mesh.setMatrixAt(i,matrix);
      });mesh.instanceMatrix.needsUpdate=true;
    });
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;
    // Sign planes are chunk-owned; instanced meshes borrow shared primitive geometry.
    this.group.traverse(object=>{if(object instanceof T.Mesh&&!(object instanceof T.InstancedMesh)){object.geometry.dispose();for(const mat of Array.isArray(object.material)?object.material:[object.material])this.materials.releaseSign(mat);}});
    for(const mesh of this.objects)mesh.dispose();
    this.group.removeFromParent();this.group.clear();this.objects.length=0;this.originals.length=0;this.bins.clear();
  }
}
