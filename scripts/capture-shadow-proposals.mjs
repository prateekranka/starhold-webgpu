import { chromium } from 'playwright';
import { mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

await mkdir('docs/shots', { recursive: true });
const ARTIFACTS_DIR = '/Users/prateekranka/.gemini/antigravity/brain/3947b9a6-a7c7-42bf-af6b-1327886d0f27';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });

const htmlPath = resolve(ARTIFACTS_DIR, 'shadow-proposals.html');
await page.goto(`file://${htmlPath}`);
await page.waitForTimeout(500);

const modes = ['current', 'idea1', 'idea2', 'idea3', 'idea4', 'combined'];

for (const mode of modes) {
  if (mode === 'idea4') {
    await page.evaluate(() => {
      document.getElementById('chk-cliff').checked = true;
      toggleCliff();
    });
  } else {
    await page.evaluate(() => {
      document.getElementById('chk-cliff').checked = false;
      toggleCliff();
    });
  }

  await page.evaluate((m) => setMode(m), mode);
  await page.waitForTimeout(200);

  const canvas = page.locator('#preview-canvas');
  const filename = `shadow-${mode}.png`;
  await canvas.screenshot({ path: `docs/shots/${filename}` });
  await copyFile(`docs/shots/${filename}`, `${ARTIFACTS_DIR}/${filename}`);
  console.log(`Captured ${filename}`);
}

await browser.close();
console.log('All shadow proposal screenshots captured successfully!');
