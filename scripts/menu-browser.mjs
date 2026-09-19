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
 const layout=await page.evaluate(()=>{const r=document.querySelector('#viewport').getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,top:r.top,innerWidth,innerHeight,scrollWidth:document.documentElement.scrollWidth};});
 assert.ok(layout.width>0&&layout.height>0,`${label} viewport should have non-zero dimensions: ${JSON.stringify(layout)}`);
 assert.ok(layout.width<=layout.innerWidth+2,`${label} viewport width should fit screen: ${JSON.stringify(layout)}`);
 assert.ok(layout.height<=layout.innerHeight+2,`${label} viewport height should fit screen: ${JSON.stringify(layout)}`);
 assert.ok(layout.scrollWidth<=layout.innerWidth+2,`${label} should not create horizontal page scrolling: ${JSON.stringify(layout)}`);
 return layout;
}
async function assertCleanTitleChrome(page,label){
 assert.equal(await page.locator('#viewport nav').evaluate(el=>getComputedStyle(el).display),'none',`${label} should hide rotate/zoom controls`);
}
try{
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:5199/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch(browserOptions());await verifyWebGPU(browser);
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});page=await context.newPage();
 page.on('pageerror',error=>{console.log('PAGEERROR:',error);errors.push(error.message);});
 page.on('console',message=>{
   console.log('BROWSER CONSOLE:',message.type(),message.text());
   if(message.type()==='error')errors.push(message.text());
 });
 await waitForGame(page);
 const laptopTitle=await assertCinematicCoverage(page,'laptop title');
 await assertCleanTitleChrome(page,'laptop title');
 assert.equal((await page.locator('#game-menu-title').textContent()).trim(),'MAIN MENU');assert.equal((await page.evaluate(()=>window.__APP.getState().mode)),0);
 assert.equal(await page.locator('#hud-bar').evaluate(el=>getComputedStyle(el).display),'none');
 const before=await page.evaluate(()=>window.__APP.entityProbe().map(e=>[e.x,e.y,e.state]));
 await page.waitForFunction((b)=>{
   const after=window.__APP.entityProbe().map(e=>[e.x,e.y,e.state]);
   return after.some((row,i)=>row.some((value,j)=>Math.abs(value-b[i][j])>1e-4));
 }, before, {timeout: 5000});
 assert.ok(true, 'Showcase actors should continue changing behind the menu');
 await page.screenshot({path:'workshop-evidence/game-menu-title.png',fullPage:true});
 // Watching the showcase should remove the menu without bringing camera-debug
 // controls back onto the home presentation.
 await page.locator('[data-action="watch"]').click();
 await page.waitForFunction(()=>document.querySelector('#game-menu')?.open===false);
 assert.equal(await page.locator('#viewport nav').evaluate(el=>getComputedStyle(el).display),'none','watch showcase should stay clean');
 await page.locator('#game-menu-toggle').click();await page.waitForFunction(()=>document.querySelector('#game-menu')?.open===true);
 await page.locator('[data-action="new"]').click();assert.equal((await page.locator('#game-menu-title').textContent()).trim(),'NEW GAME');
 await page.locator('[data-faction="1"]').click();await page.waitForFunction(()=>window.__APP.getState().mode===1&&document.querySelector('#game-menu')?.open===false,null,{timeout:5000});
 const laptopMatch=await assertCinematicCoverage(page,'laptop match');
 assert.equal(await page.locator('#hud-bar').evaluate(el=>getComputedStyle(el).display==='none'),false);
 assert.notEqual(await page.locator('#viewport nav').evaluate(el=>getComputedStyle(el).display),'none','camera controls should remain available during play');
 const appErr = await page.evaluate(() => ({ error: window.__APP.error, errorText: document.querySelector('#error')?.textContent, hidden: document.querySelector('#error')?.hidden }));
 console.log('DEBUG appError:', appErr);
 const cameraControls=await page.locator('#viewport nav button').evaluateAll(buttons=>buttons.map(button=>{const r=button.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);return {id:button.id,width:r.width,height:r.height,inside:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,hit:!!hit&&button.contains(hit),hitEl:hit?`${hit.tagName}#${hit.id}.${hit.className}`:'null'};}));
 console.log('DEBUG cameraControls:', cameraControls);
 assert.equal(cameraControls.length,4,'active match should retain all four camera controls');
 assert.ok(cameraControls.every(control=>control.width>=44&&control.height>=44&&control.inside&&control.hit),`camera controls must be visible and hit-test to themselves: ${JSON.stringify(cameraControls)}`);
  const noOverlap=await page.evaluate(()=>{const map=document.querySelector('#minimap').getBoundingClientRect(),buttons=[...document.querySelectorAll('#viewport nav button')].map(button=>button.getBoundingClientRect());return buttons.every(b=>(map.right<=b.left||map.left>=b.right||map.bottom<=b.top||map.top>=b.bottom));});
  assert.ok(noOverlap,'minimap must not overlap camera buttons');
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
  await assertCleanTitleChrome(tabletPage,name);
  await tabletPage.screenshot({path:`workshop-evidence/${name}-menu.png`,fullPage:true});
  assert.deepEqual(tabletErrors,[]);await tablet.close();page=null;
 }
 await writeFile('workshop-evidence/game-menu-results.json',JSON.stringify({pass:true,showcaseMoved:true,laptopTitle,laptopMatch,ipadLayouts,errors},null,2));console.log('PASS game menu + cinematic fill + clean title chrome');
}catch(error){await writeFile('workshop-evidence/game-menu-results.json',JSON.stringify({pass:false,error:String(error),errors},null,2));if(page)await page.screenshot({path:'workshop-evidence/game-menu-failure.png',fullPage:true}).catch(()=>{});throw error;}
finally{await browser?.close();server.kill();}
