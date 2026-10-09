import turfLength from '@turf/length';
import { lineString } from '@turf/helpers';
import type { Feature, LineString } from 'geojson';
import {
  BORDER_SLIVER_M,
  BORDER_SLIVER_SHARE,
  COMPONENT_SPLIT_M,
  CONNECT_TOLERANCE_M,
  DUAL_FLAG_SHARE,
  PAIR_MAX_DIST_M,
  PAIR_MIN_ANGLE_DEG,
  SAMPLE_STEP_M,
  TINY_STREET_M,
} from '../config';
import type { OsmWay } from '../data/osm';
import { clipLine, type BoundaryIndex } from './boundary';
import {
  bboxGap,
  bboxOf,
  dist,
  lineLineDistance,
  pointSegmentDistance,
  sampleLine,
  type BBox,
  type Projection,
  type XY,
} from './geometry';
import { streetNameOf } from './names';
import { classifyOrientation, type Orientation, type WeightedPoint } from './orientation';

export type StreetFlag = 'dual-carriageway' | 'clipped' | 'split-components' | 'tiny';

export interface Street {
  id: string; // stable: normalized name + component index
  name: string; // display name (Hebrew)
  lengthM: number; // deduplicated length in meters
  rawLengthM: number; // plain sum, for debugging
  orientation: Orientation;
  bearingDeg: number; // principal axis, 0–180
  segments: Feature<LineString>[]; // clipped geometry for drawing
  wayIds: number[];
  flags: StreetFlag[];
  /** Share of rawLengthM found to be one of two opposite carriageways (debug). */
  pairedShare: number;
}

/** One clipped piece of one OSM way. */
export interface Piece {
  wayId: number;
  xy: XY[];
  /** 1 = travel follows geometry, -1 = against it, 0 = two-way. */
  oneway: 0 | 1 | -1;
  clipped: boolean;
  lengthM: number; // geodesic
  /** Geodesic length of the whole OSM way before clipping. */
  wayLengthM: number;
  bbox: BBox;
}

function onewayOf(tags: Record<string, string> | undefined): 0 | 1 | -1 {
  const v = tags?.oneway;
  if (v === 'yes' || v === '1' || v === 'true') return 1;
  if (v === '-1' || v === 'reverse') return -1;
  return 0;
}

function isRoundabout(way: OsmWay, name: string): boolean {
  const j = way.tags?.junction;
  if (j === 'roundabout' || j === 'circular') return true;
  // Roundabouts are often mapped as a closed way named "כיכר …" without the junction tag.
  const g = way.geometry;
  const first = g?.[0];
  const last = g?.[g.length - 1];
  const closed = !!first && !!last && first.lat === last.lat && first.lon === last.lon;
  return closed && name.startsWith('כיכר');
}

/** Pedestrian plazas mapped as areas: their outline is not a street length. */
function isArea(tags: Record<string, string> | undefined): boolean {
  return tags?.area === 'yes';
}

export interface BuildStreetsOptions {
  projection: Projection;
  /** When given, ways are clipped to it. */
  boundary?: BoundaryIndex;
  onProgress?: (step: 'clip' | 'group' | 'measure', fraction: number) => void;
}

export interface NamedPieces {
  groups: Map<string, Piece[]>;
  /** Names that lost at least one whole way to clipping. */
  clippedNames: Set<string>;
}

