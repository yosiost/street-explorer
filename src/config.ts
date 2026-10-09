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

// --- Data acquisition ---

export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
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

export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Bump when the geo pipeline changes; invalidates cached processed results only.
export const PIPELINE_VERSION = 1;

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
export const BORDER_SLIVER_M = 50;
export const BORDER_SLIVER_SHARE = 0.5;

// --- Orientation ---

export const WINDING_EIGEN_RATIO = 0.2;
export const WINDING_EXTENT_RATIO = 0.6;
export const WINDING_MIN_LENGTH_M = 50;
