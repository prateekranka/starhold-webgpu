#!/usr/bin/env node
// Bar hit-test probe: for every visible control in the HUD bar, does a tap at its
// centre actually hit that control? Screens crowded by many action buttons can
// push a cluster's children outside its own box.
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
const VIEWPORTS = [
  ['phone', { width: 844, height: 390 }, 2],
  ['tablet', { width: 1024, height: 768 }, 2],
  ['portrait', { width: 390, height: 844 }, 2],
];
for (const [name, viewport, dsf] of VIEWPORTS) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: dsf, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.__APP && window.__APP.ready, null, { timeout: 30000 });
  await page.evaluate(() => window.__APP.startMatch(0));
  await page.waitForTimeout(800);
  for (const selection of ['building', 'worker', 'site']) {
    await page.evaluate((what) => {
      if (what === 'worker') window.__APP.selectKind(20);
      else if (what === 'building') window.__APP.selectKind(10);
      else window.__APP.selectEntity(0);
    }, selection);
    await page.waitForTimeout(300);
    const report = await page.evaluate(() => {
      const clusters = {};
      for (const id of ['hud-resources', 'hud-middle', 'hud-actions', 'hud-age', 'hud-action-list', 'hud-bar']) {
        const el = document.getElementById(id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        clusters[id] = { x: +r.x.toFixed(0), w: +r.width.toFixed(0), scrollW: el.scrollWidth, right: +r.right.toFixed(0) };
      }
      const cells = [];
      for (const b of document.querySelectorAll('#hud-bar button')) {
        const cs = getComputedStyle(b);
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.5) continue;
        const r = b.getBoundingClientRect();
        const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
        const hit = document.elementFromPoint(cx, cy);
        const owner = hit ? (hit.closest('button') || hit) : null;
        cells.push({
          label: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 20),
          action: b.dataset.action || b.dataset.page || '',
          x: +r.x.toFixed(0), w: +r.width.toFixed(0), right: +r.right.toFixed(0),
          hitSelf: owner === b,
          hitLabel: owner ? ((owner.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 16) || owner.id) : 'none',
          position: cs.position, flex: `${cs.flexGrow}/${cs.flexShrink}/${cs.flexBasis}`,
        });
      }
      return { clusters, cells, vw: innerWidth, barW: document.getElementById('hud-bar').getBoundingClientRect().width, barScroll: document.getElementById('hud-bar').scrollWidth };
    });
    const misses = report.cells.filter((c) => !c.hitSelf);
    console.log(`\n[${name}] selection=${selection} barW=${report.barW} scrollW=${report.barScroll} controls=${report.cells.length} mis-hit=${misses.length}`);
    if (misses.length) {
      for (const m of misses) console.log(`   MIS-HIT: "${m.label}" ${m.action} at x=${m.x} w=${m.w} centre hits "${m.hitLabel}" (position=${m.position})`);
      console.log('   clusters:', JSON.stringify(report.clusters));
    }
    if (selection === 'worker') {
      const widest = report.cells.reduce((a, c) => Math.max(a, c.right), 0);
      console.log(`   rightmost control ends at ${widest.toFixed(0)} of ${report.vw}; actions cluster right=${report.clusters['hud-actions'] ? report.clusters['hud-actions'].right : '-'}`);
    }
  }
  console.log(`[${name}] page errors: ${errors.length}${errors.length ? ' :: ' + errors.slice(0, 2).join(' | ') : ''}`);
  await context.close();
}
await browser.close();
server.close();
