import { BUNDLED_CITY_IDS, OVERPASS_TIMEOUT_MS } from '../config';
import { cacheKeys, cached, cacheGet, cacheSet } from './cache';
import { parseCityList, type City } from './cities';
import snapshot from './cities-snapshot.json';
import type { OverpassResponse } from './osm';
import { cityListQuery, cityQuery, runQuery, type RunQueryOptions } from './overpass';

const collator = new Intl.Collator('he');

export interface CityListResult {
  cities: City[];
  source: 'cache' | 'snapshot';
  /** With the snapshot: the list from Overpass once it arrives (null if that failed). */
  refresh?: Promise<City[] | null>;
}

function snapshotCities(): City[] {
  return [...(snapshot as City[])].sort((a, b) => collator.compare(a.name, b.name));
}

/**
 * City list: from the cache, else the snapshot bundled at build time right away, so the
 * app never waits for Overpass to start. In the snapshot case the fresh list is fetched in
 * the background and cached for next time.
 */
export async function loadCityList(): Promise<CityListResult> {
  const hit = await cacheGet<OverpassResponse>(cacheKeys.cityList);
  if (hit) return { cities: parseCityList(hit), source: 'cache' };
  const refresh = runQuery(cityListQuery(), { rounds: 1 })
    .then(async (res) => {
      await cacheSet(cacheKeys.cityList, res);
      const cities = parseCityList(res);
      console.info(
        `[cities] ${cities.length} admin_level=8 relations from Overpass, e.g.`,
        cities.slice(0, 5).map((c) => `${c.name} (${c.id})`),
      );
      return cities;
    })
    .catch((err) => {
      console.warn('[cities] Overpass failed, keeping the bundled list', err);
      return null;
    });
  return { cities: snapshotCities(), source: 'snapshot', refresh };
}

export interface CityRaw {
  boundary: OverpassResponse;
  streets: OverpassResponse;
}

/** Splits a cityQuery response into the boundary relation and the street ways. */
export function splitCityResponse(res: OverpassResponse): CityRaw {
  return {
    boundary: { ...res, elements: res.elements.filter((e) => e.type === 'relation') },
    streets: { ...res, elements: res.elements.filter((e) => e.type === 'way') },
  };
}

/** A city shipped with the app, or null. Same format as an Overpass cityQuery answer. */
export async function loadBundledCity(
  relationId: number,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): Promise<OverpassResponse | null> {
  if (!BUNDLED_CITY_IDS.includes(relationId)) return null;
  try {
    const res = await fetchImpl(`${import.meta.env.BASE_URL}data/${relationId}.json`);
    if (!res.ok) return null;
    const json = (await res.json()) as OverpassResponse;
    return Array.isArray(json.elements) ? json : null;
  } catch {
    return null; // fall back to Overpass
  }
}

/**
 * Raw boundary and streets for one city: from the cache, else the copy shipped with the app,
 * else Overpass.
 */
export async function loadCityRaw(
  relationId: number,
  opts: { signal?: AbortSignal } & Pick<RunQueryOptions, 'onRetry' | 'timeoutMs'> = {},
): Promise<CityRaw & { fromCache: boolean }> {
  const { signal, onRetry, timeoutMs = OVERPASS_TIMEOUT_MS } = opts;
  let fetched = false;
  const res = await cached(cacheKeys.city(relationId), async () => {
    const bundled = await loadBundledCity(relationId);
    if (bundled) return bundled;
    fetched = true;
    const query = cityQuery(relationId, Math.round(timeoutMs / 1000));
    return runQuery(query, { signal, onRetry, timeoutMs });
  });
  return { ...splitCityResponse(res), fromCache: !fetched };
}
