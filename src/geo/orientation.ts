import { WINDING_EIGEN_RATIO, WINDING_EXTENT_RATIO, WINDING_MIN_LENGTH_M } from '../config';
import type { XY } from './geometry';

export type Orientation = 'N-S' | 'E-W' | 'NE-SW' | 'NW-SE' | 'WINDING' | 'BRANCHED';

export const ORIENTATION_LABELS: Record<Orientation, string> = {
  'N-S': 'צפון–דרום',
  'NE-SW': 'צפון-מזרח – דרום-מערב',
  'E-W': 'מזרח–מערב',
  'NW-SE': 'צפון-מערב – דרום-מזרח',
  WINDING: 'מתפתל',
  BRANCHED: 'מסתעף',
};

export interface WeightedPoint {
  p: XY; // local meters, x = east, y = north
  w: number;
}

export interface OrientationResult {
  orientation: Orientation;
  /** Principal axis as a compass bearing in [0, 180). */
  bearingDeg: number;
  eigenRatio: number;
  /** Spread of the points along the principal axis divided by street length. */
  extentRatio: number;
}

export function bucketBearing(deg: number): Exclude<Orientation, 'WINDING' | 'BRANCHED'> {
  const b = ((deg % 180) + 180) % 180;
  if (b < 22.5 || b >= 157.5) return 'N-S';
  if (b < 67.5) return 'NE-SW';
  if (b < 112.5) return 'E-W';
  return 'NW-SE';
}

/**
 * Weighted PCA over sampled points. The first eigenvector is the street's axis; a weak
 * axis (high λ2/λ1) or a short spread along it means the street winds.
 */
export function classifyOrientation(points: WeightedPoint[], lengthM: number): OrientationResult {
  let W = 0;
  let mx = 0;
  let my = 0;
  for (const { p, w } of points) {
    W += w;
    mx += w * p[0];
    my += w * p[1];
  }
  if (W === 0) return { orientation: 'N-S', bearingDeg: 0, eigenRatio: 0, extentRatio: 1 };
  mx /= W;
  my /= W;

  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const { p, w } of points) {
    const dx = p[0] - mx;
    const dy = p[1] - my;
    sxx += w * dx * dx;
    sxy += w * dx * dy;
    syy += w * dy * dy;
  }
  sxx /= W;
  sxy /= W;
  syy /= W;

  const half = (sxx + syy) / 2;
  const disc = Math.sqrt(((sxx - syy) / 2) ** 2 + sxy ** 2);
  const l1 = half + disc;
  const l2 = Math.max(0, half - disc);
  const eigenRatio = l1 > 0 ? l2 / l1 : 0;

  // Angle of the principal axis from +x (east), counter-clockwise.
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const ux = Math.cos(theta);
  const uy = Math.sin(theta);
  const bearingDeg = (((90 - (theta * 180) / Math.PI) % 180) + 180) % 180;

  let lo = Infinity;
  let hi = -Infinity;
  for (const { p } of points) {
    const s = (p[0] - mx) * ux + (p[1] - my) * uy;
    if (s < lo) lo = s;
    if (s > hi) hi = s;
  }
  const extentRatio = lengthM > 0 ? (hi - lo) / lengthM : 1;

  const winding =
    lengthM >= WINDING_MIN_LENGTH_M &&
    (eigenRatio > WINDING_EIGEN_RATIO || extentRatio < WINDING_EXTENT_RATIO);

  return {
    orientation: winding ? 'WINDING' : bucketBearing(bearingDeg),
    bearingDeg,
    eigenRatio,
    extentRatio,
  };
}
