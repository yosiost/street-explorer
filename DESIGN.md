# City Streets Explorer — Design Doc

Oct 9, 2026 · @Yosi

## Overview and goals

Build a single-page web app that lets a user pick a city (from the Israeli list, or anywhere in the world through search), fetches its streets from OpenStreetMap, and shows them on a map plus a list sorted by length. The audience is young kids exploring their own city with a parent, so the answers to "which street is longest / shortest" must be believable, and the UI must be simple enough to use together.

Goals:

- Pick a city from a list of Israeli municipalities, or search for any city in the world, confirm, and see progress while data loads.
- Show the city boundary and all named streets on an interactive map.
- Show a list of streets with length and orientation, sortable longest-first or shortest-first.
- Clicking a street in the list highlights it on the map and zooms to it; clicking a street on the map shows a popup with name, length and orientation.
- Report orientation as one of: North–South, East–West, NE–SW, NW–SE, Winding, or Branched.

Non-goals for v1: routing, house numbers, offline-first mobile app, user accounts, any backend server.

UI language: Hebrew, right-to-left, with a switch to English (left-to-right); see milestone 7. In Israeli cities street names come from `name:he`, falling back to `name`; elsewhere from the local `name` (see step 1). Code, comments and identifiers in English.

## User flow and UI

The app has two states: a city picker, and a city view with the map on one side and the street list on the other (stacked on mobile, map on top).

1. **City picker.** A searchable dropdown (type-ahead in Hebrew) of Israeli municipalities, plus a "Map it" button. Default selection: Kfar Saba. The last option, "חיפוש ״…״ בכל העולם", searches the whole world for the typed text (also what Enter does when nothing local matches). Results show the name in Hebrew when OSM has one, with region and country. World cities that were opened are remembered in the browser and match as you type next time.
2. **Loading.** Clicking "Map it" shows a progress panel with named steps: fetching boundary and streets, computing lengths. Show a Cancel button. Expect 5–30 seconds depending on city size and Overpass load.
3. **City view — map.** Leaflet map fitted to the city boundary. Boundary drawn as a thin outline. All counted streets drawn in a neutral color, 3px.
4. **City view — list.** Header shows city name, street count and total street length in km. A sort toggle (longest first / shortest first) and a text filter by name. Each row: rank, street name, length, orientation arrow + label.
5. **List → map.** Clicking a row highlights that street (bright color, 6px, brought to front), fits the map to it, and opens its popup. Clicking another row moves the highlight. Esc or clicking empty map clears it.
6. **Map → list.** Clicking a street on the map highlights it, opens a popup, and scrolls the list to its row and marks it selected. Use a wider invisible hit line (about 12px) so thin streets are tappable for small fingers.
7. **Popup content.** Street name, length, orientation, number of OSM segments, and a fun comparison line.

Length format: under 1 km show meters rounded to 10 m ("430 מ׳"); 1 km and above show km with one decimal ("2.3 ק״מ").

Fun comparison for the kid, shown in the popup: length expressed as football pitches (105 m each), e.g. "כמו 22 מגרשי כדורגל". Keep it to one line; make the unit a single constant so it is easy to swap.

## Architecture and tech stack

The app is fully client-side: a static site, no backend. The browser calls the public Overpass API directly (it supports CORS), and all geometry work runs in the browser, in a Web Worker so the UI stays responsive.

| Concern       | Choice                                                                                    | Why                                                                                                                             |
| ------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Build         | Vite + TypeScript, vanilla (no framework)                                                 | Small app; Claude Code handles it well; fast dev server                                                                         |
| Map           | Leaflet 1.9                                                                               | Simple polyline highlight and popups; mature                                                                                    |
| Tiles         | OSM standard tiles, with attribution                                                      | Free; Hebrew labels in Israel. Must be served over http(s), not `file://`, because the OSM tile policy requires a valid Referer |
| Data          | Overpass API (`overpass-api.de`, fallbacks `maps.mail.ru`, `overpass.kumi.systems`)       | Only free source of street geometry with names                                                                                  |
| Geometry      | Turf.js (`length`, `booleanPointInPolygon`, `lineSplit`, `bearing`, `nearestPointOnLine`) | Geodesic lengths, boundary clipping                                                                                             |
| OSM → GeoJSON | `osmtogeojson`                                                                            | Assembles the multipolygon boundary from relation members                                                                       |
| Cache         | IndexedDB via `idb-keyval`                                                                | Avoid re-querying Overpass for the same city                                                                                    |
| Tests         | Vitest                                                                                    | Unit tests for grouping, dedup, orientation                                                                                     |

