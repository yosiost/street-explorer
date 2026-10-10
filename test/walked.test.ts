import { describe, expect, it } from 'vitest';
import type { Orientation } from '../src/geo/orientation';
import type { Street } from '../src/geo/streets';
import { stringsFor } from '../src/i18n';
import {
  earnedStickers,
  STICKERS,
  toggleWalked,
  walkedIn,
  walkProgress,
  type WalkedLog,
} from '../src/kids/walked';

function street(
  id: string,
  lengthM: number,
  orientation: Orientation = 'N-S',
  tiny = false,
): Street {
  return {
    id,
    name: id,
    lengthM,
    rawLengthM: lengthM,
    orientation,
    bearingDeg: 0,
    segments: [],
    wayIds: [],
    flags: tiny ? ['tiny'] : [],
    pairedShare: 0,
  };
}

// 10 streets, 10 km in all.
const city = [
  street('long', 3_000, 'E-W'),
  street('a', 1_500, 'N-S'),
  street('b', 1_200, 'NE-SW'),
  street('c', 1_000, 'NW-SE'),
  street('d', 900),
  street('e', 800),
  street('f', 700),
  street('g', 500),
  street('short', 380),
  street('frag', 20, 'N-S', true),
];
const walk = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, '2026-10-10']));

describe('walked log', () => {
  it('toggles a street on and off, per city', () => {
    let log: WalkedLog = {};
    log = toggleWalked(log, 1, 'a', '2026-10-10');
    log = toggleWalked(log, 2, 'a', '2026-10-11');
    expect(walkedIn(log, 1)).toEqual({ a: '2026-10-10' });
    log = toggleWalked(log, 1, 'a', '2026-10-12');
    expect(walkedIn(log, 1)).toEqual({});
    expect(walkedIn(log, 2)).toEqual({ a: '2026-10-11' });
  });

  it('measures progress by length', () => {
    const p = walkProgress(city, walk('long', 'a'));
    expect(p.count).toBe(2);
    expect(p.lengthM).toBe(4_500);
    expect(p.share).toBeCloseTo(0.45, 2);
  });
});

describe('stickers', () => {
  const earned = (walked: Record<string, string>, homeId: string | null = null) =>
    earnedStickers(city, walked, homeId);

  it('none before the first walk', () => {
    expect(earned({}).size).toBe(0);
  });

  it('first street, kilometers and share', () => {
    const e = earned(walk('long'));
    expect(e).toContain('first');
    expect(e).toContain('km1');
    expect(e).toContain('pct10');
    expect(e).not.toContain('km5');
  });

  it('the longest street', () => {
    expect(earned(walk('long'))).toContain('longest');
    expect(earned(walk('a'))).not.toContain('longest');
  });

  it('the shortest street ignores mapping fragments', () => {
    expect(earned(walk('short'))).toContain('shortest');
    expect(earned(walk('frag'))).not.toContain('shortest');
  });

  it('all four directions', () => {
    expect(earned(walk('long', 'a', 'b'))).not.toContain('compass');
    expect(earned(walk('long', 'a', 'b', 'c'))).toContain('compass');
  });

  it('our street', () => {
    expect(earned(walk('d'), 'd')).toContain('home');
    expect(earned(walk('d'), null)).not.toContain('home');
  });

  it('counts and the whole city', () => {
    expect(earned(walk('long', 'a', 'b', 'c', 'd'))).toContain('five');
    const all = walk(...city.map((s) => s.id));
    const e = earned(all);
    expect(e).toContain('ten');
    expect(e).toContain('pct100');
    expect(e).toContain('km10');
    expect(e).not.toContain('twentyfive');
  });

  it('every sticker has a label in both languages', () => {
    for (const s of STICKERS) {
      expect(s.label(stringsFor('he'))).toMatch(/\S/);
      expect(s.label(stringsFor('en'))).toMatch(/\S/);
    }
    expect(new Set(STICKERS.map((s) => s.id)).size).toBe(STICKERS.length);
  });
});
