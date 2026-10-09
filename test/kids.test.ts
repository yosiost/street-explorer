import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setLang } from '../src/i18n';
import { formatLength } from '../src/ui/format';
import type { Street } from '../src/geo/streets';
import { gameCandidates, minRatioFor, pickPair } from '../src/kids/pair';
import {
  compareToHome,
  formatRatio,
  formatSteps,
  kidSteps,
  niceRound,
  spokenLength,
  spokenStreet,
  type HomeStreet,
} from '../src/kids/units';

const home: HomeStreet = { cityId: 1, streetId: 'home#0', name: 'הרצל', lengthM: 400 };

function street(id: string, lengthM: number, extra: Partial<Street> = {}): Street {
  return {
    id,
    name: id,
    lengthM,
    rawLengthM: lengthM,
    orientation: 'N-S',
    bearingDeg: 0,
    segments: [],
    wayIds: [],
    flags: [],
    pairedShare: 0,
    ...extra,
  };
}

/** Deterministic pseudo-random numbers (mulberry32). */
function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('kid units', () => {
  it('rounds to numbers a kid can say', () => {
    expect(niceRound(43)).toBe(40);
    expect(niceRound(3)).toBe(10);
    expect(niceRound(437)).toBe(450);
    expect(niceRound(6_612)).toBe(6_600);
    expect(niceRound(23_400)).toBe(23_000);
  });

  it('counts kid steps of half a meter', () => {
    expect(kidSteps(3_300)).toBe(6_600);
    expect(formatSteps(3_300)).toBe('בערך 6,600 צעדים של ילד');
  });

  it('compares with our street in kid words', () => {
    expect(compareToHome(3_200, home, 'x')).toBe('כמו 8 רחובות שלנו, אחד אחרי השני');
    expect(compareToHome(800, home, 'x')).toBe('כמו שני רחובות שלנו, אחד אחרי השני');
    expect(compareToHome(420, home, 'x')).toBe('בערך כמו הרחוב שלנו');
    expect(compareToHome(200, home, 'x')).toBe('בערך חצי מהרחוב שלנו');
    expect(compareToHome(100, home, 'x')).toBe('בערך רבע מהרחוב שלנו');
    expect(compareToHome(30, home, 'x')).toBe('הרבה יותר קצר מהרחוב שלנו');
    expect(compareToHome(400, home, 'home#0')).toBeNull();
  });

  it('says how much longer the winner is', () => {
    expect(formatRatio(1_200, 1_000)).toBe('קצת יותר ארוך');
    expect(formatRatio(3_100, 1_000)).toBe('ארוך בערך פי 3');
  });
});

describe('read-aloud text', () => {
  it('spells lengths out without abbreviations', () => {
    expect(spokenLength(434)).toBe('430 מטר');
    expect(spokenLength(3_300)).toBe('3.3 קילומטר');
    expect(spokenLength(2_000)).toBe('2 קילומטר');
  });

  it('reads name, length, direction and a comparison', () => {
    const parts = spokenStreet(street('ויצמן', 3_300), null);
    expect(parts[0]).toEqual({ text: 'ויצמן', voice: 'he' });
    expect(parts[1]!.text).toBe('אורך 3.3 קילומטר. הולך מצפון לדרום. בערך 6600 צעדים של ילד');
  });

  it('compares with our street when there is one', () => {
    const [, facts] = spokenStreet(street('ויצמן', 3_200), home);
    expect(facts!.text).toContain('כמו 8 רחובות שלנו');
    const [, own] = spokenStreet(street('home#0', 400), home);
    expect(own!.text).toContain('וזה הרחוב שלנו!');
  });

  it('marks names in other scripts for another voice', () => {
    expect(spokenStreet(street('Broadway', 21_500), null)[0]).toEqual({
      text: 'Broadway',
      voice: 'en',
    });
    expect(spokenStreet(street('表参道', 1_000), null)[0]!.voice).toBe('other');
  });
});

