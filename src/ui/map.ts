import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_CENTER, DEFAULT_ZOOM, TILE_ATTRIBUTION, TILE_MAX_ZOOM, TILE_URL } from '../config';

export function createMap(container: HTMLElement): L.Map {
  // Canvas rendering keeps large cities (thousands of polylines) responsive.
  const map = L.map(container, { preferCanvas: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  L.tileLayer(TILE_URL, {
    maxZoom: TILE_MAX_ZOOM,
    attribution: TILE_ATTRIBUTION,
  }).addTo(map);

  return map;
}
