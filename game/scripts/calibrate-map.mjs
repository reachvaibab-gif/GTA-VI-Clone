import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const refs=path.resolve(root,'../references');
// Registration uses drawn landmark marks, not OCR, text interpretation or guessed geographic labels.
// The repository documents the zoom-3 scale exactly; only the integer source tile origin is missing.
const source='maps/leonida_yanis-16_z3.jpg',annotated='maps/leonida_landmarks_annotated_z3.jpg';
const [base,overlay,records]=await Promise.all([
  sharp(path.join(refs,source)).removeAlpha().raw().toBuffer({resolveWithObject:true}),
  sharp(path.join(refs,annotated)).removeAlpha().raw().toBuffer({resolveWithObject:true}),
  fs.readFile(path.join(refs,'landmarks/landmarks_gta6.json'),'utf8').then(JSON.parse)
]);
const cells=new Set();
const points=records.filter(p=>{
  if(!Number.isFinite(p.game_x)||!Number.isFinite(p.game_y))return false;
  const key=`${Math.round(p.game_x/60)},${Math.round(p.game_y/60)}`;
  if(cells.has(key))return false;cells.add(key);return true;
});
const width=Math.min(base.info.width,overlay.info.width),height=Math.min(base.info.height,overlay.info.height);
const diff=new Uint8Array(width*height);
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*base.info.width+x)*base.info.channels,j=(y*overlay.info.width+x)*overlay.info.channels;
  diff[y*width+x]=Math.min(255,(Math.abs(base.data[i]-overlay.data[j])+Math.abs(base.data[i+1]-overlay.data[j+1])+Math.abs(base.data[i+2]-overlay.data[j+2]))/3);
}
function sample(x,y){
  let maximum=0;
  for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
    const xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<width&&yy<height)maximum=Math.max(maximum,diff[yy*width+xx]);
  }
  return maximum;
}
const candidates=[];
for(let originTileX=0;originTileX<=12;originTileX++)for(let originTileY=0;originTileY<=12;originTileY++){
  let total=0,hits=0,inside=0;const scores=[];
  for(const p of points){
    const x=Math.round((p.game_x+16384)*.25-originTileX*256),y=Math.round((16384-p.game_y)*.25-originTileY*256);
    if(x<0||x>=width||y<0||y>=height){scores.push(0);continue;}
    inside++;const value=sample(x,y);total+=value;hits+=Number(value>45);scores.push(value);
  }
  scores.sort((a,b)=>a-b);
  candidates.push({originTileX,originTileY,meanDifference:total/points.length,medianDifference:scores[Math.floor(scores.length/2)],annotationHitRate:hits/points.length,insideRate:inside/points.length});
}
candidates.sort((a,b)=>b.meanDifference-a.meanDifference);
const best=candidates[0],ratio=best.meanDifference/Math.max(1,candidates[1].meanDifference);
const validated=best.annotationHitRate>.55&&best.insideRate>.95&&ratio>1.35;
const report={
  status:validated?'validated-against-annotation-marks':'unresolved',source,annotated,zoom:3,metresPerPixel:4,
  method:'Known source scale plus integer-tile registration against independently drawn landmark annotations. No terrain height is inferred from this image.',
  sampleCount:points.length,bestToRunnerUpRatio:ratio,candidates:candidates.slice(0,8),
  transform:validated?{originTileX:best.originTileX,originTileY:best.originTileY,scale:.25,offsetX:4096-best.originTileX*256,offsetZ:4096-best.originTileY*256}:null,
  examples:points.slice(0,12).map(p=>({id:p.id,x:p.game_x,z:-p.game_y,pixelX:(p.game_x+16384)*.25-best.originTileX*256,pixelY:(16384-p.game_y)*.25-best.originTileY*256}))
};
await fs.writeFile(path.join(root,'public/generated/map-calibration.json'),JSON.stringify(report,null,2));
const auditPath=path.join(root,'artifacts/reference-audit/audit.json');let audit={};try{audit=JSON.parse(await fs.readFile(auditPath,'utf8'));}catch{}
audit.mapCalibration=report;await fs.mkdir(path.dirname(auditPath),{recursive:true});await fs.writeFile(auditPath,JSON.stringify(audit,null,2));
console.log('MAP REGISTRATION:',JSON.stringify(report,null,2));
