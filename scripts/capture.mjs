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
 * Mobile mode (--touch) adds:
 *   - touch layout switch, no page scroll, canvas fit, HUD containment
 *   - 44x44 CSS px touch targets, safe-area inset plumbing (injected insets)
 *   - touch taps on the camera buttons, tap selection, two-finger pinch zoom,
 *     and tap-after-pinch
 *
 * Usage:
 *   node scripts/capture.mjs --root dist --out ../evidence --seed 1
 *   node scripts/capture.mjs --root dist --out ev/phone --width 844 --height 390 --touch --dsf 2
 *   node scripts/capture.mjs --root dist --out ev/portrait --width 390 --height 844 --touch --portrait
 *   node scripts/capture.mjs --root dist --out ev/ipad --ipad-portrait
 *   node scripts/capture.mjs --url http://localhost:5199 --out /tmp/shots
 *
 * Wave 2 (match mode, MATCH_SPEC §7-§10) gates run in every mode and drive the
 * app only through window.__APP (startMatch/resetShowcase/command/fastForward/
 * getState) plus real DOM clicks: hud-skirmish-entry, match-boot, hud-bar,
 * hud-resources, hud-age, age-advance, train-unit, build-site,
 * match-determinism, portrait-playable, ipad-portrait, no-webgpu-error-path.
 * --ipad-portrait is the 768x1024 dsf 2 viewport mode; its size gate is named
 * ipad-portrait and it runs the same layout and interaction gates as portrait.
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
// --ipad-portrait: 768x1024 at dsf 2 unless the flags override the preset.
const IPAD = flag('ipad-portrait');
const WIDTH = parseInt(arg('width', IPAD ? '768' : '960'), 10);
const HEIGHT = parseInt(arg('height', IPAD ? '1024' : '540'), 10);
const FPS_SECONDS = parseFloat(arg('fps-seconds', '4'));
const MIN_FPS = parseFloat(arg('min-fps', '60'));
const SEED = arg('seed', '1');
const SEED_U32 = Number.isFinite(Number(SEED)) ? Number(SEED) >>> 0 : 73129;
// Sim seconds to advance before capturing (the target frame is t=108s).
const SETTLE = parseFloat(arg('settle', '108'));
// Mobile mode.
const PORTRAIT = flag('portrait') || IPAD;
const TOUCH = flag('touch') || PORTRAIT || IPAD;
const DSF = parseFloat(arg('dsf', IPAD ? '2' : '1'));
const ZOOMS = [4 / 3, 1, 4 / 5, 2 / 3];
const zoomIndex = (z) => ZOOMS.findIndex((v) => Math.abs(v - z) < 1e-6);

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

/** A fresh page with the harness viewport. `blockGpu` removes navigator.gpu so
 *  the no-WebGPU error path can be exercised; `errors` collects console errors. */
async function newPageWith(browser, url, options = {}) {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: DSF,
    hasTouch: TOUCH,
    isMobile: TOUCH,
  });
  if (options.blockGpu) {
    await context.addInitScript(() => {
      try {
        Object.defineProperty(Navigator.prototype, 'gpu', { configurable: true, get: () => undefined });
      } catch {
        /* prototype not configurable: leave it */
      }
    });
  }
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  return { page, context, errors };
}

async function newPage(browser, url) {
  const { page, context, errors } = await newPageWith(browser, url);
  return { page, context, errors };
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

async function rect(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
  }, selector);
}

async function layout(page) {
  return page.evaluate(() => ({
    innerWidth,
    innerHeight,
    bodyClass: document.body.className,
    docWidth: document.documentElement.scrollWidth,
    docHeight: document.documentElement.scrollHeight,
    clientWidth: document.documentElement.clientWidth,
    clientHeight: document.documentElement.clientHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    canvasCss: (() => { const c = document.querySelector('canvas#world'); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom, backingW: c.width, backingH: c.height }; })(),
    buttons: [...document.querySelectorAll('nav button')].map((b) => {
      const r = b.getBoundingClientRect();
      return { id: b.id, x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
    }),
    notice: (() => {
      const el = document.querySelector('#rotate-notice');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { display: getComputedStyle(el).display, x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom, text: el.textContent.trim() };
    })(),
  }));
}

/** Two-finger pinch through CDP raw touch events. */
async function pinch(page, context, cx, cy, startHalf, endHalf) {
  const cdp = await context.newCDPSession(page);
  const points = (half) => [
    { x: cx - half, y: cy, id: 0, radiusX: 8, radiusY: 8, force: 1 },
    { x: cx + half, y: cy, id: 1, radiusX: 8, radiusY: 8, force: 1 },
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(startHalf) });
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const half = startHalf + (endHalf - startHalf) * (i / steps);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(half) });
    await page.waitForTimeout(25);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/** Tap a point with a real touch event. */
async function tapAt(page, x, y) {
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(300);
}

async function entityHash(page) {
  return page.evaluate(() => {
    const s = window.__APP.getState();
    return JSON.stringify({ n: s.entityCount });
  });
}

/* -------------------------------------------------------------- wave 2 -----
 * Match-mode gates (MATCH_SPEC §7-§10). The app is driven only through
 * window.__APP (startMatch/resetShowcase/command/fastForward/getState) and real
 * DOM clicks on the HUD and the canvas. Every new gate reports FAIL instead of
 * throwing, so a build without the wave-2 integration still returns a full gate
 * list rather than skipping the rest of the run.
 */

const AGE_NAMES = ['Founding', 'March', 'Starhold'];
// Founding->March 60 Alloy/30 Charge; March->Starhold 100 Alloy/60 Charge (§4).
const AGE_COSTS = [[60, 30], [100, 60]];
const MATCH_GATE_NAMES = [
  'hud-skirmish-entry', 'match-boot', 'hud-bar', 'hud-resources', 'hud-age',
  'age-advance', 'train-unit', 'build-site',
];
const MATCH_APP_API = ['startMatch', 'resetShowcase', 'command', 'fastForward', 'getState'];
// Kinds the exact-tap probe asks for first: the tier-0 producers (train actions)
// and the two workers (build actions). The spot scan below stays as the fallback
// for builds that predate the entityScreen probe.
const PRODUCER_KINDS = [10, 11, 12, 60, 61, 62];
const WORKER_KINDS = [20, 32];
// Canvas points tried when selecting player entities in match mode: centre-out
// and west-biased (the player base occupies the west settlement, §6).
const MATCH_SPOTS = [
  // Exact yaw-0 body projections for the six west-base workers, plus nearby
  // ground projections. Workers move during the 450 ms DOM settle, so include a
  // narrow 2-D spread around the body rather than one fragile pixel.
  [0.3100, 0.3710], [0.3074, 0.3634], [0.3110, 0.3634], [0.3040, 0.3634],
  [0.3074, 0.3571], [0.3074, 0.3697],
  [0.3125, 0.355], [0.300, 0.355], [0.325, 0.355],
  [0.3250, 0.368], [0.313, 0.368], [0.337, 0.368],
  [0.2875, 0.381], [0.276, 0.381], [0.299, 0.381],
  [0.3000, 0.394], [0.288, 0.394], [0.312, 0.394],
  [0.4050, 0.399], [0.393, 0.399], [0.417, 0.399],
  [0.3800, 0.425], [0.368, 0.425], [0.392, 0.425],
  [0.3125, 0.3754], [0.3250, 0.3882], [0.2875, 0.4011],
  [0.3000, 0.4139], [0.4050, 0.4190], [0.3800, 0.4447],
  [0.5, 0.5], [0.46, 0.52], [0.54, 0.48], [0.42, 0.5], [0.58, 0.5],
  [0.5, 0.6], [0.5, 0.4], [0.38, 0.54], [0.62, 0.46], [0.34, 0.5],
  [0.46, 0.62], [0.54, 0.38], [0.3, 0.56], [0.66, 0.44], [0.38, 0.42],
  [0.62, 0.58], [0.26, 0.5], [0.7, 0.5], [0.5, 0.68], [0.5, 0.32],
  [0.42, 0.6], [0.58, 0.4], [0.45, 0.5], [0.55, 0.5],
];

