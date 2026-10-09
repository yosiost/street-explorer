import { describe, expect, it } from 'vitest';
import { normalizeName } from '../src/geo/names';
import { build, square, way } from './helpers';

const ONEWAY = { oneway: 'yes' };

describe('dual carriageway dedup', () => {
  it('two opposite oneway lines 20 m apart count once', () => {
    const [s, ...rest] = build([
      way(
        'ויצמן',
        [
          [0, 0],
          [1000, 0],
        ],
        ONEWAY,
      ),
      way(
        'ויצמן',
        [
          [1000, 20],
          [0, 20],
        ],
        ONEWAY,
      ),
    ]);
    expect(rest).toHaveLength(0);
    expect(s!.lengthM).toBeGreaterThan(990);
    expect(s!.lengthM).toBeLessThan(1010);
    expect(s!.rawLengthM).toBeCloseTo(2000, -1);
    expect(s!.flags).toContain('dual-carriageway');
  });

  it('only the middle 400 m dual still totals about 1,000 m', () => {
    const streets = build([
      way('ויצמן', [
        [0, 0],
        [300, 0],
      ]),
      way(
        'ויצמן',
        [
          [300, 0],
          [700, 0],
        ],
        ONEWAY,
      ),
      way(
        'ויצמן',
        [
          [700, 20],
          [300, 20],
        ],
        ONEWAY,
      ),
      way('ויצמן', [
        [700, 0],
        [1000, 0],
      ]),
    ]);
    expect(streets).toHaveLength(1);
    expect(streets[0]!.lengthM).toBeGreaterThan(990);
    expect(streets[0]!.lengthM).toBeLessThan(1010);
  });

  it('`oneway=-1` is read as travel against the geometry', () => {
    const [s] = build([
      way(
        'ויצמן',
        [
          [0, 0],
          [1000, 0],
        ],
        ONEWAY,
      ),
      // Same drawing direction, but travel reversed: still opposite carriageways.
      way(
        'ויצמן',
        [
          [0, 20],
          [1000, 20],
        ],
        { oneway: '-1' },
      ),
    ]);
    expect(s!.lengthM).toBeCloseTo(1000, -1);
  });

  it('two parallel oneway lines in the same direction are not deduplicated', () => {
    const [s] = build([
      way(
        'ויצמן',
        [
          [0, 0],
          [1000, 0],
        ],
        ONEWAY,
      ),
      way(
        'ויצמן',
        [
          [0, 20],
          [1000, 20],
        ],
        ONEWAY,
      ),
    ]);
    expect(s!.lengthM).toBeCloseTo(2000, -1);
    expect(s!.flags).not.toContain('dual-carriageway');
  });

  it('two-way lines are never paired', () => {
    const [s] = build([
      way('ויצמן', [
        [0, 0],
        [1000, 0],
      ]),
      way('ויצמן', [
        [1000, 20],
        [0, 20],
      ]),
    ]);
    expect(s!.lengthM).toBeCloseTo(2000, -1);
  });
});

describe('clipping', () => {
  it('a line half inside a square keeps only the inside half', () => {
    const [s] = build(
      [
        way('הרצל', [
          [0, 0],
          [2000, 0],
        ]),
      ],
      square(1000),
    );
    expect(s!.lengthM).toBeGreaterThan(990);
    expect(s!.lengthM).toBeLessThan(1010);
    expect(s!.flags).toContain('clipped');
  });

  it('a line wholly inside is not flagged', () => {
    const [s] = build(
      [
        way('הרצל', [
          [-500, 0],
          [500, 0],
        ]),
      ],
      square(1000),
    );
    expect(s!.lengthM).toBeCloseTo(1000, -1);
    expect(s!.flags).not.toContain('clipped');
  });

  it('a line crossing out and back in keeps both inside parts', () => {
    const [s] = build(
      [
        way('הרצל', [
          [-900, 900],
          [-900, 1100],
          [-700, 1100],
          [-700, 900],
        ]),
      ],
      square(1000),
    );
    // Up and out at x = −900, across outside, back in at x = −700: two 100 m legs inside.
    expect(s!.lengthM).toBeGreaterThan(195);
    expect(s!.lengthM).toBeLessThan(205);
  });

  it('drops a neighbor street that pokes a few meters over the border', () => {
    const streets = build(
      [
        way('הקשת', [
          [-500, 0],
          [500, 0],
        ]),
        // Same name, far away, 300 m long with 10 m inside the city.
        way('הקשת', [
          [990, 600],
          [1290, 600],
        ]),
      ],
      square(1000),
    );
    expect(streets).toHaveLength(1);
    expect(streets[0]!.name).toBe('הקשת');
  });
});

