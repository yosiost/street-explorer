// Map defaults. Kfar Saba is the default city (DESIGN.md, "User flow and UI").
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
