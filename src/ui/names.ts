import type { City } from '../data/cities';
import type { Street } from '../geo/streets';
import { getLang } from '../i18n';

/** A street's name in the UI language, when OSM has one; otherwise its own name. */
export function streetName(street: Pick<Street, 'name' | 'altNames'>): string {
  return street.altNames?.[getLang()] ?? street.name;
}

/** A city's name in the UI language, when known. */
export function cityName(city: Pick<City, 'name' | 'nameEn'>): string {
  return getLang() === 'en' ? (city.nameEn ?? city.name) : city.name;
}
