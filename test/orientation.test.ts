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

  describe('branched streets', () => {
    const street = (...lines: [number, number][][]) =>
      build(lines.map((xy) => way('רחוב', xy)))[0]!;

    it('a T shape is BRANCHED', () => {
      const s = street(
        [
          [0, 0],
          [300, 0],
        ],
        [
          [150, 0],
          [150, 250],
        ],
      );
      expect(s.orientation).toBe('BRANCHED');
    });

    it('an H shape is BRANCHED', () => {
      const s = street(
        [
          [0, 0],
          [0, 300],
        ],
        [
          [200, 0],
          [200, 300],
        ],
        [
          [0, 150],
          [200, 150],
        ],
      );
      expect(s.orientation).toBe('BRANCHED');
    });

    it('a U shape split into three ways is still WINDING', () => {
      const s = street(
        [
          [0, 300],
          [0, 0],
        ],
        [
          [0, 0],
          [200, 0],
        ],
        [
          [200, 0],
          [200, 300],
        ],
      );
      expect(s.orientation).toBe('WINDING');
    });

    it('an L-shaped boulevard with two carriageways is WINDING, not BRANCHED', () => {
      const [s] = build([
        way(
          'שדרה',
          [
            [0, 300],
            [0, 0],
            [300, 0],
          ],
          { oneway: 'yes' },
        ),
        way(
          'שדרה',
          [
            [300, 20],
            [20, 20],
            [20, 300],
          ],
          { oneway: 'yes' },
        ),
      ]);
      expect(s!.orientation).toBe('WINDING');
    });

    it('a straight street with a short side spur keeps its axis', () => {
      const s = street(
        [
          [0, 0],
          [600, 0],
        ],
        [
          [300, 0],
          [300, 40],
        ],
      );
      expect(s.orientation).toBe('E-W');
    });
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
