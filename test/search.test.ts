import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { citySize } from '../src/data/cities';
import { bboxAreaKm2, parseNominatim, searchWorld, type NominatimPlace } from '../src/data/search';

// Real Nominatim answers (2026-10-09) for "פריז", "manhattan" and "tokyo", accept-language=he.
const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/nominatim.json', import.meta.url), 'utf8'),
) as Record<string, NominatimPlace[]>;

describe('parseNominatim', () => {
  it('merges areas that Nominatim returns several times', () => {
    // Paris is a city, a commune and a département with the same border.
    const cities = parseNominatim(fixture['paris-he']!);
    expect(cities).toHaveLength(1);
    expect(cities[0]).toMatchObject({
      id: 71525,
      name: 'פריז',
      country: 'fr',
      regional: false,
    });
    expect(cities[0]!.context).toContain('צרפת');
    expect(cities[0]!.areaKm2).toBeGreaterThan(150);
    expect(cities[0]!.areaKm2).toBeLessThan(200); // the woods on both sides count
  });

  it('keeps only relations, since only they have a boundary', () => {
    const raw = fixture.manhattan!;
    expect(raw.some((r) => r.osm_type === 'node')).toBe(true);
    const cities = parseNominatim(raw);
    expect(cities.every((c) => Number.isInteger(c.id))).toBe(true);
    expect(cities.map((c) => c.id)).not.toContain(150973132); // a hamlet node
    // The borough (and its identical county) appear once, with its Hebrew name.
    expect(cities.filter((c) => c.name === 'מנהטן' && c.areaKm2! > 200)).toHaveLength(1);
  });

  it('the Tokyo metropolis, islands included, is too big', () => {
    const [tokyo] = parseNominatim(fixture.tokyo!);
    expect(tokyo!.name).toBe('טוקיו');
    expect(citySize(tokyo!)).toBe('too-big');
  });

  it('sizes cities by bounding box', () => {
    // 1° × 1° is about 12,392 km² at the equator and half that at 60°.
    expect(bboxAreaKm2([-0.5, 0.5, 10, 11])).toBeCloseTo(12392, -1);
    expect(bboxAreaKm2([59.5, 60.5, 10, 11])).toBeCloseTo(6196, -1);
    expect(citySize({ id: 1, name: 'x', regional: false })).toBe('normal');
    expect(citySize({ id: 1, name: 'x', regional: false, areaKm2: 900 })).toBe('large');
  });
});

describe('searchWorld', () => {
  it('asks in Hebrew and parses the answer', async () => {
    let url = '';
    const fetchImpl = vi.fn(async (u: string | URL | Request) => {
      url = String(u);
      return new Response(JSON.stringify(fixture['paris-he']), { status: 200 });
    }) as unknown as typeof fetch;
    const cities = await searchWorld('פריז', { fetchImpl, now: () => 1e12 });
    expect(new URL(url).searchParams.get('accept-language')).toBe('he,en');
    expect(new URL(url).searchParams.get('q')).toBe('פריז');
    expect(cities.map((c) => c.id)).toEqual([71525]);
  });

  it('reports HTTP errors', async () => {
    const fetchImpl = (async () => new Response('', { status: 503 })) as unknown as typeof fetch;
    await expect(searchWorld('x', { fetchImpl, now: () => 2e12 })).rejects.toThrow('HTTP 503');
  });
});
