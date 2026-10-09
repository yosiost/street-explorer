import { RECENT_CITIES_MAX } from '../config';
import type { City } from './cities';

// World cities the user has opened, so they show up in the picker next time without a
// search. Per-browser convenience only: losing it just means searching again.
const KEY = 'street-explorer:recent-cities';

export function loadRecent(): City[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is City => typeof c?.id === 'number' && typeof c?.name === 'string',
    );
  } catch {
    return [];
  }
}

/** Puts `city` first in the recent list and returns the new list. */
export function rememberRecent(city: City, current: City[]): City[] {
  const next = [city, ...current.filter((c) => c.id !== city.id)].slice(0, RECENT_CITIES_MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked (private mode): the list just lives for this visit.
  }
  return next;
}

// The city shown last, so the app reopens on it.
const LAST_KEY = 'street-explorer:last-city';

export function loadLastCity(): City | null {
  try {
    const c = JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null') as City | null;
    return c && typeof c.id === 'number' && typeof c.name === 'string' ? c : null;
  } catch {
    return null;
  }
}

export function saveLastCity(city: City): void {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(city));
  } catch {
    // Storage blocked: the app opens on the default city next time.
  }
}
