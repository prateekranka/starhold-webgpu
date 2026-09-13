#!/usr/bin/env node
/**
 * Starhold four-yaw capture (orchestrator-owned).
 *
 * One page load, settled to the canonical t=108 state with a single
 * __APP.fastForward call, then one composited screenshot per camera yaw step
 * (0..3) driven by the real #rotate-right button. Writes yaw-0.png .. yaw-3.png
 * plus yaw-state.json (yawSteps, frameStats per shot) into the output dir.
 *
 * Usage: node scripts/yaw-capture.mjs [--root dist] [--out evidence-p25]
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { homedir } from 'node:os';

const argv = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const ROOT = resolve(arg('root', 'dist'));
const OUT = resolve(arg('out', 'evidence'));
const WIDTH = parseInt(arg('width', '960'), 10);
const HEIGHT = parseInt(arg('height', '540'), 10);
const SETTLE = parseFloat(arg('settle', '108'));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

async function resolveChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM && existsSync(process.env.PLAYWRIGHT_CHROMIUM)) {
    return process.env.PLAYWRIGHT_CHROMIUM;
  }
  const cache = join(homedir(), '.cache', 'ms-playwright');
  const candidates = [];
  try {
    const dirs = (await readdir(cache)).filter((d) => d.startsWith('chromium')).sort().reverse();
    for (const d of dirs) {
      if (d.startsWith('chromium_headless_shell')) {
        candidates.push(join(cache, d, 'chrome-headless-shell-linux64', 'chrome-headless-shell'));
        candidates.push(join(cache, d, 'chrome-linux', 'chrome-headless-shell'));
      }
    }
    for (const d of dirs) {
      if (!d.startsWith('chromium_headless_shell')) {
        candidates.push(join(cache, d, 'chrome-linux64', 'chrome'));
        candidates.push(join(cache, d, 'chrome-linux', 'chrome'));
      }
    }
  } catch { /* fall through */ }
  return candidates.find((p) => existsSync(p));
}

function startServer(root) {
  return new Promise((res) => {
    const server = createServer(async (req, resp) => {
      try {
        const url = new URL(req.url, 'http://x');
        let p = decodeURIComponent(url.pathname);
        if (p === '/' || p === '') p = '/index.html';
        const file = join(root, p);
        if (!file.startsWith(root) || !existsSync(file)) { resp.writeHead(404); resp.end('not found'); return; }
        const body = await readFile(file);
        resp.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
        resp.end(body);
      } catch (e) { resp.writeHead(500); resp.end(String(e)); }
    });
    server.listen(0, '127.0.0.1', () => res({ server, port: server.address().port }));
  });
}

const WEBGPU_ARGS = [
  '--enable-features=Vulkan,VulkanFromANGLE',
  '--enable-unsafe-webgpu',
  '--use-angle=vulkan',
  '--ignore-gpu-blocklist',
  '--use-gl=angle',
];

(async () => {
  await mkdir(OUT, { recursive: true });
  const handle = await startServer(ROOT);
  const baseUrl = `http://127.0.0.1:${handle.port}`;
  const chromiumPath = await resolveChromium();
  const browser = await chromium.launch({
    headless: true, executablePath: chromiumPath,
    ignoreDefaultArgs: ['--disable-dev-shm-usage'], args: WEBGPU_ARGS,
  });
  const report = { url: baseUrl, width: WIDTH, height: HEIGHT, settle: SETTLE, shots: [], states: [] };
  try {
    const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.goto(baseUrl, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.__APP && (window.__APP.ready || window.__APP.error), null, { timeout: 45000 });
    const err = await page.evaluate(() => window.__APP?.error ?? null);
    if (err) throw new Error(`app error: ${err}`);
    await page.evaluate((secs) => { window.__APP.fastForward(secs); }, SETTLE);
    await page.waitForTimeout(500);
    for (let guard = 0; guard < 4; guard++) {
      const y = await page.evaluate(() => window.__APP.getState().yawSteps);
      if (y === 0) break;
      await page.click('#rotate-right');
      await page.waitForTimeout(500);
    }
    for (let k = 0; k < 4; k++) {
      if (k > 0) { await page.click('#rotate-right'); await page.waitForTimeout(650); }
      const s = await page.evaluate(() => {
        const st = window.__APP.getState();
        return { yawSteps: st.yawSteps, frameStats: st.frameStats ?? null, selected: st.selected, entityCount: st.entityCount };
      });
      const file = `yaw-${k}.png`;
      await page.screenshot({ path: join(OUT, file) });
      report.shots.push(file);
      report.states.push(s);
      console.log(`${file} yawSteps=${s.yawSteps} tris=${s.frameStats ? s.frameStats.triangles : '-'} saturated=${s.frameStats ? s.frameStats.saturated : '-'} selected=${s.selected}`);
    }
    report.errors = errors;
    await writeFile(join(OUT, 'yaw-state.json'), JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
    handle.server.close();
  }
  console.log('yaw capture done');
})();
