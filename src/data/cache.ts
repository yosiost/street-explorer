import { createStore, del, get, set, type UseStore } from 'idb-keyval';
import { CACHE_TTL_MS } from '../config';

interface Entry<T> {
  savedAt: number;
  value: T;
}

let store: UseStore | null = null;
function getStore(): UseStore | null {
  if (store) return store;
  try {
    store = createStore('street-explorer', 'cache');
  } catch {
    store = null; // IndexedDB unavailable (e.g. some private modes): run uncached.
  }
  return store;
}

export async function cacheGet<T>(key: string, ttlMs = CACHE_TTL_MS): Promise<T | undefined> {
  const s = getStore();
  if (!s) return undefined;
  try {
    const entry = await get<Entry<T>>(key, s);
    if (!entry) return undefined;
    if (Date.now() - entry.savedAt > ttlMs) {
      await del(key, s);
      return undefined;
    }
    return entry.value;
  } catch {
    return undefined;
  }
}

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  const s = getStore();
  if (!s) return;
  try {
    await set(key, { savedAt: Date.now(), value } satisfies Entry<T>, s);
  } catch {
    // Quota or private mode: caching is an optimization, never fatal.
  }
}

/** Returns the cached value for `key`, or loads, caches and returns it. */
export async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== undefined) return hit;
  const value = await load();
  await cacheSet(key, value);
  return value;
}

export const cacheKeys = {
  cityList: 'raw:cities',
  boundary: (id: number) => `raw:boundary:${id}`,
  streets: (id: number) => `raw:streets:${id}`,
  processed: (id: number, version: number) => `processed:${id}:v${version}`,
};
