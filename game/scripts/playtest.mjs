import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import assert from 'node:assert/strict';
const output='artifacts/playtest';await fs.mkdir(output,{recursive:true});
const server=spawn('npm',['run','preview','--','--port','4173'],{stdio:'pipe',env:process.env});
let serverLog='';server.stdout.on('data',d=>serverLog+=d);server.stderr.on('data',d=>serverLog+=d);
const errors=[],warnings=[],checks=[];let browser;
const report={checks,errors,warnings,snapshots:[],startedAt:new Date().toISOString()};
try{
  for(let n=0;n<100;n++){try{if((await fetch('http://127.0.0.1:4173/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
  const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
  page.on('requestfailed',request=>errors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`));
  await page.goto('http://127.0.0.1:4173/?test=1&quality=low',{waitUntil:'networkidle',timeout:120000});
  await page.waitForFunction(()=>window.__game?.snapshot().ready,{timeout:120000});
  let s=await page.evaluate(()=>window.__game.snapshot());assert.ok(s.assets.landmarks>2000);assert.ok(s.render.triangles>10000);checks.push('Real renderer, reference data and physics initialized');report.snapshots.push(s);
  await page.screenshot({path:`${output}/menu.jpg`,type:'jpeg',quality:86});
  await page.click('#start');await page.waitForTimeout(800);assert.equal(await page.evaluate(()=>window.__game.snapshot().paused),false);
  await page.keyboard.press('KeyE');await page.waitForFunction(()=>window.__game.snapshot().actor.driving,{timeout:15000});checks.push('Enter nearby vehicle through keyboard input');
  const before=await page.evaluate(()=>window.__game.snapshot().actor);
  await page.keyboard.down('KeyW');await page.evaluate(()=>window.__game.step(180));await page.keyboard.up('KeyW');
  s=await page.evaluate(()=>window.__game.snapshot());assert.ok(Math.hypot(s.actor.x-before.x,s.actor.z-before.z)>5,'Vehicle must physically move');assert.ok(s.actor.z<before.z,'Forward must move north at initial heading');checks.push('Throttle moves the dynamic vehicle in the correct direction');
  await page.screenshot({path:`${output}/driving.jpg`,type:'jpeg',quality:86});report.snapshots.push(s);
  await page.keyboard.down('KeyS');await page.evaluate(()=>window.__game.step(75));await page.keyboard.up('KeyS');
  await page.evaluate(()=>window.__game.recover());await page.evaluate(()=>window.__game.step(30));
  await page.keyboard.press('KeyE');await page.waitForFunction(()=>!window.__game.snapshot().actor.driving,{timeout:15000});checks.push('Safe vehicle exit');
  const foot=await page.evaluate(()=>window.__game.snapshot().actor);await page.keyboard.down('KeyW');await page.evaluate(()=>window.__game.step(60));await page.keyboard.up('KeyW');s=await page.evaluate(()=>window.__game.snapshot());assert.ok(Math.hypot(s.actor.x-foot.x,s.actor.z-foot.z)>.5);checks.push('Collision-aware character walking');
  await page.screenshot({path:`${output}/street.jpg`,type:'jpeg',quality:86});
  await page.keyboard.press('KeyJ');await page.locator('#jobs').waitFor({state:'visible'});await page.click('[data-job="first-light"]');s=await page.evaluate(()=>window.__game.snapshot());assert.equal(s.progress.mission.id,'first-light');checks.push('Mission selection starts a real timed job');
  await page.keyboard.press('KeyM');await page.locator('#map').waitFor({state:'visible'});const paused=await page.evaluate(()=>window.__game.snapshot().actor);await page.keyboard.down('KeyW');await page.evaluate(()=>window.__game.step(90));await page.keyboard.up('KeyW');s=await page.evaluate(()=>window.__game.snapshot());assert.equal(s.actor.x,paused.x);assert.equal(s.actor.z,paused.z);checks.push('Map pauses simulation and clears gameplay input');
  await page.selectOption('#travel','-5380,7330');await page.waitForFunction(()=>window.__game.snapshot().actor.z>7000,{timeout:30000});
  s=await page.evaluate(()=>window.__game.snapshot());assert.ok(s.world.chunks<=25);assert.equal(s.progress.mission,null);checks.push('Long-distance travel replaces chunks and cancels active jobs');report.snapshots.push(s);
  await page.keyboard.press('KeyM');await page.selectOption('#travel','2000,-420');await page.waitForFunction(()=>window.__game.snapshot().actor.x>1900,{timeout:30000});
  await page.evaluate(()=>window.__game.view(2120,48,-265,1930,10,-650));await page.waitForTimeout(1500);await page.screenshot({path:`${output}/aerial.jpg`,type:'jpeg',quality:88});
  await page.evaluate(()=>{window.__game.setTime(21);window.__game.view(2017,8,-315,1952,11,-530);});await page.waitForTimeout(1500);await page.screenshot({path:`${output}/night.jpg`,type:'jpeg',quality:88});checks.push('Photo camera and night lighting render');
  await page.evaluate(()=>window.__game.save());assert.ok(await page.evaluate(()=>localStorage.getItem('leonida.after-hours.v1')));checks.push('Versioned progress persists to local storage');
  report.final=await page.evaluate(()=>window.__game.snapshot());
  assert.deepEqual(errors,[],'No browser runtime, asset or shader errors');
}catch(error){report.failure=error.stack;process.exitCode=1;console.error(error);}
finally{
  await browser?.close();server.kill('SIGTERM');report.serverLog=serverLog;report.finishedAt=new Date().toISOString();
  await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  try{await sharp(`${output}/aerial.jpg`).resize({width:360}).jpeg({quality:38}).toFile(`${output}/preview.jpg`);}catch{}
  console.log(JSON.stringify(report,null,2));
}
