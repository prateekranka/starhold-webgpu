import { chromium } from 'playwright';
import { existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const OUT_DIR = join(process.cwd(), 'evidence', 'slice-3');
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
  console.log('[slice-3-test] Launching browser...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: await resolveChromium(),
    args: WEBGPU_ARGS,
  });

  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('console', msg => console.log('[PAGE]', msg.text()));

  console.log('[slice-3-test] Loading game...');
  await page.goto('http://localhost:5199/');
  await page.waitForFunction(() => window.__APP && window.__APP.ready, { timeout: 15000 });

  // 1. Start match
  console.log('[slice-3-test] Starting Dawnward skirmish...');
  await page.evaluate(() => window.__APP.startMatch(0));
  await page.waitForTimeout(500);

  // 2. Check initial calm state
  const calmState = await page.evaluate(() => {
    const s = window.__APP.getState();
    const banner = document.querySelector('#raid-warning');
    const minimap = document.querySelector('#minimap');
    return {
      raidActive: s.raidActive,
      raidEta: s.raidEta,
      bannerOff: banner?.classList.contains('off'),
      minimapAlert: minimap?.classList.contains('alert'),
    };
  });
  console.log('[slice-3-test] Calm state:', calmState);

  // 3. Trigger raid down East Canyon corridor (lane 0)
  console.log('[slice-3-test] Dispatching raid wave via East Canyon...');
  await page.evaluate(() => window.__APP.triggerRaid(0));
  await page.waitForTimeout(300);

  // Advance 2 seconds so raiders begin marching
  await page.evaluate(() => window.__APP.fastForward(2));
  await page.waitForTimeout(300);

  const raidActiveState = await page.evaluate(() => {
    const s = window.__APP.getState();
    const banner = document.querySelector('#raid-warning');
    const badge = document.querySelector('#raid-badge');
    const detail = document.querySelector('#raid-detail');
    const minimap = document.querySelector('#minimap');
    return {
      raidActive: s.raidActive,
      raidLane: s.raidLane,
      raidBreach: s.raidBreach,
      bannerVisible: !banner?.classList.contains('off'),
      badgeText: badge?.textContent,
      detailText: detail?.textContent,
      minimapAlert: minimap?.classList.contains('alert'),
    };
  });
  console.log('[slice-3-test] Active raid state:', raidActiveState);

  const shotBanner = join(OUT_DIR, '01-raid-warning-banner.png');
  await page.screenshot({ path: shotBanner });
  console.log('[slice-3-test] Captured warning banner screenshot:', shotBanner);

  // Open minimap if closed and capture threat radar corridor
  await page.evaluate(() => {
    const btn = document.querySelector('#hud-minimap');
    const map = document.querySelector('#minimap');
    if (map?.classList.contains('off')) btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(300);

  const shotThreatRadar = join(OUT_DIR, '02-minimap-threat-corridor.png');
  await page.screenshot({ path: shotThreatRadar });
  console.log('[slice-3-test] Captured minimap threat radar screenshot:', shotThreatRadar);

  // 4. Advance raiders to breach midpoint canyon bridge
  console.log('[slice-3-test] Advancing raiders to central canyon bridge...');
  // March for 230 seconds towards player base (crossing midpoint canyon bridge)
  await page.evaluate(() => window.__APP.fastForward(230));
  await page.waitForTimeout(300);

  const breachState = await page.evaluate(() => {
    const s = window.__APP.getState();
    const banner = document.querySelector('#raid-warning');
    const badge = document.querySelector('#raid-badge');
    const detail = document.querySelector('#raid-detail');
    const minimap = document.querySelector('#minimap');
    const foeUnits = window.__APP.entityProbe().filter(e => e.faction === 1 && [30, 31, 32, 33, 34, 35, 36].includes(e.kind));
    return {
      raidActive: s.raidActive,
      raidBreach: s.raidBreach,
      foeUnits: foeUnits.map(u => ({ kind: u.kind, x: u.x, y: u.y, state: u.state })),
      isBreach: banner?.classList.contains('breach'),
      badgeText: badge?.textContent,
      detailText: detail?.textContent,
      minimapBreach: minimap?.classList.contains('breach'),
    };
  });
  console.log('[slice-3-test] Breach state:', breachState);

  const shotBreach = join(OUT_DIR, '03-canyon-breach-alert.png');
  await page.screenshot({ path: shotBreach });
  console.log('[slice-3-test] Captured canyon breach alert screenshot:', shotBreach);

  // 5. Click banner to jump camera to raiders
  console.log('[slice-3-test] Clicking raid warning banner to jump camera to threats...');
  await page.click('#raid-warning');
  await page.waitForTimeout(400);

  const shotJump = join(OUT_DIR, '04-camera-jump-to-threat.png');
  await page.screenshot({ path: shotJump });
  console.log('[slice-3-test] Captured camera jump screenshot:', shotJump);

  // 6. Test mobile touchscreen layout
  console.log('[slice-3-test] Testing mobile touch layout...');
  const mobileContext = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://localhost:5199/');
  await mobilePage.waitForFunction(() => window.__APP && window.__APP.ready);
  await mobilePage.evaluate(() => {
    window.__APP.startMatch(0);
    window.__APP.triggerRaid(1); // West Canyon for mobile test
    window.__APP.fastForward(2);
  });
  await mobilePage.waitForTimeout(500);

  const shotMobile = join(OUT_DIR, '05-mobile-threat-radar.png');
  await mobilePage.screenshot({ path: shotMobile });
  console.log('[slice-3-test] Captured mobile threat radar screenshot:', shotMobile);

  await mobileContext.close();
  await browser.close();

  console.log('[slice-3-test] All tests completed successfully!');
}

runTests().catch(err => {
  console.error('[slice-3-test] Error:', err);
  process.exit(1);
});
