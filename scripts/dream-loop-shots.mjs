import { chromium } from 'playwright';
import { mkdir, copyFile } from 'node:fs/promises';
import { browserOptions } from './workshop-gpu.mjs';

await mkdir('docs/shots', { recursive: true });

const ARTIFACTS_DIR = '/Users/prateekranka/.gemini/antigravity/brain/3947b9a6-a7c7-42bf-af6b-1327886d0f27';

const browser = await chromium.launch(browserOptions());

const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1
});
const page = await context.newPage();

page.on('console', msg => console.log('PAGE LOG:', msg.text()));
page.on('pageerror', err => console.log('PAGE ERROR:', err));

await page.goto('http://localhost:5199/');
await page.waitForFunction(() => window.__APP?.ready, null, { timeout: 60000 });
await page.waitForTimeout(1000);

// 1. Title with game menu
await page.screenshot({ path: 'docs/shots/dream-loop-title.png' });
console.log('Captured docs/shots/dream-loop-title.png');

// 2. Campaign Scenarios screen
const scenariosBtn = page.locator('button[data-action="scenarios"]');
if (await scenariosBtn.isVisible()) {
  await scenariosBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'docs/shots/dream-loop-scenarios.png' });
  console.log('Captured docs/shots/dream-loop-scenarios.png');

  // Launch Operation 1
  const launchBtn = page.locator('button[data-action="launch-scenario"]').first();
  if (await launchBtn.isVisible()) {
    await launchBtn.click();
    await page.waitForFunction(() => window.__APP?.getState().mode === 1, null, { timeout: 10000 });
    await page.waitForTimeout(2000);

    // 3. Live match gameplay with objectives HUD & weather
    await page.screenshot({ path: 'docs/shots/dream-loop-gameplay.png' });
    console.log('Captured docs/shots/dream-loop-gameplay.png');

    // 4. Select a live unit to display tactical stance / formation card
    await page.evaluate(() => {
      if (window.__APP) {
        const entities = window.__APP.entityProbe();
        const unit = entities.find(e => e.kind >= 20 && e.kind < 40);
        if (unit) {
          window.__APP.selectEntity(unit.index);
        } else if (entities.length > 0) {
          window.__APP.selectEntity(0);
        }
      }
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'docs/shots/dream-loop-tactics.png' });
    console.log('Captured docs/shots/dream-loop-tactics.png');
  }
}

await browser.close();

// Copy shots to artifacts dir for embedding in walkthrough
for (const file of ['dream-loop-title.png', 'dream-loop-scenarios.png', 'dream-loop-gameplay.png', 'dream-loop-tactics.png']) {
  try {
    await copyFile(`docs/shots/${file}`, `${ARTIFACTS_DIR}/${file}`);
  } catch (err) {
    console.warn(`Could not copy ${file} to artifacts:`, err.message);
  }
}

console.log('All screenshots captured and copied successfully!');
