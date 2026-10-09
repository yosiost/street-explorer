// End-to-end smoke test in headless Chromium. Overpass is served from test fixtures, so
// it is deterministic and never touches the network (map tiles still load from OSM).
//
//   npm run build && npx vite preview --port 4179 &
//   node e2e/smoke.mjs [http://localhost:4179] [screenshot-dir]

import { readFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4179';
const SHOTS = process.argv[3];
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const fixture = JSON.parse(
  readFileSync(new URL('../test/fixtures/kfar-saba.json', import.meta.url)),
);
const hoboken = JSON.parse(readFileSync(new URL('../test/fixtures/hoboken.json', import.meta.url)));
const cities = readFileSync(new URL('../test/fixtures/cities.json', import.meta.url), 'utf8');
const nominatim = JSON.parse(
  readFileSync(new URL('../test/fixtures/nominatim.json', import.meta.url)),
);

let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
};

/** mode: 'ok' | 'fail' | 'slow' */
async function routeOverpass(page, mode = 'ok') {
  await page.route(/\/api\/interpreter/, async (route) => {
    const q = decodeURIComponent(route.request().postData() ?? '');
    if (mode === 'fail') return route.fulfill({ status: 500, body: 'down' });
    if (mode === 'slow') await new Promise((r) => setTimeout(r, 4000));
    const city = q.includes(`rel(${hoboken.relationId})`) ? hoboken : fixture;
    const body = q.includes('ISO3166')
      ? cities
      : JSON.stringify({
          ...city.streets,
          elements: [...city.boundary.elements, ...city.streets.elements],
        });
    await route.fulfill({ status: 200, contentType: 'application/json', body }).catch(() => {});
  });
  // World search: canned Nominatim answers keyed by query.
  await page.route(/nominatim\.openstreetmap\.org\/search/, (route) => {
    const q = new URL(route.request().url()).searchParams.get('q').toLowerCase();
    const body = JSON.stringify(nominatim[q] ?? []);
    return route.fulfill({ status: 200, contentType: 'application/json', body });
  });
}

