import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {browserOptions,verifyWebGPU} from './workshop-gpu.mjs';
await mkdir('workshop-evidence',{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5199','--strictPort'],{stdio:'inherit'});
let browser,page;const errors=[];
async function waitForGame(page){
 await page.goto('http://127.0.0.1:5199/');
 await page.waitForFunction(()=>window.__APP?.ready||window.__APP?.error,null,{timeout:60000});
 assert.equal(await page.evaluate(()=>window.__APP.error),null);
 await page.waitForFunction(()=>document.querySelector('#game-menu')?.open===true,null,{timeout:5000});
}
async function assertCinematicCoverage(page,label){
 const layout=await page.evaluate(()=>{const r=document.querySelector('#viewport').getBoundingClientRect();return {cinematic:document.body.classList.contains('cinematic-fill'),width:r.width,height:r.height,left:r.left,top:r.top,innerWidth,innerHeight,scrollWidth:document.documentElement.scrollWidth};});
 assert.equal(layout.cinematic,true,`${label} should use cinematic-fill`);
 assert.ok(layout.width>=layout.innerWidth-2,`${label} viewport should cover screen width: ${JSON.stringify(layout)}`);
 assert.ok(layout.height>=layout.innerHeight-2,`${label} viewport should cover screen height: ${JSON.stringify(layout)}`);
 assert.ok(layout.scrollWidth<=layout.innerWidth+2,`${label} should not create horizontal page scrolling: ${JSON.stringify(layout)}`);
 return layout;
}
try{
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:5199/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch(browserOptions());await verifyWebGPU(browser);
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});page=await context.newPage();
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await waitForGame(page);
 const laptopTitle=await assertCinematicCoverage(page,'laptop title');
 assert.equal((await page.locator('#game-menu-title').textContent()).trim(),'MAIN MENU');assert.equal((await page.evaluate(()=>window.__APP.getState().mode)),0);
 assert.equal(await page.locator('#hud-bar').evaluate(el=>getComputedStyle(el).display),'none');
 const before=await page.evaluate(()=>window.__APP.entityProbe().map(e=>[e.x,e.y,e.state]));await page.waitForTimeout(1200);const after=await page.evaluate(()=>window.__APP.entityProbe().map(e=>[e.x,e.y,e.state]));
 assert.ok(after.some((row,i)=>row.some((value,j)=>Math.abs(value-before[i][j])>1e-4)),'Showcase actors should continue changing behind the menu');
 await page.screenshot({path:'workshop-evidence/game-menu-title.png',fullPage:true});
 await page.locator('[data-action="new"]').click();assert.equal((await page.locator('#game-menu-title').textContent()).trim(),'NEW GAME');
 await page.locator('[data-faction="1"]').click();await page.waitForFunction(()=>window.__APP.getState().mode===1&&document.querySelector('#game-menu')?.open===false,null,{timeout:5000});
 const laptopMatch=await assertCinematicCoverage(page,'laptop match');
 assert.equal(await page.locator('#hud-bar').evaluate(el=>getComputedStyle(el).display==='none'),false);
 await page.locator('#game-menu-toggle').click();await page.waitForFunction(()=>document.querySelector('#game-menu')?.open===true);
 const resume=page.locator('[data-action="resume"]');assert.equal(await resume.isEnabled(),true);await resume.click();assert.equal(await page.locator('#game-menu').evaluate(d=>d.open),false);
 await page.locator('#game-menu-toggle').click();await page.locator('[data-action="options"]').click();await page.locator('#gm-minimap-start').uncheck();
 await page.locator('[data-action="back"]').click();await page.locator('[data-action="settings"]').click();await page.locator('#gm-contrast').check();assert.equal(await page.locator('body').evaluate(b=>b.classList.contains('menu-high-contrast')),true);
 await page.locator('[data-action="back"]').click();await page.locator('[data-action="about"]').click();assert.match(await page.locator('.gm-prose').textContent(),/actual deterministic Rust\/WASM simulation/i);
 assert.deepEqual(errors,[]);await context.close();page=null;

 const ipadLayouts=[];
 for(const [name,width,height] of [['ipad-landscape',1024,768],['ipad-portrait',768,1024]]){
  const tablet=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,hasTouch:true});
  const tabletPage=await tablet.newPage(),tabletErrors=[];page=tabletPage;
  tabletPage.on('pageerror',error=>tabletErrors.push(error.message));tabletPage.on('console',message=>{if(message.type()==='error')tabletErrors.push(message.text());});
  await waitForGame(tabletPage);
  const layout=await assertCinematicCoverage(tabletPage,name);ipadLayouts.push({name,...layout});
  await tabletPage.screenshot({path:`workshop-evidence/${name}-menu.png`,fullPage:true});
  assert.deepEqual(tabletErrors,[]);await tablet.close();page=null;
 }
 await writeFile('workshop-evidence/game-menu-results.json',JSON.stringify({pass:true,showcaseMoved:true,laptopTitle,laptopMatch,ipadLayouts,errors},null,2));console.log('PASS game menu + cinematic fill');
}catch(error){await writeFile('workshop-evidence/game-menu-results.json',JSON.stringify({pass:false,error:String(error),errors},null,2));if(page)await page.screenshot({path:'workshop-evidence/game-menu-failure.png',fullPage:true}).catch(()=>{});throw error;}
finally{await browser?.close();server.kill();}
