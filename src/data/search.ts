import { NOMINATIM_MIN_INTERVAL_MS, NOMINATIM_SEARCH_URL, WORLD_SEARCH_LIMIT } from '../config';
import type { City } from './cities';

/** The fields of a Nominatim `format=jsonv2&addressdetails=1` result that we use. */
export interface NominatimPlace {
  osm_type: string;
  osm_id: number;
  category?: string;
  name?: string;
  display_name: string;
  addresstype?: string;
  /** [south, north, west, east] as strings. */
  boundingbox?: string[];
  address?: Record<string, string>;
}

export class SearchError extends Error {
  constructor(
    message: string,
    readonly aborted = false,
  ) {
    super(message);
    this.name = 'SearchError';
  }
}

/** Area of a lat/lon bounding box in km² (equirectangular, fine at city scale). */
export function bboxAreaKm2([south, north, west, east]: number[]): number {
  const kmPerDeg = 111.32;
  const midLat = ((south! + north!) / 2) * (Math.PI / 180);
  return (
    Math.abs(north! - south!) * kmPerDeg * Math.abs(east! - west!) * kmPerDeg * Math.cos(midLat)
  );
}

/**
 * Turns Nominatim results into cities. Only relations have a boundary to measure inside,
 * so nodes and ways are dropped. Nominatim often returns the same area several times (Paris
 * is a city, a commune and a département with identical borders); those are merged.
 */
export function parseNominatim(results: NominatimPlace[]): City[] {
  const cities: City[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (r.osm_type !== 'relation') continue;
    if (r.category && r.category !== 'boundary' && r.category !== 'place') continue;
    const name = (r.name || r.display_name.split(',')[0] || '').trim();
    if (!name) continue;
    const bbox = r.boundingbox?.map(Number);
    const key = `${name}|${bbox?.map((v) => v.toFixed(3)).join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const a = r.address ?? {};
    const region = a.state ?? a.province ?? a.region ?? a.county;
    const context = [region !== name ? region : undefined, a.country].filter(Boolean).join(', ');
    cities.push({
      id: r.osm_id,
      name,
      regional: false,
      country: a.country_code?.toLowerCase(),
      context: context || undefined,
      areaKm2: bbox?.length === 4 && bbox.every(Number.isFinite) ? bboxAreaKm2(bbox) : undefined,
    });
  }
  return cities;
}

let lastRequestAt = 0;

/**
 * Searches the whole world for a place by name. Names come back in Hebrew when OSM has a
 * Hebrew name, otherwise in the local language. Requests are spaced at least a second
 * apart, as the Nominatim usage policy asks.
 */
export async function searchWorld(
  query: string,
  opts: { signal?: AbortSignal; fetchImpl?: typeof fetch; now?: () => number } = {},
): Promise<City[]> {
  const { signal, fetchImpl = (...args) => fetch(...args), now = Date.now } = opts;
  const wait = lastRequestAt + NOMINATIM_MIN_INTERVAL_MS - now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  if (signal?.aborted) throw new SearchError('aborted', true);
  lastRequestAt = now();

  const url = new URL(NOMINATIM_SEARCH_URL);
  url.search = new URLSearchParams({
    q: query.trim(),
    format: 'jsonv2',
    addressdetails: '1',
    'accept-language': 'he',
    // Ask for more than we show: nodes and duplicate areas get filtered out.
    limit: String(WORLD_SEARCH_LIMIT * 2),
  }).toString();

  let res: Response;
  try {
    res = await fetchImpl(url, { signal });
  } catch (err) {
    if (signal?.aborted) throw new SearchError('aborted', true);
    throw new SearchError(err instanceof Error ? err.message : String(err));
  }
  if (!res.ok) throw new SearchError(`HTTP ${res.status}`);
  const json = (await res.json()) as NominatimPlace[];
  return parseNominatim(Array.isArray(json) ? json : []).slice(0, WORLD_SEARCH_LIMIT);
}
