import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Street } from '../src/geo/streets';
import { processCity } from '../src/geo/pipeline';
import {
  availableLetters,
  cityAlphabet,
  collectedLetters,
  firstLetter,
  LETTERS,
} from '../src/kids/alphabet';
import { findCandidates, isTarget, pickTarget, poolSizeFor } from '../src/kids/find';
import { findNamesake, NAMESAKES, namesakeKey } from '../src/kids/namesakes';
import { earnedStickers } from '../src/kids/walked';

const load = (name: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const kfarSaba = processCity(load('kfar-saba'));
const hoboken = processCity(load('hoboken'), undefined, { hebrewNames: false });

function street(name: string, lengthM = 500, id = name): Street {
  return {
    id,
    name,
    lengthM,
    rawLengthM: lengthM,
    orientation: 'N-S',
    bearingDeg: 0,
    segments: [],
    wayIds: [],
    flags: [],
    pairedShare: 0,
  };
}

describe('alef-bet', () => {
  it('takes the first letter on the sign', () => {
    expect(firstLetter('הרצל', 'he')).toBe('ה');
    expect(firstLetter('ד״ר משה סנה', 'he')).toBe('ד');
    expect(firstLetter('״אחוזה״', 'he')).toBe('א');
    expect(firstLetter('Église Street', 'en')).toBe('E');
    expect(firstLetter('1st Street', 'en')).toBe('S');
    expect(firstLetter('הרצל', 'en')).toBeNull();
    expect(firstLetter('Herzl', 'he')).toBeNull();
  });

  it('final letter forms never start a name, so the board has 22 letters', () => {
    expect(LETTERS.he).toHaveLength(22);
    expect(LETTERS.en).toHaveLength(26);
  });

  it('picks the alphabet the city is written in', () => {
    expect(cityAlphabet(kfarSaba.streets)).toBe('he');
    expect(cityAlphabet(hoboken.streets)).toBe('en');
    expect(cityAlphabet([street('銀座'), street('新宿')])).toBeNull();
  });

  it('Kfar Saba has a street for every Hebrew letter', () => {
    expect(availableLetters(kfarSaba.streets, 'he').size).toBe(22);
  });

  it('a letter goes to the first street walked, then to the longest', () => {
    const streets = [street('הרצל', 900), street('הגליל', 400), street('אחד העם', 300)];
    const walked = { הרצל: '2026-10-02', הגליל: '2026-10-01', 'אחד העם': '2026-10-02' };
    const got = collectedLetters(streets, walked, 'he');
    expect(got.get('ה')?.name).toBe('הגליל');
    expect(got.get('א')?.name).toBe('אחד העם');
    expect(got.size).toBe(2);
    const sameDay = collectedLetters(streets, { הרצל: '2026-10-01', הגליל: '2026-10-01' }, 'he');
    expect(sameDay.get('ה')?.name).toBe('הרצל');
  });

  it('the alphabet sticker needs every letter the city has', () => {
    const one = new Map<string, Street>();
    for (const s of kfarSaba.streets) {
      const l = firstLetter(s.name, 'he');
      if (l && !one.has(l)) one.set(l, s);
    }
    const all = Object.fromEntries([...one.values()].map((s) => [s.id, '2026-10-10']));
    expect(earnedStickers(kfarSaba.streets, all, null).has('alphabet')).toBe(true);
    const [, dropped] = [...one.values()];
    const missingOne = { ...all };
    delete missingOne[dropped!.id];
    expect(earnedStickers(kfarSaba.streets, missingOne, null).has('alphabet')).toBe(false);
  });
});

describe('namesakes', () => {
  it('finds people behind Kfar Saba streets, through prefixes and spelling variants', () => {
    const named = kfarSaba.streets.filter((s) => findNamesake(s));
    const names = new Set(named.map((s) => findNamesake(s)!.en.name));
    for (const who of [
      'Theodor Herzl',
      'Chaim Weizmann',
      'David Ben-Gurion',
      'Ze’ev Jabotinsky',
      'Menachem Begin', // "שדרות מנחם בגין"
      'Rashi', // רש"י, with ASCII quotes in OSM
      'Leah Goldberg',
      'Janusz Korczak',
    ]) {
      expect(names, who).toContain(who);
    }
    expect(names.size).toBeGreaterThan(50);
  });

  it('does not guess from a lone first name', () => {
    expect(findNamesake(street('רחל'))).toBeNull();
    expect(findNamesake(street('לוי'))).toBeNull();
    expect(findNamesake(street('יונה'))).toBeNull();
  });

  it('reads Latin street names without the kind of street', () => {
    expect(namesakeKey('Martin Luther King Jr. Blvd')).toBe('martin luther king');
    expect(namesakeKey('Theodor-Herzl-Straße')).toBe('theodor herzl');
    expect(findNamesake(street('Washington Street'))?.en.name).toBe('George Washington');
    expect(findNamesake(street('Boulevard Princesse Grace'))?.en.name).toBe('Princess Grace');
    const inHoboken = hoboken.streets.filter((s) => findNamesake(s)).map((s) => s.name);
    expect(inHoboken).toContain('Washington Street');
  });

  it('every entry has text in both languages and no key points at two people', () => {
    const seen = new Map<string, string>();
    for (const n of NAMESAKES) {
      for (const lang of ['he', 'en'] as const) {
        expect(n[lang].name, n.en.name).toBeTruthy();
        expect(n[lang].about.length, n.en.name).toBeGreaterThan(10);
      }
      for (const key of n.keys) {
        const k = namesakeKey(key);
        expect(seen.get(k) ?? n.en.name, `${key} in ${n.en.name}`).toBe(n.en.name);
        seen.set(k, n.en.name);
      }
    }
  });
});

describe('find it', () => {
  it('one candidate per street name, longest first', () => {
    const c = findCandidates([street('א', 900, 'א#0'), street('א', 300, 'א#1'), street('ב', 400)]);
    expect(c.map((s) => s.id)).toEqual(['א#0', 'ב']);
  });

  it('starts with the longest streets and opens up with the streak', () => {
    const c = findCandidates(kfarSaba.streets);
    const top = new Set(c.slice(0, poolSizeFor(0)).map((s) => s.name));
    for (let i = 0; i < 200; i++) {
      expect(top).toContain(pickTarget(c, { streak: 0, rng: Math.random })!.name);
    }
    expect(poolSizeFor(3)).toBeGreaterThan(poolSizeFor(0));
    expect(poolSizeFor(10)).toBe(Infinity);
  });

  it('walked streets join the pool and recent ones are skipped', () => {
    const c = findCandidates(kfarSaba.streets);
    const short = c[c.length - 1]!;
    let seen = false;
    for (let i = 0; i < 300 && !seen; i++) {
      seen = pickTarget(c, { streak: 0, favorites: new Set([short.name]) })!.name === short.name;
    }
    expect(seen).toBe(true);
    const recent = new Set(c.slice(0, poolSizeFor(0) - 1).map((s) => s.name));
    for (let i = 0; i < 50; i++) {
      expect(recent.has(pickTarget(c, { streak: 0, recent })!.name)).toBe(false);
    }
  });

  it('any piece of the street counts as found', () => {
    expect(isTarget(street('הרצל', 1, 'הרצל#1'), street('הרצל', 1, 'הרצל#0'))).toBe(true);
    expect(isTarget(street('ויצמן'), street('הרצל'))).toBe(false);
  });
});
