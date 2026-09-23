import * as T from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Batch, Primitives } from '../render/batch';
import { Materials } from '../render/materials';
import { building,palm,streetLamp,bench,type BoxCollider } from './architecture';
import { CHUNK_SIZE,SEGMENTS,wantedChunks,terrainHeight,isLand,nearestRoad,districtAt,WORLD_BOUNDS } from './layout.mjs';
import { rng,hash } from '../core/math.mjs';
import type { WorldData,Settings } from '../types';
type Chunk={batch:Batch;ground:T.Mesh;body:RAPIER.RigidBody;colliders:number};
const names=['AZURE','THE CRESCENT','PALOMA','OCEANIC','CASA SOL','SEABREEZE','LUNA','THE MERIDIAN'];
const cities=['Vice City','Ocean Beach','Washington Beach','Port Gellhorn','Ambrosia'];
export class WorldStream {
  readonly chunks=new Map<string,Chunk>();
  readonly primitives=new Primitives();
  readonly groundMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0});
  readonly farGround:T.Mesh;
  readonly skyline:T.Group;
  private farBatch:Batch;
  private lastCenter='';
  private pending:ReturnType<typeof wantedChunks>=[];
  constructor(readonly scene:T.Scene,readonly physics:RAPIER.World,readonly materials:Materials,readonly data:WorldData,public quality:Settings['quality']){
    const b=WORLD_BOUNDS;
    const g=new T.PlaneGeometry(b.maxX-b.minX,b.maxZ-b.minZ,140,160);g.rotateX(-Math.PI/2);
    const p=g.attributes.position,colors=[];
    for(let i=0;i<p.count;i++){
      const x=p.getX(i)+(b.minX+b.maxX)/2,z=p.getZ(i)+(b.minZ+b.maxZ)/2;
      p.setXYZ(i,x,terrainHeight(x,z)-.15,z);const c=new T.Color(isLand(x,z)?0x71815b:0x376e70);colors.push(c.r,c.g,c.b);
    }
    g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();
    this.farGround=new T.Mesh(g,this.groundMaterial);this.farGround.receiveShadow=true;scene.add(this.farGround);
    this.farBatch=new Batch(this.primitives,materials,0,0);
    for(const p of data.landmarks){
      if(!/hotel|residential|office|retail/.test(p.tags)||!isLand(p.x,p.z))continue;
      if(p.x>1450&&p.x<2250&&p.z>-1800&&p.z<600)continue;
      const random=rng(hash(Math.floor(p.x),Math.floor(p.z))),h=12+random()*68;
      this.farBatch.box('stucco',p.x,terrainHeight(p.x,p.z)+h/2,p.z,18+random()*12,h,18+random()*12,0xc4c9c3);
    }
    this.skyline=this.farBatch.finish();scene.add(this.skyline);
    // The far mesh provides silhouettes only. Nearby authored streaming meshes replace it.
    this.skyline.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=false;}});
  }
  private inside(x:number,z:number,cx:number,cz:number){return x>=cx*CHUNK_SIZE&&x<(cx+1)*CHUNK_SIZE&&z>=cz*CHUNK_SIZE&&z<(cz+1)*CHUNK_SIZE;}
  private make(cx:number,cz:number):Chunk {
    const ox=cx*CHUNK_SIZE,oz=cz*CHUNK_SIZE,cxw=ox+128,czw=oz+128;
    const batch=new Batch(this.primitives,this.materials,ox,oz);
    const body=this.physics.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(ox,0,oz));
    let colliders=0;
    const boxCollider=(b:BoxCollider)=>{
      this.physics.createCollider(RAPIER.ColliderDesc.cuboid(b.hx,b.hy,b.hz).setTranslation(b.x-ox,b.y,b.z-oz).setRotation({x:0,y:Math.sin(b.yaw/2),z:0,w:Math.cos(b.yaw/2)}).setFriction(.75),body);colliders++;
    };
    const g=new T.PlaneGeometry(256,256,16,16);g.rotateX(-Math.PI/2);g.translate(128,0,128);
    const p=g.attributes.position,colors:number[]=[];
    for(let i=0;i<p.count;i++){
      const x=p.getX(i)+ox,z=p.getZ(i)+oz;const y=terrainHeight(x,z);
      p.setY(i,y);
      const beach=x>2007&&x<2320&&z>-3400&&z<700;
      const n=(hash(Math.floor(x/8),Math.floor(z/8))%100)/1500;
      const c=new T.Color(beach?0xd8c59f:y<0?0x436d65:0x718255);c.offsetHSL(0,0,n);colors.push(c.r,c.g,c.b);
    }
    g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();
    const ground=new T.Mesh(g,this.groundMaterial);ground.position.set(ox,0,oz);ground.receiveShadow=true;
    this.physics.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(p.array),new Uint32Array(g.index!.array)),body);colliders++;
    // Globally anchored road pieces avoid cracks and repeated markings at chunk boundaries.
    for(const s of SEGMENTS){
      if(Math.max(s.a[0],s.b[0])<ox-40||Math.min(s.a[0],s.b[0])>ox+296||Math.max(s.a[1],s.b[1])<oz-40||Math.min(s.a[1],s.b[1])>oz+296)continue;
      const count=Math.ceil(s.length/16),length=s.length/count;
      for(let i=0;i<count;i++){
        const t=(i+.5)/count,x=s.a[0]+(s.b[0]-s.a[0])*t,z=s.a[1]+(s.b[1]-s.a[1])*t;
        if(!this.inside(x,z,cx,cz))continue;
        const y=Math.max(3.1,terrainHeight(x,z)+.7),dx=Math.cos(s.yaw),dz=-Math.sin(s.yaw);
        batch.box('asphalt',x,y,z,s.width,.22,length+.12,0xffffff,s.yaw);
        boxCollider({x,y:y-.15,z,hx:s.width/2,hy:.26,hz:length/2+.08,yaw:s.yaw});
        const crossing=SEGMENTS.some(other=>other.id!==s.id&&Math.abs(Math.sin(other.yaw-s.yaw))>.3&&
          Math.hypot(x-other.a[0],z-other.a[1])+Math.hypot(x-other.b[0],z-other.b[1])<other.length+3);
        if(!crossing){
          for(const side of [-1,1]){
            batch.box('stripe',x+dx*side*.16,y+.125,z+dz*side*.16,.08,.012,length,0xe4ba66,s.yaw);
            batch.box('stripe',x+dx*side*(s.width/2-1.2),y+.127,z+dz*side*(s.width/2-1.2),.11,.012,length*.57,0xffffff,s.yaw);
          }
        }
        if(s.kind==='urban')for(const side of [-1,1]){
          const off=s.width/2+2.3,xx=x+dx*side*off,zz=z+dz*side*off;
          const r=nearestRoad(xx,zz);if(r&&r.segment.id!==s.id&&r.distance<r.segment.width*.6)continue;
          batch.box('sidewalk',xx,y+.13,zz,4.6,.42,length,0xffffff,s.yaw);
          boxCollider({x:xx,y:y+.1,z:zz,hx:2.3,hy:.21,hz:length/2,yaw:s.yaw});
          if(i%4===0)streetLamp(batch,x+dx*side*(off+1.1),z+dz*side*(off+1.1),y,s.yaw-side*Math.PI/2);
        }
        if(!isLand(x,z)&&s.kind==='bridge'){
          for(const side of [-1,1]){
            const xx=x+dx*side*(s.width/2+.2),zz=z+dz*side*(s.width/2+.2);
            batch.box('stone',xx,y+.42,zz,.4,.9,length,0xdfd9c9,s.yaw);
            boxCollider({x:xx,y:y+.42,z:zz,hx:.2,hy:.45,hz:length/2,yaw:s.yaw});
          }
          if(i%3===0)batch.box('stone',x,-1,z,2.5,8,2.5,0xbfb9a7);
        }
      }
    }
    const occupied:{x:number;z:number;r:number}[]=[];
    const addBuilding=(x:number,z:number,w:number,d:number,h:number,yaw:number,seed:number,style:'deco'|'tower'|'house'|'warehouse',name?:string)=>{
      if(!this.inside(x,z,cx,cz)||!isLand(x,z))return;
      const road=nearestRoad(x,z),r=Math.max(w,d)*.5;
      if(road&&road.distance<road.segment.width/2+r+2)return;
      if(occupied.some(o=>Math.hypot(o.x-x,o.z-z)<o.r+r))return;
      occupied.push({x,z,r});boxCollider(building(batch,{x,z,width:w,depth:d,height:h,yaw,seed,style,name},terrainHeight(x,z),this.quality!=='low'));
    };
    // Authored street frontage: individual volumes, continuous pedestrian frontage and readable ground floors.
    for(let z=Math.floor(oz/34)*34;z<oz+256;z+=34){
      if(z< -1430||z>250)continue;
      const s=hash(1960,z),random=rng(s);addBuilding(1960,z,28,31,12+Math.floor(random()*5)*3.25,Math.PI/2,s,'deco',names[Math.abs(Math.floor(z/34))%names.length]);
      for(const x of [1799,1660])addBuilding(x,z,26,28,10+Math.floor(random()*7)*3.25,Math.PI/2,hash(x,z),'deco');
    }
    for(const lm of this.data.landmarks){
      if(!this.inside(lm.x,lm.z,cx,cz)||!/(hotel|residential|retail|office|public)/.test(lm.tags))continue;
      if(lm.x>1450&&lm.x<2250&&lm.z>-1600&&lm.z<400)continue;
      const s=hash(Math.floor(lm.x),Math.floor(lm.z)),random=rng(s),r=nearestRoad(lm.x,lm.z);
      const town=districtAt(lm.x,lm.z),h=town==='Vice City'?20+random()*75:8+random()*30;
      addBuilding(lm.x,lm.z,18+random()*10,18+random()*12,h,r?r.segment.yaw+Math.PI/2:0,s,h>35?'tower':'deco');
    }
    // Inferred infill has its own deterministic seed; it never moves the sourced landmark pins.
    for(let x=Math.floor(ox/74)*74+37;x<ox+256;x+=74)for(let z=Math.floor(oz/74)*74+37;z<oz+256;z+=74){
      const town=districtAt(x,z),s=hash(x,z,52),random=rng(s);
      if(!cities.includes(town)||x>1450&&x<2350||!isLand(x,z)||random()>.77)continue;
      const road=nearestRoad(x,z);if(!road||road.distance>330)continue;
      const tower=town==='Vice City'&&x>-1700&&z>-2100&&z<400;
      addBuilding(x,z,22+random()*15,23+random()*15,tower?25+random()*88:7+random()*15,Math.PI/2,s,tower?'tower':town==='Port Gellhorn'?'warehouse':'house');
    }
    // Boardwalk, landscaping, lifeguard huts and umbrellas create a proper shoreline rather than empty sand.
    if(ox<2070&&ox+256>2010&&oz<320&&oz+256>-1450){
      const z=Math.max(oz,-1450),length=Math.min(oz+256,320)-z;
      if(length>0){batch.box('sidewalk',2025,2.56,z+length/2,24,.28,length);batch.box('asphalt',2037,2.57,z+length/2,3,.04,length,0xaaa58c);}
    }
    for(let z=Math.floor(oz/24)*24;z<oz+256;z+=24){
      if(z>-1450&&z<330)for(const x of [2012,2046])if(this.inside(x,z,cx,cz)){
        palm(batch,x,z,2.4,hash(x,z));
        if(z%72===0)bench(batch,x+4,z,2.4);
      }
    }
    for(let x=Math.floor(ox/38)*38+19;x<ox+256;x+=38)for(let z=Math.floor(oz/38)*38+19;z<oz+256;z+=38){
      const s=hash(x,z,93),random=rng(s),r=nearestRoad(x,z);
      if(!isLand(x,z)||r&&r.distance<r.segment.width/2+8||occupied.some(o=>Math.hypot(o.x-x,o.z-z)<o.r+5))continue;
      if(x>2060&&x<2200&&z>-1450&&z<330){
        if(random()>.45)continue;
        batch.add('round','metal',x,3.5,z,.035,2.2,.035);
        batch.add('sphere','paint',x,4.6,z,1.7,.24,1.7,random()>.5?0x73b8ba:0xe1ae73);
        batch.box('white',x+2.6,2.7,z,1,.1,2.1);batch.box('white',x+2.6,2.98,z-.78,1,.55,.08);
      }else if(random()<(cities.includes(districtAt(x,z))?.22:.68))palm(batch,x,z,terrainHeight(x,z),s,.65+random()*.5);
    }
    for(let z=Math.floor(oz/320)*320;z<oz+256;z+=320)if(z>-1400&&z<320&&this.inside(2114,z,cx,cz)){
      for(const dx of [-1.7,1.7])for(const dz of [-1.4,1.4])batch.box('trunk',2114+dx,3.9,z+dz,.16,3,.16);
      batch.box('white',2114,5.25,z,4.4,.2,3.7);batch.box('stucco',2114,6.05,z,3.4,1.4,2.4,0xd9bc83);
      batch.box('glass',2114,6.25,z+1.22,2.8,.65,.04);batch.box('paint',2114,6.9,z,4.7,.2,4.1,0x75aaa4);
      for(let i=0;i<7;i++)batch.box('white',2114,2.65+i*.37,z+4-i*.32,1.25,.12,.38);
    }
    batch.finish();this.scene.add(ground,batch.group);
    return {batch,ground,body,colliders};
  }
  ensure(x:number,z:number){
    for(const c of wantedChunks(x,z,1))if(!this.chunks.has(c.key))this.chunks.set(c.key,this.make(c.x,c.z));
    this.lastCenter='';this.update(x,z,0);
  }
  update(x:number,z:number,budget=1){
    const radius=this.quality==='low'?1:2,needed=wantedChunks(x,z,radius),center=needed[0].key+this.quality;
    if(center!==this.lastCenter){
      this.lastCenter=center;const keep=new Set(needed.map(c=>c.key));
      for(const [key,c] of this.chunks)if(!keep.has(key)){this.physics.removeRigidBody(c.body);c.batch.dispose();c.ground.removeFromParent();c.ground.geometry.dispose();this.chunks.delete(key);}
      this.pending=needed.filter(c=>!this.chunks.has(c.key));
    }
    for(let n=0;n<budget&&this.pending.length;n++){const c=this.pending.shift()!;this.chunks.set(c.key,this.make(c.x,c.z));}
  }
  get stats(){return {chunks:this.chunks.size,pending:this.pending.length,colliders:[...this.chunks.values()].reduce((s,c)=>s+c.colliders,0)};}
  dispose(){for(const c of this.chunks.values()){this.physics.removeRigidBody(c.body);c.batch.dispose();c.ground.geometry.dispose();c.ground.removeFromParent();}this.chunks.clear();this.farBatch.dispose();this.farGround.geometry.dispose();this.farGround.removeFromParent();this.groundMaterial.dispose();this.primitives.dispose();}
}
