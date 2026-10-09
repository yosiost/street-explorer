import type { OsmWay } from '../src/data/osm';
import { BoundaryIndex } from '../src/geo/boundary';
import { makeProjection, type XY } from '../src/geo/geometry';
import { buildStreets } from '../src/geo/streets';

// Synthetic geometry is written in local meters around Kfar Saba.
export const proj = makeProjection(34.907, 32.178);

let nextId = 1;

export function way(name: string, xy: XY[], tags: Record<string, string> = {}): OsmWay {
  return {
    type: 'way',
    id: nextId++,
    tags: { highway: 'residential', name, ...tags },
    geometry: xy.map((p) => {
      const [lon, lat] = proj.toLonLat(p);
      return { lon, lat };
    }),
  };
}

/** Straight line from `from`, `length` meters long at compass bearing `bearingDeg`. */
export function straight(from: XY, length: number, bearingDeg: number, steps = 1): XY[] {
  const r = (bearingDeg * Math.PI) / 180;
  const pts: XY[] = [];
  for (let i = 0; i <= steps; i++) {
    const d = (length * i) / steps;
    pts.push([from[0] + d * Math.sin(r), from[1] + d * Math.cos(r)]);
  }
  return pts;
}

export function square(half: number): BoundaryIndex {
  return new BoundaryIndex([
    [
      [-half, -half],
      [half, -half],
      [half, half],
      [-half, half],
      [-half, -half],
    ],
  ]);
}

export function build(ways: OsmWay[], boundary?: BoundaryIndex) {
  return buildStreets(ways, { projection: proj, boundary });
}
