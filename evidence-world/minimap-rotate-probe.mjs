#!/usr/bin/env node
// A dragged minimap must stay on screen after an orientation flip.
const { chromium } = await import('/home/bobbyranka/Cowork/starhold/node_modules/playwright/index.mjs');
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { homedir } from 'node:os';
const ROOT = '/home/bobbyranka/Cowork/starhold/dist';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.wasm': 'application/wasm' };
const server = createServer(async (req, resp) => {
  const u = new URL(req.url, 'http://x');
  let p = decodeURIComponent(u.pathname);
  if (p === '/' || p === '') p = '/index.html';
  const f = join(ROOT, p);
  if (!existsSync(f)) { resp.writeHead(404); resp.end(); return; }
  resp.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
  resp.end(await readFile(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const cache = join(homedir(), '.cache', 'ms-playwright');
const dirs = (await readdir(cache)).filter((d) => d.startsWith('chromium_headless_shell')).sort().reverse();
const exe = dirs.map((d) => join(cache, d, 'chrome-headless-shell-linux64', 'chrome-headless-shell')).find(existsSync);
const browser = await chromium.launch({ executablePath: exe, ignoreDefaultArgs: ['--disable-dev-shm-usage'], args: ['--use-angle=vulkan', '--enable-features=Vulkan,VulkanFromANGLE', '--enable-unsafe-webgpu', '--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.waitForFunction(() => window.__APP && window.__APP.ready, null, { timeout: 30000 });
const rect = () => page.evaluate(() => {
  const m = document.querySelector('#minimap');
  const r = m.getBoundingClientRect();
  return { x: +r.x.toFixed(0), y: +r.y.toFixed(0), w: +r.width.toFixed(0), h: +r.height.toFixed(0), right: +r.right.toFixed(0), bottom: +r.bottom.toFixed(0), vw: innerWidth, vh: innerHeight, off: m.classList.contains('off') };
});
console.log('portrait:', JSON.stringify(await rect()));
// drag the panel to the bottom-right corner of the portrait screen
const start = await rect();
await page.mouse.move(start.x + start.w / 2, start.y + start.h / 2);
await page.mouse.down();
for (let i = 1; i <= 8; i++) await page.mouse.move(start.x + start.w / 2 + i * 6, start.y + start.h / 2 + i * 12);
await page.mouse.up();
await page.waitForTimeout(300);
const dragged = await rect();
console.log('after drag in portrait:', JSON.stringify(dragged));
// rotate to landscape
await page.setViewportSize({ width: 844, height: 390 });
await page.waitForTimeout(600);
const after = await rect();
const inside = after.x >= 0 && after.y >= 0 && after.right <= after.vw + 0.5 && after.bottom <= after.vh + 0.5;
console.log('after rotation:', JSON.stringify(after), 'inside:', inside);
console.log(inside ? 'PASS: the panel stays on screen' : 'FAIL: the panel is off-screen after rotation');
console.log(`page errors: ${errors.length}${errors.length ? ' :: ' + errors.join(' | ') : ''}`);
await browser.close();
server.close();
