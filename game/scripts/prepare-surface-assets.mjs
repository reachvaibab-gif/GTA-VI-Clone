import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {selectTexture} from './asset-utils.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const assets=path.join(root,'public/assets'),generated=path.join(root,'public/generated');
const available=JSON.parse(await fs.readFile(path.join(generated,'assets.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(generated,'asset-manifest.json'),'utf8'));
const ids=['white_stucco','palm_tree_bark','aerial_sand'];
for(const id of ids){
  try{
    const response=await fetch(`https://api.polyhaven.com/files/${id}`,{signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error(`Metadata HTTP ${response.status}`);
    const spec=await response.json(),maps={};
    for(const channel of ['color','normal','roughness']){
      const entry=selectTexture(spec,channel);if(!entry)continue;
      const file=`${id}-${channel}.${entry.format}`,destination=path.join(assets,file);
      let bytes;try{bytes=await fs.readFile(destination);}catch{}
      if(!bytes){
        const res=await fetch(entry.url,{signal:AbortSignal.timeout(30000)});
        if(!res.ok)throw new Error(`${channel} HTTP ${res.status}`);
        if(Number(res.headers.get('content-length'))>12*1024*1024)throw new Error('Texture exceeds download budget');
        bytes=Buffer.from(await res.arrayBuffer());
        if(bytes.length>12*1024*1024)throw new Error('Texture exceeds decode budget');
        const metadata=await sharp(bytes,{limitInputPixels:4096*4096}).metadata();
        if(!metadata.width||!metadata.height||metadata.width>2048||metadata.height>2048)throw new Error('Unexpected runtime texture dimensions');
        await fs.writeFile(destination,bytes);
      }
      maps[channel]=`assets/${file}`;
      const item={id:`${id}-${channel}`,source:entry.url,license:'CC0-1.0',author:'Poly Haven contributors',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),modifications:'1K runtime PBR texture; material-scale mapping in world metres.'};
      const previous=manifest.findIndex(row=>row.id===item.id);if(previous>=0)manifest[previous]=item;else manifest.push(item);
    }
    available.textures[id]=maps;console.log(`Prepared ${id}: ${Object.keys(maps).join(', ')}`);
  }catch(error){console.warn(`Optional surface ${id}: ${error.message}. Procedural material retained.`);}
}
await fs.writeFile(path.join(generated,'assets.json'),JSON.stringify(available));
await fs.writeFile(path.join(generated,'asset-manifest.json'),JSON.stringify(manifest,null,2));
// Compact review copies stay in private test evidence, never the playable asset bundle.
const output=path.join(root,'artifacts/reference-audit');await fs.mkdir(output,{recursive:true});
for(const [file,source]of [
 ['vice-city-reference.jpg','Vice_City/Vice_City_01.jpg'],
 ['keys-reference.jpg','Leonida_Keys/Leonida_Keys_01.jpg'],
 ['gellhorn-reference.jpg','Port_Gellhorn/Port_Gellhorn_01.jpg']
])await sharp(path.join(root,'../references/official_rockstar/places',source)).resize({width:240}).jpeg({quality:24}).toFile(path.join(output,file));
