import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_CENTER, DEFAULT_ZOOM, TILE_ATTRIBUTION, TILE_MAX_ZOOM, TILE_URL } from '../config';
import type { CityResult } from '../geo/pipeline';
import type { Street } from '../geo/streets';

const STREET_STYLE: L.PolylineOptions = { color: '#5b6b7f', weight: 3, opacity: 0.85 };
const HIGHLIGHT_STYLE: L.PolylineOptions = { color: '#e8590c', weight: 6, opacity: 1 };
const HOME_STYLE: L.PolylineOptions = { color: '#f2b705', weight: 6, opacity: 1 };
// Game: everything else fades so the two contenders stand out.
const DIM_STYLE: L.PolylineOptions = { color: '#5b6b7f', weight: 2, opacity: 0.25 };
export const PAIR_COLORS = { red: '#e03131', blue: '#1c7ed6' } as const;
const pairStyle = (color: string, weight = 8): L.PolylineOptions => ({ color, weight, opacity: 1 });
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
  /** A click on one of the two game streets. */
  onPairClick(id: string): void;
  renderPopup(street: Street): HTMLElement;
}

export class MapView {
  readonly map: L.Map;
  private layers = new Map<string, L.Polyline>();
  private streets = new Map<string, Street>();
  private group = L.featureGroup();
  private boundary: L.GeoJSON | null = null;
  private selected: string | null = null;
  private homeId: string | null = null;
  private homeMarker: L.Marker | null = null;
  private pair: { red: string; blue: string } | null = null;
  private pairMarkers: L.Marker[] = [];
  private popup: { street: Street; popup: L.Popup } | null = null;
  private lastStreetClickAt = -1;

  constructor(
    container: HTMLElement,
    private readonly cb: MapCallbacks,
  ) {
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
      if (this.pair) {
        // In the game only the two contenders answer clicks, and no popup gives it away.
        if (id === this.pair.red || id === this.pair.blue) cb.onPairClick(id);
        return;
      }
      cb.onStreetClick(id);
      this.openPopup(id, e.latlng);
    });
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      // The same DOM click also reaches the map after hitting a street; ignore that one.
      if (e.originalEvent.timeStamp === this.lastStreetClickAt || this.pair) return;
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
      const line = L.polyline(latlngs, this.styleFor(street.id)) as L.Polyline & {
        streetId?: string;
      };
      line.streetId = street.id;
      this.layers.set(street.id, line);
      this.streets.set(street.id, street);
      this.group.addLayer(line);
    }
    // No animation: a zoom animation still running when the user picks a street would snap
    // the map back to the whole city as it finishes.
    this.map.fitBounds(this.boundary.getBounds(), { padding: [12, 12], animate: false });
    this.placeHomeMarker();
  }

  clear() {
    this.endPair();
    // Street ids repeat across cities ("הרצל#0"); main sets the new city's home again.
    this.homeId = null;
    this.homeMarker?.remove();
    this.homeMarker = null;
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
      this.layers.get(this.selected)?.setStyle(this.styleFor(this.selected));
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

  private styleFor(id: string): L.PolylineOptions {
    if (id === this.selected) return HIGHLIGHT_STYLE;
    return id === this.homeId ? HOME_STYLE : STREET_STYLE;
  }

  private openPopup(id: string, at: L.LatLng) {
    const street = this.streets.get(id);
    if (!street) return;
    const popup = L.popup({ autoPanPadding: [24, 24] })
      .setLatLng(at)
      .setContent(this.cb.renderPopup(street))
      .openOn(this.map);
    this.popup = { street, popup };
  }

  /** Re-renders the open popup, e.g. after "our street" changed. */
  refreshPopup() {
    if (this.popup?.popup.isOpen()) {
      this.popup.popup.setContent(this.cb.renderPopup(this.popup.street));
    }
  }

  /** Marks "our street" in gold with a star, when it is in this city. */
  setHome(id: string | null) {
    const old = this.homeId;
    this.homeId = id;
    if (old && !this.pair) this.layers.get(old)?.setStyle(this.styleFor(old));
    if (id && !this.pair) this.layers.get(id)?.setStyle(this.styleFor(id));
    this.placeHomeMarker();
  }

  private placeHomeMarker() {
    this.homeMarker?.remove();
    this.homeMarker = null;
    const line = this.homeId ? this.layers.get(this.homeId) : undefined;
    if (!line || this.pair) return;
    this.homeMarker = L.marker(midpointOf(line), {
      icon: L.divIcon({ className: 'map-emoji', html: '⭐', iconSize: [28, 28] }),
      interactive: false,
      keyboard: false,
    }).addTo(this.map);
  }

  // --- "Which is longer?" game ---

  /** Shows two streets in red and blue, everything else faded, both in view. */
  showPair(redId: string, blueId: string) {
    this.endPair();
    this.select(null);
    this.map.closePopup(); // an open popup would give the length away
    const red = this.layers.get(redId);
    const blue = this.layers.get(blueId);
    if (!red || !blue) return;
    this.pair = { red: redId, blue: blueId };
    this.homeMarker?.remove();
    this.homeMarker = null;
    for (const line of this.layers.values()) line.setStyle(DIM_STYLE);
    red.setStyle(pairStyle(PAIR_COLORS.red)).bringToFront();
    blue.setStyle(pairStyle(PAIR_COLORS.blue)).bringToFront();
    const bounds = red.getBounds().extend(blue.getBounds());
    this.map.fitBounds(bounds, { padding: [48, 48], maxZoom: 17, animate: false });
  }

  /** After the answer: the winner gets thicker and a trophy, the other one thinner. */
  revealPair(winnerId: string) {
    if (!this.pair) return;
    const loserId = winnerId === this.pair.red ? this.pair.blue : this.pair.red;
    const color = (id: string) => (id === this.pair!.red ? PAIR_COLORS.red : PAIR_COLORS.blue);
    const winner = this.layers.get(winnerId)!;
    this.layers.get(loserId)?.setStyle(pairStyle(color(loserId), 4));
    winner.setStyle(pairStyle(color(winnerId), 11)).bringToFront();
    this.pairMarkers.push(
      L.marker(midpointOf(winner), {
        // The pop-in animates an inner span: Leaflet positions the icon itself with a transform.
        icon: L.divIcon({
          className: 'map-emoji trophy',
          html: '<span>🏆</span>',
          iconSize: [36, 36],
        }),
        interactive: false,
        keyboard: false,
      }).addTo(this.map),
    );
  }

  /** Back to the normal map. */
  endPair() {
    for (const m of this.pairMarkers) m.remove();
    this.pairMarkers = [];
    if (!this.pair) return;
    this.pair = null;
    for (const [id, line] of this.layers) line.setStyle(this.styleFor(id));
    this.placeHomeMarker();
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
