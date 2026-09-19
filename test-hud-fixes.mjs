import { chromium } from 'playwright';
import { existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const OUT_DIR = join(process.cwd(), 'evidence', 'hud-fixes');
mkdirSync(OUT_DIR, { recursive: true });

async function resolveChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM && existsSync(process.env.PLAYWRIGHT_CHROMIUM)) {
    return process.env.PLAYWRIGHT_CHROMIUM;
  }
  const cache = join(homedir(), 'Library', 'Caches', 'ms-playwright');
  const dirs = readdirSync(cache).filter((d) => d.startsWith('chromium')).sort().reverse();
  for (const d of dirs) {
    const p = join(cache, d, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
    if (existsSync(p)) return p;
  }
  return undefined;
}

const WEBGPU_ARGS = [
  '--enable-unsafe-webgpu',
  '--ignore-gpu-blocklist',
  '--use-angle=metal',
  '--enable-features=Vulkan,VulkanFromANGLE',
];

async function runTests() {
  console.log('[hud-test] Launching browser...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: await resolveChromium(),
    args: WEBGPU_ARGS,
  });

  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('console', msg => console.log('[PAGE]', msg.text()));

  console.log('[hud-test] Loading game...');
  await page.goto('http://localhost:5199/');
  await page.waitForFunction(() => window.__APP && window.__APP.ready, { timeout: 15000 });

  // 1. Start match
  console.log('[hud-test] Starting Dawnward skirmish...');
  await page.evaluate(() => window.__APP.startMatch(0));
  await page.waitForTimeout(600);

  // Capture clean canvas top (no overlapping text)
  const shotCleanTop = join(OUT_DIR, '01-clean-match-top.png');
  await page.screenshot({ path: shotCleanTop });
  console.log('[hud-test] Captured clean top screenshot:', shotCleanTop);

  // 2. Select a worker to inspect action buttons
  console.log('[hud-test] Selecting worker to verify full building names...');
  const workerSelected = await page.evaluate(() => {
    const pt = window.__APP.entityScreen(20, 0);
    if (!pt) return null;
    window.__APP.selectAt(pt.x, pt.y);
    const buttons = Array.from(document.querySelectorAll('#hud-action-list button .n')).map(el => el.textContent);
    return {
      buttons,
      selected: window.__APP.getState().selected,
    };
  });
  console.log('[hud-test] Worker action buttons:', workerSelected);

  const shotButtons = join(OUT_DIR, '02-full-action-names.png');
  await page.screenshot({ path: shotButtons });
  console.log('[hud-test] Captured action buttons screenshot:', shotButtons);

  // 3. Select Heliowell to verify tactical readout instead of "NO ACTIONS"
  console.log('[hud-test] Selecting Heliowell to verify tactical readout...');
  const heliowellInfo = await page.evaluate(() => {
    const pt = window.__APP.entityScreen(12, 0);
    if (!pt) return null;
    window.__APP.selectAt(pt.x, pt.y);
    const status = document.querySelector('#hud-status')?.textContent;
    return {
      status,
      selected: window.__APP.getState().selected,
    };
  });
  console.log('[hud-test] Heliowell readout:', heliowellInfo);

  const shotHeliowell = join(OUT_DIR, '03-heliowell-tactical-readout.png');
  await page.screenshot({ path: shotHeliowell });
  console.log('[hud-test] Captured Heliowell tactical readout:', shotHeliowell);

  // 4. Test income rates
  console.log('[hud-test] Advancing time to verify resource income rates...');
  await page.evaluate(() => window.__APP.fastForward(5));
  await page.waitForTimeout(300);

  const economyInfo = await page.evaluate(() => {
    const alloyEl = document.querySelector('#hud-alloy');
    const chargeEl = document.querySelector('#hud-charge');
    return {
      alloyText: alloyEl?.textContent,
      chargeText: chargeEl?.textContent,
    };
  });
  console.log('[hud-test] Economy readouts:', economyInfo);

  const shotEconomy = join(OUT_DIR, '04-resource-income-rates.png');
  await page.screenshot({ path: shotEconomy });
  console.log('[hud-test] Captured income rates screenshot:', shotEconomy);

  // 5. Test minimap closed alert when raid is active
  console.log('[hud-test] Closing minimap and triggering raid to test MAP ⚠ pulse...');
  await page.evaluate(() => {
    const closeBtn = document.querySelector('#minimap-close');
    closeBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    window.__APP.triggerRaid(0);
    window.__APP.fastForward(2);
  });
  await page.waitForTimeout(300);

  const mapAlertInfo = await page.evaluate(() => {
    const mapBtn = document.querySelector('#hud-minimap');
    return {
      hasPulse: mapBtn?.classList.contains('pulse-alert'),
      buttonText: mapBtn?.textContent,
    };
  });
  console.log('[hud-test] Map button alert:', mapAlertInfo);

  const shotMapAlert = join(OUT_DIR, '05-map-alert-pulse.png');
  await page.screenshot({ path: shotMapAlert });
  console.log('[hud-test] Captured map alert screenshot:', shotMapAlert);

  await browser.close();
  console.log('[hud-test] All tests completed successfully!');
}

runTests().catch(err => {
  console.error('[hud-test] Error:', err);
  process.exit(1);
});
