import * as T from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { clamp } from '../core/math.mjs';
export class Environment {
  readonly sky=new Sky();
  readonly sun=new T.DirectionalLight(0xffedcf,3.2);
  readonly hemi=new T.HemisphereLight(0xb1d0ec,0x9a8260,1.65);
  readonly water:T.Mesh<T.PlaneGeometry,T.ShaderMaterial>;
  private target=new T.Object3D();
  private environment:T.WebGLRenderTarget;
  night=0;
  constructor(readonly scene:T.Scene,renderer:T.WebGLRenderer){
    this.sky.scale.setScalar(45000);scene.add(this.sky);
    const u=this.sky.material.uniforms;u.turbidity.value=4.2;u.rayleigh.value=2.1;u.mieCoefficient.value=.006;u.mieDirectionalG.value=.84;
    this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.camera.near=1;this.sun.shadow.camera.far=620;
    Object.assign(this.sun.shadow.camera,{left:-100,right:100,top:100,bottom:-100});this.sun.shadow.normalBias=.06;this.sun.shadow.bias=-.00015;this.sun.shadow.radius=2;
    this.sun.target=this.target;scene.add(this.sun,this.target,this.hemi);
    const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();this.environment=pmrem.fromScene(room,.06);scene.environment=this.environment.texture;room.dispose();pmrem.dispose();
    scene.fog=new T.FogExp2(0xd4d9d3,.000095);
    const material=new T.ShaderMaterial({
      uniforms:{time:{value:0},sunDirection:{value:new T.Vector3(.4,.5,.1)},sunColor:{value:new T.Color(0xffe6c0)},skyColor:{value:new T.Color(0xb8cfdb)},deepColor:{value:new T.Color(0x176d77)},night:{value:0}},
      vertexShader:`varying vec3 vWorld;uniform float time;
      void main(){vec3 p=position;vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
      fragmentShader:`varying vec3 vWorld;uniform float time;uniform vec3 sunDirection;uniform vec3 sunColor;uniform vec3 skyColor;uniform vec3 deepColor;uniform float night;
      void main(){vec2 p=vWorld.xz;float a=p.x*.10+p.y*.14+time*.7;float b=p.x*.24-p.y*.19+time*1.1;
      vec3 n=normalize(vec3(cos(a)*.10+cos(b)*.035,1.,sin(a)*.08-sin(b)*.06));vec3 v=normalize(cameraPosition-vWorld);
      float fres=pow(1.-max(dot(n,v),0.),3.);vec3 c=mix(deepColor,skyColor,fres*.78);vec3 h=normalize(v+sunDirection);
      float spec=pow(max(dot(n,h),0.),160.)*2.2;float ripple=sin(p.x*.45+p.y*.32+time)*sin(p.x*.32-p.y*.4-time*.8)*.018;
      c+=sunColor*spec*(1.-night)+ripple;float fog=1.-exp(-length(cameraPosition-vWorld)*.00011);c=mix(c,skyColor,fog);
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`
    });
    this.water=new T.Mesh(new T.PlaneGeometry(70000,70000),material);this.water.rotation.x=-Math.PI/2;this.water.position.y=.08;scene.add(this.water);
  }
  update(hour:number,time:number,focus:T.Vector3){
    const angle=(hour-6)/24*Math.PI*2,altitude=Math.sin(angle),azimuth=(hour/24)*Math.PI*2;
    const dir=new T.Vector3(Math.cos(azimuth)*.65,Math.max(.04,altitude),Math.sin(azimuth)*.65).normalize();
    this.night=clamp((.13-altitude)*4,0,1);
    this.sky.material.uniforms.sunPosition.value.copy(dir);this.sky.material.uniforms.turbidity.value=4.2+this.night*2;
    this.sun.intensity=(1-this.night)*3.0+.12;this.sun.color.setHSL(.095,.18+(1-altitude)*.25,.88);
    this.hemi.intensity=1.45-this.night*1.05;
    this.hemi.color.set(this.night>.7?0x6981b7:0xbad5e7);
    this.sun.position.copy(focus).addScaledVector(dir,250);this.target.position.copy(focus);this.target.updateMatrixWorld();
    const fog=this.scene.fog as T.FogExp2;fog.color.set(0xc7d0d4).lerp(new T.Color(0x152336),this.night);fog.density=.00010+this.night*.000065;
    this.sky.visible=this.night<.85;this.scene.background=this.night>=.85?new T.Color(0x0e1b31):null;
    const u=this.water.material.uniforms;u.time.value=time;u.night.value=this.night;u.sunDirection.value.copy(dir);u.skyColor.value.copy(fog.color);u.deepColor.value.set(0x176d77).lerp(new T.Color(0x081d2d),this.night);
  }
  dispose(){this.water.geometry.dispose();this.water.material.dispose();this.sky.geometry.dispose();this.sky.material.dispose();this.environment.dispose();this.sun.shadow.map?.dispose();}
}
