// Acceptance run against the real Overpass API (network required, results vary with load).
//
//   npm run build && npx vite preview --port 4179 &
//   node e2e/live.mjs [http://localhost:4179] [screenshot-dir]

import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4179';
const SHOTS = process.argv[3];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => m.text().startsWith('[') && console.log('  page:', m.text()));
page.on('pageerror', (e) => console.log('  pageerror:', e.message));

async function mapIt(name) {
  await page.click('#city-input');
  await page.fill('#city-input', name);
  await page.keyboard.press('Enter');
  const t0 = Date.now();
  await page.click('#map-it');
  await page.waitForFunction(
    (n) =>
      document.querySelector('#city-name').textContent === n &&
      document.querySelector('#loading-panel').hidden,
    name,
    { timeout: 180_000, polling: 100 },
  );
  const ms = Date.now() - t0;
  const error = await page.isVisible('#error-panel');
  const summary = await page.textContent('#list-summary');
  console.log(`${name}: ${error ? 'ERROR' : summary} in ${(ms / 1000).toFixed(1)} s`);
  return { ms, error };
}

await page.goto(`${BASE}/?debug=1`);
await page.waitForFunction(() => !document.querySelector('#city-input').disabled, null, {
  timeout: 120_000,
});

const cold = await mapIt('כפר סבא');
console.log(`  cold < 30 s: ${!cold.error && cold.ms < 30_000 ? 'PASS' : 'FAIL'}`);
const warm = await mapIt('כפר סבא');
console.log(`  cached < 2 s: ${!warm.error && warm.ms < 2_000 ? 'PASS' : 'FAIL'}`);
const second = await mapIt('רעננה');
console.log(`  second city without reload: ${second.error ? 'FAIL' : 'PASS'}`);
await page.waitForTimeout(1500);
if (SHOTS) await page.screenshot({ path: `${SHOTS}/live-raanana.png` });
const top = await page.$$eval('.street-row', (els) =>
  els.slice(0, 5).map((e) => e.innerText.replace(/\s+/g, ' ')),
);
console.log(top.join('\n'));
await browser.close();
