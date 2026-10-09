import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assembleBoundary, BoundaryIndex, boundaryRings } from '../src/geo/boundary';
import { makeProjection } from '../src/geo/geometry';
import { processCity } from '../src/geo/pipeline';

// Real Overpass responses for Kfar Saba (relation 1383631), saved so tests never hit the network.
const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/kfar-saba.json', import.meta.url), 'utf8'),
);

describe('Kfar Saba fixture', () => {
  const result = processCity(fixture);
  const byName = new Map(result.streets.map((s) => [s.name, s]));

  it('assembles a closed boundary polygon', () => {
    const b = assembleBoundary(fixture.boundary)!;
    expect(b.geometry.type).toBe('Polygon');
    for (const ring of boundaryRings(b)) expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('the city center is inside the boundary and Ra’anana is not', () => {
    const b = assembleBoundary(fixture.boundary)!;
    const proj = makeProjection(34.907, 32.178);
    const index = new BoundaryIndex(
      boundaryRings(b).map((r) => r.map(([x, y]) => proj.toXY(x!, y!))),
    );
    expect(index.contains(proj.toXY(34.907, 32.178))).toBe(true);
    expect(index.contains(proj.toXY(34.871, 32.184))).toBe(false); // Ra'anana center
  });

  it('processes in well under 2 s', () => {
    expect(result.stats.timeMs).toBeLessThan(2000);
  });

  it('produces a plausible number of streets', () => {
    expect(result.streets.length).toBeGreaterThan(350);
    expect(result.streets.length).toBeLessThan(500);
  });

  it('every street has drawable geometry and positive length', () => {
    for (const s of result.streets) {
      expect(s.segments.length, s.name).toBeGreaterThan(0);
      expect(s.lengthM, s.name).toBeGreaterThan(0);
      expect(s.lengthM).toBeLessThanOrEqual(s.rawLengthM + 1e-6);
    }
  });

  it('street ids are unique', () => {
    expect(new Set(result.streets.map((s) => s.id)).size).toBe(result.streets.length);
  });

  it('fully dual streets are measured at about half their raw length', () => {
    for (const s of result.streets.filter((x) => x.pairedShare > 0.9)) {
      expect(s.lengthM, s.name).toBeLessThanOrEqual(0.6 * s.rawLengthM);
    }
  });

  it('Weizmann, the main boulevard, is counted once (about 3.3 km, not 6.6)', () => {
    const w = byName.get('ויצמן')!;
    expect(w.flags).toContain('dual-carriageway');
    expect(w.lengthM).toBeGreaterThan(3000);
    expect(w.lengthM).toBeLessThan(3700);
    expect(w.orientation).toBe('E-W');
  });

  it('no border slivers under 5 m survive clipping', () => {
    expect(result.streets.filter((s) => s.lengthM < 5)).toEqual([]);
  });
});