/** Run a gate body; a thrown error fails that gate instead of skipping the run. */
async function guarded(name, fn) {
  try {
    const result = await fn();
    gate(name, !!(result && result.pass), result && result.detail);
  } catch (e) {
    gate(name, false, `error: ${String(e && e.message ? e.message : e).slice(0, 220)}`);
  }
}

/** Read a labelled integer out of HUD text, in either label/number order. */
function pickNumber(text, label) {
  const t = String(text || '').replace(/\s+/g, ' ');
  const forward = new RegExp(`${label}[^0-9-]{0,16}(-?\\d[\\d,]*)`, 'i');
  const backward = new RegExp(`(-?\\d[\\d,]*)[^0-9]{0,16}${label}`, 'i');
  for (const re of [forward, backward]) {
    const m = t.match(re);
    if (m) return Number(m[1].replace(/,/g, ''));
  }
  return null;
}

/** Read the POP used/cap pair, preferring the text next to the POP label. */
function pickPop(text) {
  const t = String(text || '').replace(/\s+/g, ' ');
  const at = t.search(/pop/i);
  const segments = at >= 0 ? [t.slice(at, at + 32), t.slice(Math.max(0, at - 24), at + 4)] : [];
  segments.push(t);
  for (const seg of segments) {
    const m = seg.match(/(\d+)\s*\/\s*(\d+)/);
    if (m) return { used: Number(m[1]), cap: Number(m[2]) };
  }
  return null;
}

const isTrainControl = (c) => /train|recruit|queue|produce/i.test(`${c.action || ''} ${c.name || ''}`) || c.action === '0';
const isBuildControl = (c) => /build|place|construct/i.test(`${c.action || ''} ${c.name || ''}`) || c.action === '1';
const isAdvanceControl = (c) => /advance/i.test(`${c.action || ''} ${c.name || ''}`) || c.action === '2';
const isResetControl = (c) => /reset|showcase/i.test(`${c.action || ''} ${c.name || ''}`);
const namedControl = (controls, re) => controls.find((c) => c.visible && !c.disabled && re.test(`${c.name || ''} ${c.action || ''} ${c.kind || ''}`)) || null;

/** The DOM HUD bar (#hud-bar) and __APP state, read in the same frame. */
async function hudSnapshot(page) {
  return page.evaluate(() => {
    const st = window.__APP.getState();
    const viewport = { vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio };
    const bar = document.querySelector('#hud-bar');
    if (!bar) return { st, present: false, ...viewport };
    const cs = getComputedStyle(bar);
    const r = bar.getBoundingClientRect();
    const shown = (el) => {
      const s = getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.01;
    };
    const controls = [...bar.querySelectorAll('button, [role="button"], [data-action]')].map((el) => {
      const b = el.getBoundingClientRect();
      return {
        id: el.id || null,
        action: el.getAttribute('data-action'),
        kind: el.getAttribute('data-kind'),
        name: `${el.getAttribute('aria-label') || ''} ${el.textContent || ''}`.replace(/\s+/g, ' ').trim().slice(0, 60),
        disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true' || el.classList.contains('disabled'),
        visible: shown(el),
        x: b.x, y: b.y, w: b.width, h: b.height, right: b.right, bottom: b.bottom,
      };
    });
    const readText = (el) => `${el.innerText || el.textContent || ''}`.replace(/\s+/g, ' ').trim();
    const ageEl = bar.querySelector('#hud-age, #age-label, [data-role="age"], [data-age]');
    const resEl = bar.querySelector('#hud-resources, #hud-alloy, [data-role="resources"], [data-cluster="resources"]');
    const progressEl = bar.querySelector('progress, [role="progressbar"], [data-role="age-progress"], #age-progress');
    let progress = null;
    if (progressEl) {
      const b = progressEl.getBoundingClientRect();
      const value = progressEl.value !== undefined && progressEl.value !== '' ? Number(progressEl.value) : (progressEl.getAttribute('aria-valuenow') !== null ? Number(progressEl.getAttribute('aria-valuenow')) : null);
      const max = progressEl.max !== undefined && progressEl.max !== '' ? Number(progressEl.max) : (progressEl.getAttribute('aria-valuemax') !== null ? Number(progressEl.getAttribute('aria-valuemax')) : null);
      const inner = progressEl.firstElementChild;
      progress = {
        tag: progressEl.tagName.toLowerCase(),
        visible: shown(progressEl) && b.width > 0 && b.height > 0,
        value: Number.isFinite(value) ? value : null,
        max: Number.isFinite(max) ? max : null,
        ratio: inner && b.width > 0 ? inner.getBoundingClientRect().width / b.width : null,
        w: b.width, h: b.height,
      };
    }
    return {
      st, present: true, ...viewport,
      display: cs.display, visibility: cs.visibility, opacity: Number(cs.opacity), hiddenAttr: bar.hasAttribute('hidden'),
      x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom,
      text: readText(bar).slice(0, 500),
      ageText: ageEl ? readText(ageEl).slice(0, 80) : null,
      resText: resEl ? readText(resEl).slice(0, 160) : null,
      controls, progress,
    };
  });
}

/** Inject or clear the four safe-area custom properties the page reads. */
async function setSafeInsets(page, px) {
  await page.evaluate((value) => {
    const style = document.documentElement.style;
    for (const name of ['--safe-t', '--safe-r', '--safe-b', '--safe-l']) {
      if (value === null) style.removeProperty(name);
      else style.setProperty(name, `${value}px`);
    }
    window.dispatchEvent(new Event('resize'));
  }, px);
  await page.waitForTimeout(250);
}