Run locally with `npm run dev`; `npm run build` produces a static `dist/` that can be hosted anywhere (GitHub Pages, Netlify).

Module layout:

- `src/data/overpass.ts`: query builders, fetch with timeout, retry and endpoint fallback.
- `src/data/cache.ts`: IndexedDB cache keyed by city relation id, with a 30-day TTL.
- `src/geo/streets.ts`: filter, clip, group by name, dedup dual carriageways, compute length.
- `src/geo/orientation.ts`: orientation classification.
- `src/worker.ts`: runs the geo pipeline off the main thread and posts progress messages.
- `src/ui/picker.ts`, `src/ui/map.ts`, `src/ui/list.ts`: the three UI parts, communicating through a small event bus or shared store (`selectedStreetId`, `sortDir`, `filterText`).

## Data acquisition

Two Overpass queries. The city list is fetched once and cached; boundary and streets are fetched per city in one request and cached by relation id. If the city list can't be fetched, the app falls back to a snapshot bundled at build time.

**1. City list.** All municipal boundaries in Israel. In Israeli OSM data, cities, local councils and regional councils are `admin_level=8`. The first run should log the count and a sample so we can confirm this. Regional councils are spread-out rural areas and make poor "cities", so hide them by default with a toggle (they usually carry "מועצה אזורית" in the name).

```
[out:json][timeout:60];
area["ISO3166-1"="IL"][admin_level=2]->.il;
rel(area.il)[boundary=administrative][admin_level=8][name];
out tags;
```

Keep `id`, `name:he` (fallback `name`), `name:en`. Sort by Hebrew name with `Intl.Collator('he')`.

**2. Boundary and streets.** One request returns the boundary relation with member geometry, then the named roads inside the city area. Include `geom` so no separate node fetch is needed. A single request instead of two halves the exposure to Overpass "too busy" errors. The boundary's outer and inner rings are stitched from the member ways into a (Multi)Polygon in our own code (`osmtogeojson` pulls in an XML library with critical security advisories).

```
[out:json][timeout:120];
rel(<id>)->.r;
.r out geom;
.r map_to_area->.city;
way(area.city)[highway~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian)$"][name];
out tags geom;
```

The highway list is a single config constant. Excluded on purpose: `service` (parking aisles, driveways), `footway`, `path`, `cycleway`, `track`, `steps`, and all `*_link` ramps. `pedestrian` is included because Israeli town centers often have pedestrian streets with real street names (מדרחוב).

Network rules:

- Timeout per request: 120 s. On HTTP 429 or 504, wait 5 s and retry once, then try the next endpoint. After all endpoints fail, go around the list once more.
- Show a clear Hebrew error with a Retry button if every endpoint fails.
- Endpoints must send CORS headers to work from a browser. As of 2026-10-09, `overpass.private.coffee` fails CORS in Chromium and `overpass.kumi.systems` returns HTTP 500.
- Never hammer Overpass. One request at a time, and use the cache first.
- Store raw responses in the cache, not processed output, so algorithm changes don't require refetching. Bump a `PIPELINE_VERSION` constant to invalidate processed results only.

