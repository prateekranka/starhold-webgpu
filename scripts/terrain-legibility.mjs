#!/usr/bin/env node
/** Pixel measures of the BUILT world, not assertions about renderer materials.
 * Usage: node scripts/terrain-legibility.mjs [--root dist] [--out /tmp/terrain-legibility]
 * Desktop and emulated landscape phone, at 1x and the widest camera step.
 * Three predeclared targets: ore hue >=60deg AND CIE L* lift >=20;
 * clearing sigma/control <=0.70; all four departures >=30 consecutive tiles.
 * Hue is circular HSL degrees; shade/lightness is CIE L* (D65 sRGB).
 * Ore: exposed non-ground pixels in a fixed 3x3-tile, 3-tile-high envelope.
 * Reject colours common (>1%) in exposed ground 2..8 tiles away, and dark
 * contact/outline pixels. Median of the surviving pixels, not a guessed hue.
 * Compare with median exposed ground colour. Also print ground MAD
 * noise floors and distance to the charge PALETTE reference (not a charge-pixel
 * acceptance test). No renderer material IDs are read.
 * Calm: paired radius-18 discs, one inside each radius-31 clearing, the other
 * 85 tiles away. Same offsets, nine sub-tile samples, actors/roads/HUD excluded.
 * Route: raster-derived stone coverage (>=60%) at nine sub-tile points per tile,
 * tracing 48 adjacent tiles OUTSIDE each clearing. Missing pixels break the run.
 * Camera mosaics keep measurements on-screen; page frames preserve actual HUD.
 * Frozen rAF timestamps stop simulation drift without changing render geometry.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { homedir } from 'node:os';

const arg = (key, fallback) => process.argv.includes(`--${key}`) ? process.argv[process.argv.indexOf(`--${key}`) + 1] : fallback;
const root = resolve(arg('root', 'dist')), out = resolve(arg('out', '/tmp/terrain-legibility'));
const seed = 73129, targets = { oreHue: 60, oreLightness: 20, calmRatio: .70, routeTiles: 30 };
await mkdir(out, { recursive: true });
const paletteText = await readFile('src/kinds.ts', 'utf8');
const palette = paletteText.match(/export const palette = \[([^\]]+)\]/)[1].match(/[0-9A-F]{6}/g).map(h => [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)));
const server = createServer(async (req, res) => {
  try {
    const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
    if (!path.startsWith(root + '/')) throw new Error('outside root');
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm' })[extname(path)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store'); res.end(await readFile(path));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
let browser;
const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const sd = xs => { const mean = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length); };
const hueDistance = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
function color(rgb) {
  const [r, g, b] = rgb.map(x => x / 255), hi = Math.max(r, g, b), lo = Math.min(r, g, b), d = hi - lo;
  const hue = d === 0 ? 0 : ((hi === r ? (g - b) / d : hi === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360;
  const linear = [r, g, b].map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  const y = linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
  return { hue, L: y > .008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y };
}
const round = n => Number(n.toFixed(3));
const swatches = palette.map(color);
const rows = [];
try {
  const cache = join(homedir(), '.cache/ms-playwright');
  const shells = (await readdir(cache)).filter(p => p.startsWith('chromium_headless_shell')).sort().reverse();
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM || shells.flatMap(p => [join(cache, p, 'chrome-headless-shell-linux64/chrome-headless-shell'), join(cache, p, 'chrome-linux/chrome-headless-shell')]).find(existsSync);
  browser = await chromium.launch({ headless: true, executablePath, args: ['--enable-features=Vulkan,VulkanFromANGLE', '--enable-unsafe-webgpu', '--use-angle=vulkan', '--ignore-gpu-blocklist', '--use-gl=angle'] });
  for (const vp of [{ name: 'desktop', width: 960, height: 540, dsf: 1, touch: false }, { name: 'phone', width: 844, height: 390, dsf: 2, touch: true }]) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dsf, hasTouch: vp.touch, isMobile: vp.touch });
    await context.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = callback => raf(() => callback(1000));
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/?seed=${seed}`);
    await page.waitForFunction(() => window.__APP?.ready || window.__APP?.error);
    if (await page.evaluate(() => window.__APP.error)) throw new Error(await page.evaluate(() => window.__APP.error));
    const layout = await page.evaluate(() => {
      const r = document.querySelector('#world').getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    const fits = layout.x >= -.5 && layout.y >= -.5 && layout.x + layout.width <= vp.width + .5 && (vp.touch ? Math.abs(layout.width - vp.width) < 1 : layout.y + layout.height <= vp.height);
    console.log(`canvas-fits ${vp.name}: ${fits ? 'PASS' : 'FAIL'} rect=${layout.width.toFixed(1)}x${layout.height.toFixed(1)}@${layout.x.toFixed(1)},${layout.y.toFixed(1)} mode=${vp.touch ? 'fill' : 'fit'}`);
    if (!fits) throw new Error('canvas layout failed');
    // Exact-tick island frame, retained for baseline/final pixel identity checks.
    await page.evaluate(() => window.__APP.fastForward(108));
    if (await page.evaluate(() => window.__APP.getState().minimap.open)) await page.locator('#minimap-close').click();
    await page.waitForTimeout(100);
    await page.screenshot({ path: join(out, `${vp.name}-showcase.png`), scale: 'css' });
    await page.evaluate(() => window.__APP.startMatch(0));
    await page.waitForTimeout(100);
    const terrain = await page.evaluate(() => window.__APP.terrainSample(1));
    const entities = await page.evaluate(() => window.__APP.entityProbe());
    const side = terrain.side, at = (x, y) => terrain.levels[Math.floor(y) * side + Math.floor(x)];
    const bases = entities.filter(e => e.kind === 10 || e.kind === 60);
    const ores = entities.filter(e => e.kind === 40);
    const settle = () => page.waitForTimeout(70);
    async function walk(x, y) {
      if (!(await page.evaluate(() => window.__APP.getState().minimap.open))) await page.locator('#hud-minimap').click();
      const b = await page.locator('#minimap canvas').boundingBox();
      await page.mouse.click(b.x + x / side * b.width, b.y + y / side * b.height);
      await page.locator('#minimap-close').click();
      await settle();
      const c = await page.evaluate(() => window.__APP.getState().camera);
      if (Math.hypot(c.x - x, c.y - y) > 1) throw new Error(`camera failed to walk: ${JSON.stringify(c)} vs ${x},${y}`);
    }
    // Decode composited screenshots using browser's standard PNG decoder, not
    // WebGPU readPixels (which can read a discarded framebuffer). Samples are
    // in CSS pixels, so phone results include its real nearest-neighbour scale.
    async function frame(name, points = [], envelopes = []) {
      const buf = await page.screenshot({ path: join(out, `${vp.name}-${name}.png`), scale: 'css' });
      return page.evaluate(async ({ png, points, envelopes }) => {
        const img = new Image(); img.src = `data:image/png;base64,${png}`; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        const rect = document.querySelector('#world').getBoundingClientRect(), s = window.__APP.getState(), scale = rect.width / 960;
        const project = ([x, y, z]) => [rect.left + (480 + 12 * (x - s.camera.x - y + s.camera.y) / s.zoom) * scale, rect.top + (272 + (6.9282032 * (x - s.camera.x + y - s.camera.y) - 13.8564064 * z) / s.zoom) * scale];
        const pixel = (x, y) => {
          x = Math.floor(x); y = Math.floor(y);
          if (x < 0 || y < 0 || x >= c.width || y >= c.height || document.elementFromPoint(x, y)?.id !== 'world') return null;
          const i = (y * c.width + x) * 4; return Array.from(data.slice(i, i + 3));
        };
        return { samples: points.map(p => pixel(...project(p))), envelopes: envelopes.map(e => {
          const [x, y] = project(e), rx = Math.ceil(18 * scale / s.zoom), top = Math.ceil(42 * scale / s.zoom), bottom = Math.ceil(8 * scale / s.zoom), pixels = [];
          for (let yy = y - top; yy <= y + bottom; yy++) for (let xx = x - rx; xx <= x + rx; xx++) { const v = pixel(xx, yy); if (v) pixels.push(v); }
          return pixels;
        }) };
      }, { png: buf.toString('base64'), points, envelopes });
    }
    const routePoints = (bx, by, lane) => {
      const m = bx < side / 2 ? 1 : -1;
      return lane === 0 ? [[bx, by], [bx, by - 38 * m], [bx + 90 * m, by - 32 * m]] : [[bx, by], [bx - 38 * m, by], [bx - 48 * m, by + 70 * m]];
    };
    const onRoad = (x, y, bx, by) => [0, 1].some(lane => {
      const ps = routePoints(bx, by, lane);
      return ps.slice(1).some((b, i) => { const a = ps[i], dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy) < 4; });
    });
    for (const zoom of [1, 4 / 3]) {
      await page.evaluate(z => { const app = window.__APP; while (app.getState().zoom < z - .001) app.zoomBy(-1); while (app.getState().zoom > z + .001) app.zoomBy(1); }, zoom);
      const label = zoom === 1 ? '1x' : 'widest';
      for (let slot = 0; slot < bases.length; slot++) {
        const base = bases[slot], bx = Math.floor(base.x), by = Math.floor(base.y), m = bx < side / 2 ? 1 : -1;
        await walk(base.x, base.y);
        const nearest = [...ores].sort((a, b) => Math.hypot(a.x - base.x, a.y - base.y) - Math.hypot(b.x - base.x, b.y - base.y))[0];
        const ground = [];
        for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
          const x = Math.floor(nearest.x) + dx + .5, y = Math.floor(nearest.y) + dy + .5;
          if (Math.hypot(dx, dy) < 2 || Math.hypot(dx, dy) > 8 || at(x, y) < 0 || entities.some(e => Math.hypot(e.x - x, e.y - y) < (e.kind < 20 || e.kind >= 60 ? 4 : 2))) continue;
          ground.push([x, y, at(x, y)]);
        }
        const oreFrame = await frame(`base${slot}-${label}`, ground, [[nearest.x, nearest.y, nearest.z]]);
        const groundColors = oreFrame.samples.filter(Boolean).map(color);
        if (groundColors.length < 20 || oreFrame.envelopes[0].length < 20) throw new Error('insufficient ore samples');
        const groundRGB = [0, 1, 2].map(i => median(oreFrame.samples.filter(Boolean).map(p => p[i]))), g = color(groundRGB);
        const groundCounts = new Map();
        for (const p of oreFrame.samples.filter(Boolean)) groundCounts.set(p.join(','), (groundCounts.get(p.join(',')) || 0) + 1);
        const exposed = oreFrame.envelopes[0].filter(p => (groundCounts.get(p.join(',')) || 0) <= groundColors.length * .01 && color(p).L > g.L + 2).sort((a, b) => color(a).L - color(b).L);
        if (exposed.length < 6) throw new Error('insufficient exposed ore pixels');
        const oreRGB = exposed[Math.floor(exposed.length / 2)], o = color(oreRGB);
        const ore = { pixels: exposed.length, hue: round(hueDistance(o.hue, g.hue)), lightness: round(o.L - g.L), hueNoiseMAD: round(median(groundColors.map(c => hueDistance(c.hue, g.hue)))), lightnessNoiseMAD: round(median(groundColors.map(c => Math.abs(c.L - g.L)))), chargePaletteHue: round(hueDistance(o.hue, swatches[17].hue)), oreRGB, groundRGB };
        // Same radius, same offsets and identical paired exclusions in the two discs.
        const clearPts = [], controlPts = [], control = [bx + 85 * m, by + 18 * m];
        for (let dy = -18; dy <= 18; dy++) for (let dx = -18; dx <= 18; dx++) {
          if (dx * dx + dy * dy > 18 * 18) continue;
          const x = bx + dx, y = by + dy, u = control[0] + dx, v = control[1] + dy;
          if (at(x, y) < 0 || at(u, v) < 0 || onRoad(x, y, bx, by) || onRoad(u, v, bx, by) || entities.some(e => Math.hypot(e.x - x, e.y - y) < 5 || Math.hypot(e.x - u, e.y - v) < 5)) continue;
          for (const a of [.2, .5, .8]) for (const b of [.2, .5, .8]) { clearPts.push([x + a, y + b, at(x, y)]); controlPts.push([u + a, v + b, at(u, v)]); }
        }
        const clear = await frame(`clear${slot}-${label}`, clearPts);
        await walk(...control);
        const ctrl = await frame(`control${slot}-${label}`, controlPts);
        const paired = clear.samples.map((p, i) => [p, ctrl.samples[i]]).filter(([a, b]) => a && b);
        if (paired.length < 500) throw new Error('insufficient clearing/control pairs');
        const clearingSD = sd(paired.map(([p]) => color(p).L)), controlSD = sd(paired.map(([, p]) => color(p).L));
        const calm = { clearingSD: round(clearingSD), controlSD: round(controlSD), ratio: round(clearingSD / controlSD), pairs: paired.length };
        const routes = [];
        for (let lane = 0; lane < 2; lane++) {
          const ps = routePoints(bx, by, lane), tiles = [], seen = new Set();
          for (let j = 0; j < ps.length - 1; j++) {
            const [ax, ay] = ps[j], [ex, ey] = ps[j + 1], length = Math.hypot(ex - ax, ey - ay);
            for (let t = 0; t <= length; t += .1) {
              const x = Math.round(ax + (ex - ax) * t / length), y = Math.round(ay + (ey - ay) * t / length), key = `${x},${y}`;
              if (Math.hypot(x - bx, y - by) < 31 || seen.has(key)) continue;
              seen.add(key); tiles.push([x, y]);
            }
          }
          const trace = tiles.slice(0, 48), reads = [];
          for (let start = 0; start < trace.length; start += 16) {
            const chunk = trace.slice(start, start + 16), center = chunk[Math.floor(chunk.length / 2)];
            await walk(center[0] + .5, center[1] + .5);
            const points = chunk.flatMap(([x, y]) => [.2, .5, .8].flatMap(a => [.2, .5, .8].map(b => [x + a, y + b, at(x, y)])));
            const f = await frame(`route${slot}-${lane}-${start}-${label}`, points);
            for (let k = 0; k < chunk.length; k++) {
              // Stone road: palette-bounded lightness and low saturation. It
              // must cover a tile, not just contain a single bright seam.
              const pixels = f.samples.slice(k * 9, k * 9 + 9);
              reads.push(pixels.filter(p => p && [5, 6, 7].some(i => p.every((v, c) => v === palette[i][c]))).length / 9 >= .6);
            }
          }
          let run = 0, longest = 0;
          for (const yes of reads) { run = yes ? run + 1 : 0; longest = Math.max(longest, run); }
          routes.push({ lane, longest, tiles: trace.length, reads: reads.map(x => x ? '1' : '0').join('') });
        }
        rows.push({ viewport: vp.name, zoom: label, base: slot, ore, calm, routes });
      }
    }
    await page.evaluate(() => { window.__APP.resetShowcase(); window.__APP.fastForward(108); });
    await settle();
    // Match leaves zoom at widest; restore the judging camera, not game state.
    await page.evaluate(() => { while (window.__APP.getState().zoom > 1.001) window.__APP.zoomBy(1); });
    await settle();
    await page.screenshot({ path: join(out, `${vp.name}-showcase-return.png`), scale: 'css' });
    if (errors.length) throw new Error(errors.join('\n'));
    await context.close();
  }
  const summary = { oreHueMin: Math.min(...rows.map(r => r.ore.hue)), oreLightnessMin: Math.min(...rows.map(r => r.ore.lightness)), calmRatioMax: Math.max(...rows.map(r => r.calm.ratio)), routeTilesMin: Math.min(...rows.flatMap(r => r.routes.map(x => x.longest))) };
  const pass = summary.oreHueMin >= targets.oreHue && summary.oreLightnessMin >= targets.oreLightness && summary.calmRatioMax <= targets.calmRatio && summary.routeTilesMin >= targets.routeTiles;
  await writeFile(join(out, 'measurements.json'), JSON.stringify({ seed, targets, rows, summary, pass }, null, 2));
  for (const r of rows) console.log(`${r.viewport} ${r.zoom} base${r.base}: ore Δh=${r.ore.hue}° ΔL*=${r.ore.lightness} (MAD ${r.ore.hueNoiseMAD}°/${r.ore.lightnessNoiseMAD}, charge-palette Δh=${r.ore.chargePaletteHue}°); calm σ=${r.calm.clearingSD}/${r.calm.controlSD} ratio=${r.calm.ratio}; route=${r.routes.map(p => p.longest).join('/')} tiles`);
  console.log(`ore-separation: Δh>=${summary.oreHueMin}° ΔL*>=${summary.oreLightnessMin}`);
  console.log(`calm-clearing: σclear/σcontrol<=${summary.calmRatioMax}`);
  console.log(`route-continuity: shortest of four departures >=${summary.routeTilesMin} consecutive tiles`);
  console.log(`terrain-legibility: ${pass ? 'PASS' : 'FAIL'}; frames and raw measurements: ${out}`);
  if (!pass) process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise(r => server.close(r));
}