/** A real click (or tap) on the centre of a HUD control. */
async function clickControl(page, control) {
  const x = control.x + control.w / 2;
  const y = control.y + control.h / 2;
  if (TOUCH) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await page.waitForTimeout(220);
}

/** A real click (or tap) on a canvas point given as canvas fractions. */
async function clickCanvas(page, box, fx, fy) {
  if (!box) return;
  const x = box.x + box.width * fx;
  const y = box.y + box.height * fy;
  if (TOUCH) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await page.waitForTimeout(TOUCH ? 300 : 200);
}

/** A real tap on an absolute CSS point, using the same input path as clickCanvas. */
async function clickPoint(page, x, y) {
  if (TOUCH) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await page.waitForTimeout(TOUCH ? 300 : 200);
}

/** Portrait/ipad playability (MATCH_SPEC §8): canvas visible and above the HUD
 *  bar, bar visible with >=44x44 px targets, camera buttons intact, no scroll. */
async function playableLayout(page) {
  const P = await layout(page);
  const snap = await hudSnapshot(page);
  const c = P.canvasCss;
  const notice = P.notice;
  const noticeUp = !!notice && notice.display !== 'none' && notice.w > 2 && notice.h > 2;
  const canvasOk = !!c && c.w > 0 && c.h > 0 && c.x >= -0.5 && c.y >= -0.5 && c.right <= P.innerWidth + 0.5 && c.bottom <= P.innerHeight + 0.5;
  const widthOk = !!c && c.w >= P.innerWidth * 0.95 - 0.5;
  const barOk = !!snap.present && snap.display !== 'none' && snap.visibility !== 'hidden' && snap.opacity > 0.5 && !snap.hiddenAttr && snap.w > 0 && snap.h >= 44 &&
    snap.x >= -0.5 && snap.right <= P.innerWidth + 0.5 && snap.bottom <= P.innerHeight + 0.5;
  const canvasAboveBar = !c || !snap.present ? true : c.bottom <= snap.y + 0.5;
  const hudControls = snap.present ? snap.controls.filter((x) => x.visible) : [];
  const smallHud = hudControls.filter((x) => x.w < 44 || x.h < 44);
  const smallNav = P.buttons.filter((b) => b.w < 44 || b.h < 44);
  const navOutside = P.buttons.filter((b) => b.x < -0.5 || b.y < -0.5 || b.right > P.innerWidth + 0.5 || b.bottom > P.innerHeight + 0.5);
  const noScroll = P.docWidth <= P.clientWidth + 1 && P.docHeight <= P.clientHeight + 1 && P.scrollX === 0 && P.scrollY === 0;
  const pass = canvasOk && widthOk && barOk && canvasAboveBar && smallHud.length === 0 && smallNav.length === 0 && navOutside.length === 0 && noScroll && !noticeUp;
  const detail = [
    `canvas=${c ? `${c.w.toFixed(0)}x${c.h.toFixed(0)}@${c.x.toFixed(0)},${c.y.toFixed(0)}` : 'missing'}`,
    `bar=${snap.present ? `${snap.w.toFixed(0)}x${snap.h.toFixed(0)}@y${snap.y.toFixed(0)} controls=${hudControls.length}` : 'missing'}`,
    `smallHud=${smallHud.map((x) => x.name || x.id || x.action || '?').join(',') || 'none'}`,
    `navSmall=${smallNav.map((b) => b.id).join(',') || 'none'}`,
    `navOutside=${navOutside.map((b) => b.id).join(',') || 'none'}`,
    `doc=${P.docWidth}x${P.docHeight}/${P.clientWidth}x${P.clientHeight}`,
    `notice=${noticeUp ? 'UP' : 'hidden'}`,
  ].join(' ');
  return { pass, detail, snap, P };
}

/** hud-bar gate body (MATCH_SPEC §7): visible, >=44 px tall, inside the viewport
 *  and the safe area, and never covering the camera buttons. */
async function checkHudBar(page) {
  const snap = await hudSnapshot(page);
  if (!snap.present) return { pass: false, detail: 'no #hud-bar' };
  const visible = snap.display !== 'none' && snap.visibility !== 'hidden' && snap.opacity > 0.5 && !snap.hiddenAttr && snap.w > 0 && snap.h > 0;
  const inside = snap.x >= -0.5 && snap.y >= -0.5 && snap.right <= snap.vw + 0.5 && snap.bottom <= snap.vh + 0.5;
  const tall = snap.h >= 44;
  const hits = await page.evaluate(() => [...document.querySelectorAll('nav button')].map((b) => {
    const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { id: b.id, ok: !!el && (el === b || b.contains(el)) };
  }));
  const covered = hits.filter((h) => !h.ok).map((h) => h.id);
  await setSafeInsets(page, 44);
  const inset = await hudSnapshot(page);
  await setSafeInsets(page, null);
  const insetOk = inset.present && inset.x >= 43.5 && inset.right <= inset.vw - 43.5 && inset.bottom <= inset.vh - 43.5 && inset.h >= 44;
  const pass = visible && inside && tall && covered.length === 0 && insetOk;
  return {
    pass,
    detail: `bar=${snap.w.toFixed(0)}x${snap.h.toFixed(0)}@${snap.x.toFixed(0)},${snap.y.toFixed(0)} visible=${visible} tall>=44=${tall} covers=${covered.join(',') || 'none'} ` +
      `insets44=${inset.present ? `${inset.x.toFixed(0)}..${inset.right.toFixed(0)} of ${inset.vw}, h=${inset.h.toFixed(0)}` : 'missing'}`,
  };
}

/** hud-resources gate body (MATCH_SPEC §9): ALLOY/CHARGE/POP text equals
 *  __APP.getState(). Retries a few frames so a one-frame skew is not a failure. */
async function checkHudResources(page) {
  let detail = 'no #hud-bar';
  for (let attempt = 0; attempt < 4; attempt++) {
    const snap = await hudSnapshot(page);
    if (!snap.present) return { pass: false, detail: 'no #hud-bar' };
    const st = snap.st;
    const alloy = pickNumber(snap.resText, 'ALLOY') ?? pickNumber(snap.text, 'ALLOY');
    const charge = pickNumber(snap.resText, 'CHARGE') ?? pickNumber(snap.text, 'CHARGE');
    const pop = pickPop(snap.resText) || pickPop(snap.text);
    detail = `bar alloy=${alloy} charge=${charge} pop=${pop ? `${pop.used}/${pop.cap}` : 'n/a'} | state alloy=${st.alloy} charge=${st.charge} pop=${st.popUsed}/${st.popCap}`;
    const pass = alloy !== null && charge !== null && !!pop &&
      alloy === st.alloy && charge === st.charge && pop.used === st.popUsed && pop.cap === st.popCap;
    if (pass) return { pass: true, detail };
    await page.waitForTimeout(200);
  }
  return { pass: false, detail };
}

