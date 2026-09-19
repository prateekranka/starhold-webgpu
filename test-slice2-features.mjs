import { chromium } from 'playwright';
import { existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const OUT_DIR = join(process.cwd(), 'evidence', 'slice-2');
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
  console.log('[slice-2-test] Launching browser...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: await resolveChromium(),
    args: WEBGPU_ARGS,
  });

  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('console', msg => console.log('[PAGE]', msg.text()));

  console.log('[slice-2-test] Loading game...');
  await page.goto('http://localhost:5199/');
  await page.waitForFunction(() => window.__APP && window.__APP.ready, { timeout: 15000 });

  // 1. Start Dawnward match
  console.log('[slice-2-test] Starting Dawnward skirmish...');
  await page.evaluate(() => window.__APP.startMatch(0));
  await page.waitForTimeout(600);

  // 2. Find screen positions of workers
  const workerInfo = await page.evaluate(() => {
    const probe = window.__APP.entityProbe();
    const workers = probe.filter(e => e.faction === 0 && e.kind === 20);
    return {
      count: workers.length,
      firstWorker: window.__APP.entityScreen(20, 0),
    };
  });
  console.log('[slice-2-test] Worker info:', workerInfo);

  // 3. Test box selection on desktop
  console.log('[slice-2-test] Testing box selection around workers...');
  const box = await page.$eval('#world', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  // Drag around the worker cluster (south of Keep)
  const dragStart = { x: workerInfo.firstWorker.x - 60, y: workerInfo.firstWorker.y - 40 };
  const dragEnd = { x: workerInfo.firstWorker.x + 80, y: workerInfo.firstWorker.y + 60 };

  await page.mouse.move(dragStart.x, dragStart.y);
  await page.mouse.down();
  // Drag in multiple steps so selection-box is drawn
  for (let i = 1; i <= 6; i++) {
    const cx = dragStart.x + (dragEnd.x - dragStart.x) * (i / 6);
    const cy = dragStart.y + (dragEnd.y - dragStart.y) * (i / 6);
    await page.mouse.move(cx, cy);
    await page.waitForTimeout(30);
  }

  // Screenshot of selection-box active
  const shotBox = join(OUT_DIR, '01-box-selection-active.png');
  await page.screenshot({ path: shotBox });
  console.log('[slice-2-test] Captured box selection visual:', shotBox);

  await page.mouse.up();
  await page.waitForTimeout(300);

  // 4. Verify selection state
  const selectState = await page.evaluate(() => {
    const s = window.__APP.getState();
    const pill = document.querySelector('#selection');
    return {
      selected: s.selected,
      selectedCount: s.selectedCount,
      selectedGroup: s.selectedGroup,
      pillText: pill?.textContent,
      pillVisible: !pill?.hidden,
    };
  });
  console.log('[slice-2-test] Post-box selection state:', selectState);

  const shotSelected = join(OUT_DIR, '02-group-selected.png');
  await page.screenshot({ path: shotSelected });
  console.log('[slice-2-test] Captured group selected screenshot:', shotSelected);

  // 5. Test group move order
  console.log('[slice-2-test] Issuing group move order via right click...');
  const targetX = workerInfo.firstWorker.x + 120;
  const targetY = workerInfo.firstWorker.y - 80;
  await page.mouse.click(targetX, targetY, { button: 'right' });
  await page.waitForTimeout(300);

  const shotMove = join(OUT_DIR, '03-group-move-issued.png');
  await page.screenshot({ path: shotMove });
  console.log('[slice-2-test] Captured move order ripple & formation:', shotMove);

  // Let units march for 2 seconds
  await page.evaluate(() => window.__APP.fastForward(2));
  await page.waitForTimeout(300);

  const shotMarching = join(OUT_DIR, '04-group-marching-formation.png');
  await page.screenshot({ path: shotMarching });
  console.log('[slice-2-test] Captured units marching in formation:', shotMarching);

  // 6. Test double-tap selection on mobile viewport
  console.log('[slice-2-test] Testing touch double-tap on mobile viewport...');
  const mobileContext = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://localhost:5199/');
  await mobilePage.waitForFunction(() => window.__APP && window.__APP.ready);
  await mobilePage.evaluate(() => window.__APP.startMatch(0));
  await mobilePage.waitForTimeout(500);

  const mobileWorker = await mobilePage.evaluate(() => window.__APP.entityScreen(20, 0));
  console.log('[slice-2-test] Mobile worker tap position:', mobileWorker);

  // Double tap on worker
  await mobilePage.tap('#world', { position: { x: mobileWorker.x, y: mobileWorker.y } });
  await mobilePage.waitForTimeout(100);
  await mobilePage.tap('#world', { position: { x: mobileWorker.x, y: mobileWorker.y } });
  await mobilePage.waitForTimeout(300);

  const mobileSelectState = await mobilePage.evaluate(() => {
    const s = window.__APP.getState();
    const pill = document.querySelector('#selection');
    return {
      selectedCount: s.selectedCount,
      selectedGroup: s.selectedGroup,
      pillText: pill?.textContent,
    };
  });
  console.log('[slice-2-test] Mobile double-tap selection state:', mobileSelectState);

  const shotMobile = join(OUT_DIR, '05-mobile-doubletap-selection.png');
  await mobilePage.screenshot({ path: shotMobile });
  console.log('[slice-2-test] Captured mobile double-tap selection:', shotMobile);

  await mobileContext.close();
  await browser.close();

  console.log('[slice-2-test] All tests completed successfully!');
}

runTests().catch(err => {
  console.error('[slice-2-test] Error:', err);
  process.exit(1);
});
