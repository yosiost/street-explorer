import type { OverpassResponse } from './osm';

export interface City {
  id: number;
  name: string; // Hebrew
  nameEn?: string;
  regional: boolean;
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
