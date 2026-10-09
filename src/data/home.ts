import type { HomeStreet } from '../kids/units';

// "Our street", per browser. One for the whole app, so streets in any city (even Broadway)
// can be compared with it.
const KEY = 'street-explorer:home';

export function loadHome(): HomeStreet | null {
  try {
    const h = JSON.parse(localStorage.getItem(KEY) ?? 'null') as HomeStreet | null;
    return h && typeof h.streetId === 'string' && h.lengthM > 0 ? h : null;
  } catch {
    return null;
  }
}

export function saveHome(home: HomeStreet | null): void {
  try {
    if (home) localStorage.setItem(KEY, JSON.stringify(home));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked (private mode): it lasts for this visit only.
  }
}
