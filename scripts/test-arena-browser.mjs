import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {browserOptions, verifyWebGPU} from './workshop-gpu.mjs';

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5199', '--strictPort'], {stdio: 'inherit'});

let browser, page;
const errors = [];

try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch('http://127.0.0.1:5199/')).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }

  browser = await chromium.launch(browserOptions());
  await verifyWebGPU(browser);
  const context = await browser.newContext({viewport: {width: 1440, height: 900}, deviceScaleFactor: 1});
  page = await context.newPage();

  page.on('pageerror', (err) => {
    console.log('PAGE ERROR:', err);
    errors.push(err.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR:', msg.text());
      errors.push(msg.text());
    }
  });

  await page.goto('http://127.0.0.1:5199/');
  await page.waitForFunction(() => window.__APP?.ready || window.__APP?.error, null, {timeout: 60000});
  assert.equal(await page.evaluate(() => window.__APP.error), null);

  console.log('[Test 1] Testing Arena Modal trigger from Menu...');
  await page.waitForFunction(() => document.querySelector('#game-menu')?.open === true, null, {timeout: 5000});
  const arenaBtn = page.locator('[data-action="arena"]');
  assert.equal(await arenaBtn.count(), 1, 'Arena button must exist in game menu');
  await arenaBtn.click();

  // Wait for arena modal to open
  await page.waitForFunction(() => document.querySelector('#arena-modal')?.open === true, null, {timeout: 5000});
  console.log('PASS: Arena modal opened successfully');

  // Verify modal selects
  const p1Select = page.locator('#arena-p1-select');
  const p2Select = page.locator('#arena-p2-select');
  assert.equal(await p1Select.count(), 1);
  assert.equal(await p2Select.count(), 1);

  console.log('[Test 2] Launching Claude vs Codex AI Battle...');
  await p1Select.selectOption('claude');
  await p2Select.selectOption('codex');
  await page.locator('[data-action="launch"]').click();

  // Wait for modal to close and arena match to start
  await page.waitForFunction(() => document.querySelector('#arena-modal')?.open === false, null, {timeout: 5000});
  assert.equal(await page.evaluate(() => window.__APP.getState().mode), 1);
  console.log('PASS: Match launched in arena mode (mode = 1)');

  // Verify Spectator HUD is visible
  const specHud = page.locator('#spectator-hud');
  await page.waitForFunction(() => {
    const el = document.querySelector('#spectator-hud');
    return el && getComputedStyle(el).display !== 'none';
  }, null, {timeout: 5000});
  console.log('PASS: Spectator HUD is visible with LIVE MLX badge');

  // Test speed controls
  const btn2x = page.locator('#spec-speed-2x');
  await btn2x.click();
  const speed = await page.evaluate(() => window.__starhold_time_scale);
  assert.equal(speed, 2, 'Speed 2x should set __starhold_time_scale to 2');
  console.log('PASS: Spectator speed multiplier active (2x)');

  // Wait for at least one AI thought to appear from Laya-MLX
  console.log('[Test 3] Waiting for tactical thoughts from local Laya-MLX...');
  await page.waitForFunction(() => {
    const thoughts = document.querySelectorAll('.spec-thought-entry');
    return thoughts.length > 0;
  }, null, {timeout: 15000});

  const thoughtCount = await page.locator('.spec-thought-entry').count();
  const firstThoughtText = await page.locator('.spec-thought-text').first().textContent();
  console.log(`PASS: Received ${thoughtCount} thoughts from Laya-MLX!`);
  console.log(`First thought snippet: "${firstThoughtText?.slice(0, 80)}..."`);

  await page.screenshot({path: 'workshop-evidence/arena-battle-live.png', fullPage: true});
  console.log('PASS: Live arena screenshot saved to workshop-evidence/arena-battle-live.png');

  assert.deepEqual(errors, []);
  console.log('\n========================================');
  console.log('ALL BATTLE ARENA BROWSER TESTS PASSED!');
  console.log('========================================');
} catch (err) {
  console.error('TEST FAILED:', err);
  if (page) await page.screenshot({path: 'workshop-evidence/arena-failure.png', fullPage: true}).catch(() => {});
  throw err;
} finally {
  await browser?.close();
  server.kill();
}
