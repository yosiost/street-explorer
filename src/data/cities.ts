import { CITY_LARGE_KM2, CITY_MAX_KM2 } from '../config';
import type { OverpassResponse } from './osm';

export interface City {
  /** OSM relation id of the boundary. */
  id: number;
  name: string; // Hebrew when OSM has it
  nameEn?: string;
  regional: boolean;
  /** ISO 3166-1 alpha-2, lowercase. Missing means Israel (the bundled list). */
  country?: string;
  /** Region and country for world search results, e.g. "איל-דה-פראנס, צרפת". */
  context?: string;
  /** Bounding-box area of the boundary in km², when the search told us. */
  areaKm2?: number;
}

export function isIsraeli(city: City): boolean {
  return !city.country || city.country === 'il';
}

export type CitySize = 'normal' | 'large' | 'too-big';

/** How heavy a city's download will be, judged from its bounding box. */
export function citySize(city: City): CitySize {
  const a = city.areaKm2;
  if (a === undefined || a <= CITY_LARGE_KM2) return 'normal';
  return a <= CITY_MAX_KM2 ? 'large' : 'too-big';
}

const collator = new Intl.Collator('he');

export function parseCityList(res: OverpassResponse): City[] {
  const cities: City[] = [];
  for (const el of res.elements) {
    if (el.type !== 'relation' || !el.tags) continue;
    const name = (el.tags['name:he'] ?? el.tags.name)?.trim();
    if (!name) continue;
    cities.push({
      id: el.id,
      name,
      nameEn: el.tags['name:en'],
      regional: name.includes('מועצה אזורית'),
    });
  }
  return cities.sort((a, b) => collator.compare(a.name, b.name));
}

/** Case- and punctuation-tolerant match for the type-ahead. */
export function matchesCity(city: City, query: string): boolean {
  const q = searchKey(query);
  if (!q) return true;
  return searchKey(city.name).includes(q) || searchKey(city.nameEn ?? '').includes(q);
}

/** Lowercased, without spaces, dashes or quote marks, for forgiving substring search. */
export function searchKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[-–־'"׳״’”\s]/g, '')
    .trim();
}
