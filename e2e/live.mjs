// Acceptance run against the real Overpass and Nominatim APIs (network required, results
// vary with load).
//
//   npm run build && npx vite preview --port 4179 &
//   node e2e/live.mjs [http://localhost:4179] [screenshot-dir]
//
// LIVE_BIG=1 also loads Berlin, a "large" city (minutes, and may fail when Overpass is busy).

import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4179';
const SHOTS = process.argv[3];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => m.text().startsWith('[') && console.log('  page:', m.text()));
page.on('pageerror', (e) => console.log('  pageerror:', e.message));

async function mapIt(name, search) {
  await page.click('#city-input');
  if (search) {
    // World search: type, Enter to search, then pick the result named `name`.
    await page.fill('#city-input', search);
    await page.keyboard.press('Enter');
    const option = page.locator('#city-listbox li[role=option]', { hasText: name }).first();
    await option.waitFor({ timeout: 30_000 });
    await option.dispatchEvent('mousedown');
  } else {
    await page.fill('#city-input', name);
    await page.keyboard.press('Enter');
  }
  const t0 = Date.now();
  await page.click('#map-it');
  await page.waitForFunction(
    (n) =>
      document.querySelector('#city-name').textContent === n &&
      document.querySelector('#loading-panel').hidden,
    name,
    { timeout: 600_000, polling: 100 },
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

// World cities, found through Nominatim.
for (const [name, query] of [
  ['מונקו', 'monaco'],
  ['מנהטן', 'manhattan'],
  ...(process.env.LIVE_BIG ? [['ברלין', 'berlin']] : []),
]) {
  const r = await mapIt(name, query);
  const stats = await page.evaluate(() => window.__app.store.get().result?.stats);
  console.log(
    `  ${query}: ${r.error ? 'FAIL' : 'PASS'}, pipeline ${stats?.timeMs.toFixed(0)} ms, ${stats?.waysIn} ways`,
  );
  if (SHOTS) {
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/live-${query}.png` });
  }
}
await browser.close();
