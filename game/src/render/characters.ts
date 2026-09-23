import * as T from 'three';
import { GLTFLoader,type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { Materials } from './materials';
import type { AssetData } from '../types';
export class CharacterLibrary {
  readonly templates:GLTF[]=[];
  constructor(readonly materials:Materials){}
  async load(data:AssetData){
    const loader=new GLTFLoader();
    for(const id of data.characters){try{this.templates.push(await loader.loadAsync(`${import.meta.env.BASE_URL}assets/${id}.gltf`));}catch(error){console.warn('Character fallback:',id,error);}}
  }
  make(index=0){return new CharacterView(this.templates[index%Math.max(1,this.templates.length)],this.materials,index);}
}
export class CharacterView {
  readonly root=new T.Group();
  private model:T.Object3D;private mixer?:T.AnimationMixer;
  private actions=new Map<string,T.AnimationAction>();private action?:T.AnimationAction;
  private limbs:T.Group[]=[];private phase=0;private disposed=false;
  private ownedGeometry:T.BufferGeometry[]=[];private ownedMaterials:T.Material[]=[];
  constructor(template:GLTF|undefined,materials:Materials,variant:number){
    if(template){
      this.model=clone(template.scene);this.root.add(this.model);
      const box=new T.Box3().setFromObject(this.model),size=box.getSize(new T.Vector3()),scale=1.78/Math.max(.1,size.y);
      this.model.scale.setScalar(scale);this.model.position.y=-box.min.y*scale;
      this.model.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});
      this.mixer=new T.AnimationMixer(this.model);
      const pick=(names:string[])=>names.map(name=>template.animations.find(c=>c.name.toLowerCase()===name)).find(Boolean);
      for(const [state,names]of [['idle',['idle_neutral','idle']],['walk',['walk','walking']],['run',['run','running']],['jump',['jump']]] as [string,string[]][]){
        const clip=pick(names);if(clip)this.actions.set(state,this.mixer.clipAction(clip));
      }
      if(!this.actions.size&&template.animations[0])this.actions.set('idle',this.mixer.clipAction(template.animations[0]));
    }else{
      this.model=new T.Group();this.root.add(this.model);
      const shirt=materials.values.paint.clone();this.ownedMaterials.push(shirt);shirt.color.set([0xa6b9b3,0xb88269,0x42777b,0xd2b9a0][variant%4]);shirt.metalness=0;shirt.roughness=1;
      const mesh=(geo:T.BufferGeometry,mat:T.Material,x:number,y:number,z:number,parent:T.Object3D=this.model)=>{this.ownedGeometry.push(geo);const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;};
      mesh(new T.CapsuleGeometry(.24,.37,6,12),shirt,0,1.12,0);
      mesh(new T.SphereGeometry(.16,16,12),materials.values.skin,0,1.62,0);
      mesh(new T.SphereGeometry(.164,12,8,0,Math.PI*2,0,Math.PI*.52),materials.values.dark,0,1.68,0);
      for(const side of [-1,1]){
        const leg=new T.Group();leg.position.set(side*.13,.8,0);this.model.add(leg);this.limbs.push(leg);
        mesh(new T.CapsuleGeometry(.095,.49,5,10),materials.values.dark,0,-.33,0,leg);mesh(new T.BoxGeometry(.17,.12,.3),materials.values.rubber,0,-.71,.05,leg);
        const arm=new T.Group();arm.position.set(side*.29,1.35,0);this.model.add(arm);this.limbs.push(arm);mesh(new T.CapsuleGeometry(.065,.44,5,10),materials.values.skin,0,-.28,0,arm);
      }
    }
  }
  update(dt:number,speed:number,grounded=true){
    this.phase+=dt*Math.max(1,speed)*2;
    const state=!grounded?'jump':speed>3.3?'run':speed>.25?'walk':'idle';
    const next=this.actions.get(state)??this.actions.get('idle');
    if(next&&next!==this.action){this.action?.fadeOut(.18);next.reset().fadeIn(.18).play();this.action=next;}
    if(this.action)this.action.timeScale=state==='run'?Math.min(1.35,speed/5.4):state==='walk'?Math.max(.6,speed/1.5):1;
    this.mixer?.update(dt);
    this.limbs.forEach((limb,i)=>{limb.rotation.x=Math.sin(this.phase+(i<2?0:Math.PI)+(i%2?Math.PI:0))*Math.min(.7,speed*.14);});
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.mixer?.stopAllAction();if(this.mixer)this.mixer.uncacheRoot(this.model);
    // Imported mesh geometry/materials belong to the library, but cloned skeleton GPU textures do not.
    const skeletons=new Set<T.Skeleton>();this.model.traverse(o=>{if(o instanceof T.SkinnedMesh)skeletons.add(o.skeleton);});for(const skeleton of skeletons)skeleton.dispose();
    for(const geometry of this.ownedGeometry)geometry.dispose();for(const material of this.ownedMaterials)material.dispose();this.root.removeFromParent();this.root.clear();
  }
}
