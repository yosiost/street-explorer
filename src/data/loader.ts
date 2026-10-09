import { cacheKeys, cached, cacheGet, cacheSet } from './cache';
import { parseCityList, type City } from './cities';
import snapshot from './cities-snapshot.json';
import type { OverpassResponse } from './osm';
import {
  boundaryQuery,
  cityListQuery,
  runQuery,
  streetsQuery,
  type RunQueryOptions,
} from './overpass';

const collator = new Intl.Collator('he');

export interface CityListResult {
  cities: City[];
  source: 'cache' | 'network' | 'snapshot';
}

/**
 * City list: cache, then Overpass, then the snapshot bundled at build time so the picker
 * still works when Overpass is down.
 */
export async function loadCityList(): Promise<CityListResult> {
  const hit = await cacheGet<OverpassResponse>(cacheKeys.cityList);
  if (hit) return { cities: parseCityList(hit), source: 'cache' };
  try {
    const res = await runQuery(cityListQuery(), { rounds: 1 });
    await cacheSet(cacheKeys.cityList, res);
    const cities = parseCityList(res);
    console.info(
      `[cities] ${cities.length} admin_level=8 relations from Overpass, e.g.`,
      cities.slice(0, 5).map((c) => `${c.name} (${c.id})`),
    );
    return { cities, source: 'network' };
  } catch (err) {
    console.warn('[cities] Overpass failed, using bundled snapshot', err);
    const cities = [...(snapshot as City[])].sort((a, b) => collator.compare(a.name, b.name));
    return { cities, source: 'snapshot' };
  }
}

export interface CityRaw {
  boundary: OverpassResponse;
  streets: OverpassResponse;
}

export type LoadStep = 'boundary' | 'streets';

/** Fetches (or reads from cache) the raw boundary and streets for one city, sequentially. */
export async function loadCityRaw(
  relationId: number,
  opts: { signal?: AbortSignal; onStep?: (step: LoadStep) => void } & Pick<
    RunQueryOptions,
    'onRetry'
  > = {},
): Promise<CityRaw & { fromCache: boolean }> {
  const { signal, onStep, onRetry } = opts;
  let fetched = false;
  const fetchQuery = (q: string) => {
    fetched = true;
    return runQuery(q, { signal, onRetry });
  };
  onStep?.('boundary');
  const boundary = await cached(cacheKeys.boundary(relationId), () =>
    fetchQuery(boundaryQuery(relationId)),
  );
  onStep?.('streets');
  const streets = await cached(cacheKeys.streets(relationId), () =>
    fetchQuery(streetsQuery(relationId)),
  );
  return { boundary, streets, fromCache: !fetched };
}
