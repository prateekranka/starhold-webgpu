import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {browserOptions,verifyWebGPU} from './workshop-gpu.mjs';
await mkdir('workshop-evidence',{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5199','--strictPort'],{stdio:'inherit'});
let browser,activePage,activeErrors=[];const results=[];
try{
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:5199/tools/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch(browserOptions());
 const gpu=await verifyWebGPU(browser);
 await writeFile('workshop-evidence/webgpu-environment.json',JSON.stringify(gpu,null,2));
 console.log('PASS WebGPU environment',JSON.stringify(gpu));
 for(const [name,width,height] of [['desktop',1440,1000],['phone',390,844],['landscape',844,390],['ipad',768,1024]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,hasTouch:name!=='desktop'});
  const page=await context.newPage(),errors=[];activePage=page;activeErrors=errors;page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto('http://127.0.0.1:5199/tools/?view=forge&civ=1&kind=30');
  await page.waitForFunction(()=>document.querySelector('#workshop')?.dataset.ready==='true'||document.querySelector('#workshop')?.dataset.error==='true',null,{timeout:60000});
  assert.equal(await page.locator('#workshop').getAttribute('data-error'),null,await page.locator('#status').textContent());
  assert.equal((await page.locator('#asset-name').textContent()).toLowerCase(),'ash jackal');
  await page.locator('#variant').selectOption('longbow');await page.locator('#state').selectOption('2');
  await page.locator('#phase').evaluate(input=>{input.value='.49';input.dispatchEvent(new Event('input',{bubbles:true}));});
  // Wait for real pixels, but surface renderer/device errors immediately.
  await page.waitForFunction(()=>{if(document.querySelector('#workshop')?.dataset.error==='true')return true;const canvas=document.querySelector('#native'),data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,colors=new Set();for(let i=0;i<data.length;i+=4)colors.add(`${data[i]},${data[i+1]},${data[i+2]}`);return colors.size>3;},null,{timeout:15000});
  assert.equal(await page.locator('#workshop').getAttribute('data-error'),null,await page.locator('#status').textContent());
  await page.screenshot({path:`workshop-evidence/${name}-forge.png`,fullPage:true});
  const painted=await page.locator('#native').evaluate(canvas=>{const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;const colors=new Set();for(let i=0;i<data.length;i+=4)colors.add(`${data[i]},${data[i+1]},${data[i+2]}`);return colors.size;});
  assert.ok(painted>3,'Actual production-renderer crop is empty');
  await page.locator('nav [data-view=research]').click();
  await page.locator('button[data-research="202"]').click();await page.evaluate(()=>window.__WORKSHOP.step(1200));
  assert.equal(await page.locator('[data-node="202"] button').textContent(),'Completed');
  await page.locator('button[data-research="203"]').click();await page.evaluate(()=>window.__WORKSHOP.step(1440));
  assert.equal(await page.locator('[data-node="203"] button').textContent(),'Completed');
  await page.screenshot({path:`workshop-evidence/${name}-research.png`,fullPage:true});
  await page.locator('nav [data-view=encounter]').click();
  await page.locator('#doctrine').selectOption('running');await page.locator('#reset').click();await page.evaluate(()=>window.__WORKSHOP.step(60));
  const state=await page.evaluate(()=>window.__WORKSHOP.getState());assert.ok(state.shots>=1);assert.equal(state.preparationSeconds,44);
  await page.screenshot({path:`workshop-evidence/${name}-encounter.png`,fullPage:true});
  await page.locator('#play').click();await page.waitForTimeout(80);await page.locator('#play').click();
  assert.equal((await page.evaluate(()=>window.__WORKSHOP.getState())).playing,false);
  const scroll=await page.evaluate(()=>({width:innerWidth,doc:document.documentElement.scrollWidth}));assert.ok(scroll.doc<=scroll.width+2,`Horizontal page overflow: ${JSON.stringify(scroll)}`);
  const evidence=await page.evaluate(()=>window.__WORKSHOP.evidence());await writeFile(`workshop-evidence/${name}-session.json`,JSON.stringify(evidence,null,2));
  assert.deepEqual(errors,[]);assert.equal(await page.locator('#workshop').getAttribute('data-error'),null,await page.locator('#status').textContent());results.push({viewport:name,pass:true,paintedColors:painted,metrics:state});console.log('PASS',name,JSON.stringify(state));await context.close();activePage=null;activeErrors=[];
 }
 const page=await browser.newPage();activePage=page;await page.goto('http://127.0.0.1:5199/');
 await page.waitForFunction(()=>window.__APP?.ready||window.__APP?.error,null,{timeout:60000});
 assert.equal(await page.evaluate(()=>window.__APP.error),null);
 await page.evaluate(()=>window.__APP.startMatch(1));await page.locator('#hud-research').click();assert.equal(await page.locator('.research-dialog').evaluate(d=>d.open),true);await page.locator('.research-close').click();
 results.push({view:'production-match-research',pass:true});console.log(JSON.stringify(results,null,2));
}catch(error){results.push({pass:false,error:String(error),browserErrors:activeErrors});if(activePage){const diagnostics=await activePage.evaluate(()=>({state:window.__WORKSHOP?.getState(),status:document.querySelector('#status')?.textContent,canvases:[...document.querySelectorAll('canvas')].map(c=>({id:c.id,width:c.width,height:c.height,visible:!c.hidden}))})).catch(()=>({}));console.error('DIAGNOSTICS',JSON.stringify({...diagnostics,browserErrors:activeErrors}));await activePage.screenshot({path:'workshop-evidence/failure.png',fullPage:true}).catch(()=>{});await writeFile('workshop-evidence/failure.txt',await activePage.locator('body').innerText().catch(()=>''));}throw error;}
finally{await writeFile('workshop-evidence/browser-results.json',JSON.stringify(results,null,2));await browser?.close();server.kill();}