describe('grouping', () => {
  it('two same-name lines 3 km apart become two numbered streets', () => {
    const streets = build([
      way('הרצל', [
        [0, 0],
        [500, 0],
      ]),
      way('הרצל', [
        [3500, 0],
        [3800, 0],
      ]),
    ]);
    expect(streets.map((s) => s.name).sort()).toEqual(['הרצל (1)', 'הרצל (2)']);
    expect(streets.every((s) => s.flags.includes('split-components'))).toBe(true);
    // (1) is the longer one.
    expect(streets.find((s) => s.name === 'הרצל (1)')!.lengthM).toBeCloseTo(500, -1);
  });

  it('same-name lines with a small gap stay one street', () => {
    const streets = build([
      way('הרצל', [
        [0, 0],
        [500, 0],
      ]),
      way('הרצל', [
        [800, 0],
        [1300, 0],
      ]),
    ]);
    expect(streets).toHaveLength(1);
    expect(streets[0]!.name).toBe('הרצל');
  });

  it('name variants רמב"ם and רמב״ם are one street', () => {
    const streets = build([
      way('רמב"ם', [
        [0, 0],
        [300, 0],
      ]),
      way('רמב״ם', [
        [300, 0],
        [600, 0],
      ]),
    ]);
    expect(streets).toHaveLength(1);
    expect(streets[0]!.lengthM).toBeCloseTo(600, -1);
  });

  it('prefers name:he over name', () => {
    const [s] = build([
      way(
        'Herzl',
        [
          [0, 0],
          [100, 0],
        ],
        { 'name:he': 'הרצל' },
      ),
    ]);
    expect(s!.name).toBe('הרצל');
  });

  it('a named roundabout adds 0 m', () => {
    const streets = build([
      way('הרצל', [
        [0, 0],
        [500, 0],
      ]),
      way(
        'הרצל',
        [
          [500, 0],
          [520, 20],
          [540, 0],
          [520, -20],
          [500, 0],
        ],
        { junction: 'roundabout' },
      ),
    ]);
    expect(streets).toHaveLength(1);
    expect(streets[0]!.lengthM).toBeCloseTo(500, -1);
    expect(streets[0]!.segments).toHaveLength(1);
  });

  it('flags streets under 30 m as tiny but keeps them', () => {
    const [s] = build([
      way('סמטה', [
        [0, 0],
        [20, 0],
      ]),
    ]);
    expect(s!.flags).toContain('tiny');
  });
});

describe('normalizeName', () => {
  it('unifies geresh and gershayim variants', () => {
    expect(normalizeName('רמב"ם')).toBe('רמב״ם');
    expect(normalizeName('רמב”ם')).toBe('רמב״ם');
    expect(normalizeName("האר''י")).toBe('האר״י');
    expect(normalizeName("ז'בוטינסקי")).toBe('ז׳בוטינסקי');
    expect(normalizeName('ז’בוטינסקי')).toBe('ז׳בוטינסקי');
  });

  it('trims and collapses whitespace, keeps prefixes', () => {
    expect(normalizeName('  שדרות   ויצמן ')).toBe('שדרות ויצמן');
  });
});
