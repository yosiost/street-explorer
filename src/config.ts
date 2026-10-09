// Map defaults. Kfar Saba is the default city (DESIGN.md, "User flow and UI").
export const DEFAULT_CITY_ID = 1383631;
export const DEFAULT_CENTER: [number, number] = [32.178, 34.907];
export const DEFAULT_ZOOM = 14;

// OSM standard tiles. The tile policy requires a valid Referer, so the app must be
// served over http(s), never opened from file://.
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const TILE_MAX_ZOOM = 19;

// Length of one football pitch in meters, used for the kid-friendly comparison.
export const FOOTBALL_PITCH_M = 105;
// One step of a 6-year-old, for "about 6,600 steps".
export const KID_STEP_M = 0.5;

// "Which is longer?" game. Streets shorter than this, or flagged tiny, are never asked
// about. The required length ratio between the two streets shrinks as the streak grows.
export const GAME_MIN_STREET_M = 60;
export const GAME_LEVELS = [
  { fromStreak: 0, minRatio: 2 },
  { fromStreak: 2, minRatio: 1.5 },
  { fromStreak: 4, minRatio: 1.3 },
  { fromStreak: 7, minRatio: 1.15 },
];
// Streets asked about in the last rounds are not asked again right away.
export const GAME_RECENT_ROUNDS = 6;

// --- Data acquisition ---

// Main instance first, then public mirrors that work from a browser (CORS). Checked
// 2026-10-09: kumi.systems was returning 500, so it is tried last; private.coffee answers
// curl but fails CORS in Chromium, so it is not listed.
export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
export const OVERPASS_TIMEOUT_MS = 120_000;
export const OVERPASS_BUSY_WAIT_MS = 5_000;
// overpass-api.de often answers 504 "too busy" several times in a row, so after every
// endpoint has failed we go around once more (still one request at a time).
export const OVERPASS_ROUNDS = 2;

// Road types counted as streets. Excluded on purpose: service, footway, path, cycleway,
// track, steps and all *_link ramps.
export const HIGHWAY_TYPES = [
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'unclassified',
  'residential',
  'living_street',
  'pedestrian',
];

// World search: Nominatim, OSM's own geocoder. Its usage policy allows at most one request
// per second and forbids search-as-you-type, so the app only searches when asked.
export const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
export const NOMINATIM_MIN_INTERVAL_MS = 1_100;
export const WORLD_SEARCH_LIMIT = 10;
export const RECENT_CITIES_MAX = 8;

// City size, from the search result's bounding box (not the real area, so generous).
// Above LARGE the download is slow and gets a longer Overpass timeout; above MAX it would
// be tens of thousands of streets, so we ask for a district instead.
// Bounding boxes: Kfar Saba 31 km², Paris 173, Manhattan 265, Berlin 1,702, New York 2,301,
// London 2,624.
export const CITY_LARGE_KM2 = 400;
export const CITY_MAX_KM2 = 2_000;
export const OVERPASS_LARGE_TIMEOUT_MS = 300_000;

export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Bump when the geo pipeline changes; invalidates cached processed results only.
export const PIPELINE_VERSION = 5;

// --- Street model ---

export const CONNECT_TOLERANCE_M = 15;
export const COMPONENT_SPLIT_M = 1_000;
export const SAMPLE_STEP_M = 10;
export const PAIR_MAX_DIST_M = 35;
export const PAIR_MIN_ANGLE_DEG = 135;
export const DUAL_FLAG_SHARE = 0.2;
export const TINY_STREET_M = 30;
// A clipped street with less than this much inside the city, and less than
// BORDER_SLIVER_SHARE of its ways inside, is a neighbor's street poking over the border.
export const BORDER_SLIVER_M = 100;
export const BORDER_SLIVER_SHARE = 0.5;

// --- Orientation ---

export const WINDING_EIGEN_RATIO = 0.2;
export const WINDING_EXTENT_RATIO = 0.6;
export const WINDING_MIN_LENGTH_M = 50;
