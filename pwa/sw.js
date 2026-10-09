/* Service worker: makes the app installable and usable offline.
 *
 * - The app itself (HTML, scripts, styles, icons, bundled city data) is cached at install.
 *   Pages are network-first so a new version arrives as soon as there is a connection.
 * - OSM map tiles are network-first too, with the copy last seen as the offline fallback,
 *   as the OSM tile policy allows (no prefetching, nothing extra downloaded). The tile
 *   cache is capped.
 * - Overpass and Nominatim are not touched: city data lives in IndexedDB already.
 *
 * Built by the plugin in vite.config.ts, which fills in the file list and version.
 */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const APP_CACHE = `app-${VERSION}`;
const TILE_CACHE = 'tiles-v1';
const TILE_LIMIT = 800;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith('app-') && k !== APP_CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'tile.openstreetmap.org') {
    event.respondWith(networkFirst(req, TILE_CACHE, true));
  } else if (url.origin === self.location.origin) {
    event.respondWith(
      req.mode === 'navigate' ? networkFirst(req, APP_CACHE, false, './') : cacheFirst(req),
    );
  }
});

async function cacheFirst(req) {
  const hit = await caches.match(req, { ignoreSearch: true, ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(APP_CACHE)).put(req, res.clone());
  return res;
}

async function networkFirst(req, cacheName, trim, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    // Tiles are cross-origin; an opaque answer can't be checked, so keep only real ones.
    if (res.ok) {
      await cache.put(fallbackUrl ?? req, res.clone());
      if (trim) trimCache(cache);
    }
    return res;
  } catch (err) {
    const hit = await cache.match(fallbackUrl ?? req, {
      ignoreSearch: !!fallbackUrl,
      ignoreVary: true,
    });
    if (hit) return hit;
    throw err;
  }
}

async function trimCache(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - TILE_LIMIT))) await cache.delete(key);
}