/** hud-age gate body (MATCH_SPEC §9): the age label equals getState().age
 *  (sim_age()) and the progress bar is coherent with ageProgress. */
async function checkHudAge(page) {
  const snap = await hudSnapshot(page);
  if (!snap.present) return { pass: false, detail: 'no #hud-bar' };
  const st = snap.st;
  const expected = AGE_NAMES[st.age] || null;
  const dedicated = !!snap.ageText;
  const label = (dedicated ? snap.ageText : snap.text || '').toUpperCase();
  const named = !!expected && label.includes(expected.toUpperCase());
  const others = dedicated ? AGE_NAMES.filter((name, i) => i !== st.age && label.includes(name.toUpperCase())) : [];
  const p = typeof st.ageProgress === 'number' ? st.ageProgress : null;
  const bar = snap.progress;
  const ratio = bar ? (bar.ratio !== null ? bar.ratio : (bar.value !== null && bar.max ? bar.value / bar.max : null)) : null;
  let progressOk = true;
  let progressDetail = 'absent';
  if (p === null) {
    progressOk = false;
    progressDetail = 'state has no ageProgress';
  } else if (p >= 1) {
    progressOk = !bar || !bar.visible || ratio === null || ratio >= 0.9;
    progressDetail = bar ? `${bar.visible ? 'visible' : 'hidden'} ratio=${ratio === null ? 'n/a' : ratio.toFixed(2)}` : 'absent';
  } else {
    progressOk = !!bar && bar.visible && (ratio === null || Math.abs(ratio - p) <= 0.25);
    progressDetail = `visible=${bar ? bar.visible : false} ratio=${ratio === null ? 'n/a' : ratio.toFixed(2)}`;
  }
  const pass = named && others.length === 0 && progressOk;
  return {
    pass,
    detail: `label="${(dedicated ? snap.ageText : '').slice(0, 40)}" state.age=${st.age}(${expected || '?'}) otherAges=${others.join(',') || 'none'} ` +
      `ageProgress=${p} progress=${progressDetail}`,
  };
}

/** Roster rows from the shipped wasm (MATCH_SPEC §3): kind, faction, tier,
 *  klass, producer, alloy, charge, pop. Null when the build predates wave 2. */
async function wasmRoster(faction) {
  const bytes = await readFile(join(ROOT, 'sim.wasm')).catch(() => null);
  if (!bytes) return null;
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const sim = instance.exports;
  if (typeof sim.sim_match_init !== 'function' || typeof sim.sim_roster_ptr !== 'function' || typeof sim.sim_roster_count !== 'function') return null;
  sim.sim_match_init(SEED_U32, faction >>> 0);
  const count = sim.sim_roster_count();
  const rows = new Float32Array(sim.memory.buffer, sim.sim_roster_ptr(), count * 8);
  const out = [];
  for (let i = 0; i < count; i++) {
    const r = rows.subarray(i * 8, i * 8 + 8);
    out.push({ kind: r[0], faction: r[1], tier: r[2], klass: r[3], producer: r[4], alloy: r[5], charge: r[6], pop: r[7] });
  }
  return out;
}

/** One fresh match run for the determinism gate. The whole command stream runs
 *  inside a single evaluate, so no rAF tick can interleave between startMatch
 *  and the final read; the hash is of the normalized __APP.getState(). */
async function matchRunHash(browser, url, faction) {
  const { page, context, errors } = await newPageWith(browser, url);
  let out;
  try {
    await waitReady(page).catch(() => {});
    const hasApi = await page.evaluate(() => {
      const a = window.__APP || {};
      return typeof a.startMatch === 'function' && typeof a.command === 'function' &&
        typeof a.fastForward === 'function' && typeof a.getState === 'function';
    });
    const appError = await page.evaluate(() => (window.__APP && window.__APP.error) || null);
    if (!hasApi) out = { error: 'window.__APP.startMatch/command/fastForward/getState missing' };
    else if (appError) out = { error: `app error: ${appError}` };
    else {
      out = await page.evaluate((f) => {
        window.__APP.startMatch(f);
        window.__APP.command(3, 0, 0);          // cancel: rejected at a fresh start
        window.__APP.command(2, 0, 0);          // advance age: affordable at the standard start
        window.__APP.fastForward(41);           // the 40 s advance completes
        window.__APP.command(3, 0, 0);
        window.__APP.fastForward(5);
        const s = window.__APP.getState();
        const norm = {
          mode: s.mode, player: s.player, age: s.age,
          ageProgress: typeof s.ageProgress === 'number' ? Math.round(s.ageProgress * 1e4) / 1e4 : null,
          popUsed: s.popUsed, popCap: s.popCap, alloy: s.alloy, charge: s.charge,
          entityCount: s.entityCount, selectedKind: s.selectedKind ?? null,
          actions: Array.isArray(s.actions) ? [...s.actions].sort((x, y) => x - y) : null,
        };
        const str = JSON.stringify(norm);
        let hash = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
          hash ^= str.charCodeAt(i);
          hash = Math.imul(hash, 0x01000193) >>> 0;
        }
        return { hash: hash.toString(16).padStart(8, '0'), str, entityCount: s.entityCount, age: s.age };
      }, faction);
    }
  } catch (e) {
    out = { error: `error: ${String(e && e.message ? e.message : e).slice(0, 220)}` };
  } finally {
    await context.close();
  }
  out.errors = errors;
  return out;
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

