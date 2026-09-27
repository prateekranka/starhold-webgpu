import { chromium } from 'playwright';
import { browserOptions } from './workshop-gpu.mjs';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, join } from 'node:path';

const outDir = resolve('evidence-civ-bases');
await mkdir(outDir, { recursive: true });

const root = resolve('dist');
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const path = resolve(root, '.' + url.pathname.replace(/\/$/, '/index.html'));
    if (!path.startsWith(root + '/')) throw new Error('outside root');
    const mime = ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.png': 'image/png' })[extname(path)] || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'no-store');
    res.end(await readFile(path));
  } catch {
    res.writeHead(404);
    res.end();
  }
});

await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
console.log(`Server listening on port ${port}`);

const browser = await chromium.launch(browserOptions());
const context = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
const page = await context.newPage();

await page.goto(`http://127.0.0.1:${port}/?seed=73129`);
await page.waitForFunction(() => window.__APP?.ready);

// 1. Capture Dawnward Compact match base
console.log('Capturing Dawnward Compact match base...');
await page.evaluate(() => window.__APP.startMatch(0));
await page.waitForTimeout(600);
await page.screenshot({ path: join(outDir, 'dawnward-base.png') });
console.log('Saved dawnward-base.png');

// 2. Capture Zoomed-out Macro View (Age of Empires 2 style commanding scale)
console.log('Capturing Zoomed-out Macro View...');
await page.evaluate(() => {
  window.__APP.zoomBy(-1);
  window.__APP.zoomBy(-1);
});
await page.waitForTimeout(600);
await page.screenshot({ path: join(outDir, 'macro-zoomout.png') });
console.log('Saved macro-zoomout.png');

// 3. Reset zoom and pan to Chokepoint & Basalt Ramp Pass
console.log('Capturing Chokepoint & Ramp Pass...');
await page.evaluate(() => {
  window.__APP.zoomBy(1);
  const cam = window.__APP.getState().camera;
  window.__APP.panTo(cam.x, cam.y - 36);
});
await page.waitForTimeout(600);
await page.screenshot({ path: join(outDir, 'chokepoint-ramp.png') });
console.log('Saved chokepoint-ramp.png');

// 4. Pan to Fractured Asteroid Rim & Void Abyss
console.log('Capturing Asteroid Rim & Void...');
await page.evaluate(() => {
  const cam = window.__APP.getState().camera;
  window.__APP.panTo(cam.x - 70, cam.y - 20);
});
await page.waitForTimeout(600);
await page.screenshot({ path: join(outDir, 'asteroid-rim.png') });
console.log('Saved asteroid-rim.png');

// 5. Capture Cinderwake Reavers match base
console.log('Capturing Cinderwake Reavers match base...');
await page.evaluate(() => {
  window.__APP.startMatch(1);
});
await page.waitForTimeout(600);
await page.screenshot({ path: join(outDir, 'cinderwake-base.png') });
console.log('Saved cinderwake-base.png');

await browser.close();
server.close();
console.log('All captures complete!');
