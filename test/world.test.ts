import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { processCity } from '../src/geo/pipeline';

// Real Overpass responses (2026-10-09), saved so tests never hit the network:
// Hoboken, NJ (relation 170708), a street grid; Monaco (relation 1124039), a hillside city
// with French names.
const load = (name: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const total = (streets: { lengthM: number }[]) => streets.reduce((a, s) => a + s.lengthM, 0);

describe('Hoboken fixture (a grid)', () => {
  const result = processCity(load('hoboken'), undefined, { hebrewNames: false });
  const byName = new Map(result.streets.map((s) => [s.name, s]));

  it('uses the local names', () => {
    expect(byName.has('Washington Street')).toBe(true);
    expect(byName.has('4th Street')).toBe(true);
  });

  it('a plausible street network', () => {
    expect(result.streets.length).toBeGreaterThan(40);
    expect(result.streets.length).toBeLessThan(90);
    expect(total(result.streets) / 1000).toBeGreaterThan(40);
    expect(total(result.streets) / 1000).toBeLessThan(75);
  });

  it('the grid comes out as N-S avenues and E-W numbered streets', () => {
    expect(byName.get('Washington Street')!.orientation).toBe('N-S');
    expect(byName.get('Clinton Street')!.orientation).toBe('N-S');
    for (const n of ['4th', '9th', '10th'])
      expect(byName.get(`${n} Street`)!.orientation).toBe('E-W');
    const gridded = result.streets.filter(
      (s) => s.orientation === 'N-S' || s.orientation === 'E-W',
    );
    expect(gridded.length / result.streets.length).toBeGreaterThan(0.85);
  });
});

describe('Monaco fixture (hills, French names)', () => {
  const result = processCity(load('monaco'), undefined, { hebrewNames: false });
  const names = result.streets.map((s) => s.name);

  it('keeps apostrophes in French names', () => {
    expect(names).toContain("Boulevard d'Italie");
    expect(names).toContain("Avenue de l'Annonciade");
    expect(names.some((n) => n.includes('׳') || n.includes('״'))).toBe(false);
  });

  it('a plausible street network, with winding hill roads', () => {
    expect(result.streets.length).toBeGreaterThan(100);
    expect(result.streets.length).toBeLessThan(200);
    expect(total(result.streets) / 1000).toBeGreaterThan(30);
    expect(total(result.streets) / 1000).toBeLessThan(55);
    expect(result.streets.filter((s) => s.orientation === 'WINDING').length).toBeGreaterThan(5);
  });

  it('dual carriageways are counted once here too', () => {
    const italie = result.streets.find((s) => s.name === "Boulevard d'Italie")!;
    expect(italie.flags).toContain('dual-carriageway');
    expect(italie.lengthM).toBeLessThan(italie.rawLengthM);
  });
});