const shot = (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png` });
const rowNames = (page) =>
  page.$$eval('.street-row .name', (els) => els.map((e) => e.firstChild?.textContent));
const selectedName = (page) =>
  page.$eval('.street-list .selected .name', (e) => e.firstChild?.textContent).catch(() => null);

const browser = await chromium.launch();
const errors = [];

/** A fake speechSynthesis with a Hebrew voice that records what is said. */
const fakeSpeech = () => {
  const voices = [
    { lang: 'en-US', name: 'Samantha', voiceURI: 'Samantha', localService: true, default: true },
    { lang: 'he-IL', name: 'Carmit', voiceURI: 'Carmit', localService: true },
  ];
  window.__spoken = [];
  window.__voices = [];
  const synth = {
    getVoices: () => voices,
    speak: (u) => {
      window.__spoken.push(u.text);
      window.__voices.push(u.voice?.name ?? 'default');
    },
    cancel() {},
    addEventListener() {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
    }
  };
};

// ---------- Desktop happy path ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'he-IL' });
  await ctx.addInitScript(fakeSpeech);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await routeOverpass(page);
  await page.goto(`${BASE}/?debug=1`);
  await page.waitForFunction(() => !document.querySelector('#city-input').disabled);
  check((await page.inputValue('#city-input')) === 'כפר סבא', 'default city is Kfar Saba');
  await shot(page, '01-start');

  // Type-ahead
  await page.click('#city-input');
  await page.fill('#city-input', 'רעננ');
  const opts = await page.$$eval('#city-listbox li', (els) => els.map((e) => e.textContent));
  check(opts.includes('רעננה'), `type-ahead finds רעננה (${opts.length} options)`);
  check(!opts.some((o) => o.includes('מועצה אזורית')), 'regional councils hidden by default');
  await page.keyboard.press('Escape');
  await page.fill('#city-input', 'כפר ס');
  await page.keyboard.press('Enter');
  check((await page.inputValue('#city-input')) === 'כפר סבא', 'Enter picks the best match');

  const t0 = Date.now();
  await page.click('#map-it');
  await page.waitForSelector('.street-row', { timeout: 30000 });
  const loadMs = Date.now() - t0;
  check(loadMs < 30000, `Kfar Saba loads (${loadMs} ms, fixtures)`);
  await page.waitForTimeout(1500); // tiles
  await shot(page, '02-loaded');

  const state = await page.evaluate(() => {
    const { store, mapView } = window.__app;
    const s = store.get();
    return { ids: s.result.streets.map((x) => x.id), drawn: mapView.drawnIds() };
  });
  const rows = await page.$$eval('.street-row', (els) => els.map((e) => e.dataset.id));
  check(rows.length === state.ids.length, `list shows every street (${rows.length})`);
  check(
    state.drawn.length === rows.length && rows.every((id) => state.drawn.includes(id)),
    'every listed street is drawn and every drawn street is listed',
  );
  const summary = await page.textContent('#list-summary');
  check(/רחובות · [\d.]+ ק״מ/.test(summary), `header summary: "${summary}"`);

  const names = await rowNames(page);
  check(names[0] === 'ויצמן', `longest first: ${names.slice(0, 3).join(', ')}`);
  await page.click('[data-sort="asc"]');
  const asc = await rowNames(page);
  check(asc[0] === names[names.length - 1], `shortest first: ${asc.slice(0, 3).join(', ')}`);
  await page.click('[data-sort="desc"]');

  // Filter
  await page.fill('#street-filter', 'ויצמ');
  const filtered = await rowNames(page);
  check(
    filtered.length >= 1 && filtered.every((n) => n.includes('ויצמ')),
    `filter: ${filtered.join(', ')}`,
  );
  await page.fill('#street-filter', 'zzzz');
  check(
    (await page.textContent('.street-list')).includes('אין רחוב'),
    'filter with no match says so',
  );
  await page.fill('#street-filter', '');

  // List → map
  await page.click('.street-row >> nth=2');
  await page.waitForSelector('.leaflet-popup .street-popup');
  const popup = await page.textContent('.street-popup');
  check(
    popup.includes(names[2]) && popup.includes('מגרשי כדורגל'),
    `popup for list click: ${names[2]}`,
  );
  check((await selectedName(page)) === names[2], 'clicked row is marked selected');
  await page.waitForTimeout(800);
  await shot(page, '03-list-select');
  const debugText = await page.textContent('#debug-panel');
  const wayLinks = await page.$$('#debug-panel a[href^="https://www.openstreetmap.org/way/"]');
  check(
    debugText.includes('raw length') && wayLinks.length > 0,
    'debug panel shows details and way links',
  );

  // Esc clears
  await page.keyboard.press('Escape');
  check((await selectedName(page)) === null, 'Esc clears selection');
  // Leaflet fades popups out before removing them.
  const popupGone = await page
    .waitForSelector('.leaflet-popup', { state: 'detached', timeout: 2000 })
    .then(
      () => true,
      () => false,
    );
  check(popupGone, 'Esc closes popup');

  // Map → list: click on a short-ish street far down the list.
  const target = state.ids[Math.floor(state.ids.length * 0.7)];
  await page.evaluate(() => window.__app.store.set({ selectedStreetId: null }));
  await page.evaluate((id) => {
    const { mapView } = window.__app;
    const line = mapView.layers.get(id);
    mapView.map.fitBounds(line.getBounds(), { maxZoom: 18, animate: false });
  }, target);
  await page.waitForTimeout(300);
  const pt = await page.evaluate((id) => {
    const p = window.__app.mapView.pointOnStreet(id);
    const r = document.querySelector('#map').getBoundingClientRect();
    return { x: r.left + p.x, y: r.top + p.y };
  }, target);
  // Click 4 px off the line: the wide hit area should still catch it.
  await page.mouse.click(pt.x + 4, pt.y + 4);
  await page.waitForTimeout(400);
  const sel = await page.evaluate(() => window.__app.store.get().selectedStreetId);
  check(sel !== null, `map click selects a street (${sel})`);
  // The list scrolls smoothly; wait for the selected row to come fully into view.
  const scrolled = await page
    .waitForFunction(
      () => {
        const row = document.querySelector('.street-list .selected');
        const list = document.querySelector('#street-list');
        if (!row) return false;
        const r = row.getBoundingClientRect();
        const l = list.getBoundingClientRect();
        return r.top >= l.top - 1 && r.bottom <= l.bottom + 1;
      },
      null,
      { timeout: 3000 },
    )
    .then(
      () => true,
      () => false,
    );
  check(scrolled, 'list scrolled to the selected row');
  check(!!(await page.$('.leaflet-popup .street-popup')), 'popup opened on map click');
  await shot(page, '04-map-select');

  // Click on empty map clears.
  const empty = await page.evaluate(() => {
    // Find a pixel with no street within 20 px.
    const { mapView, store } = window.__app;
    const r = document.querySelector('#map').getBoundingClientRect();
    const pts = store
      .get()
      .result.streets.flatMap((s) =>
        s.segments.flatMap((f) =>
          f.geometry.coordinates.map(([lon, lat]) =>
            mapView.map.latLngToContainerPoint([lat, lon]),
          ),
        ),
      );
    for (let y = 60; y < r.height - 60; y += 25)
      for (let x = 60; x < r.width - 60; x += 25)
        if (pts.every((p) => Math.hypot(p.x - x, p.y - y) > 40))
          return { x: r.left + x, y: r.top + y };
    return null;
  });
  if (empty) {
    await page.mouse.click(empty.x, empty.y);
    await page.waitForTimeout(200);
    check(
      (await page.evaluate(() => window.__app.store.get().selectedStreetId)) === null,
      'click on empty map clears',
    );
  } else check(false, 'found an empty spot on the map');

  // ----- Our street, kid units, read-aloud -----
  const openRow = async (name) => {
    await page.fill('#street-filter', name);
    await page.click('.street-row >> nth=0');
    await page.waitForFunction(
      (n) => document.querySelector('.leaflet-popup .street-popup h3')?.textContent.includes(n),
      name,
    );
    await page.fill('#street-filter', '');
  };
  await openRow('ויצמן');
  let popupText = await page.textContent('.street-popup');
  check(popupText.includes('👣') && popupText.includes('צעדים של ילד'), 'popup shows kid steps');
  await page.click('.street-popup .set-home');
  await page.waitForSelector('.street-popup .set-home[aria-pressed=true]');
  popupText = await page.textContent('.street-popup');
  check(popupText.includes('זה הרחוב שלנו!'), 'setting our street updates the open popup');
  check(
    await page.$eval('.street-list .selected .name', (e) => e.textContent.includes('⭐')),
    'our street gets a star in the list',
  );
  check(
    await page.evaluate(() => localStorage.getItem('street-explorer:home')?.includes('ויצמן')),
    'our street is remembered',
  );
  await openRow('סיפן');
  popupText = await page.textContent('.street-popup');
  check(
    /הרבה יותר קצר מהרחוב שלנו|רבע מהרחוב שלנו/.test(popupText),
    `other streets compare to ours: ${popupText.match(/⭐[^👣]*/u)?.[0]}`,
  );
  await page.click('.street-popup .speak');
  const spoken = await page.evaluate(() => window.__spoken.join(' | '));
  check(
    spoken.includes('סיפן') && spoken.includes('מטר') && spoken.includes('הרחוב שלנו'),
    `read-aloud: ${spoken}`,
  );
  await page.keyboard.press('Escape');

  // ----- "Which is longer?" game -----
  const lengthOf = (name) =>
    page.evaluate(
      (n) => window.__app.store.get().result.streets.find((s) => s.name === n).lengthM,
      name,
    );
  const choiceNames = () => page.$$eval('.choice bdi', (els) => els.map((e) => e.textContent));
  await page.click('#start-game');
  await page.waitForSelector('#game-panel:not([hidden]) .choice.red');
  check(await page.isHidden('#street-list'), 'game replaces the list');
  const [redName, blueName] = await choiceNames();
  const [redLen, blueLen] = [await lengthOf(redName), await lengthOf(blueName)];
  check(
    redName !== blueName && Math.max(redLen, blueLen) / Math.min(redLen, blueLen) >= 2,
    `round 1 is easy: ${redName} ${Math.round(redLen)} m vs ${blueName} ${Math.round(blueLen)} m`,
  );
  check(
    (await page.evaluate(() => window.__spoken.at(-1))) !== undefined &&
      (await page.evaluate(() => window.__spoken.join(' ').includes('מה יותר ארוך'))),
    'the question is read aloud',
  );
  await shot(page, '11-game-question');
  // Answer right with the button.
  await page.click(redLen > blueLen ? '.choice.red' : '.choice.blue');
  await page.waitForFunction(
    () => document.querySelector('.verdict').textContent.length > 0,
    null,
    {
      timeout: 5000,
    },
  );
  check((await page.textContent('.verdict')).startsWith('נכון'), 'right answer: נכון!');
  check((await page.textContent('.game-score')).includes('1'), 'score goes up');
  check(!!(await page.$('.map-emoji.trophy')), 'trophy on the winning street');
  check(
    await page.$$eval('.race-length', (els) => els.every((e) => e.textContent.length > 0)),
    'race shows both lengths',
  );
  await page.waitForTimeout(400);
  await shot(page, '12-game-answer');

  // Round 2: answer wrong by tapping the shorter street's line on the map.
  await page.click('.game-next');
  await page.waitForSelector('.choice.red:not([disabled])');
  const [r2, b2] = await choiceNames();
  const shorterSide = (await lengthOf(r2)) < (await lengthOf(b2)) ? 'red' : 'blue';
  const pt2 = await page.evaluate((side) => {
    const { mapView } = window.__app;
    const p = mapView.pointOnStreet(mapView.pair[side]);
    const r = document.querySelector('#map').getBoundingClientRect();
    return { x: r.left + p.x, y: r.top + p.y };
  }, shorterSide);
  await page.mouse.click(pt2.x, pt2.y);
  await page.waitForFunction(
    () => document.querySelector('.verdict').textContent.length > 0,
    null,
    {
      timeout: 5000,
    },
  );
  check(
    (await page.textContent('.verdict')).startsWith('כמעט'),
    'tapping the map line answers; wrong answer gets a gentle כמעט',
  );
  check((await page.textContent('.game-round')).includes('2'), 'round counter');
  await page.click('.game-exit');
  check(
    (await page.isVisible('#street-list')) && !(await page.$('.map-emoji.trophy')),
    'exiting the game brings the list back and clears the map',
  );

  // ----- Language switch -----
  check(
    await page.evaluate(() =>
      window.__voices.every(
        (v, i) => v === 'Carmit' || !/[\u0590-\u05FF]/.test(window.__spoken[i]),
      ),
    ),
    'Hebrew text is always read by the Hebrew voice',
  );
  await page.click('#lang-toggle');
  const html = await page.evaluate(() => ({
    dir: document.documentElement.dir,
    lang: document.documentElement.lang,
    title: document.querySelector('.app-title').textContent,
    toggle: document.querySelector('#lang-toggle').textContent.trim(),
  }));
  check(
    html.dir === 'ltr' &&
      html.lang === 'en' &&
      html.title === 'Street Explorers' &&
      html.toggle === 'עברית',
    `switching to English flips the page: ${JSON.stringify(html)}`,
  );
  const enNames = await rowNames(page);
  check(
    (await page.textContent('#list-summary')).includes('streets') &&
      enNames.filter((n) => /[A-Za-z]/.test(n)).length > enNames.length * 0.9,
    `street names in English: ${enNames.slice(0, 3).join(', ')}`,
  );
  check((await page.inputValue('#city-input')) === 'Kfar Saba', 'city name in English');
  await page.click('.street-row >> nth=0');
  await page.waitForSelector('.leaflet-popup .street-popup');
  const enPopup = await page.textContent('.street-popup');
  check(enPopup.includes('Length') && enPopup.includes('kid steps'), 'popup in English');
  await page.evaluate(() => {
    window.__spoken = [];
    window.__voices = [];
  });
  await page.click('.street-popup .speak');
  const enSpoken = await page.evaluate(() => ({ text: window.__spoken, voices: window.__voices }));
  check(
    enSpoken.voices[1] === 'Samantha' && enSpoken.text[1].includes('kilometers long'),
    `English read-aloud uses the English voice: ${enSpoken.text.join(' | ')}`,
  );
  await page.keyboard.press('Escape');
  await shot(page, '13-english');
  await page.click('#start-game');
  await page.waitForSelector('.choice.red');
  check((await page.textContent('.game-title')) === 'Which is longer?', 'game in English');
  await shot(page, '14-english-game');
  await page.click('#lang-toggle');
  check(
    (await page.textContent('.game-title')) === 'מה יותר ארוך?' &&
      (await page.evaluate(() => document.documentElement.dir)) === 'rtl',
    'switching back mid-game: Hebrew again',
  );
  await page.click('.game-exit');

  // Typing the picked city's full name filters by it (it used to show the whole list,
  // so Enter picked the first city in the alphabet).
  await page.click('#city-input');
  await page.fill('#city-input', 'כפר סבא');
  await page.keyboard.press('Enter');
  check(
    (await page.inputValue('#city-input')) === 'כפר סבא',
    'typing the exact picked name keeps it',
  );
  check(
    (await page.evaluate(() => window.__app.store.get().pickedCity.name)) === 'כפר סבא',
    'and Enter picks that city, not the first in the list',
  );

  // Second city without reload (same fixture data, different id flows through the cache keys).
  await page.click('#city-input');
  await page.fill('#city-input', 'רעננה');
  await page.keyboard.press('Enter');
  await page.click('#map-it');
  await page.waitForFunction(
    () => document.querySelector('#city-name').textContent === 'רעננה',
    null,
    { timeout: 30000 },
  );
  check(true, 'second city loads without a reload');

  // Cached reload of Kfar Saba is fast.
  await page.click('#city-input');
  await page.fill('#city-input', 'כפר סבא');
  await page.keyboard.press('Enter');
  const t1 = Date.now();
  await page.click('#map-it');
  await page.waitForFunction(() => document.querySelector('#city-name').textContent === 'כפר סבא');
  check(Date.now() - t1 < 2000, `cached Kfar Saba loads in ${Date.now() - t1} ms`);

  // World search: no local match, so Enter runs the search, then picks the first result.
  const optionTexts = () => page.$$eval('#city-listbox li', (els) => els.map((e) => e.textContent));
  await page.click('#city-input');
  await page.fill('#city-input', 'hoboken');
  const before = await optionTexts();
  check(
    before.length === 1 && before[0].includes('בכל העולם'),
    `no local match offers a world search: ${before.join(' / ')}`,
  );
  await page.keyboard.press('Enter');
  await page.waitForSelector('#city-listbox li[role=option] .context');
  const found = await optionTexts();
  check(
    found.some((t) => t.startsWith('הובוקן') && t.includes('ארצות הברית')),
    `world results in Hebrew with country: ${found.join(' / ')}`,
  );
  await shot(page, '09-world-search');
  await page.keyboard.press('Enter');
  check((await page.inputValue('#city-input')) === 'הובוקן', 'Enter picks the first world result');
  await page.click('#map-it');
  await page.waitForFunction(() => document.querySelector('#city-name').textContent === 'הובוקן');
  const hobokenNames = await rowNames(page);
  check(
    hobokenNames.includes('Washington Street') && !hobokenNames.some((n) => n.includes('׳')),
    `a world city loads with local street names (${hobokenNames.length} streets)`,
  );
  check(
    (await page.$eval('#street-list', (el) => el.scrollTop)) === 0,
    'a new city starts at the top of the list',
  );
  await page.waitForTimeout(1200);
  await shot(page, '10-world-city');

  // Recent cities: Hoboken now matches without a search.
  await page.click('#city-input');
  await page.fill('#city-input', 'הובו');
  const recent = await optionTexts();
  check(recent[0]?.startsWith('הובוקן'), `opened world city is remembered: ${recent[0]}`);
  await page.keyboard.press('Escape');

  // Too big: shown, explained, not selectable.
  await page.fill('#city-input', 'tokyo');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#city-listbox li[aria-disabled=true]');
  const tokyo = await page.textContent('#city-listbox li[aria-disabled=true]');
  check(tokyo.includes('טוקיו') && tokyo.includes('גדולה מדי'), `too-big city explained: ${tokyo}`);
  await page.click('#city-listbox li[aria-disabled=true]', { force: true });
  await page.keyboard.press('Escape');
  await page.click('.list-pane');
  check((await page.inputValue('#city-input')) === 'הובוקן', 'a too-big city cannot be picked');
  await ctx.close();
}

// ---------- Cancel and error ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await routeOverpass(page, 'slow');
  await page.goto(BASE);
  await page.waitForFunction(() => !document.querySelector('#city-input').disabled, null, {
    timeout: 15000,
  });
  await page.click('#map-it');
  await page.waitForSelector('#loading-panel:not([hidden])');
  await shot(page, '05-loading');
  const stepText = await page.textContent('#loading-steps');
  check(stepText.includes('גבול העיר'), 'loading panel shows named steps');
  await page.click('#cancel-load');
  check(await page.isHidden('#loading-panel'), 'Cancel hides the loading panel');
  check(!(await page.isDisabled('#map-it')), 'Map it is usable again after cancel');

  await page.unroute(/\/api\/interpreter/);
  await routeOverpass(page, 'fail');
  await page.click('#map-it');
  await page.waitForSelector('#error-panel:not([hidden])', { timeout: 60000 });
  await shot(page, '06-error');
  check(
    (await page.textContent('#error-text')).includes('OpenStreetMap'),
    'Hebrew error message shown',
  );
  await page.unroute(/\/api\/interpreter/);
  await routeOverpass(page, 'ok');
  await page.click('#retry-load');
  await page.waitForSelector('.street-row', { timeout: 30000 });
  check(true, 'Retry recovers');
  await ctx.close();
}

// ---------- Mobile ----------
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await routeOverpass(page);
  await page.goto(`${BASE}/?debug=1`);
  await page.waitForFunction(() => !document.querySelector('#city-input').disabled);
  await page.tap('#map-it');
  await page.waitForSelector('.street-row');
  await page.waitForTimeout(1200);
  const mapBox = await (await page.$('#map')).boundingBox();
  const listBox = await (await page.$('.list-pane')).boundingBox();
  check(mapBox.y < listBox.y, 'mobile: map stacked above list');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  check(!overflow, 'mobile: no horizontal scroll');
  await page.tap('#start-game');
  await page.waitForSelector('.choice.red');
  await page.waitForTimeout(300);
  const gameOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  check(!gameOverflow, 'mobile: game fits the screen');
  const toggleBox = await (await page.$('#lang-toggle')).boundingBox();
  const titleBox = await (await page.$('.app-title')).boundingBox();
  check(
    Math.abs(toggleBox.y + toggleBox.height / 2 - (titleBox.y + titleBox.height / 2)) < 12,
    'mobile: language button sits on the title row',
  );
  await shot(page, '07b-mobile-game');
  await page.tap('.game-exit');
  await page.tap('.street-row >> nth=0');
  await page.waitForSelector('.leaflet-popup .street-popup');
  check((await selectedName(page)) === 'ויצמן', 'mobile: tapping a row selects it');
  await page.waitForTimeout(800);
  await shot(page, '07-mobile');
  // Tap the map on a street.
  await page.keyboard.press('Escape');
  const id = await page.evaluate(
    () => window.__app.store.get().result.streets.find((s) => s.name === 'בן יהודה').id,
  );
  await page.evaluate((id) => {
    const { mapView } = window.__app;
    mapView.map.fitBounds(mapView.layers.get(id).getBounds(), { animate: false });
  }, id);
  await page.waitForTimeout(300);
  const pt = await page.evaluate((id) => {
    const p = window.__app.mapView.pointOnStreet(id);
    const r = document.querySelector('#map').getBoundingClientRect();
    return { x: r.left + p.x, y: r.top + p.y };
  }, id);
  await page.touchscreen.tap(pt.x + 4, pt.y + 4);
  await page.waitForTimeout(500);
  check((await selectedName(page)) === 'בן יהודה', 'mobile: tapping a street selects its row');
  await shot(page, '08-mobile-tap');
  await ctx.close();
}

await browser.close();
check(errors.length === 0, `no page errors ${errors.length ? JSON.stringify(errors) : ''}`);
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
