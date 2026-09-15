#!/usr/bin/env node
// Stress the worker tap path: N fresh matches, one exact tap per match, and the
// selection must be a worker. This measures the flakiness that made the
// build-site gate intermittent before the crystal seam moved to the apron.
const { chromium } = await import('/home/bobbyranka/Cowork/starhold/node_modules/playwright/index.mjs');
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { homedir } from 'node:os';
const ROOT = '/home/bobbyranka/Cowork/starhold/dist';
const ROUNDS = Number(process.env.ROUNDS || 12);
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
const browser = await chromium.launch({ executablePath: exe, ignoreDefaultArgs: ['--disable-dev-shm-usage'], args: ['--use-angle=vulkan', '--enable-features=Vulkan,VulkanFromAngles', '--enable-unsafe-webgpu', '--no-sandbox'].map((a) => a.replace('VulkanFromAngles', 'VulkanFromANGLE')) });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.waitForFunction(() => window.__APP && window.__APP.ready, null, { timeout: 30000 });

let hits = 0;
const misses = [];
for (let round = 0; round < ROUNDS; round++) {
  await page.evaluate(() => window.__APP.startMatch(0));
  await page.waitForTimeout(700);
  // Reproduce the harness condition: the workers have been gathering for a
  // while, so they are wherever the gather route puts them.
  const settle = Number(process.env.SETTLE || 0);
  if (settle > 0) await page.evaluate((s2) => window.__APP.fastForward(s2), settle);
  const outcome = await page.evaluate(() => {
    const p = window.__APP.entityScreen(20, 0);
    if (!p) return { ok: false, why: 'entityScreen returned null' };
    window.__APP.selectAt(p.x, p.y);
    const g = window.__APP.getState();
    return { ok: g.selectedKind === 20, kind: g.selectedKind, x: +p.x.toFixed(0), y: +p.y.toFixed(0) };
  });
  if (outcome.ok) hits++;
  else misses.push(`round ${round}: kind=${outcome.kind} ${outcome.why || ''} at ${outcome.x},${outcome.y}`);
  process.stdout.write(`round ${round}: ${outcome.ok ? 'worker selected' : `MISS (${JSON.stringify(outcome)})`}\n`);
}
console.log(`\nworker taps: ${hits}/${ROUNDS} (${((100 * hits) / ROUNDS).toFixed(0)}%)`);
for (const m of misses) console.log('  ' + m);
await browser.close();
server.close();
