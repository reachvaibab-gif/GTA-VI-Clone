// Bounded evidence and verified builds stay inside the existing private repository.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const token=process.env.GITHUB_TOKEN,repo=process.env.GITHUB_REPOSITORY;
if(!token||!repo||process.env.GITHUB_EVENT_NAME!=='push'||process.env.GITHUB_REF!=='refs/heads/main')process.exit(0);
const branch='build-evidence';
const api=async(route,method='GET',body)=>{
  const r=await fetch(`https://api.github.com/repos/${repo}/${route}`,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  if(!r.ok)throw new Error(`Evidence API ${route}: ${r.status}`);return r.json();
};
const tree=[];let total=0;
async function add(local,target,max=2*1024*1024){
  let bytes;try{bytes=await fs.readFile(local);}catch{return;}
  total+=bytes.length;if(bytes.length>max||total>35*1024*1024)throw new Error(`Evidence budget exceeded: ${target}`);
  const blob=await api('git/blobs','POST',{encoding:'base64',content:bytes.toString('base64')});tree.push({path:target,mode:'100644',type:'blob',sha:blob.sha});
}
for(const name of ['street','driving','aerial','night','menu','failure']){
  const source=path.join('artifacts/playtest',`${name}.jpg`);
  try{await fs.access(source);}catch{continue;}
  await sharp(source).resize({width:240}).jpeg({quality:26}).toFile(path.join('artifacts/playtest',`${name}-compact.jpg`));
}
const allowed=['reference-audit/map-preview.jpg','reference-audit/map-preview.webp','reference-audit/audit.json',
  'reference-audit/vice-city-reference.jpg','reference-audit/keys-reference.jpg','reference-audit/gellhorn-reference.jpg',
  'playtest/report.json','playtest/street.jpg','playtest/driving.jpg','playtest/aerial.jpg','playtest/night.jpg','playtest/menu.jpg','playtest/failure.jpg','playtest/preview.jpg',
  ...['street','driving','aerial','night','menu','failure'].map(name=>`playtest/${name}-compact.jpg`)];
for(const file of allowed)await add(path.join('artifacts',file),file);
await add('package-lock.json','lock/package-lock.json');
let verified=false;try{const report=JSON.parse(await fs.readFile('artifacts/playtest/report.json','utf8'));verified=!report.failure&&report.errors.length===0&&report.checks.length>=10;}catch{}
if(verified){
  const walk=async dir=>(await Promise.all((await fs.readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?walk(path.join(dir,e.name)):path.join(dir,e.name)))).flat();
  for(const file of await walk('dist')){
    const relative=path.relative('dist',file);
    if(!/\.(html|js|css|json|gltf|glb|wasm|jpg|jpeg|png|webp|txt|svg)$/.test(relative))throw new Error(`Unexpected distribution file: ${relative}`);
    await add(file,`playable/${relative}`,10*1024*1024);
  }
}
const readme=`# Build verification evidence\n\nSource commit: ${process.env.GITHUB_SHA}\nRun: ${process.env.GITHUB_RUN_ID}\n\nBrowser verification: **${verified?'passed':'not passed; read the report'}**.\n\nScreenshots and reports belong to this exact source revision. Software-rendered CI timings are not Mac hardware benchmarks. Reference thumbnails are source comparison material, not screenshots of the implemented game.\n\n${verified?'## Run the packaged build\n\nDownload this branch as a ZIP, open a terminal in its playable/ folder, then run `python3 -m http.server 8765 --bind 127.0.0.1` and visit http://127.0.0.1:8765. All runtime assets are packaged. Serve over HTTP rather than opening index.html as a local file.\n\n':''}This branch is private build evidence, not a public deployment or a GTA VI completion claim.\n`;
const blob=await api('git/blobs','POST',{encoding:'utf-8',content:readme});tree.push({path:'README.md',mode:'100644',type:'blob',sha:blob.sha});
const newTree=await api('git/trees','POST',{tree});let parent;try{parent=(await api(`git/ref/heads/${branch}`)).object.sha;}catch{}
const commit=await api('git/commits','POST',{message:`test evidence for ${process.env.GITHUB_SHA.slice(0,7)}`,tree:newTree.sha,parents:parent?[parent]:[]});
await api(parent?`git/refs/heads/${branch}`:'git/refs',parent?'PATCH':'POST',parent?{sha:commit.sha,force:false}:{ref:`refs/heads/${branch}`,sha:commit.sha});
console.log(`Evidence saved to ${branch}, commit ${commit.sha}; verified build: ${verified}; ${(total/1024/1024).toFixed(2)} MB`);