**3. World search.** Any other city is found with [Nominatim](https://nominatim.org/), OSM's geocoder: `search?q=<text>&format=jsonv2&addressdetails=1&accept-language=he`. It returns Hebrew names where OSM has them ("פריז, איל-דה-פראנס, צרפת"). Photon was considered because it allows search-as-you-type, but it has no Hebrew. Rules:

- Nominatim's usage policy forbids autocomplete and allows at most one request per second, so the app searches only on an explicit action, spaced at least 1.1 s apart.
- Keep only relations (only they have a boundary to clip to), with category `boundary` or `place`. Merge results with the same name and bounding box: Paris comes back as a city, a commune and a département with one border.
- The result's `id` is the relation id, so boundary, streets and cache keys work exactly as for Israeli cities.
- **City size** is judged from the result's bounding box before downloading anything. Up to 400 km² is normal. Up to 2,000 km² is "large": a warning in the picker, a 300 s timeout and a "this can take minutes" note while loading. Above that the city is shown but can't be picked, with a hint to search for a district instead. For reference, bounding boxes: Kfar Saba 31 km², Paris 173, Manhattan 265 (about 9,000 street ways), Berlin 1,702, New York 2,301, London 2,624, and Tokyo with its islands over 3 million.

## Street model and length algorithm

A "street" is not an OSM object. It is all counted ways in the city that share a normalized name, minus double-counted carriageways. This step decides whether "longest street" is right, so it gets the most care and the most tests.

```ts
interface Street {
  id: string; // stable: normalized name + component index
  name: string; // display name (Hebrew)
  lengthM: number; // deduplicated length in meters
  rawLengthM: number; // plain sum, for debugging
  orientation: 'N-S' | 'E-W' | 'NE-SW' | 'NW-SE' | 'WINDING' | 'BRANCHED';
  bearingDeg: number; // principal axis, 0–180
  segments: Feature<LineString>[]; // clipped geometry for drawing
  wayIds: number[];
  flags: string[]; // e.g. 'dual-carriageway', 'clipped', 'split-components', 'tiny'
}
```

Pipeline, per city:

1. **Normalize names.** In Israeli cities use `name:he`, else `name`; elsewhere use `name` only, because the few famous streets that have a Hebrew name would otherwise split from their unevenly tagged neighbors. Trim and collapse whitespace. For names in Hebrew script, unify geresh/gershayim variants (`'` `’` `׳` → `׳`, `"` `”` `״` → `״`). Do not strip prefixes like "שדרות": שדרות ויצמן and ויצמן can be different streets.
2. **Drop roundabouts** (`junction=roundabout|circular`) from length, since a named roundabout would add its circumference. Also treat a closed way whose name starts with "כיכר" as a roundabout: Kfar Saba has several without the junction tag. Drop pedestrian areas (`area=yes`), whose outline is not a street. Keep all of these out of the drawing too.
3. **Clip to the boundary.** Overpass `way(area)` returns any way with at least one node inside, so ways crossing the border stick out. Split each way at the boundary outline (own code, with an `rbush` index of boundary edges, rather than `turf.lineSplit`) and keep the pieces whose midpoint is inside the polygon. Mark the street `clipped`. Result: length counts only the part inside the city. A clipped street with less than 100 m inside the city, and less than half of its ways' length inside, is a neighboring city's street poking over the border; drop it.
4. **Group by normalized name.**
5. **Split far-apart components.** Within a group, build connected components (two ways connect if endpoints are within 15 m). If two components are more than 1,000 m apart, they are treated as separate streets and shown as "הרצל (1)" and "הרצל (2)", flagged `split-components`. Otherwise keep one street even if there are small gaps.
6. **Deduplicate dual carriageways.** Applies to ways tagged `oneway=yes` (or `-1`). Sample each such way every 10 m. A sample is _paired_ if another oneway way of the same street lies within 35 m of it and its local bearing differs by more than 135° (i.e. runs the opposite way). Then: `lengthM = unpairedLength + pairedLength / 2`. This handles boulevards that are dual for only part of their length. Flag `dual-carriageway` when the paired share is over 20%.
7. **Measure** with `turf.length` in meters (geodesic). Keep `rawLengthM` alongside for the debug view.
8. **Flag tiny streets** under 30 m as `tiny`. They stay in the list (the shortest street is a real question) but get a small marker, because they are often mapping fragments rather than real streets.

Performance target: Kfar Saba (roughly 600–900 named ways) processed in under 2 s in the worker. Use a spatial index (`rbush` or `geokdbush`) for the pairing step so it is not O(n²) over the whole city; within one street it is fine.

## Orientation algorithm

Orientation is an axis, not a direction: a street runs North–South, not "from North to South". So the result is an angle in 0–180° mapped to four buckets, plus "Winding" or "Branched" when no single axis fits.

1. Project all sampled points of the street (every 10 m, after dedup) to local meters with an equirectangular projection centered on the street's centroid.
2. Run PCA on those points (2×2 covariance, closed-form eigenvectors). The first eigenvector is the principal axis; convert it to a compass bearing in 0–180°.
3. Linearity check: if the eigenvalue ratio λ2/λ1 > 0.2, or the spread of the points along the principal axis is under 60% of the street's length, there is no single axis.
4. Branching check (only when the linearity check failed): count the street's loose ends, meaning ends that no other piece of the same street meets. Loose oneway ends within 35 m of each other count as one, so a boulevard's two carriageway ends count once. If any connected part has three or more loose ends (T, Y, H shapes), classify as `BRANCHED`, else `WINDING`. A straight street with a short side spur passes the linearity check and keeps its bearing.
5. Otherwise bucket the bearing:

| Bearing (°)              | Code    | Hebrew label          |
| ------------------------ | ------- | --------------------- |
| 0–22.5 or 157.5–180      | N-S     | צפון–דרום             |
| 22.5–67.5                | NE-SW   | צפון-מזרח – דרום-מערב |
| 67.5–112.5               | E-W     | מזרח–מערב             |
| 112.5–157.5              | NW-SE   | צפון-מערב – דרום-מזרח |
| (linearity check failed) | WINDING | מתפתל                 |
| (failed, 3+ loose ends)  | BRANCHED | מסתעף                |

Show a small rotated line icon next to the label in the list, drawn from `bearingDeg` (a squiggle for Winding, a fork for Branched), so the orientation is readable at a glance even for a child who can't read the label yet. Streets shorter than 50 m show orientation but no WINDING check (too few points to judge).

Thresholds (0.2, 60%, 50 m) are config constants; expect to tune them once against Kfar Saba.

## Edge cases and known inaccuracies

The numbers are only as good as OSM tagging, and some will be off by tens of meters. The app should be honest about that: a small "how we measure" note in the footer, and a debug panel (toggle with `?debug=1`) showing raw vs deduplicated length, flags and way ids per street, with a link to each way on openstreetmap.org.

| Case                                                          | Effect if ignored                       | Handling                                                       |
| ------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------- |
| Boulevard mapped as two oneway ways                           | Length doubled; wrongly tops the list   | Pairing dedup (step 6)                                         |
| Road crosses city border (e.g. toward Ra'anana, Hod HaSharon) | Length includes the neighboring city    | Clip to boundary (step 3)                                      |
| Same name, two distant places                                 | Two streets merged into one long one    | Component split over 1,000 m (step 5)                          |
| Name typo or variant between segments                         | One street split into two shorter ones  | Normalization (step 1); otherwise visible in debug, fix in OSM |
| Named roundabout                                              | Circumference added                     | Excluded (step 2), including closed ways named "כיכר"           |
| Highway named only by number (e.g. road 4 with no `name`)     | Missing from list                       | Acceptable for v1; such roads usually have `ref` only          |
| Very short fragments                                          | Bogus "shortest street"                 | `tiny` flag, still listed                                      |
| Unnamed alleys and parking lanes                              | Noise                                   | Excluded by the highway filter and `[name]`                    |
| Overpass slow or rate-limited                                 | Stuck loading                           | Timeout, retry, fallback endpoint, cache                       |
| Large city (Jerusalem, Tel Aviv)                              | Slow render with thousands of polylines | Use Leaflet `preferCanvas: true`; worker for geometry          |
| Huge city (London, New York)                                  | Overpass timeout, browser out of memory | Size check from the search bounding box; ask for a district    |
| Names in other scripts ("Rue de l'Église")                    | Apostrophe turned into a Hebrew geresh  | Geresh/gershayim rules only apply to Hebrew names              |
| Places without street names (most of Japan)                   | Short or empty list                     | Expected: addresses there use blocks, not streets              |

If the debug panel shows a real OSM mistake in Kfar Saba (wrong name, missing `oneway`), the right fix is editing OSM itself. That is also a nice thing to do together with the kid.

## Implementation plan and acceptance criteria

Build in five milestones, each runnable and committed before the next. Instruction for Claude Code: stop after each milestone, run tests, and show a short summary before continuing.

1. **Scaffold.** Vite + TS project, Leaflet map centered on Kfar Saba, RTL Hebrew layout shell, Vitest set up, ESLint + Prettier.
2. **Data layer.** Overpass client with timeout, retry and fallback; IndexedDB cache; city list query and the picker UI. Save one real Kfar Saba response (boundary + streets) as a test fixture in `test/fixtures/kfar-saba.json` so tests never hit the network.
3. **Geo pipeline.** Steps 1–8 plus orientation, running in a Web Worker with progress messages. Unit tests against the fixture and against small synthetic cases (below).
4. **UI wiring.** Street list with sort and filter, map drawing, two-way selection, popups, length formatting, football-pitch comparison, loading and error states.
5. **Polish.** Debug panel, "how we measure" note, mobile layout, OSM attribution, `npm run build` and a README.

Synthetic unit tests (geometry built in code):

- [ ] Two parallel opposite oneway lines 1,000 m long, 20 m apart, same name → length ≈ 1,000 m (±1%), flag `dual-carriageway`.
- [ ] Same, but only the middle 400 m is dual → ≈ 1,000 m total.
- [ ] A line half inside, half outside a square boundary → length ≈ the inside half, flag `clipped`.
- [ ] Two same-name lines 3 km apart → two streets with suffixes (1) and (2).
- [ ] Name variants `רמב"ם` and `רמב״ם` → one street.
- [ ] Straight line at bearing 10° → N-S; 80° → E-W; 45° → NE-SW; 135° → NW-SE; a U shape → WINDING; a T or H shape → BRANCHED.
- [ ] A roundabout way with the street's name adds 0 m.

Acceptance on real data (Kfar Saba):

- [ ] Selecting Kfar Saba loads in under 30 s cold and under 2 s from cache.
- [ ] Every street in the list is drawn on the map, and every drawn street is in the list.
- [ ] Every street that is fully dual (paired share over 90%) has `lengthM` at most 60% of its `rawLengthM`. (Partly dual streets are flagged from 20% paired, so their length can legitimately be up to 90% of raw.)
- [ ] The top 10 longest and the 10 shortest streets are reviewed by hand in the debug panel against the map, and each looks plausible; anything off is either an algorithm fix or a noted OSM issue.
- [ ] Sort toggle, filter, list→map and map→list selection all work on desktop and on a phone.
- [ ] Picking a second city (e.g. Ra'anana) works without a reload.

**6. World cities** (added after v1). Nominatim world search in the picker, city size check, local street names outside Israel, recent cities. Fixtures: `hoboken.json` (a street grid in New Jersey), `monaco.json` (hills and French names) and `nominatim.json`.

- [x] A grid city comes out mostly N-S and E-W (Hoboken: over 85%).
- [x] French names keep their apostrophes; no Hebrew geresh in non-Hebrew names.
- [x] Searching "hoboken" offers הובוקן with its country; it loads with English street names.
- [x] Tokyo (the metropolis) is shown as too big and can't be picked.

**7. Fun for kids, and English.**

- *Which is longer?* Two streets drawn red and blue, everything else faded. Answer with a big button or by tapping the line; the lengths race as bars at the same speed, the winner gets a 🏆, a right answer gets confetti. Pairs come from streets of at least 60 m without the `tiny` flag, differ by a ratio of 2, then 1.5, 1.3 and 1.15 as the streak grows (`GAME_LEVELS`), and avoid the last six rounds' streets. Our street shows up in about a third of rounds.
- *Our street.* Set from any popup; stored per browser. Comparisons: whole multiples when longer ("like 8 of our street, end to end"), otherwise "about as long", "about half", "about a quarter", "much shorter". Kid steps are 0.5 m.
- *Read-aloud.* `speechSynthesis`, offered only when a voice exists for the UI language. Each piece is read by a voice picked explicitly for its script (Hebrew, English, or the default for other scripts), never left to the browser default. Lengths are spelled out ("3.3 קילומטר"), digits without separators.
- *English.* Every string lives in `src/i18n.ts` (the English table must match the Hebrew one key for key). Switching sets `<html lang dir>`, re-renders all text, and shows streets by `name:en` (most common by length among the street's ways; 416 of 421 in Kfar Saba) and cities by `name:en`. Grouping still uses the Hebrew or local name, so lengths don't change with the language. World search asks Nominatim for `namedetails`, so a result has both names.

- *Streets we walked.* A per-browser log, city → street → day. Walked streets are green on the map (our street's gold and the selection's orange win) and get a ✅ in the list. Progress is by length (share of the city's total). Stickers are derived from the log, never stored, so un-marking a street takes back what it earned; new ones pop up together in one card with confetti. The shortest-street sticker ignores `tiny` fragments.

- [x] Round 1 pairs differ by at least 2×; a right answer scores, a wrong one says "almost" gently.
- [x] Setting our street updates the open popup, stars the list row, and survives a reload.
- [x] Hebrew text is always read by the Hebrew voice, also in the English UI.
- [x] Switching language mid-game keeps the round and flips the page direction.
- [x] Walking our street (also the longest) earns four stickers in one pop-up; walks survive a reload.

Suggested first prompt for Claude Code: "Read DESIGN.md. Implement milestone 1 only, then stop and summarize." Save this doc as `DESIGN.md` in the repo root (export as Markdown).