/** Steps 1–4 of the pipeline: name, drop roundabouts, clip, group by name. */
export function piecesByName(ways: OsmWay[], opts: BuildStreetsOptions): NamedPieces {
  const { projection, boundary, onProgress } = opts;
  const groups = new Map<string, Piece[]>();
  const clippedNames = new Set<string>();
  ways.forEach((way, i) => {
    if (i % 200 === 0) onProgress?.('clip', i / ways.length);
    const name = streetNameOf(way.tags);
    if (!name || !way.geometry || isRoundabout(way, name) || isArea(way.tags)) return;
    const xy = way.geometry.filter((g) => g !== null).map((g) => projection.toXY(g.lon, g.lat));
    if (xy.length < 2) return;
    const { pieces, clipped } = boundary
      ? clipLine(xy, boundary)
      : { pieces: [xy], clipped: false };
    const geodesicM = (line: XY[]) =>
      turfLength(lineString(line.map((p) => projection.toLonLat(p))), { units: 'kilometers' }) *
      1000;
    const wayLengthM = clipped ? geodesicM(xy) : 0;
    for (const pxy of pieces) {
      const lengthM = geodesicM(pxy);
      if (lengthM < 0.01) continue;
      const piece: Piece = {
        wayId: way.id,
        xy: pxy,
        oneway: onewayOf(way.tags),
        clipped,
        lengthM,
        wayLengthM: clipped ? wayLengthM : lengthM,
        bbox: bboxOf(pxy),
      };
      const list = groups.get(name);
      if (list) list.push(piece);
      else groups.set(name, [piece]);
    }
    // A way entirely outside still marks its street as clipped if other parts survive.
    if (clipped && pieces.length === 0) clippedNames.add(name);
  });
  return { groups, clippedNames };
}

/** Groups pieces into connected components (endpoints within CONNECT_TOLERANCE_M). */
export function connectedComponents(pieces: Piece[]): number[][] {
  const parent = pieces.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };
  for (let i = 0; i < pieces.length; i++) {
    const a = pieces[i]!;
    const aEnds = [a.xy[0]!, a.xy[a.xy.length - 1]!];
    for (let j = i + 1; j < pieces.length; j++) {
      const b = pieces[j]!;
      if (bboxGap(a.bbox, b.bbox) > CONNECT_TOLERANCE_M) continue;
      const bEnds = [b.xy[0]!, b.xy[b.xy.length - 1]!];
      // Endpoint to endpoint, or endpoint onto the other line (T-junctions).
      const touches =
        aEnds.some((p) => bEnds.some((q) => dist(p, q) <= CONNECT_TOLERANCE_M)) ||
        aEnds.some((p) => nearLine(p, b.xy)) ||
        bEnds.some((p) => nearLine(p, a.xy));
      if (touches) union(i, j);
    }
  }
  return groupIndices(pieces.length, find);
}

function nearLine(p: XY, line: XY[]): boolean {
  for (let i = 0; i + 1 < line.length; i++) {
    if (pointSegmentDistance(p, line[i]!, line[i + 1]!) <= CONNECT_TOLERANCE_M) return true;
  }
  return false;
}

function groupIndices(n: number, find: (i: number) => number): number[][] {
  const byRoot = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const list = byRoot.get(r);
    if (list) list.push(i);
    else byRoot.set(r, [i]);
  }
  return [...byRoot.values()];
}

/**
 * Merges components that are within COMPONENT_SPLIT_M of each other (single linkage), so
 * small gaps keep one street while far-apart same-name streets become separate.
 */
export function clusterComponents(pieces: Piece[], components: number[][]): number[][] {
  const parent = components.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const boxes = components.map((c) => mergeBoxes(c.map((i) => pieces[i]!.bbox)));
  for (let a = 0; a < components.length; a++) {
    for (let b = a + 1; b < components.length; b++) {
      if (find(a) === find(b)) continue;
      if (bboxGap(boxes[a]!, boxes[b]!) > COMPONENT_SPLIT_M) continue;
      if (componentDistance(pieces, components[a]!, components[b]!) <= COMPONENT_SPLIT_M) {
        parent[find(a)] = find(b);
      }
    }
  }
  return groupIndices(components.length, find).map((group) =>
    group.flatMap((ci) => components[ci]!),
  );
}

