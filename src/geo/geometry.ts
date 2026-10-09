// Planar helpers. All XY coordinates are local meters (see makeProjection).

export type XY = [number, number];

const EARTH_RADIUS_M = 6371008.8;
const DEG = Math.PI / 180;

export interface Projection {
  toXY(lon: number, lat: number): XY;
  toLonLat(p: XY): [number, number];
}

/** Equirectangular projection centered on (lon0, lat0); accurate to <0.1% at city scale. */
export function makeProjection(lon0: number, lat0: number): Projection {
  const kx = EARTH_RADIUS_M * DEG * Math.cos(lat0 * DEG);
  const ky = EARTH_RADIUS_M * DEG;
  return {
    toXY: (lon, lat) => [(lon - lon0) * kx, (lat - lat0) * ky],
    toLonLat: ([x, y]) => [lon0 + x / kx, lat0 + y / ky],
  };
}

export function dist(a: XY, b: XY): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

export function lineLength(line: XY[]): number {
  let sum = 0;
  for (let i = 1; i < line.length; i++) sum += dist(line[i - 1]!, line[i]!);
  return sum;
}

export function pointSegmentDistance(p: XY, a: XY, b: XY): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Minimum distance between two polylines (exact when they do not cross; 0 when they do). */
export function lineLineDistance(a: XY[], b: XY[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < a.length; i++) {
    for (let j = 0; j + 1 < b.length; j++) {
      if (segmentIntersectionT(a[i]!, a[i + 1]!, b[j]!, b[j + 1]!) !== null) return 0;
    }
  }
  for (const p of a)
    for (let j = 0; j + 1 < b.length; j++)
      best = Math.min(best, pointSegmentDistance(p, b[j]!, b[j + 1]!));
  for (const p of b)
    for (let i = 0; i + 1 < a.length; i++)
      best = Math.min(best, pointSegmentDistance(p, a[i]!, a[i + 1]!));
  if (a.length === 1 && b.length === 1) best = dist(a[0]!, b[0]!);
  return best;
}

/** Parameter t along a→b where it crosses c→d, or null. */
export function segmentIntersectionT(a: XY, b: XY, c: XY, d: XY): number | null {
  const rx = b[0] - a[0];
  const ry = b[1] - a[1];
  const sx = d[0] - c[0];
  const sy = d[1] - c[1];
  const denom = rx * sy - ry * sx;
  if (denom === 0) return null; // parallel or collinear: treat as no crossing
  const qpx = c[0] - a[0];
  const qpy = c[1] - a[1];
  const t = (qpx * sy - qpy * sx) / denom;
  const u = (qpx * ry - qpy * rx) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return t;
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function bboxOf(line: XY[]): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of line) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

export function bboxGap(a: BBox, b: BBox): number {
  const dx = Math.max(0, a.minX - b.maxX, b.minX - a.maxX);
  const dy = Math.max(0, a.minY - b.maxY, b.minY - a.maxY);
  return Math.hypot(dx, dy);
}

export interface Sample {
  p: XY;
  /** Unit vector of the segment the sample lies on, in line order. */
  dir: XY;
  /** Length of line this sample stands for, in meters. */
  weight: number;
}

/** Samples a line at the centers of equal intervals no longer than `step` meters. */
export function sampleLine(line: XY[], step: number): Sample[] {
  const total = lineLength(line);
  if (total === 0) return [];
  const n = Math.max(1, Math.ceil(total / step));
  const interval = total / n;
  const samples: Sample[] = [];
  let seg = 0;
  let segStart = 0; // distance along the line where segment `seg` starts
  for (let k = 0; k < n; k++) {
    const target = (k + 0.5) * interval;
    let a = line[seg]!;
    let b = line[seg + 1]!;
    let segLen = dist(a, b);
    while (segStart + segLen < target && seg + 2 < line.length) {
      segStart += segLen;
      seg++;
      a = line[seg]!;
      b = line[seg + 1]!;
      segLen = dist(a, b);
    }
    const t = segLen === 0 ? 0 : (target - segStart) / segLen;
    samples.push({
      p: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])],
      dir: segLen === 0 ? [0, 0] : [(b[0] - a[0]) / segLen, (b[1] - a[1]) / segLen],
      weight: interval,
    });
  }
  return samples;
}
