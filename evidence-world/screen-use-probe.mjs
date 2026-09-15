#!/usr/bin/env node
// Screen-use measurements for docs/SCREEN_USE_SPEC.md, per viewport.
// Reports: canvas size and the empty share of the viewport, the bar and nav
// layout mode, the minimap panel, and the minimap close control's touch size.
const { chromium } = await import('/home/bobbyranka/Cowork/starhold/node_modules/playwright/index.mjs');
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { homedir } from 'node:os';
import { createServer } from 'node:http';

const ROOT = process.env.ROOT || '/tmp/dist-matchend';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm' };
const server = createServer(async (req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  const file = join(ROOT, p === '/' ? '/index.html' : p);
  if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(await readFile(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));

const CACHE = join(homedir(), '.cache', 'ms-playwright');
const dirs = (await readdir(CACHE)).filter((d) => d.startsWith('chromium_headless_shell')).sort().reverse();
const exe = dirs.map((d) => join(CACHE, d, 'chrome-headless-shell-linux64', 'chrome-headless-shell')).find(existsSync);
const browser = await chromium.launch({ executablePath: exe, ignoreDefaultArgs: ['--disable-dev-shm-usage'], args: ['--use-angle=vulkan', '--enable-features=Vulkan,VulkanFromANGLE', '--enable-unsafe-webgpu', '--no-sandbox'] });

const VIEWPORTS = [
  ['desktop', { width: 960, height: 540 }, 1, { hasTouch: false, isMobile: false }],
  ['phone', { width: 844, height: 390 }, 2, { hasTouch: true, isMobile: true }],
  ['tablet', { width: 1024, height: 768 }, 2, { hasTouch: true, isMobile: true }],
  ['portrait', { width: 390, height: 844 }, 2, { hasTouch: true, isMobile: true }],
  ['ipad', { width: 768, height: 1024 }, 2, { hasTouch: true, isMobile: true }],
];
for (const [name, viewport, dsf, opts] of VIEWPORTS) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: dsf, ...opts });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).split('\n')[0].slice(0, 100)));
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__APP && window.__APP.ready, null, { timeout: 30000 });
  const m = await page.evaluate(() => {
    const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { x: +b.x.toFixed(0), y: +b.y.toFixed(0), w: +b.width.toFixed(0), h: +b.height.toFixed(0) }; };
    const vp = { w: innerWidth, h: innerHeight };
    const canvas = r('#viewport');
    const empty = canvas ? 1 - (canvas.w * canvas.h) / (vp.w * vp.h) : null;
    return {
      bodyClass: document.body.className, vp, canvas,
      emptyShare: empty === null ? null : +(empty * 100).toFixed(1),
      bar: r('#hud-bar'), minimap: r('#minimap'), close: r('#minimap-close'),
      sideMargins: canvas ? { left: canvas.x, right: vp.w - (canvas.x + canvas.w) } : null,
    };
  });
  const side = m.sideMargins;
  console.log(`\n[${name}] ${m.vp.w}x${m.vp.h} body="${m.bodyClass}"`);
  console.log(`  canvas ${m.canvas ? `${m.canvas.w}x${m.canvas.h} at ${m.canvas.x},${m.canvas.y}` : 'missing'}  empty=${m.emptyShare}%  margins L/R=${side ? `${side.left}/${side.right}` : '-'}`);
  console.log(`  bar    ${m.bar ? `${m.bar.w}x${m.bar.h}` : 'none'}   minimap ${m.minimap ? `${m.minimap.w}x${m.minimap.h}` : 'closed'}   close ${m.close ? `${m.close.w}x${m.close.h}` : 'none'}`);
  if (errors.length) console.log(`  errors: ${errors.join(' | ')}`);
  await context.close();
}
await browser.close();
server.close();
