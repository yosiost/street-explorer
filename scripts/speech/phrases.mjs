// Lists every piece of Hebrew the app says, for scripts/speech/record.py to record:
// the street names of the bundled cities and every read-aloud sentence.
//
//   node scripts/speech/phrases.mjs > phrases.json
//
// Uses the app's own code through Vite, so the list matches what the app says.

import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});
try {
  const { BUNDLED_CITY_IDS } = await vite.ssrLoadModule('/src/config.ts');
  const { processCity } = await vite.ssrLoadModule('/src/geo/pipeline.ts');
  const { splitCityResponse } = await vite.ssrLoadModule('/src/data/loader.ts');
  const { hebrewPhrases } = await vite.ssrLoadModule('/src/kids/phrases.ts');
  const streets = BUNDLED_CITY_IDS.flatMap((id) => {
    const res = JSON.parse(readFileSync(`public/data/${id}.json`, 'utf8'));
    return processCity(splitCityResponse(res)).streets;
  });
  const phrases = [...hebrewPhrases(streets)];
  process.stdout.write(`${JSON.stringify(phrases, null, 1)}\n`);
  console.error(`${phrases.length} phrases`);
} finally {
  await vite.close();
}
