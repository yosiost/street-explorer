import { describe, expect, it } from 'vitest';
import { bucketBearing } from '../src/geo/orientation';
import { build, straight, way } from './helpers';

function orientationOf(xy: [number, number][]) {
  return build([way('רחוב', xy)])[0]!;
}

describe('orientation', () => {
  it.each([
    [10, 'N-S'],
    [80, 'E-W'],
    [45, 'NE-SW'],
    [135, 'NW-SE'],
    [190, 'N-S'], // an axis: 190° is the same as 10°
    [260, 'E-W'],
  ] as const)('a straight line at %i° is %s', (bearing, expected) => {
    const s = orientationOf(straight([0, 0], 500, bearing, 5));
    expect(s.orientation).toBe(expected);
    expect(s.bearingDeg).toBeCloseTo(bearing % 180, 0);
  });

  it('a U shape is WINDING', () => {
    const s = orientationOf([
      [0, 300],
      [0, 0],
      [200, 0],
      [200, 300],
    ]);
    expect(s.orientation).toBe('WINDING');
  });

  it('an L shape with equal arms is WINDING', () => {
    const s = orientationOf([
      [0, 300],
      [0, 0],
      [300, 0],
    ]);
    expect(s.orientation).toBe('WINDING');
  });

  it('a gently curving street keeps its axis', () => {
    // 600 m east-west with a 30 m bow.
    const pts: [number, number][] = [];
    for (let i = 0; i <= 12; i++) pts.push([i * 50, 30 * Math.sin((i / 12) * Math.PI)]);
    expect(orientationOf(pts).orientation).toBe('E-W');
  });

  it('streets under 50 m skip the WINDING check', () => {
    const s = orientationOf([
      [0, 20],
      [0, 0],
      [20, 0],
    ]);
    expect(s.orientation).not.toBe('WINDING');
  });

  it('a dual carriageway is classified by its axis, not as WINDING', () => {
    const [s] = build([
      way('ויצמן', straight([0, 0], 1000, 100, 4), { oneway: 'yes' }),
      way('ויצמן', straight([-3, 20], 1000, 100, 4).reverse(), { oneway: 'yes' }),
    ]);
    expect(s!.orientation).toBe('E-W');
  });

  it('bucket edges', () => {
    expect(bucketBearing(0)).toBe('N-S');
    expect(bucketBearing(22.4)).toBe('N-S');
    expect(bucketBearing(22.5)).toBe('NE-SW');
    expect(bucketBearing(112.5)).toBe('NW-SE');
    expect(bucketBearing(157.5)).toBe('N-S');
    expect(bucketBearing(179.9)).toBe('N-S');
  });
});
