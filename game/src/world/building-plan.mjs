// Original, deterministic architectural kit. These are not claimed to be exact landmark meshes.
const palette=[0xead5c1,0xd3ded3,0xf0c6b9,0xc7d8db,0xe5dfcb,0xe7d2aa,0xd3c6b7,0xc6d9d1];
function random(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
export function planBuilding(options,detail=true){
  const {width:w,depth:d,height:h,style,seed=1}=options;
  if(![w,d,h].every(n=>Number.isFinite(n)&&n>1))throw new RangeError('Building dimensions must be finite metres greater than one.');
  const r=random(seed),variant=Math.floor(r()*4),color=palette[Math.floor(r()*palette.length)],parts=[];
  const add=(material,x,y,z,sx,sy,sz,tint=0xffffff,shape='box',ry=0)=>{
    if(Math.min(sx,sy,sz)<=0)return;
    parts.push({material,position:[x,y,z],size:[sx,sy,sz],color:tint,shape,ry});
  };
  const cap=(width,depth,y,x=0,z=0)=>{
    add('roof',x,y+.1,z,width+.2,.2,depth+.2);
    for(const side of [-1,1]){
      add('trim',x,y+.46,z+side*depth/2,width+.4,.74,.2);
      add('trim',x+side*width/2,y+.46,z,.2,.74,depth);
    }
  };
  const window=(x,y,z,width,height,side=0)=>{
    const glass=r()>.79?'windowLight':'glass';
    if(side===0){
      add('dark',x,y,z,width+.2,height+.2,.16);
      add(glass,x,y,z+(z<0?-.1:.1),width,height,.08);
      if(detail){add('trim',x,y-height/2-.12,z+(z<0?-.13:.13),width+.35,.12,.32);add('metal',x,y,z+(z<0?-.16:.16),.045,height,.045);}
    }else{
      add('dark',x,y,z,.16,height+.2,width+.2);add(glass,x+side*.1,y,z,.08,height,width);
      if(detail)add('trim',x+side*.12,y-height/2-.12,z,.32,.12,width+.3);
    }
  };
  if(style==='house'){
    const roofHeight=Math.min(4,w*.16),eave=h-roofHeight;
    add('stucco',0,eave/2,0,w,eave,d,color);
    add('roofTile',0,eave+roofHeight/2,0,w+1,roofHeight,d+1,0xffffff,'gable');
    add('trim',0,eave+.04,d/2+.45,w+1.1,.16,.14);
    const floors=Math.max(1,Math.floor(eave/3.2));
    for(let floor=0;floor<floors;floor++)for(let x=-w/2+2.2;x<w/2-1;x+=4){
      const y=1.9+floor*3.2;if(y+1>eave)continue;
      window(x,y,d/2+.07,1.5,1.7);
      for(const side of [-1,1])add('paint',x+side*1.02,y,d/2+.14,.38,1.8,.12,variant%2?0x697f75:0x688791);
      window(x,y,-d/2-.07,1.5,1.7);
    }
    add('dark',0,1.35,d/2+.15,1.15,2.7,.12);
    add('stone',0,.17,d/2+.9,w*.44,.34,2.2);
    add('roofTile',0,3.05,d/2+.9,w*.47,.18,2.5);
    for(const side of [-1,1])add('trim',side*w*.2,1.65,d/2+1.8,.2,2.9,.2);
    add('stucco',-w*.3,h-roofHeight*.6+.55,-d*.23,1,2.1,1,color);
  }else if(style==='warehouse'){
    const roofHeight=Math.min(2.5,w*.09),eave=h-roofHeight;
    add('stone',0,.8,0,w,1.6,d,0x969c98);
    add('roof',0,.8+(eave-.8)/2,0,w,eave-.8,d,0x9ca9a5);
    add('metal',0,eave+roofHeight/2,0,w+.6,roofHeight,d+.6,0x7c8987,'gable');
    for(let x=-w/2+3;x<w/2-1;x+=6){
      add('dark',x,2.45,d/2+.12,4.35,4.9,.2);
      add('metal',x,2.25,d/2+.24,4.05,4.5,.08,0x748582);
      if(detail)for(let y=.4;y<4.5;y+=.45)add('dark',x,y,d/2+.3,4.05,.035,.045);
      for(const side of [-1,1]){add('paint',x+side*2.4,.6,d/2+.65,.12,1.2,.12,0xd1a253,'round');}
    }
    if(detail)for(let x=-w/2;x<w/2;x+=1.2)add('metal',x,eave/2,d/2+.035,.045,eave,.08,0xa3aca6);
    for(let z=-d/2+3;z<d/2-2;z+=5)for(const side of [-1,1])window(side*(w/2+.07),eave-1.5,z,2.9,1.1,side);
  }else{
    const podium=style==='tower'?Math.min(6,h*.2):Math.min(h,4.25);
    const setback=style==='tower'?0.8:variant===0?0.87:1;
    const upperW=w*setback,upperD=d*(style==='tower'?.84:1);
    add('stucco',0,podium/2,0,w,podium,d,color);
    add('stucco',0,podium+(h-podium)/2,0,upperW,h-podium,upperD,color);
    if(setback<1)cap(w,d,podium);
    const floors=Math.max(1,Math.floor((h-podium)/3.25));
    const stride=detail?1:Math.max(1,Math.ceil(floors/9));
    for(let f=0;f<floors;f+=stride){
      const y=podium+1.55+f*3.25;if(y+1>h)continue;
      for(let x=-upperW/2+2;x<upperW/2-1;x+=3.8){window(x,y,upperD/2+.07,1.65,1.85);window(x,y,-upperD/2-.07,1.65,1.85);}
      for(let z=-upperD/2+2;z<upperD/2-1;z+=4.4)for(const side of [-1,1])window(side*(upperW/2+.07),y,z,1.65,1.85,side);
      if(style==='tower'&&detail&&f%2===0){
        for(const side of [-1,1]){
          add('trim',0,y-1.23,side*(upperD/2+.45),upperW+.4,.2,1.15);
          add('glass',0,y-.65,side*(upperD/2+1),upperW-.3,.88,.055,0xadc4be);
          add('metal',0,y-.2,side*(upperD/2+1),upperW-.3,.045,.045);
        }
      }else if(style==='deco')add('trim',0,y-1.2,upperD/2+.2,upperW+.5,.17,.6);
    }
    // Separate shop bays, a central doorway, awnings and planted entrance pockets.
    for(let x=-w/2+2;x<w/2-1;x+=4){
      add('dark',x,1.65,d/2+.1,3.65,3.3,.16);
      add('glass',x,1.65,d/2+.2,3.25,2.8,.07);
      add('trim',x-1.8,1.8,d/2+.27,.16,3.6,.3);
      if(detail){
        const tint=variant%2?0x68867e:0xbc8267;
        add('paint',x,3.18,d/2+.82,3.5,.17,1.6,tint);
        add('paint',x,3.03,d/2+1.6,3.5,.4,.08,tint);
      }
    }
    add('trim',0,podium-.2,d/2+.38,w+.6,.22,.8);
    cap(upperW,upperD,h);
    if(style==='deco'){
      if(variant===0){add('stucco',0,h+.8,-d*.1,w*.6,1.6,d*.58,color);cap(w*.6,d*.58,h+1.6,0,-d*.1);}
      else if(variant===1){
        add('stucco',w*.25,h*.56,d/2+.24,2.1,h*.95,.75,color);
        for(const side of [-1,1])add('neon',w*.25+side*.78,h*.57,d/2+.67,.075,h*.82,.075,0xffbd83);
      }else if(variant===2){
        for(let i=0;i<3;i++)add('trim',0,h-.5-i*.5,d/2+.28,w+.7-i*.22,.14,.48);
        add('stucco',-w*.25,h+.9,0,w*.23,1.8,d*.6,color);
      }else{
        for(const side of [-1,1])add('stucco',side*(w/2-1.5),h/2,d/2-.85,1.7,h,1.7,color,'round');
        add('neon',0,3.67,d/2+.6,w-.6,.07,.1,0x8fdacb);
      }
    }else{
      add('roof',0,h+1.2,0,w*.44,2.4,d*.44,0x8b9b98);
      for(const side of [-1,1])add('trim',side*upperW*.42,h*.6,upperD/2+.2,.18,h*.76,.55);
    }
    if(detail)for(const side of [-1,1]){
      add('stone',side*(w/2-1),.46,d/2+.8,1.15,.9,1.05,0x9d9f86);
      add('leaf',side*(w/2-1),1.13,d/2+.8,.9,.6,.82,0x81966c,'round');
    }
  }
  // Roof service equipment and rear drainage keep elevated/back views authored too.
  if(style!=='house'){
    for(let i=0;i<Math.min(3,Math.floor(w/9));i++){
      const x=-w*.28+i*4.2,roofY=style==='warehouse'?h-Math.abs(x)/(w/2)*Math.min(2.5,w*.09):h;add('metal',x,roofY+.4,-d*.22,2.5,1.1,1.6,0x8c9895);
      if(detail){for(let k=0;k<5;k++)add('dark',x,roofY+.1+k*.14,-d*.22+.82,2.08,.055,.025);add('dark',x,roofY+.97,-d*.22,.65,.04,.65,0x303a39,'round');}
    }
  }
  const drainH=style==='house'?h-Math.min(4,w*.16):style==='warehouse'?h-Math.min(2.5,w*.09):h;
  if(detail)for(const side of [-1,1])add('metal',side*(w/2-.38),drainH/2,-d/2-.16,.09,drainH,.09,0x929990,'round');
  return {parts,variant,color,width:w,depth:d,height:h};
}