function componentDistance(pieces: Piece[], a: number[], b: number[]): number {
  let best = Infinity;
  for (const i of a) {
    for (const j of b) {
      const pa = pieces[i]!;
      const pb = pieces[j]!;
      if (bboxGap(pa.bbox, pb.bbox) >= best) continue;
      best = Math.min(best, lineLineDistance(pa.xy, pb.xy));
      if (best <= COMPONENT_SPLIT_M) return best;
    }
  }
  return best;
}

function mergeBoxes(boxes: BBox[]): BBox {
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    maxY: Math.max(...boxes.map((b) => b.maxY)),
  };
}

const PAIR_COS = Math.cos((PAIR_MIN_ANGLE_DEG * Math.PI) / 180);

/**
 * Dual-carriageway dedup. Each oneway piece is sampled; a sample is paired when another
 * oneway piece of the same street runs the opposite way within PAIR_MAX_DIST_M.
 * Returns, per piece, the share of its length that is paired.
 */
export function pairedShares(pieces: Piece[]): number[] {
  return pieces.map((piece, i) => {
    if (piece.oneway === 0) return 0;
    const others = pieces.filter(
      (o, j) => j !== i && o.oneway !== 0 && bboxGap(o.bbox, piece.bbox) <= PAIR_MAX_DIST_M,
    );
    if (others.length === 0) return 0;
    const samples = sampleLine(piece.xy, SAMPLE_STEP_M);
    let paired = 0;
    for (const s of samples) {
      const dx = s.dir[0] * piece.oneway;
      const dy = s.dir[1] * piece.oneway;
      if (others.some((o) => opposesAt(s.p, dx, dy, o))) paired++;
    }
    return samples.length ? paired / samples.length : 0;
  });
}

function opposesAt(p: XY, dx: number, dy: number, other: Piece): boolean {
  // Use the nearest segment of the other piece, so a curve far away does not count.
  let bestD = Infinity;
  let bestK = -1;
  for (let k = 0; k + 1 < other.xy.length; k++) {
    const d = pointSegmentDistance(p, other.xy[k]!, other.xy[k + 1]!);
    if (d < bestD) {
      bestD = d;
      bestK = k;
    }
  }
  if (bestD > PAIR_MAX_DIST_M || bestK < 0) return false;
  const a = other.xy[bestK]!;
  const b = other.xy[bestK + 1]!;
  const len = dist(a, b);
  if (len === 0) return false;
  const ox = ((b[0] - a[0]) / len) * other.oneway;
  const oy = ((b[1] - a[1]) / len) * other.oneway;
  return dx * ox + dy * oy < PAIR_COS;
}

/** Steps 4–8: group, split components, dedup, measure, flag; plus orientation. */
export function buildStreets(ways: OsmWay[], opts: BuildStreetsOptions): Street[] {
  const { groups, clippedNames } = piecesByName(ways, opts);
  const streets: Street[] = [];
  let done = 0;
  for (const [name, pieces] of groups) {
    if (done++ % 50 === 0) opts.onProgress?.('group', done / groups.size);
    const clusters = clusterComponents(pieces, connectedComponents(pieces))
      .map((idx) => idx.map((i) => pieces[i]!))
      .map((ps) => ({ ps, len: ps.reduce((s, p) => s + p.lengthM, 0) }))
      .filter(({ ps, len }) => !isBorderSliver(ps, len))
      // Stable order: longest first, then westmost.
      .sort((a, b) => b.len - a.len || a.ps[0]!.bbox.minX - b.ps[0]!.bbox.minX);

    clusters.forEach(({ ps }, k) => {
      const split = clusters.length > 1;
      streets.push(
        measureStreet(
          ps,
          split ? `${name} (${k + 1})` : name,
          `${name}#${k}`,
          split,
          clippedNames.has(name),
          opts.projection,
        ),
      );
    });
  }
  opts.onProgress?.('measure', 1);
  return streets;
}