const results = { gates: [], shots: [], errors: [], viewport: { width: WIDTH, height: HEIGHT, dsf: DSF, touch: TOUCH, portrait: PORTRAIT, ipad: IPAD } };
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
    const { page, context, errors } = await newPage(browser, baseUrl);
    await waitReady(page);
    // Advance to the canonical moment (t=108s) so the shot shows a built-up world.
    await settle(page, SETTLE);
    const s0 = await state(page);
    gate('boots-ready', true, `entities=${s0.entityCount}`);
    // A saturated instance list silently drops late draws (outer rim, backdrop,
    // ambient). Losing content is easy to miss; this gate makes it loud.
    gate('instance-budget', !(s0.frameStats && s0.frameStats.saturated === true),
      s0.frameStats ? `triangles=${s0.frameStats.triangles} saturated=${s0.frameStats.saturated === true}` : 'no frame stats');

    if (PORTRAIT) {
      // ---- portrait gates (before rotation) ----------------------------------
      // Portrait is playable (MATCH_SPEC §8): canvas visible above the HUD bar,
      // bar visible with >=44x44 px targets, no scroll. The rotate notice is gone
      // for playable viewports and survives only as the no-WebGPU error path.
      const L = await playableLayout(page);
      gate('portrait-playable', L.pass, L.detail);
      if (IPAD) {
        const V = await page.evaluate(() => ({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio }));
        gate('ipad-portrait', V.w === 768 && V.h === 1024 && Math.abs(V.dpr - 2) < 1e-6 && L.pass,
          `viewport=${V.w}x${V.h} dpr=${V.dpr} · ${L.detail}`);
      }
      const P = L.P;
      gate('no-scroll', P.docWidth <= P.clientWidth + 1 && P.docHeight <= P.clientHeight + 1 && P.scrollX === 0 && P.scrollY === 0,
        `portrait doc=${P.docWidth}x${P.docHeight} client=${P.clientWidth}x${P.clientHeight}`);
      await page.screenshot({ path: join(OUT, 'shot-portrait.png') });
      results.shots.push('shot-portrait.png');
      // Rotate the device: the landscape layout and the controls must return.
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForTimeout(600);
      const R = await layout(page);
      const noticeHidden = !R.notice || R.notice.display === 'none';
      const canvasOk = !!R.canvasCss && R.canvasCss.right <= R.innerWidth + 0.5 && R.canvasCss.bottom <= R.innerHeight + 0.5;
      gate('portrait-clears-on-rotate', noticeHidden && canvasOk && R.buttons.every((b) => b.w >= 44 && b.h >= 44),
        `notice=${R.notice ? R.notice.display : 'none'} canvas=${R.canvasCss ? `${R.canvasCss.w.toFixed(0)}x${R.canvasCss.h.toFixed(0)}` : '-'} btns=${R.buttons.map((b) => `${b.w.toFixed(0)}x${b.h.toFixed(0)}`).join(' ')}`);
      await page.screenshot({ path: join(OUT, 'shot-portrait-rotated.png') });
      results.shots.push('shot-portrait-rotated.png');
    }

    if (TOUCH) {
      // ---- mobile layout gates (landscape) -----------------------------------
      const L = await layout(page);
      if (!PORTRAIT) {
        gate('touch-layout', L.bodyClass.includes('touch') && s0.touch === true, `body="${L.bodyClass}" touch=${s0.touch}`);
        gate('no-scroll', L.docWidth <= L.clientWidth + 1 && L.docHeight <= L.clientHeight + 1 && L.scrollX === 0 && L.scrollY === 0,
          `doc=${L.docWidth}x${L.docHeight} client=${L.clientWidth}x${L.clientHeight} scroll=${L.scrollX},${L.scrollY}`);
      }
      const c = L.canvasCss;
      const aspect = c ? c.w / c.h : 0;
      gate('canvas-fits', !!c && c.x >= -0.5 && c.y >= -0.5 && c.right <= L.innerWidth + 0.5 && c.bottom <= L.innerHeight + 0.5 && Math.abs(aspect - 16 / 9) < 0.01 && c.backingW === 960 && c.backingH === 540,
        c ? `rect=${c.w.toFixed(1)}x${c.h.toFixed(1)}@${c.x.toFixed(1)},${c.y.toFixed(1)} aspect=${aspect.toFixed(3)} backing=${c.backingW}x${c.backingH}` : 'no canvas');

      const outside = L.buttons.filter((b) => b.x < -0.5 || b.y < -0.5 || b.right > L.innerWidth + 0.5 || b.bottom > L.innerHeight + 0.5);
      gate('hud-unclipped', !!c && c.x >= -0.5 && c.right <= L.innerWidth + 0.5 && outside.length === 0,
        `buttons=${L.buttons.length} outside=${outside.map((b) => b.id).join(',') || 'none'}`);

      const small = L.buttons.filter((b) => b.w < 44 || b.h < 44);
      const overlap = [];
      for (let i = 0; i < L.buttons.length; i++) {
        for (let j = i + 1; j < L.buttons.length; j++) {
          const a = L.buttons[i], b = L.buttons[j];
          if (a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom) overlap.push(`${a.id}/${b.id}`);
        }
      }
      gate('touch-targets-44', L.buttons.length === 4 && small.length === 0 && overlap.length === 0,
        `sizes=${L.buttons.map((b) => `${b.w.toFixed(0)}x${b.h.toFixed(0)}`).join(' ')} overlap=${overlap.join(',') || 'none'}`);

      // Simulated notch: the harness sets the CSS variables the page reads.
      await page.evaluate(() => {
        const r = document.documentElement.style;
        r.setProperty('--safe-l', '44px');
        r.setProperty('--safe-r', '44px');
        window.dispatchEvent(new Event('resize'));
      });
      await page.waitForTimeout(250);
      const LS = await layout(page);
      const insetOk = LS.canvasCss.x >= 43.5 && LS.canvasCss.right <= LS.innerWidth - 43.5 &&
        LS.buttons.every((b) => b.x >= 43.5 && b.right <= LS.innerWidth - 43.5);
      gate('safe-area-respected', insetOk,
        `canvas=${LS.canvasCss.x.toFixed(1)}..${LS.canvasCss.right.toFixed(1)} firstBtn=${LS.buttons[0] ? LS.buttons[0].x.toFixed(1) : '-'} lastBtn=${LS.buttons[LS.buttons.length - 1] ? LS.buttons[LS.buttons.length - 1].right.toFixed(1) : '-'}`);
      await page.evaluate(() => {
        const r = document.documentElement.style;
        r.removeProperty('--safe-l');
        r.removeProperty('--safe-r');
        window.dispatchEvent(new Event('resize'));
      });
      await page.waitForTimeout(200);

      // ---- touch interaction gates -------------------------------------------
      const bootSel = (await state(page)).selected;
      const yaw0 = (await state(page)).yawSteps;
      if (L.buttons.length === 4) {
        await tapAt(page, L.buttons[1].x + L.buttons[1].w / 2, L.buttons[1].y + L.buttons[1].h / 2);
      }
      const yaw1 = (await state(page)).yawSteps;
      gate('rotate-touch', yaw1 === (yaw0 + 1) % 4, `${yaw0} -> ${yaw1}`);

      const zA = (await state(page)).zoom;
      if (L.buttons.length === 4) {
        await tapAt(page, L.buttons[3].x + L.buttons[3].w / 2, L.buttons[3].y + L.buttons[3].h / 2);
      }
      const zB = (await state(page)).zoom;
      if (L.buttons.length === 4) {
        await tapAt(page, L.buttons[2].x + L.buttons[2].w / 2, L.buttons[2].y + L.buttons[2].h / 2);
      }
      const zC = (await state(page)).zoom;
      gate('zoom-touch', zoomIndex(zB) === Math.min(3, zoomIndex(zA) + 1) && Math.abs(zC - zA) < 1e-6, `zoom ${zA} -> ${zB} -> ${zC}`);

      const box = await page.locator('canvas#world').boundingBox();
      const spots = [[0.5, 0.5], [0.5, 0.55], [0.45, 0.5], [0.55, 0.5], [0.5, 0.62], [0.4, 0.45], [0.6, 0.58], [0.35, 0.55], [0.65, 0.45]];
      // 1. A tap on empty terrain clears the selection. The sim boots with a
      // default selection, so this gate is what proves touch events arrive.
      let cleared = 'no-canvas';
      for (const [fx, fy] of [[0.04, 0.96], [0.96, 0.96], [0.5, 0.97]]) {
        if (!box) break;
        await tapAt(page, box.x + box.width * fx, box.y + box.height * fy);
        cleared = (await state(page)).selected;
        if (cleared === null) break;
      }
      gate('tap-clears', cleared === null, `boot=${bootSel} afterClear=${cleared}`);

      // 2. A tap on the settlement selects a unit or building.
      let sel = null;
      for (const [fx, fy] of spots) {
        if (!box) break;
        await tapAt(page, box.x + box.width * fx, box.y + box.height * fy);
        sel = (await state(page)).selected;
        if (sel !== null && sel !== undefined) break;
      }
      gate('tap-select', sel !== null && sel !== undefined, `selected=${sel}`);
      await page.screenshot({ path: join(OUT, 'shot-selected.png') });
      results.shots.push('shot-selected.png');

      // 3. Two-finger pinch: exactly one zoom step in, and no selection change.
      const zb = (await state(page)).zoom;
      const selBeforePinch = (await state(page)).selected;
      const cx = box ? box.x + box.width / 2 : WIDTH / 2;
      const cy = box ? box.y + box.height * 0.62 : HEIGHT / 2;
      await pinch(page, context, cx, cy, 30, 45);
      await page.waitForTimeout(350);
      const za = (await state(page)).zoom;
      const selAfterPinch = (await state(page)).selected;
      gate('pinch-zoom', zoomIndex(za) === Math.min(3, zoomIndex(zb) + 1), `zoom ${zb} -> ${za} (idx ${zoomIndex(zb)} -> ${zoomIndex(za)})`);
      gate('pinch-keeps-selection', selAfterPinch === selBeforePinch, `${selBeforePinch} -> ${selAfterPinch}`);
      await page.screenshot({ path: join(OUT, 'shot-pinch.png') });
      results.shots.push('shot-pinch.png');

      // 4. A tap after a pinch still clears and still selects.
      let clearAfter = (await state(page)).selected;
      for (const [fx, fy] of [[0.04, 0.96], [0.96, 0.96], [0.5, 0.97]]) {
        if (!box) break;
        await tapAt(page, box.x + box.width * fx, box.y + box.height * fy);
        clearAfter = (await state(page)).selected;
        if (clearAfter === null) break;
      }
      let sel2 = null;
      for (const [fx, fy] of spots) {
        if (!box) break;
        await tapAt(page, box.x + box.width * fx, box.y + box.height * fy);
        sel2 = (await state(page)).selected;
        if (sel2 !== null && sel2 !== undefined) break;
      }
      gate('tap-after-pinch', clearAfter === null && sel2 !== null && sel2 !== undefined, `clear=${clearAfter} select=${sel2}`);

      // Back to yaw 0 and the default zoom for the evidence frame (one touch
      // tap each: the rotate gate stepped yaw once, the pinch stepped zoom once).
      if (L.buttons.length === 4) {
        const b2 = L.buttons[2];
        if (zoomIndex((await state(page)).zoom) > 1) await tapAt(page, b2.x + b2.w / 2, b2.y + b2.h / 2);
        const b0 = L.buttons[0];
        if ((await state(page)).yawSteps !== 0) await tapAt(page, b0.x + b0.w / 2, b0.y + b0.h / 2);
      }
      await page.screenshot({ path: join(OUT, 'shot-main.png') });
      results.shots.push('shot-main.png');
      await page.screenshot({ path: join(OUT, 'shot-rotated.png') });
      results.shots.push('shot-rotated.png');

      const fps = await sampleFps(page, FPS_SECONDS);
      results.fps = fps;
      gate('fps>=59-vsync-locked', fps.fps >= MIN_FPS - 1.0 && fps.p95_ms <= 20,
        `fps=${fps.fps.toFixed(1)} p95=${fps.p95_ms.toFixed(1)}ms max=${fps.max_ms.toFixed(1)}ms`);
    } else {
      // ---- desktop gates (unchanged) ----------------------------------------
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
      // Restore the camera so all later interaction gates use the canonical
      // yaw-0 screen projection rather than inheriting this visual probe.
      await page.click('#rotate-left');
      await page.waitForTimeout(450);

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
    }

    // --- wave 2: match, ages, HUD (MATCH_SPEC §7-§10) -----------------------
    // Driven only through window.__APP (startMatch/resetShowcase/command/
    // fastForward/getState) plus real DOM clicks. Each gate fails without
    // throwing, so a build that predates the integration still reports every
    // gate name instead of skipping the rest of the run.
    const matchApi = await page.evaluate((keys) => {
      const app = window.__APP || {};
      return Object.fromEntries(keys.map((k) => [k, typeof app[k]]));
    }, MATCH_APP_API);
    const missingApi = MATCH_APP_API.filter((k) => matchApi[k] !== 'function');
    if (missingApi.length) {
      // Report every match gate name. The API-driven gates fail on the missing
      // surface; the bar gates are DOM-only, so they still report the real UI
      // state instead (a stale build has no #hud-bar either).
      const why = `window.__APP.${missingApi[0]} is ${matchApi[missingApi[0]]}, not a function`;
      const apiDriven = new Set(['hud-skirmish-entry', 'match-boot', 'age-advance', 'train-unit', 'build-site']);
      const domDriven = { 'hud-bar': () => checkHudBar(page), 'hud-resources': () => checkHudResources(page), 'hud-age': () => checkHudAge(page) };
      for (const name of MATCH_GATE_NAMES) {
        if (apiDriven.has(name)) gate(name, false, why);
        else await guarded(name, domDriven[name]);
      }
    } else {
      const canvasBox = await page.locator('canvas#world').boundingBox();
      const roster = await wasmRoster(0).catch(() => null);
      const freshMatch = async (faction = 0) => {
        await page.evaluate((f) => window.__APP.startMatch(f), faction);
        await page.waitForTimeout(450);
      };
      const selectFirst = async (matcher, kinds = []) => {
        // Prefer one exact tap on a live position the app reports for the kind
        // the gate needs (read-only probe, no mutation). The point comes from
        // the same projection the renderer submits, so no guessed fractions.
        const player = (await state(page)).player ?? 0;
        for (const faction of [player, 1 - player]) {
          for (const kind of kinds) {
            const pt = await page.evaluate(([k, f]) => {
              const probe = window.__APP.entityScreen;
              return typeof probe === 'function' ? probe(k, f) : null;
            }, [kind, faction]);
            if (!pt) continue;
            await clickPoint(page, pt.x, pt.y);
            const snap = await hudSnapshot(page);
            const found = snap.controls.filter((c) => c.visible && matcher(c));
            if (found.length) {
              return { snap, found, how: `exact tap kind ${kind} f${faction} @${pt.x.toFixed(0)},${pt.y.toFixed(0)}` };
            }
          }
        }
        // Fallback for builds that predate the probe: scan the known spots.
        for (const [fx, fy] of MATCH_SPOTS) {
          await clickCanvas(page, canvasBox, fx, fy);
          const snap = await hudSnapshot(page);
          const found = snap.controls.filter((c) => c.visible && matcher(c));
          if (found.length) return { snap, found, how: `spot scan ${fx},${fy}` };
        }
        return null;
      };

      // Showcase mode (mode 0) offers the SKIRMISH entry (§7): two faction
      // buttons that start a match; the app never boots straight into one.
      await guarded('hud-skirmish-entry', async () => {
        await page.evaluate(() => window.__APP.resetShowcase());
        await page.waitForTimeout(500);
        const show = await hudSnapshot(page);
        if (!show.present) return { pass: false, detail: 'no #hud-bar' };
        const startButton = (snap, re) => namedControl(snap.controls, re);
        const dawnward = startButton(show, /dawnward/i);
        const cinderwake = startButton(show, /cinderwake/i);
        const start = async (button) => {
          await clickControl(page, button);
          await page.evaluate(() => window.__APP.fastForward(2));
          await page.waitForTimeout(150);
          return state(page);
        };
        const afterDawnward = dawnward ? await start(dawnward) : null;
        await page.evaluate(() => window.__APP.resetShowcase());
        await page.waitForTimeout(450);
        const back = await hudSnapshot(page);
        const cinderwakeAgain = startButton(back, /cinderwake/i) || cinderwake;
        const afterCinderwake = cinderwakeAgain ? await start(cinderwakeAgain) : null;
        await page.evaluate(() => window.__APP.resetShowcase());
        await page.waitForTimeout(350);
        const named = /skirmish/i.test(show.text || '');
        const sized = [dawnward, cinderwake].filter((c) => c && (c.w < 44 || c.h < 44)).length;
        const pass = show.st.mode === 0 && named && !!dawnward && !!cinderwake && sized === 0 &&
          !!afterDawnward && afterDawnward.mode === 1 && afterDawnward.player === 0 &&
          !!afterCinderwake && afterCinderwake.mode === 1 && afterCinderwake.player === 1;
        return {
          pass,
          detail: `showcaseMode=${show.st.mode} skirmishLabel=${named} dawnward=${dawnward ? `${dawnward.w.toFixed(0)}x${dawnward.h.toFixed(0)}` : 'missing'} ` +
            `cinderwake=${cinderwake ? `${cinderwake.w.toFixed(0)}x${cinderwake.h.toFixed(0)}` : 'missing'} ` +
            `dawnwardClick=${afterDawnward ? `mode ${afterDawnward.mode} player ${afterDawnward.player}` : 'n/a'} reset->mode ${back.st.mode} ` +
            `cinderwakeClick=${afterCinderwake ? `mode ${afterCinderwake.mode} player ${afterCinderwake.player}` : 'n/a'}`,
        };
      });

      // match-boot: startMatch(f) gives the standard start package (§6), match
      // mode shows the faction name and a RESET control, and resetShowcase()
      // returns to mode 0 (§7, §10).
      await guarded('match-boot', async () => {
        const s = await page.evaluate((f) => {
          window.__APP.startMatch(f);
          return window.__APP.getState();
        }, 0);
        await page.waitForTimeout(450);
        const snap = await hudSnapshot(page);
        const reset = snap.controls.filter((c) => c.visible && isResetControl(c))[0] || null;
        const factionLabel = /dawnward/i.test(snap.text || '');
        await page.evaluate(() => window.__APP.resetShowcase());
        await page.waitForTimeout(400);
        const back = await state(page);
        const startPackage = s.mode === 1 && s.player === 0 && s.age === 0 &&
          s.popUsed === 11 && s.popCap === 15 && s.alloy === 80 && s.charge === 40 && s.entityCount >= 13;
        const pass = startPackage && !!reset && factionLabel && back.mode === 0;
        return {
          pass,
          detail: `mode=${s.mode} player=${s.player} age=${s.age} alloy=${s.alloy} charge=${s.charge} pop=${s.popUsed}/${s.popCap} entities=${s.entityCount} ` +
            `(standard start 80/40, 11/15, 3 buildings + 10 units) factionLabel=${factionLabel} ` +
            `resetControl=${reset ? `"${(reset.name || reset.action || '').slice(0, 28)}"` : 'missing'} resetShowcase->mode ${back.mode}`,
        };
      });

      await freshMatch(0);
      await page.screenshot({ path: join(OUT, 'shot-match-hud.png') });
      results.shots.push('shot-match-hud.png');

      await guarded('hud-bar', () => checkHudBar(page));

      await guarded('hud-resources', () => checkHudResources(page));
      await guarded('hud-age', () => checkHudAge(page));

      // age-advance: a real click on ADVANCE deducts the tier cost and, after
      // the advance settles, raises the age (§4, §9).
      await guarded('age-advance', async () => {
        await freshMatch(0);
        const snap = await hudSnapshot(page);
        const advance = snap.controls.filter((c) => c.visible && !c.disabled && isAdvanceControl(c))[0] || null;
        if (!advance) {
          return { pass: false, detail: `no ADVANCE control in the bar (controls=${snap.controls.map((c) => c.name || c.action).join('|') || 'none'})` };
        }
        const cost = AGE_COSTS[snap.st.age] || null;
        const before0 = snap.st;
        await page.waitForTimeout(400);
        const before = await state(page);
        const drift = { alloy: before.alloy - before0.alloy, charge: before.charge - before0.charge };
        await clickControl(page, advance);
        let mid = await state(page);
        for (let i = 0; i < 3; i++) {
          if (cost && Math.abs(before.alloy - mid.alloy - cost[0]) <= 1 && Math.abs(before.charge - mid.charge - cost[1]) <= 1) break;
          await page.waitForTimeout(90);
          mid = await state(page);
        }
        const drop = { alloy: before.alloy - mid.alloy, charge: before.charge - mid.charge };
        // A real click/readback can straddle the match's deterministic one-Charge
        // generation tick. Preserve exact cost checking while allowing that one
        // earned point to offset the observed drop.
        const tol = { alloy: Math.max(1, Math.abs(drift.alloy)), charge: Math.max(1, Math.abs(drift.charge)) };
        const deducted = cost
          ? Math.abs(drop.alloy - cost[0]) <= tol.alloy && Math.abs(drop.charge - cost[1]) <= tol.charge && drop.alloy + drop.charge > 0
          : drop.alloy + drop.charge > tol.alloy + tol.charge;
        await page.evaluate(() => window.__APP.fastForward(45));
        await page.waitForTimeout(400);
        const after = await state(page);
        const snapAfter = await hudSnapshot(page);
        const label = `${snapAfter.ageText || snapAfter.text || ''}`.toUpperCase();
        const labelOk = !!AGE_NAMES[after.age] && label.includes(AGE_NAMES[after.age].toUpperCase());
        const raised = after.age === before.age + 1;
        return {
          pass: deducted && raised && labelOk,
          detail: `cost=${cost ? `${cost[0]}a/${cost[1]}c` : 'n/a'} drop=${drop.alloy}a/${drop.charge}c drift=${drift.alloy}/${drift.charge} ` +
            `age ${before.age}->${after.age} label=${AGE_NAMES[after.age] || '?'} labelShown=${labelOk}`,
        };
      });

      // train-unit: a real click on a train action lowers resources (and
      // population) immediately and raises the entity count after the spawn.
      await guarded('train-unit', async () => {
        await freshMatch(0);
        const found = await selectFirst((c) => c.visible && isTrainControl(c), PRODUCER_KINDS);
        if (!found) return { pass: false, detail: `no train action for any of ${MATCH_SPOTS.length} canvas selections (selectedKind=${(await state(page)).selectedKind ?? 'null'})` };
        const button = found.found.find((c) => !c.disabled) || found.found[0];
        if (button.disabled) return { pass: false, detail: `all ${found.found.length} train actions disabled for selectedKind=${found.snap.st.selectedKind}` };
        const row = roster ? roster.find((r) => Number(button.kind) === r.kind) : null;
        const before0 = found.snap.st;
        await page.waitForTimeout(400);
        const before = await state(page);
        const drift = { alloy: before.alloy - before0.alloy, charge: before.charge - before0.charge };
        await clickControl(page, button);
        const mid = await state(page);
        await page.evaluate(() => window.__APP.fastForward(40));
        await page.waitForTimeout(400);
        const after = await state(page);
        const drop = { alloy: before.alloy - mid.alloy, charge: before.charge - mid.charge };
        const spent = drop.alloy + drop.charge > Math.max(0, drift.alloy) + Math.max(0, drift.charge);
        const popOk = mid.popUsed > before.popUsed || after.popUsed > before.popUsed;
        const grew = after.entityCount > before.entityCount;
        return {
          pass: spent && popOk && grew,
          detail: `[${found.how}] action="${button.name || button.action}" kind=${button.kind ?? '-'} roster=${row ? `${row.alloy}a/${row.charge}c pop ${row.pop}` : 'n/a'} ` +
            `drop=${drop.alloy}a/${drop.charge}c drift=${drift.alloy}/${drift.charge} pop ${before.popUsed}->${after.popUsed} ` +
            `entities ${before.entityCount}->${after.entityCount}`,
        };
      });

      // build-site: a real click on a build action creates a construction site,
      // so the entity count rises as soon as the site is placed (§5).
      await guarded('build-site', async () => {
        await freshMatch(0);
        const found = await selectFirst((c) => c.visible && isBuildControl(c), WORKER_KINDS);
        if (!found) return { pass: false, detail: `no build action for any of ${MATCH_SPOTS.length} canvas selections (selectedKind=${(await state(page)).selectedKind ?? 'null'})` };
        const button = found.found.find((c) => !c.disabled) || found.found[0];
        if (button.disabled) return { pass: false, detail: `all ${found.found.length} build actions disabled for selectedKind=${found.snap.st.selectedKind}` };
        const row = roster ? roster.find((r) => Number(button.kind) === r.kind) : null;
        const before = found.snap.st;
        await clickControl(page, button);
        let after = before;
        for (let i = 0; i < 10; i++) {
          after = await state(page);
          if (after.entityCount > before.entityCount) break;
          await page.waitForTimeout(200);
        }
        const placed = after.entityCount > before.entityCount;
        const spent = after.alloy < before.alloy || after.charge < before.charge;
        return {
          pass: placed,
          detail: `[${found.how}] action="${button.name || button.action}" kind=${button.kind ?? '-'} roster=${row ? `${row.alloy}a/${row.charge}c` : 'n/a'} ` +
            `sitePlaced=${placed} entities ${before.entityCount}->${after.entityCount} ` +
            `alloy ${before.alloy}->${after.alloy} charge ${before.charge}->${after.charge} costSpent=${spent}`,
        };
      });
    }

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

    // --- pass 3: match determinism -------------------------------------------
    // Two fresh page loads, one seed, one faction, one command stream: the
    // normalized getState() hash must be identical (MATCH_SPEC §6, §9).
    await guarded('match-determinism', async () => {
      const runA = await matchRunHash(browser, baseUrl, 0);
      const runB = await matchRunHash(browser, baseUrl, 0);
      results.matchErrors = [...(runA.errors || []), ...(runB.errors || [])];
      if (runA.error || runB.error) return { pass: false, detail: `run1=${runA.error || 'ok'} run2=${runB.error || 'ok'}` };
      const pass = runA.hash === runB.hash && runA.str === runB.str;
      return {
        pass,
        detail: `${runA.hash} vs ${runB.hash} entities=${runA.entityCount}/${runB.entityCount} age=${runA.age}/${runB.age}` +
          (pass ? '' : ` | ${runA.str} vs ${runB.str}`),
      };
    });

    // --- pass 4: no-WebGPU error path ----------------------------------------
    // Portrait is playable, so the rotate notice survives only here: with
    // navigator.gpu removed the app must not claim ready and must report the
    // WebGPU failure (visible overlay and/or __APP.error).
    await guarded('no-webgpu-error-path', async () => {
      const { page: errPage, context: errContext, errors: errErrors } = await newPageWith(browser, baseUrl, { blockGpu: true });
      try {
        await errPage.waitForFunction(() => window.__APP && (window.__APP.ready || window.__APP.error), null, { timeout: 20000 }).catch(() => {});
        await errPage.waitForTimeout(600);
        const info = await errPage.evaluate(() => {
          const read = (sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return {
              visible: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0,
              text: `${el.textContent || ''}`.replace(/\s+/g, ' ').trim().slice(0, 160),
            };
          };
          return {
            ready: !!(window.__APP && window.__APP.ready),
            error: (window.__APP && window.__APP.error) || null,
            overlays: { error: read('#error'), notice: read('#rotate-notice') },
          };
        });
        results.matchErrors = (results.matchErrors || []).concat(errErrors);
        const shown = Object.entries(info.overlays).filter(([, o]) => o && o.visible);
        const blob = [info.error || '', ...shown.map(([k, o]) => `${k} ${o.text}`)].join(' | ');
        const gpuNamed = /webgpu|gpu|unavailable|requires/i.test(blob);
        const visiblePath = shown.length > 0 || !!info.error;
        const pass = !info.ready && visiblePath && gpuNamed;
        return {
          pass,
          detail: `ready=${info.ready} error="${(info.error || '').slice(0, 90)}" overlays=${shown.map(([k, o]) => `${k}:"${o.text.slice(0, 60)}"`).join(' ') || 'none'}`,
        };
      } finally {
        await errContext.close();
      }
    });
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
