import * as T from 'three';
import { rng } from '../core/math.mjs';
import type { AssetData } from '../types';

function texture(base:string, grain:number, seed:number, tileLines=0):T.CanvasTexture {
  const c=document.createElement('canvas');c.width=c.height=256;
  const ctx=c.getContext('2d')!;ctx.fillStyle=base;ctx.fillRect(0,0,256,256);
  const pixels=ctx.getImageData(0,0,256,256),random=rng(seed);
  for(let i=0;i<pixels.data.length;i+=4){const n=(random()-.5)*grain;for(let k=0;k<3;k++)pixels.data[i+k]+=n;}
  ctx.putImageData(pixels,0,0);
  if(tileLines){ctx.strokeStyle='rgba(35,37,34,.18)';ctx.lineWidth=1;for(let n=0;n<256;n+=tileLines){ctx.beginPath();ctx.moveTo(n,0);ctx.lineTo(n,256);ctx.moveTo(0,n);ctx.lineTo(256,n);ctx.stroke();}}
  const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;
}
export class Materials {
  readonly values:Record<string,T.MeshStandardMaterial>={};
  private textures:T.Texture[]=[];
  private signs=new Map<string,T.MeshBasicMaterial>();
  constructor(){
    const add=(id:string,color:T.ColorRepresentation,roughness=.8,metalness=0,map?:T.Texture)=>{
      this.values[id]=new T.MeshStandardMaterial({color,roughness,metalness,map});if(map)this.textures.push(map);
    };
    add('stucco',0xffffff,.93,0,texture('#e0dace',18,8));
    add('stone',0xffffff,.95,0,texture('#b9b5a7',28,9,64));
    add('asphalt',0xffffff,.94,0,texture('#555759',30,5));
    add('sidewalk',0xffffff,.88,0,texture('#c3c0b5',20,4,64));
    add('sand',0xffffff,1,0,texture('#dbc7a2',23,14));
    add('grass',0xffffff,1,0,texture('#70834d',24,6));
    add('roof',0xffffff,.92,0,texture('#8a8b80',40,19,64));
    add('trim',0xeae4d7,.72);add('dark',0x232c30,.72);add('white',0xf3eee0,.65);
    add('metal',0x9ca5a6,.37,.78);add('rubber',0x16191b,.95);add('trunk',0x847660,.9);
    add('glass',0x45636f,.17,.68);this.values.glass.envMapIntensity=1.3;
    add('paint',0xffffff,.29,.42);this.values.paint.envMapIntensity=1.6;
    add('leaf',0x577e37,.88);this.values.leaf.side=T.DoubleSide;
    add('stripe',0xe6dcc0,.8);add('red',0x8d322c,.6);add('skin',0xbf8c67,.9);
    add('neon',0xffffff,.4);this.values.neon.emissive.set(0xffffff);this.values.neon.emissiveIntensity=1.8;
    add('windowLight',0xcca774,.5);this.values.windowLight.emissive.set(0xffb064);this.values.windowLight.emissiveIntensity=.18;
  }
  async load(data:AssetData){
    const loader=new T.TextureLoader();
    for(const [id,key] of [['aerial_asphalt_01','asphalt'],['concrete_floor_worn_001','sidewalk']]){
      const maps=data.textures[id];if(!maps)continue;
      for(const [channel,url] of Object.entries(maps)){
        try {const t=await loader.loadAsync(`${import.meta.env.BASE_URL}${url}`);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;if(channel==='color')t.colorSpace=T.SRGBColorSpace;
          const m=this.values[key];if(channel==='color')m.map=t;else if(channel==='normal'){m.normalMap=t;m.normalScale.set(.3,.3);}else m.roughnessMap=t;m.needsUpdate=true;this.textures.push(t);
        }catch(error){console.warn('Packaged optional texture failed',url,error);}
      }
    }
  }
  sign(text:string,color='#ffd1b3'){
    const key=text+color;if(this.signs.has(key))return this.signs.get(key)!;
    const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d')!;
    ctx.fillStyle='#183236';ctx.fillRect(0,0,512,128);ctx.strokeStyle=color;ctx.lineWidth=3;ctx.strokeRect(7,7,498,114);
    ctx.font='500 46px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text.toUpperCase(),256,68,470);
    const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;this.textures.push(t);
    const m=new T.MeshBasicMaterial({map:t,toneMapped:false});this.signs.set(key,m);return m;
  }
  setNight(amount:number){this.values.windowLight.emissiveIntensity=.15+amount*1.7;this.values.neon.emissiveIntensity=.3+amount*2.2;}
  dispose(){for(const t of this.textures)t.dispose();for(const m of Object.values(this.values))m.dispose();for(const m of this.signs.values())m.dispose();}
}
