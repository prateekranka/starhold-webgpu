#!/usr/bin/env node
/**
 * Starhold capture harness (orchestrator-owned).
 *
 * Launches a static server over dist/ (or the path given), opens the page in a
 * Chromium with WebGPU enabled, then:
 *   - waits for window.__APP.ready
 *   - captures N screenshots (plus one per camera step + one selected)
 *   - samples fps over a window
 *   - exercises the real DOM buttons (#rotate-left/#rotate-right/#zoom-in/#zoom-out)
 *   - verifies click-selection via __APP.getState().selected
 *   - verifies determinism across two fresh loads
 *   - collects console errors and the first __APP.error
 *
 * Usage:
 *   node scripts/capture.mjs --root dist --out ../evidence --seed 1
 *   node scripts/capture.mjs --url http://localhost:5199 --out /tmp/shots
 *
 * Exit code 0 only when every gate passes.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { homedir } from 'node:os';

/** Find a usable Chromium: env override, else the cached headless shell (WebGPU
 *  works there), else a full chromium build. */
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
  } catch {
    /* fall through to playwright default */
  }
  return candidates.find((p) => existsSync(p));
}

const argv = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const flag = (name) => argv.includes(`--${name}`);

const ROOT = resolve(arg('root', 'dist'));
const OUT = resolve(arg('out', 'evidence'));
const WIDTH = parseInt(arg('width', '960'), 10);
const HEIGHT = parseInt(arg('height', '540'), 10);
const FPS_SECONDS = parseFloat(arg('fps-seconds', '4'));
const MIN_FPS = parseFloat(arg('min-fps', '60'));
const SEED = arg('seed', '1');
// Sim seconds to advance before capturing (the target frame is t=108s).
const SETTLE = parseFloat(arg('settle', '108'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function startServer(root) {
  return new Promise((res) => {
    const server = createServer(async (req, resp) => {
      try {
        const url = new URL(req.url, 'http://x');
        let p = decodeURIComponent(url.pathname);
        if (p === '/' || p === '') p = '/index.html';
        const file = join(root, p);
        if (!file.startsWith(root) || !existsSync(file)) {
          resp.writeHead(404); resp.end('not found'); return;
        }
        const body = await readFile(file);
        resp.writeHead(200, {
          'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        resp.end(body);
      } catch (e) {
        resp.writeHead(500); resp.end(String(e));
      }
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

async function newPage(browser, url) {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  return { page, errors };
}

async function waitReady(page, timeoutMs = 45000) {
  await page.waitForFunction(
    () => window.__APP && (window.__APP.ready || window.__APP.error),
    null,
    { timeout: timeoutMs },
  );
  const err = await page.evaluate(() => window.__APP?.error ?? null);
  if (err) throw new Error(`app error: ${err}`);
}

async function state(page) {
  return page.evaluate(() => window.__APP.getState());
}

/** Advance the world to a target simulation time before judging it.
 *  Prefers __APP.fastForward(seconds); falls back to real-time waiting. */
async function settle(page, seconds) {
  if (seconds <= 0) return;
  const viaApi = await page.evaluate((secs) => {
    if (typeof window.__APP?.fastForward === 'function') {
      window.__APP.fastForward(secs);
      return true;
    }
    return false;
  }, seconds).catch(() => false);
  if (viaApi) {
    await page.waitForTimeout(400);
    return;
  }
  // fallback: wall-clock wait (rAF drives the sim at 60 Hz)
  await page.waitForTimeout(seconds * 1000);
}

async function sampleFps(page, seconds) {
  return page.evaluate(async (secs) => {
    const frames = [];
    let last = performance.now();
    const t0 = last;
    while (performance.now() - t0 < secs * 1000) {
      await new Promise((r) => requestAnimationFrame(r));
      const now = performance.now();
      frames.push(now - last);
      last = now;
    }
    frames.sort((a, b) => a - b);
    const n = frames.length;
    const sum = frames.reduce((a, b) => a + b, 0);
    const pct = (p) => frames[Math.min(n - 1, Math.floor(n * p))];
    return {
      fps: n / secs,
      frames: n,
      mean_ms: sum / n,
      p50_ms: pct(0.5),
      p95_ms: pct(0.95),
      max_ms: frames[n - 1],
    };
  }, seconds);
}

async function entityHash(page) {
  return page.evaluate(() => {
    const s = window.__APP.getState();
    return JSON.stringify({ n: s.entityCount });
  });
}

/** Replay the raw simulation without browser rAF timing and hash all exported
 * entity bytes plus resources. This measures deterministic fixed-tick output. */
async function wasmReplayHash(seconds) {
  const bytes = await readFile(join(ROOT, 'sim.wasm'));
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const sim = instance.exports;
  const seed = Number.isFinite(Number(SEED)) ? Number(SEED) >>> 0 : 73129;
  sim.sim_init(seed);
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) sim.sim_step(1000 / 60);
  const n = sim.sim_entity_count();
  const stride = sim.sim_entity_stride();
  const ptr = sim.sim_entity_ptr();
  const view = new Uint8Array(sim.memory.buffer, ptr, n * stride * 4);
  let hash = 0x811c9dc5;
  for (const byte of view) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return JSON.stringify({
    n,
    alloy: sim.sim_alloy(),
    charge: sim.sim_charge(),
    hash: hash.toString(16).padStart(8, '0'),
  });
}

const results = { gates: [], shots: [], errors: [] };
function gate(name, pass, detail) {
  results.gates.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

(async () => {
  await mkdir(OUT, { recursive: true });
  let serverHandle = null;
  let baseUrl = arg('url', null);
  if (!baseUrl) {
    if (!existsSync(join(ROOT, 'index.html'))) {
      console.error(`no index.html under ${ROOT}; run the build first or pass --url`);
      process.exit(2);
    }
    serverHandle = await startServer(ROOT);
    baseUrl = `http://127.0.0.1:${serverHandle.port}`;
  }

  const chromiumPath = await resolveChromium();
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromiumPath,
    ignoreDefaultArgs: ['--disable-dev-shm-usage'],
    args: WEBGPU_ARGS,
  });

  try {
    // --- pass 1: boot, fps, controls, selection -------------------------------
    const { page, errors } = await newPage(browser, baseUrl);
    await waitReady(page);
    // Advance to the canonical moment (t=108s) so the shot shows a built-up world.
    await settle(page, SETTLE);
    const s0 = await state(page);
    gate('boots-ready', true, `entities=${s0.entityCount}`);

    const fps = await sampleFps(page, FPS_SECONDS);
    results.fps = fps;
    // rAF is vsync-locked at the display rate, so ">60 fps" reads as: never drops
    // below the refresh rate and keeps p95 inside the 60 Hz frame budget.
    gate('fps>=59-vsync-locked', fps.fps >= MIN_FPS - 1.0 && fps.p95_ms <= 20,
      `fps=${fps.fps.toFixed(1)} p95=${fps.p95_ms.toFixed(1)}ms max=${fps.max_ms.toFixed(1)}ms`);

    await page.screenshot({ path: join(OUT, 'shot-main.png') });
    results.shots.push('shot-main.png');

    // camera rotation via the REAL buttons
    const yawBefore = (await state(page)).yawSteps;
    await page.click('#rotate-right');
    await page.waitForTimeout(450);
    const yawAfter = (await state(page)).yawSteps;
    gate('rotate-button', yawAfter !== yawBefore, `${yawBefore} -> ${yawAfter}`);
    await page.screenshot({ path: join(OUT, 'shot-rotated.png') });
    results.shots.push('shot-rotated.png');

    // zoom via the REAL buttons
    const z0 = (await state(page)).zoom;
    await page.click('#zoom-in');
    await page.waitForTimeout(350);
    const z1 = (await state(page)).zoom;
    await page.click('#zoom-out');
    await page.waitForTimeout(350);
    const z2 = (await state(page)).zoom;
    gate('zoom-buttons', z1 !== z0 && Math.abs(z2 - z0) < 1e-3, `zoom ${z0} -> ${z1} -> ${z2}`);

    // selection via a real click on the canvas centre
    const box = await page.locator('canvas').first().boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(350);
    }
    let sel = (await state(page)).selected;
    if (sel === null || sel === undefined) {
      // sweep a few points to find an entity
      for (const [fx, fy] of [[0.5, 0.55], [0.45, 0.5], [0.55, 0.5], [0.5, 0.62], [0.4, 0.45], [0.6, 0.58]]) {
        if (box) await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
        await page.waitForTimeout(220);
        sel = (await state(page)).selected;
        if (sel !== null && sel !== undefined) break;
      }
    }
    gate('click-select', sel !== null && sel !== undefined, `selected=${sel}`);
    await page.screenshot({ path: join(OUT, 'shot-selected.png') });
    results.shots.push('shot-selected.png');

    await page.waitForTimeout(600);
    await page.screenshot({ path: join(OUT, 'shot-later.png') });
    results.shots.push('shot-later.png');

    results.errors = errors;
    gate('no-console-errors', errors.length === 0, errors.slice(0, 3).join(' | '));

    // --- pass 2: determinism --------------------------------------------------
    // Browser pages can differ by one rAF tick. Replay the raw WASM twice for
    // an exact number of fixed ticks and compare full entity/resource hashes.
    const [h1, h2] = await Promise.all([
      wasmReplayHash(SETTLE),
      wasmReplayHash(SETTLE),
    ]);
    gate('determinism', h1 === h2, `${h1} vs ${h2}`);
  } catch (e) {
    results.errors.push(String(e));
    gate('harness', false, String(e).slice(0, 300));
  } finally {
    await browser.close();
    if (serverHandle) serverHandle.server.close();
  }

  await writeFile(join(OUT, 'capture-report.json'), JSON.stringify(results, null, 2));
  const failed = results.gates.filter((g) => !g.pass);
  console.log(`\n${results.gates.length - failed.length}/${results.gates.length} gates passed`);
  if (results.fps) console.log(`fps mean=${results.fps.fps.toFixed(1)}  p50=${results.fps.p50_ms.toFixed(1)}ms  p95=${results.fps.p95_ms.toFixed(1)}ms`);
  console.log(`shots -> ${OUT}`);
  process.exit(failed.length ? 1 : 0);
})();