describe('in English', () => {
  beforeAll(() => setLang('en'));
  afterAll(() => setLang('he'));

  it('formats lengths and kid units', () => {
    expect(formatLength(434)).toBe('430 m');
    expect(formatLength(2_300)).toBe('2.3 km');
    expect(formatSteps(3_300)).toBe('About 6,600 kid steps');
    expect(compareToHome(3_200, home, 'x')).toBe('Like 8 of our street, end to end');
    expect(formatRatio(3_100, 1_000)).toBe('about 3 times longer');
  });

  it('reads aloud in English, Hebrew names still in the Hebrew voice', () => {
    const [name, facts] = spokenStreet(street('ויצמן', 3_300), null);
    expect(name).toEqual({ text: 'ויצמן', voice: 'he' });
    expect(facts).toEqual({
      text: '3.3 kilometers long. It goes from north to south. About 6600 kid steps',
      voice: 'en',
    });
  });
});

describe('game pairs', () => {
  const streets = [50, 120, 200, 300, 450, 700, 1_000, 1_600, 2_500, 3_300].map((m, i) =>
    street(`s${i}`, m),
  );

  it('never asks about fragments', () => {
    const c = gameCandidates([...streets, street('tiny', 90, { flags: ['tiny'] })]);
    expect(c.map((s) => s.id)).not.toContain('s0'); // 50 m
    expect(c.map((s) => s.id)).not.toContain('tiny');
  });

  it('gets harder as the streak grows', () => {
    expect(minRatioFor(0)).toBe(2);
    expect(minRatioFor(3)).toBe(1.5);
    expect(minRatioFor(5)).toBe(1.3);
    expect(minRatioFor(20)).toBe(1.15);
  });

  it('picks two different streets that differ by the required ratio', () => {
    const rng = seeded(1);
    for (let i = 0; i < 200; i++) {
      const p = pickPair(gameCandidates(streets), { minRatio: 2, rng })!;
      expect(p.red.id).not.toBe(p.blue.id);
      const r = Math.max(p.red.lengthM, p.blue.lengthM) / Math.min(p.red.lengthM, p.blue.lengthM);
      expect(r).toBeGreaterThanOrEqual(2);
    }
  });

  it('puts the longer street on either side', () => {
    const rng = seeded(2);
    let redLonger = 0;
    for (let i = 0; i < 200; i++) {
      const p = pickPair(gameCandidates(streets), { minRatio: 2, rng })!;
      if (p.red.lengthM > p.blue.lengthM) redLonger++;
    }
    expect(redLonger).toBeGreaterThan(60);
    expect(redLonger).toBeLessThan(140);
  });

  it('avoids streets asked about recently', () => {
    const recent = new Set(['s9', 's8', 's7']);
    const rng = seeded(3);
    for (let i = 0; i < 100; i++) {
      const p = pickPair(gameCandidates(streets), { minRatio: 2, recent, rng })!;
      expect(recent.has(p.red.id) || recent.has(p.blue.id)).toBe(false);
    }
  });

  it('brings in our street about a third of the time', () => {
    const rng = seeded(4);
    let withHome = 0;
    for (let i = 0; i < 300; i++) {
      const p = pickPair(gameCandidates(streets), { minRatio: 1.5, homeId: 's3', rng })!;
      if (p.red.id === 's3' || p.blue.id === 's3') withHome++;
    }
    expect(withHome).toBeGreaterThan(80);
  });

  it('falls back to the most different pair when no pair is different enough', () => {
    const same = [street('a', 500), street('b', 510), street('c', 520)];
    const p = pickPair(same, { minRatio: 2, rng: seeded(5) })!;
    expect(new Set([p.red.id, p.blue.id])).toEqual(new Set(['a', 'c']));
  });

  it('needs at least two streets', () => {
    expect(pickPair([street('a', 500)], { minRatio: 2 })).toBeNull();
  });
});
