import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import assert from 'node:assert/strict';
const output='artifacts/playtest';await fs.mkdir(output,{recursive:true});
const server=spawn('npm',['run','preview','--','--port','4173'],{stdio:'pipe',env:process.env});
let serverLog='';server.stdout.on('data',d=>serverLog+=d);server.stderr.on('data',d=>serverLog+=d);
const errors=[],warnings=[],checks=[];let browser,page;
const report={checks,errors,warnings,snapshots:[],startedAt:new Date().toISOString()};
const state=()=>page.evaluate(()=>window.__game.snapshot());
const step=n=>page.evaluate(n=>window.__game.step(n),n);
const key=async code=>{await page.keyboard.press(code);await page.waitForTimeout(100);};
const shot=async name=>{await page.screenshot({path:`${output}/${name}.jpg`,type:'jpeg',quality:86});};
try{
  for(let n=0;n<100;n++){try{if((await fetch('http://127.0.0.1:4173/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
  const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});page=await context.newPage();page.setDefaultTimeout(30000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
  page.on('requestfailed',r=>errors.push(`${r.method()} ${r.url()}: ${r.failure()?.errorText}`));
  await page.goto('http://127.0.0.1:4173/?test=1&quality=low',{waitUntil:'networkidle',timeout:120000});
  await page.waitForFunction(()=>window.__game?.snapshot().ready,undefined,{timeout:120000});
  let s=await state();assert.ok(s.assets.landmarks>2000);assert.ok(s.render.triangles>10000);checks.push('Real renderer, reference data and physics initialized');report.snapshots.push(s);
  await shot('menu');
  await page.click('#start');await page.waitForTimeout(800);assert.equal((await state()).paused,false);
  await key('KeyE');await page.waitForFunction(()=>window.__game.snapshot().actor.driving);checks.push('Enter nearby vehicle through keyboard input');
  const before=(await state()).actor;
  await page.keyboard.down('KeyW');await step(180);await page.keyboard.up('KeyW');
  s=await state();assert.ok(Math.hypot(s.actor.x-before.x,s.actor.z-before.z)>5,'Vehicle must physically move');assert.ok(s.actor.z<before.z,'Forward must move north at initial heading');checks.push('Throttle moves the dynamic vehicle in the correct direction');
  await shot('driving');report.snapshots.push(s);
  await page.keyboard.down('KeyS');await step(75);await page.keyboard.up('KeyS');await page.evaluate(()=>window.__game.recover());await step(30);
  await key('KeyE');await page.waitForFunction(()=>!window.__game.snapshot().actor.driving);checks.push('Safe vehicle exit');
  const foot=(await state()).actor;await page.keyboard.down('KeyW');await step(60);await page.keyboard.up('KeyW');s=await state();assert.ok(Math.hypot(s.actor.x-foot.x,s.actor.z-foot.z)>.5);checks.push('Collision-aware character walking');await shot('street');
  await key('KeyJ');await page.locator('#jobs').waitFor({state:'visible'});await page.click('[data-job="first-light"]');s=await state();assert.equal(s.progress.mission.id,'first-light');checks.push('Mission selection starts a real timed job');
  await key('KeyM');await page.locator('#map').waitFor({state:'visible'});const paused=(await state()).actor;await page.keyboard.down('KeyW');await step(90);await page.keyboard.up('KeyW');s=await state();assert.equal(s.actor.x,paused.x);assert.equal(s.actor.z,paused.z);checks.push('Map pauses simulation and clears gameplay input');
  await page.selectOption('#travel','-5380,7330');await page.waitForFunction(()=>window.__game.snapshot().actor.z>7000);
  s=await state();assert.ok(s.world.chunks<=25);assert.equal(s.progress.mission,null);checks.push('Long-distance travel replaces chunks and cancels active jobs');report.snapshots.push(s);
  await key('KeyM');await page.selectOption('#travel','2000,-420');await page.waitForFunction(()=>window.__game.snapshot().actor.x>1900);
  await page.evaluate(()=>window.__game.view(2120,48,-265,1930,10,-650));await page.waitForTimeout(1500);await shot('aerial');
  await page.evaluate(()=>{window.__game.setTime(21);window.__game.view(2017,8,-315,1952,11,-530);});await page.waitForTimeout(1500);await shot('night');checks.push('Photo camera and night lighting render');
  await page.evaluate(()=>window.__game.save());assert.ok(await page.evaluate(()=>localStorage.getItem('leonida.after-hours.v1')));checks.push('Versioned progress persists to local storage');
  report.final=await state();assert.deepEqual(errors,[],'No browser runtime, asset or shader errors');
}catch(error){report.failure=error.stack;process.exitCode=1;console.error(error);if(page){await shot('failure').catch(()=>{});try{report.failureSnapshot=await state();}catch{}}}
finally{
  await browser?.close();server.kill('SIGTERM');report.serverLog=serverLog;report.finishedAt=new Date().toISOString();
  await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  for(const name of ['aerial','failure','street','driving','menu']){try{await sharp(`${output}/${name}.jpg`).resize({width:360}).jpeg({quality:32}).toFile(`${output}/preview.jpg`);break;}catch{}}
  console.log(JSON.stringify(report,null,2));
}
