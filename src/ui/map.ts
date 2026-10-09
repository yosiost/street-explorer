import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_CENTER, DEFAULT_ZOOM, TILE_ATTRIBUTION, TILE_MAX_ZOOM, TILE_URL } from '../config';
import type { CityResult } from '../geo/pipeline';
import type { Street } from '../geo/streets';
import { ORIENTATION_LABELS } from '../geo/orientation';
import { formatLength, formatPitches } from './format';

const STREET_STYLE: L.PolylineOptions = { color: '#5b6b7f', weight: 3, opacity: 0.85 };
const HIGHLIGHT_STYLE: L.PolylineOptions = { color: '#e8590c', weight: 6, opacity: 1 };
const BOUNDARY_STYLE: L.PathOptions = {
  color: '#3b5bdb',
  weight: 2,
  dashArray: '6 4',
  fill: false,
  interactive: false,
};

export interface MapCallbacks {
  onStreetClick(id: string): void;
  onEmptyClick(): void;
}

export class MapView {
  readonly map: L.Map;
  private layers = new Map<string, L.Polyline>();
  private streets = new Map<string, Street>();
  private group = L.featureGroup();
  private boundary: L.GeoJSON | null = null;
  private selected: string | null = null;
  private lastStreetClickAt = -1;

  constructor(container: HTMLElement, cb: MapCallbacks) {
    // Canvas keeps thousands of streets responsive. The renderer's tolerance widens the
    // click target around every line (~13 px total) so thin streets are easy to tap.
    const renderer = L.canvas({ tolerance: 5 });
    this.map = L.map(container, { preferCanvas: true, renderer }).setView(
      DEFAULT_CENTER,
      DEFAULT_ZOOM,
    );
    L.tileLayer(TILE_URL, { maxZoom: TILE_MAX_ZOOM, attribution: TILE_ATTRIBUTION }).addTo(
      this.map,
    );
    this.group.addTo(this.map);

    this.group.on('click', (e: L.LeafletMouseEvent) => {
      const id = (e.propagatedFrom as L.Polyline & { streetId?: string }).streetId;
      if (!id) return;
      this.lastStreetClickAt = e.originalEvent.timeStamp;
      cb.onStreetClick(id);
      this.openPopup(id, e.latlng);
    });
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      // The same DOM click also reaches the map after hitting a street; ignore that one.
      if (e.originalEvent.timeStamp === this.lastStreetClickAt) return;
      cb.onEmptyClick();
    });
  }

  showCity(result: CityResult) {
    this.clear();
    this.boundary = L.geoJSON(result.boundary, { style: BOUNDARY_STYLE }).addTo(this.map);
    for (const street of result.streets) {
      const latlngs = street.segments.map((f) =>
        f.geometry.coordinates.map(([lon, lat]) => L.latLng(lat!, lon!)),
      );
      const line = L.polyline(latlngs, STREET_STYLE) as L.Polyline & { streetId?: string };
      line.streetId = street.id;
      this.layers.set(street.id, line);
      this.streets.set(street.id, street);
      this.group.addLayer(line);
    }
    // No animation: a zoom animation still running when the user picks a street would snap
    // the map back to the whole city as it finishes.
    this.map.fitBounds(this.boundary.getBounds(), { padding: [12, 12], animate: false });
  }

  clear() {
    this.group.clearLayers();
    this.boundary?.remove();
    this.boundary = null;
    this.layers.clear();
    this.streets.clear();
    this.selected = null;
    this.map.closePopup();
  }

  /** Moves the highlight. With `focus`, also fits the map to the street and opens its popup. */
  select(id: string | null, focus = false) {
    if (this.selected && this.selected !== id) {
      this.layers.get(this.selected)?.setStyle(STREET_STYLE);
    }
    this.selected = id;
    if (!id) {
      this.map.closePopup();
      return;
    }
    const line = this.layers.get(id);
    if (!line) return;
    line.setStyle(HIGHLIGHT_STYLE);
    line.bringToFront();
    if (focus) {
      this.map.fitBounds(line.getBounds(), { padding: [40, 40], maxZoom: 17 });
      this.openPopup(id, midpointOf(line));
    }
  }

  private openPopup(id: string, at: L.LatLng) {
    const street = this.streets.get(id);
    if (!street) return;
    L.popup({ autoPanPadding: [24, 24] })
      .setLatLng(at)
      .setContent(popupContent(street))
      .openOn(this.map);
  }

  /** Ids of the streets currently drawn (for the debug hook and tests). */
  drawnIds(): string[] {
    return [...this.layers.keys()];
  }

  /** Screen point on a street's line, relative to the map container. */
  pointOnStreet(id: string): L.Point | null {
    const line = this.layers.get(id);
    return line ? this.map.latLngToContainerPoint(midpointOf(line)) : null;
  }
}

/** A point on the street's longest segment, so the popup sits on the line itself. */
function midpointOf(line: L.Polyline): L.LatLng {
  const parts = line.getLatLngs() as L.LatLng[][];
  let best = parts[0]!;
  let bestLen = -1;
  for (const p of parts) {
    let len = 0;
    for (let i = 1; i < p.length; i++) len += p[i - 1]!.distanceTo(p[i]!);
    if (len > bestLen) {
      bestLen = len;
      best = p;
    }
  }
  let half = bestLen / 2;
  for (let i = 1; i < best.length; i++) {
    const a = best[i - 1]!;
    const b = best[i]!;
    const d = a.distanceTo(b);
    if (d >= half) {
      const t = d === 0 ? 0 : half / d;
      return L.latLng(a.lat + t * (b.lat - a.lat), a.lng + t * (b.lng - a.lng));
    }
    half -= d;
  }
  return best[0]!;
}

function popupContent(street: Street): HTMLElement {
  const el = document.createElement('div');
  el.className = 'street-popup';
  el.dir = 'rtl';
  const h = document.createElement('h3');
  h.textContent = street.name;
  const dl = document.createElement('dl');
  const rows: [string, string][] = [
    ['אורך', formatLength(street.lengthM)],
    ['כיוון', ORIENTATION_LABELS[street.orientation]],
    ['מקטעים במפה', String(street.wayIds.length)],
  ];
  for (const [k, v] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    dl.append(dt, dd);
  }
  const fun = document.createElement('p');
  fun.className = 'fun';
  fun.textContent = `⚽ ${formatPitches(street.lengthM)}`;
  el.append(h, dl, fun);
  return el;
}
