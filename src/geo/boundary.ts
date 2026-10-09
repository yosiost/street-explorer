import type { Feature, MultiPolygon, Polygon, Position } from 'geojson';
import RBush from 'rbush';
import type { OverpassResponse, OsmRelation } from '../data/osm';
import { segmentIntersectionT, type BBox, type XY } from './geometry';

/**
 * Assembles a relation's outer/inner member ways (from `out geom`) into a (Multi)Polygon.
 * Replaces osmtogeojson for this one job.
 */
export function assembleBoundary(res: OverpassResponse): Feature<Polygon | MultiPolygon> | null {
  const rel = res.elements.find((e): e is OsmRelation => e.type === 'relation');
  if (!rel?.members) return null;

  const outerWays: Position[][] = [];
  const innerWays: Position[][] = [];
  for (const m of rel.members) {
    if (m.type !== 'way' || !m.geometry) continue;
    const coords = m.geometry.filter((g) => g !== null).map((g) => [g.lon, g.lat]);
    if (coords.length < 2) continue;
    (m.role === 'inner' ? innerWays : outerWays).push(coords);
  }

  const outers = stitchRings(outerWays);
  const inners = stitchRings(innerWays);
  if (outers.length === 0) return null;

  const polygons: Position[][][] = outers.map((o) => [o]);
  for (const inner of inners) {
    const owner = polygons.find((poly) => ringContains(poly[0]!, inner[0]!));
    owner?.push(inner);
  }

  const props = { id: rel.id, name: rel.tags?.['name:he'] ?? rel.tags?.name ?? '' };
  if (polygons.length === 1) {
    return {
      type: 'Feature',
      properties: props,
      geometry: { type: 'Polygon', coordinates: polygons[0]! },
    };
  }
  return {
    type: 'Feature',
    properties: props,
    geometry: { type: 'MultiPolygon', coordinates: polygons },
  };
}

const samePos = (a: Position, b: Position) => a[0] === b[0] && a[1] === b[1];

/** Joins way fragments that share end nodes into closed rings. */
export function stitchRings(ways: Position[][]): Position[][] {
  const remaining = ways.map((w) => [...w]);
  const rings: Position[][] = [];
  while (remaining.length) {
    const ring = remaining.shift()!;
    let extended = true;
    while (!samePos(ring[0]!, ring[ring.length - 1]!) && extended) {
      extended = false;
      const end = ring[ring.length - 1]!;
      for (let i = 0; i < remaining.length; i++) {
        const w = remaining[i]!;
        if (samePos(w[0]!, end)) ring.push(...w.slice(1));
        else if (samePos(w[w.length - 1]!, end)) ring.push(...w.slice(0, -1).reverse());
        else continue;
        remaining.splice(i, 1);
        extended = true;
        break;
      }
    }
    // An unclosed ring means broken OSM data; close it rather than drop the city.
    if (!samePos(ring[0]!, ring[ring.length - 1]!)) ring.push(ring[0]!);
    if (ring.length >= 4) rings.push(ring);
  }
  return rings;
}

function ringContains(ring: Position[], p: Position): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    if (yi > p[1]! !== yj > p[1]! && p[0]! < ((xj - xi) * (p[1]! - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function boundaryRings(f: Feature<Polygon | MultiPolygon>): Position[][] {
  return f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat();
}

interface Edge extends BBox {
  a: XY;
  b: XY;
}

/** Spatial index over boundary edges (in projected meters) for clipping and containment. */
export class BoundaryIndex {
  private tree = new RBush<Edge>();

  constructor(rings: XY[][]) {
    const edges: Edge[] = [];
    for (const ring of rings) {
      for (let i = 0; i + 1 < ring.length; i++) {
        const a = ring[i]!;
        const b = ring[i + 1]!;
        edges.push({
          a,
          b,
          minX: Math.min(a[0], b[0]),
          minY: Math.min(a[1], b[1]),
          maxX: Math.max(a[0], b[0]),
          maxY: Math.max(a[1], b[1]),
        });
      }
    }
    this.tree.load(edges);
  }

  /** Even-odd ray cast to +x; correct for multipolygons with holes. */
  contains(p: XY): boolean {
    const hits = this.tree.search({ minX: p[0], minY: p[1], maxX: Infinity, maxY: p[1] });
    let inside = false;
    for (const { a, b } of hits) {
      if (a[1] > p[1] !== b[1] > p[1]) {
        const x = ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0];
        if (p[0] < x) inside = !inside;
      }
    }
    return inside;
  }

  /** Parameters t in (0, 1) where segment a→b crosses the boundary, sorted. */
  crossings(a: XY, b: XY): number[] {
    const hits = this.tree.search({
      minX: Math.min(a[0], b[0]),
      minY: Math.min(a[1], b[1]),
      maxX: Math.max(a[0], b[0]),
      maxY: Math.max(a[1], b[1]),
    });
    const ts: number[] = [];
    for (const e of hits) {
      const t = segmentIntersectionT(a, b, e.a, e.b);
      if (t !== null && t > 1e-9 && t < 1 - 1e-9) ts.push(t);
    }
    return ts.sort((x, y) => x - y);
  }
}

export interface ClipResult {
  pieces: XY[][];
  /** True when some part of the line was outside the boundary and removed. */
  clipped: boolean;
}

/** Splits a line at the boundary and keeps the pieces whose midpoint is inside. */
export function clipLine(line: XY[], index: BoundaryIndex): ClipResult {
  const crossingsPerSeg: number[][] = [];
  let anyCrossing = false;
  for (let i = 0; i + 1 < line.length; i++) {
    const ts = index.crossings(line[i]!, line[i + 1]!);
    crossingsPerSeg.push(ts);
    if (ts.length) anyCrossing = true;
  }

  // Fast path: no crossings means the whole line is on one side.
  if (!anyCrossing) {
    const a = line[0]!;
    const b = line[1]!;
    const inside = index.contains([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
    return inside ? { pieces: [line], clipped: false } : { pieces: [], clipped: true };
  }

  const pieces: XY[][] = [];
  let current: XY[] = [];
  let clipped = false;
  const flush = () => {
    if (current.length >= 2) pieces.push(current);
    current = [];
  };
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const at = (t: number): XY =>
      t === 0 ? a : t === 1 ? b : [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    const ts = [0, ...crossingsPerSeg[i]!, 1];
    for (let k = 0; k + 1 < ts.length; k++) {
      const p0 = at(ts[k]!);
      const p1 = at(ts[k + 1]!);
      if (p0[0] === p1[0] && p0[1] === p1[1]) continue;
      if (index.contains([(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2])) {
        if (current.length === 0) current.push(p0);
        current.push(p1);
      } else {
        clipped = true;
        flush();
      }
    }
  }
  flush();
  return { pieces, clipped };
}
