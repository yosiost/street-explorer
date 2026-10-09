# חוקרי הרחובות · Street Explorer

Pick a city, in Israel or anywhere in the world, and see all of its named streets on a map
and in a list sorted by length, with each street's orientation. Built for a curious kid and a parent to explore
together, so "which street is longest?" gets a believable answer.

Everything runs in the browser: data comes straight from OpenStreetMap's Overpass API (and
Nominatim for world search), and the geometry runs in a Web Worker. There is no backend. See [DESIGN.md](DESIGN.md) for the
full design.

## Run it

```sh
npm install
npm run dev        # http://localhost:5180
npm run build      # static site in dist/, host anywhere (GitHub Pages, Netlify…)
npm run preview    # serve dist/ locally
```

The app must be served over http(s), not opened from `file://`, because the OSM tile
policy requires a valid Referer.

## Use it

1. Type a city name (Hebrew or English) and press **הצג במפה**. Regional councils are
   hidden unless you tick **כולל מועצות אזוריות**.
   For a city outside Israel, type its name and pick **חיפוש ״…״ בכל העולם** at the end
   of the list (or just press Enter when nothing in Israel matches). Results show in Hebrew
   when OSM has a Hebrew name. Cities you opened are remembered for next time.
   Very large cities get a warning (the download can take minutes). Huge ones, like London,
   New York or Tokyo, can't be picked: search for a district instead (Manhattan,
   Westminster, Shibuya).
2. The first load of a city (one Overpass request for boundary and streets) takes
   5–30 s, sometimes more when Overpass is busy. After
   that it comes from the browser cache (IndexedDB, 30 days) and loads instantly.
3. Click a street in the list to highlight and zoom to it, or click a street on the map to
   find it in the list. **Esc** or a click on empty map clears the selection.

Add `?debug=1` to the URL for the debug panel. For every street it shows raw vs
deduplicated length, the paired (dual-carriageway) share, flags and links to each OSM way.
In the console, `__app.store.get()` shows the full state.

## How streets are measured

A "street" is every counted way in the city that shares a normalized name. The pipeline
(`src/geo/`):

1. **Names:** in Israeli cities use `name:he`, falling back to `name`; elsewhere use the
   local `name`. In Hebrew names, unify geresh and gershayim variants
   (`"` `”` `''` → `״`, `'` `’` → `׳`).
2. **Dropped:** roundabouts (`junction=roundabout`, or a closed way named `כיכר …`) and
   pedestrian areas (`area=yes`).
3. **Clipped** to the city boundary, keeping only the part inside the city.
4. **Grouped** by name. Groups more than 1 km apart become separate streets, e.g.
   "הרצל (1)" and "הרצל (2)".
5. **Dual carriageways:** where two oneway ways of the same street run in opposite
   directions within 35 m of each other, that stretch is counted once.
6. **Length** is geodesic (Turf). Streets under 30 m are marked `•` as possible mapping
   fragments.
7. **Orientation** comes from PCA over points sampled every 10 m. When there is no single
   axis, a street with three or more loose ends (T, Y, H shapes) is "מסתעף" (branched),
   and anything else is "מתפתל" (winding).

All thresholds are in `src/config.ts`. When the pipeline changes, bump `PIPELINE_VERSION`
to invalidate cached results. Raw Overpass responses stay cached.

## Tests

```sh
npm test           # unit tests: synthetic geometry + a real Kfar Saba fixture
npm run lint
npm run typecheck

# End to end (Playwright + Chromium; run `npx playwright install chromium` once)
npm run build && npm run preview &   # http://localhost:4179
npm run e2e        # Overpass served from fixtures: deterministic
npm run e2e:live   # real Overpass: timings depend on server load
```

Fixtures: `hoboken.json` (a street grid) and `monaco.json` (hills, French names) are real
Overpass responses too, and `nominatim.json` holds real search answers.

The fixture `test/fixtures/kfar-saba.json` is a real Overpass response (OSM data as of
2026-10-09), stored as separate boundary and streets responses. To refresh it, run
`cityQuery(1383631)` from `src/data/overpass.ts` and split the result with
`splitCityResponse` from `src/data/loader.ts`.

## Layout

```
src/
  config.ts            all constants and thresholds
  data/overpass.ts     queries, fetch with timeout, retry and endpoint fallback
  data/cache.ts        IndexedDB cache (idb-keyval)
  data/loader.ts       city list (cache → Overpass → bundled snapshot), city raw data
  data/search.ts       world search through Nominatim, city size from its bounding box
  data/recent.ts       world cities opened before (localStorage)
  geo/boundary.ts      boundary ring assembly, spatial index, line clipping
  geo/streets.ts       naming, grouping, components, dedup, measuring, flags
  geo/orientation.ts   PCA orientation and buckets
  geo/pipeline.ts      one city: raw Overpass JSON → streets
  worker.ts            runs the pipeline off the main thread
  ui/                  picker, map, list, loading/error panel, debug panel
```

## Data and attribution

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright),
available under the ODbL. Search by [Nominatim](https://nominatim.org/), used within its
[usage policy](https://operations.osmfoundation.org/policies/nominatim/): one request per
second at most, and only when you ask for a search. Tiles come from the OSM standard tile layer. Lengths are only
as good as OSM tagging. If the debug panel shows a mapping mistake (a wrong name, a
roundabout without `junction=roundabout`, a missing `oneway`), the best fix is to edit
OSM itself.
