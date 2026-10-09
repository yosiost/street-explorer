// Refreshes the city data shipped with the app (public/data/<id>.json) from Overpass.
//
//   npm run snapshot            # every city in BUNDLED_CITY_IDS
//
// Uses the app's own query and endpoints through Vite, so it stays in sync with src/.

import { writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});
try {
  const { BUNDLED_CITY_IDS } = await vite.ssrLoadModule('/src/config.ts');
  const { cityQuery, runQuery } = await vite.ssrLoadModule('/src/data/overpass.ts');
  for (const id of BUNDLED_CITY_IDS) {
    console.log(`city ${id}: downloading…`);
    const res = await runQuery(cityQuery(id), {
      // overpass-api.de rejects requests without a descriptive User-Agent.
      fetchImpl: (url, init) =>
        fetch(url, { ...init, headers: { 'User-Agent': 'street-explorer/0.1 (snapshot)' } }),
      onRetry: ({ endpoint, reason }) => console.log(`  ${new URL(endpoint).host}: ${reason}`),
    });
    const ways = res.elements.filter((e) => e.type === 'way').length;
    if (!ways) throw new Error(`city ${id}: no streets in the answer, not saving`);
    writeFileSync(`public/data/${id}.json`, JSON.stringify(res));
    console.log(`  ${ways} ways, OSM ${res.osm3s?.timestamp_osm_base}`);
  }
} finally {
  await vite.close();
}
