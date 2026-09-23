import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import assert from 'node:assert/strict';
const output='artifacts/playtest';await fs.mkdir(output,{recursive:true});
// Launch Vite directly: killing an npm wrapper can leave a grandchild holding the output pipes open.
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4173'],{stdio:['ignore','pipe','pipe'],env:process.env});
let serverLog='';server.stdout.on('data',d=>serverLog+=d);server.stderr.on('data',d=>serverLog+=d);
const errors=[],warnings=[],checks=[];let browser,page;
const report={phase:'server',checks,errors,warnings,snapshots:[],startedAt:new Date().toISOString()};
const write=()=>fs.writeFile(`${output}/report.json`,JSON.stringify({...report,serverLog},null,2));
const timeout=(p,ms,label)=>Promise.race([p,new Promise((_,reject)=>{const t=setTimeout(()=>reject(new Error(`${label} exceeded ${ms}ms`)),ms);t.unref();})]);
function stopServer(){server.kill('SIGTERM');server.stdout.destroy();server.stderr.destroy();server.unref();}
async function phase(name){report.phase=name;console.log(`PLAYTEST: ${name}`);await write();}
const state=()=>timeout(page.evaluate(()=>window.__game.snapshot()),15000,'state read');
const step=n=>timeout(page.evaluate(n=>window.__game.step(n),n),45000,'simulation step');
const key=async code=>{await page.keyboard.press(code);await page.waitForTimeout(120);};
const shot=async name=>{await page.screenshot({path:`${output}/${name}.jpg`,type:'jpeg',quality:84,timeout:20000});await sharp(`${output}/${name}.jpg`).resize({width:360}).jpeg({quality:32}).toFile(`${output}/preview.jpg`);};
const watchdog=setTimeout(async()=>{report.failure=report.failure??`Global browser deadline at phase ${report.phase}`;await write();console.error(report.failure);stopServer();process.exit(1);},330000);watchdog.unref();
try{
  for(let n=0;n<100;n++){try{if((await fetch('http://127.0.0.1:4173/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  await phase('launch browser');browser=await chromium.launch({headless:true,timeout:45000,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
  report.browser=browser.version();const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});page=await context.newPage();page.setDefaultTimeout(20000);
  page.on('pageerror',e=>{errors.push(e.message);write().catch(()=>{});});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());write().catch(()=>{});}if(m.type()==='warning')warnings.push(m.text());});
  page.on('requestfailed',r=>errors.push(`${r.method()} ${r.url()}: ${r.failure()?.errorText}`));
  await phase('load production game');await page.goto('http://127.0.0.1:4173/?test=1&quality=low',{waitUntil:'networkidle',timeout:60000});
  await page.waitForFunction(()=>window.__game?.snapshot().ready||document.querySelector('.fatal pre'),undefined,{timeout:90000});
  if(await page.locator('.fatal pre').count())throw new Error(await page.locator('.fatal pre').innerText());
  let s=await state();assert.ok(s.assets.landmarks>2000);assert.ok(s.render.triangles>10000);checks.push('Real renderer, reference data and physics initialized');report.snapshots.push(s);
  await shot('menu');await phase('enter nearby car');
  await page.click('#start');await page.waitForTimeout(800);assert.equal((await state()).paused,false);
  await key('KeyE');await page.waitForFunction(()=>window.__game.snapshot().actor.driving);checks.push('Enter nearby vehicle through keyboard input');
  const before=(await state()).actor;await phase('drive');
  await page.keyboard.down('KeyW');await step(180);await page.keyboard.up('KeyW');
  s=await state();assert.ok(Math.hypot(s.actor.x-before.x,s.actor.z-before.z)>5,'Vehicle must physically move');assert.ok(s.actor.z<before.z,'Forward must move north at initial heading');checks.push('Throttle moves the dynamic vehicle in the correct direction');
  await shot('driving');report.snapshots.push(s);await phase('brake and exit');
  await page.keyboard.down('KeyS');await step(75);await page.keyboard.up('KeyS');await page.evaluate(()=>window.__game.recover());await step(30);
  await key('KeyE');await page.waitForFunction(()=>!window.__game.snapshot().actor.driving);checks.push('Safe vehicle exit');
  const foot=(await state()).actor;await page.keyboard.down('KeyW');await step(60);await page.keyboard.up('KeyW');s=await state();assert.ok(Math.hypot(s.actor.x-foot.x,s.actor.z-foot.z)>.5);checks.push('Collision-aware character walking');await shot('street');
  await phase('mission and map');await key('KeyJ');await page.locator('#jobs').waitFor({state:'visible'});await page.click('[data-job="first-light"]');s=await state();assert.equal(s.progress.mission.id,'first-light');checks.push('Mission selection starts a real timed job');
  await key('KeyM');await page.locator('#map').waitFor({state:'visible'});const paused=(await state()).actor;await page.keyboard.down('KeyW');await step(90);await page.keyboard.up('KeyW');s=await state();assert.equal(s.actor.x,paused.x);assert.equal(s.actor.z,paused.z);checks.push('Map pauses simulation and clears gameplay input');
  await phase('world streaming');await page.selectOption('#travel','-5380,7330');await page.waitForFunction(()=>window.__game.snapshot().actor.z>7000);
  s=await state();assert.ok(s.world.chunks<=25);assert.equal(s.progress.mission,null);checks.push('Long-distance travel replaces chunks and cancels active jobs');report.snapshots.push(s);
  await key('KeyM');await page.selectOption('#travel','2000,-420');await page.waitForFunction(()=>window.__game.snapshot().actor.x>1900);
  await phase('visual capture');await key('Escape');await page.click('#pause [data-panel="settings"]');await page.selectOption('#quality','balanced');await page.click('#settings [data-close]');
  await page.waitForFunction(()=>window.__game.snapshot().world.pending===0,undefined,{timeout:45000});
  await page.evaluate(()=>window.__game.view(2120,48,-265,1930,10,-650));await page.waitForTimeout(1500);await shot('aerial');
  await page.evaluate(()=>{window.__game.setTime(21);window.__game.view(2017,8,-315,1952,11,-530);});await page.waitForTimeout(1500);await shot('night');checks.push('Photo camera and night lighting render at balanced quality');
  await page.evaluate(()=>window.__game.save());assert.ok(await page.evaluate(()=>localStorage.getItem('leonida.after-hours.v1')));checks.push('Versioned progress persists to local storage');
  report.final=await state();assert.deepEqual(errors,[],'No browser runtime, asset or shader errors');await phase('passed');
}catch(error){report.failure=error.stack;process.exitCode=1;console.error(error);await write();if(page){await shot('failure').catch(()=>{});try{report.failureSnapshot=await state();}catch{}}}
finally{
  await timeout(browser?.close()??Promise.resolve(),8000,'browser shutdown').catch(()=>{});stopServer();report.finishedAt=new Date().toISOString();await write();clearTimeout(watchdog);
  console.log(JSON.stringify(report,null,2));
}
