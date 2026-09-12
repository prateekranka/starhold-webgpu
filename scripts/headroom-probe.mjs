#!/usr/bin/env node
/**
 * One-off headroom probe (orchestrator tool, not part of the gate suite).
 *
 * The normal harness measures rAF spacing, which is vsync-locked at 60 Hz and so
 * cannot show spare GPU budget. This launches the same WebGPU Chromium WITHOUT
 * vsync (--disable-frame-rate-limit) and reports uncapped frame rate, so we can
 * decide whether a 2x-pixel-grid change is affordable.
 *
 * Usage: node scripts/headroom-probe.mjs [--url http://...] [--seconds 5]
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { homedir } from 'node:os';

const argv = process.argv.slice(2);
const arg = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const ROOT = resolve(arg('root', 'dist'));
const SECONDS = parseFloat(arg('seconds', '5'));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml',
};

async function resolveChromium() {
  const cache = join(homedir(), '.cache', 'ms-playwright');
  const dirs = (await readdir(cache)).filter((d) => d.startsWith('chromium')).sort().reverse();
  for (const d of dirs) {
    if (d.startsWith('chromium_headless_shell')) {
      const p = join(cache, d, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

function startServer(root) {
  return new Promise((res) => {
    const server = createServer(async (req, resp) => {
      try {
        let p = new URL(req.url, 'http://x').pathname;
        if (p.endsWith('/')) p += 'index.html';
        const file = join(root, p);
        if (!existsSync(file)) { resp.writeHead(404); resp.end('nf'); return; }
        const body = await readFile(file);
        resp.writeHead(200, {
          'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
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
  '--disable-frame-rate-limit',
  '--disable-gpu-vsync',
];

const { server, port } = await startServer(ROOT);
const browser = await chromium.launch({
  headless: true,
  executablePath: await resolveChromium(),
  ignoreDefaultArgs: ['--disable-dev-shm-usage'],
  args: WEBGPU_ARGS,
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__APP && (window.__APP.ready || window.__APP.error), null, { timeout: 45000 });

const err = await page.evaluate(() => window.__APP.error);
if (err) { console.error(`app error: ${err}`); process.exit(2); }

// fast-forward to the busy t=108s moment, like the real gate
await page.evaluate(() => window.__APP.fastForward?.(108) ?? null).catch(() => {});
await page.waitForTimeout(1500);

const stats = await page.evaluate(async (secs) => {
  const deltas = [];
  let last = performance.now();
  const t0 = last;
  while (performance.now() - t0 < secs * 1000) {
    await new Promise((r) => requestAnimationFrame(r));
    const now = performance.now();
    deltas.push(now - last);
    last = now;
  }
  deltas.sort((a, b) => a - b);
  const n = deltas.length;
  return {
    frames: n,
    uncapped_fps: n / secs,
    p50_ms: deltas[Math.floor(n * 0.5)],
    p95_ms: deltas[Math.floor(n * 0.95)],
    max_ms: deltas[n - 1],
  };
}, SECONDS);

const gpu = await page.evaluate(() => {
  const a = navigator.gpu ? 'webgpu-api' : 'none';
  const c = document.querySelector('canvas');
  return { api: a, canvas: c ? `${c.width}x${c.height}` : 'none' };
});
const renderer = await page.evaluate(async () => {
  const ad = await navigator.gpu.requestAdapter();
  return ad ? (ad.info?.architecture ?? 'unknown') : 'none';
});

console.log(JSON.stringify({ ...stats, ...gpu, adapter: renderer }, null, 2));
await browser.close();
server.close();