/**
 * A street branches when one connected part has three or more loose ends. An end is loose
 * when no other piece of the street meets it. Loose oneway ends within PAIR_MAX_DIST_M of
 * each other count as one, so a boulevard whose two carriageways end side by side has one
 * end there, not two.
 */
export function isBranched(pieces: Piece[]): boolean {
  const loose: { p: XY; piece: number }[] = [];
  pieces.forEach((pc, i) => {
    for (const p of [pc.xy[0]!, pc.xy[pc.xy.length - 1]!]) {
      const meets = pieces.some((other, j) => j !== i && nearLine(p, other.xy));
      if (!meets) loose.push({ p, piece: i });
    }
  });

  const parent = loose.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  for (let i = 0; i < loose.length; i++) {
    for (let j = i + 1; j < loose.length; j++) {
      const a = loose[i]!;
      const b = loose[j]!;
      const bothOneway = pieces[a.piece]!.oneway !== 0 && pieces[b.piece]!.oneway !== 0;
      if (bothOneway && dist(a.p, b.p) <= PAIR_MAX_DIST_M) parent[find(i)] = find(j);
    }
  }

  const componentOf = new Map<number, number>();
  connectedComponents(pieces).forEach((c, k) => c.forEach((i) => componentOf.set(i, k)));
  const endsPerComponent = new Map<number, Set<number>>();
  loose.forEach((e, i) => {
    const k = componentOf.get(e.piece)!;
    const set = endsPerComponent.get(k) ?? new Set<number>();
    set.add(find(i));
    endsPerComponent.set(k, set);
  });
  return [...endsPerComponent.values()].some((ends) => ends.size >= 3);
}

function isBorderSliver(pieces: Piece[], insideM: number): boolean {
  if (insideM >= BORDER_SLIVER_M || !pieces.some((p) => p.clipped)) return false;
  const wayLen = new Map<number, number>();
  for (const p of pieces) wayLen.set(p.wayId, p.wayLengthM);
  const fullM = [...wayLen.values()].reduce((s, x) => s + x, 0);
  return insideM < BORDER_SLIVER_SHARE * fullM;
}

function measureStreet(
  pieces: Piece[],
  name: string,
  id: string,
  split: boolean,
  lostWays: boolean,
  projection: Projection,
): Street {
  const shares = pairedShares(pieces);
  let raw = 0;
  let paired = 0;
  const points: WeightedPoint[] = [];
  pieces.forEach((p, i) => {
    raw += p.lengthM;
    paired += shares[i]! * p.lengthM;
    // Paired carriageways each stand for half the street in the orientation fit.
    const w = 1 - shares[i]! / 2;
    for (const s of sampleLine(p.xy, SAMPLE_STEP_M)) points.push({ p: s.p, w: s.weight * w });
  });
  const lengthM = raw - paired / 2;
  const pairedShare = raw > 0 ? paired / raw : 0;
  const fit = classifyOrientation(points, lengthM);
  // No single axis: tell branching streets (T, Y, H shapes) apart from winding ones.
  const orientation: Orientation =
    fit.orientation === 'WINDING' && isBranched(pieces) ? 'BRANCHED' : fit.orientation;
  const { bearingDeg } = fit;

  const flags: Street['flags'] = [];
  if (pairedShare > DUAL_FLAG_SHARE) flags.push('dual-carriageway');
  if (lostWays || pieces.some((p) => p.clipped)) flags.push('clipped');
  if (split) flags.push('split-components');
  if (lengthM < TINY_STREET_M) flags.push('tiny');

  return {
    id,
    name,
    lengthM,
    rawLengthM: raw,
    orientation,
    bearingDeg,
    segments: pieces.map((p) => ({
      type: 'Feature',
      properties: { wayId: p.wayId },
      geometry: { type: 'LineString', coordinates: p.xy.map((q) => projection.toLonLat(q)) },
    })),
    wayIds: [...new Set(pieces.map((p) => p.wayId))],
    flags,
    pairedShare,
  };
}
