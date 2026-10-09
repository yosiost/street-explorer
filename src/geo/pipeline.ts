import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { OsmWay, OverpassResponse } from '../data/osm';
import { assembleBoundary, BoundaryIndex, boundaryRings } from './boundary';
import { makeProjection } from './geometry';
import { HEBREW_NAME_KEYS, LOCAL_NAME_KEYS } from './names';
import { buildStreets, type Street } from './streets';

export type PipelineStep = 'boundary' | 'clip' | 'group' | 'measure';

export interface CityResult {
  boundary: Feature<Polygon | MultiPolygon>;
  streets: Street[];
  stats: { waysIn: number; timeMs: number; osmTimestamp?: string };
}

export function processCity(
  raw: { boundary: OverpassResponse; streets: OverpassResponse },
  onProgress?: (step: PipelineStep, fraction: number) => void,
  opts: { hebrewNames?: boolean } = {},
): CityResult {
  const t0 = performance.now();
  onProgress?.('boundary', 0);
  const boundary = assembleBoundary(raw.boundary);
  if (!boundary) throw new Error('City boundary could not be assembled from OSM data');

  const rings = boundaryRings(boundary);
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring as [number, number][]) {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  }
  const projection = makeProjection((minLon + maxLon) / 2, (minLat + maxLat) / 2);
  const index = new BoundaryIndex(
    rings.map((r) => r.map(([lon, lat]) => projection.toXY(lon!, lat!))),
  );

  const ways = raw.streets.elements.filter((e): e is OsmWay => e.type === 'way');
  const streets = buildStreets(ways, {
    projection,
    boundary: index,
    nameKeys: opts.hebrewNames === false ? LOCAL_NAME_KEYS : HEBREW_NAME_KEYS,
    onProgress,
  });
  return {
    boundary,
    streets,
    stats: {
      waysIn: ways.length,
      timeMs: performance.now() - t0,
      osmTimestamp: raw.streets.osm3s?.timestamp_osm_base,
    },
  };
}
