#!/usr/bin/env node
// Composes labelled frames into one contact sheet, so a person (or a blind
// critic) can judge a whole visual round in a single image: same scene, every
// zoom step, both viewports, before and after side by side.
//
// Usage: node scripts/critic-sheet.mjs <out.png> "Column A:<dir>" "Column B:<dir>" ...
// Each argument after the output is "label:directory". A directory contributes the
// frames whose names contain the zoom tags the sheet looks for.
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, basename, resolve } from 'node:path';
import { homedir } from 'node:os';

const [out, ...columns] = process.argv.slice(2);
if (!out || columns.length === 0) {
  console.error('usage: node scripts/critic-sheet.mjs <out.png> "Label:dir" ["Label:dir" ...]');
  process.exit(1);
}

/** Finds one frame per viewport and zoom tag in a directory. */
async function pickFrames(dir) {
  const abs = resolve(dir);
  if (!existsSync(abs)) return [];
  const files = (await readdir(abs)).filter((f) => f.endsWith('.png'));
  const wanted = [
    ['desktop', '1x'], ['desktop', 'widest'],
    ['phone', '1x'], ['phone', 'widest'],
  ];
  const picked = [];
  for (const [viewport, zoom] of wanted) {
    const hit = files.find((f) => f.startsWith(viewport) && f.includes(zoom));
    if (hit) picked.push({ viewport, zoom, src: join(abs, hit) });
  }
  return picked;
}

const blocks = [];
for (const spec of columns) {
  const index = spec.indexOf(':');
  const label = spec.slice(0, index);
  const dir = spec.slice(index + 1);
  const frames = await pickFrames(dir);
  // Inline as data URLs: a page built with setContent has an opaque origin, and
  // file:// subresources never load there (the first version shipped eight broken
  // images because of it).
  const cells = (await Promise.all(frames.map(async (f) => {
    const data = (await readFile(f.src)).toString('base64');
    return `
      <figure>
        <img src="data:image/png;base64,${data}" alt="${label} ${f.viewport} ${f.zoom}">
        <figcaption>${f.viewport} · ${f.zoom}</figcaption>
      </figure>`;
  }))).join('');
  blocks.push(`<section><h2>${label}</h2><div class="grid">${cells || '<p class="missing">no frames found</p>'}</div></section>`);
}

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { background:#10121C; color:#F3F0D7; font:16px/1.5 ui-monospace,monospace; margin:0; padding:20px; }
  h1 { font-size:20px; color:#F1CE72; margin:0 0 4px; }
  p.note { color:#98A4AE; margin:0 0 18px; font-size:14px; }
  h2 { font-size:16px; color:#8BD7BE; margin:0 0 8px; }
  section { margin-bottom:26px; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  figure { margin:0; }
  img { width:100%; height:auto; display:block; border:2px solid #747C91; image-rendering:pixelated; }
  figcaption { color:#98A4AE; font-size:13px; margin-top:4px; }
  .missing { color:#BC4A45; }
</style></head><body>
<h1>Starhold — visual round contact sheet</h1>
<p class="note">The same world scene at every camera step the game offers, on desktop and on a
landscape phone, side by side. Judge the terrain language: what is harvestable, where building
is allowed, where the routes go, and whether cliffs read as walls.</p>
${blocks.join('\n')}
</body></html>`;

const cache = join(homedir(), '.cache', 'ms-playwright');
const dirs = (await readdir(cache)).filter((d) => d.startsWith('chromium_headless_shell')).sort().reverse();
const exe = dirs.map((d) => join(cache, d, 'chrome-headless-shell-linux64', 'chrome-headless-shell')).find(existsSync);
const browser = await chromium.launch({ executablePath: exe, ignoreDefaultArgs: ['--disable-dev-shm-usage'], args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 })).newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(700);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`contact sheet: ${out} (${columns.length} columns)`);
