import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { matchesCity, parseCityList } from '../src/data/cities';
import { cityQuery, OverpassError, runQuery } from '../src/data/overpass';
import { splitCityResponse } from '../src/data/loader';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const status = (code: number) => new Response('busy', { status: code });
const EMPTY = { elements: [] };

function setup(responses: (Response | Error)[]) {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request) => {
    calls.push(new URL(String(url)).host);
    const next = responses.shift();
    if (!next) throw new Error('no more responses');
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof fetch;
  const sleep = vi.fn(async () => {});
  return {
    calls,
    sleep,
    run: () =>
      runQuery('q', {
        fetchImpl,
        sleep,
        endpoints: ['https://a.test/api', 'https://b.test/api'],
        rounds: 1,
      }),
  };
}

describe('runQuery', () => {
  it('returns the first good response', async () => {
    const t = setup([ok(EMPTY)]);
    await expect(t.run()).resolves.toEqual(EMPTY);
    expect(t.calls).toEqual(['a.test']);
  });

  it('on 504 waits and retries once, then falls back', async () => {
    const t = setup([status(504), status(504), ok(EMPTY)]);
    await expect(t.run()).resolves.toEqual(EMPTY);
    expect(t.calls).toEqual(['a.test', 'a.test', 'b.test']);
    expect(t.sleep).toHaveBeenCalledTimes(1);
  });

  it('on 429 retries the same endpoint', async () => {
    const t = setup([status(429), ok(EMPTY)]);
    await expect(t.run()).resolves.toEqual(EMPTY);
    expect(t.calls).toEqual(['a.test', 'a.test']);
  });

  it('on other errors goes straight to the fallback', async () => {
    const t = setup([status(500), ok(EMPTY)]);
    await expect(t.run()).resolves.toEqual(EMPTY);
    expect(t.calls).toEqual(['a.test', 'b.test']);
    expect(t.sleep).not.toHaveBeenCalled();
  });

  it('treats a runtime-error remark as busy', async () => {
    const t = setup([ok({ elements: [], remark: 'runtime error: Query timed out' }), ok(EMPTY)]);
    await expect(t.run()).resolves.toEqual(EMPTY);
    expect(t.calls).toEqual(['a.test', 'a.test']);
  });

  it('rejects non-JSON bodies', async () => {
    const t = setup([new Response('<html>', { status: 200 }), ok(EMPTY)]);
    await expect(t.run()).resolves.toEqual(EMPTY);
    expect(t.calls).toEqual(['a.test', 'b.test']);
  });

  it('throws OverpassError when every endpoint fails', async () => {
    const t = setup([status(504), status(504), status(504), status(504)]);
    await expect(t.run()).rejects.toBeInstanceOf(OverpassError);
    expect(t.calls).toHaveLength(4);
  });

  it('stops immediately when aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn(async () => {
      throw new DOMException('aborted', 'AbortError');
    }) as unknown as typeof fetch;
    const err = await runQuery('q', { fetchImpl, signal: controller.signal }).catch((e) => e);
    expect(err).toBeInstanceOf(OverpassError);
    expect(err.aborted).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('queries', () => {
  it('city query fetches the boundary and the streets in one request', () => {
    const q = cityQuery(1383631);
    expect(q).toContain('.r out geom;');
    expect(q).toContain('map_to_area');
  });

  it('city query uses the configured highway list and excludes service roads', () => {
    const q = cityQuery(1383631);
    expect(q).toContain('rel(1383631)');
    expect(q).toContain('residential');
    expect(q).toContain('pedestrian');
    expect(q).not.toContain('service');
    expect(q).not.toContain('_link');
  });
});

describe('splitCityResponse', () => {
  it('separates the boundary relation from the street ways', () => {
    const res = {
      osm3s: { timestamp_osm_base: 't' },
      elements: [
        { type: 'relation' as const, id: 1, members: [] },
        { type: 'way' as const, id: 2 },
        { type: 'way' as const, id: 3 },
      ],
    };
    const { boundary, streets } = splitCityResponse(res);
    expect(boundary.elements.map((e) => e.id)).toEqual([1]);
    expect(streets.elements.map((e) => e.id)).toEqual([2, 3]);
    expect(streets.osm3s?.timestamp_osm_base).toBe('t');
  });
});

describe('city list', () => {
  const res = JSON.parse(readFileSync(new URL('./fixtures/cities.json', import.meta.url), 'utf8'));
  const cities = parseCityList(res);

  it('parses all municipalities with Hebrew names, sorted', () => {
    expect(cities.length).toBeGreaterThan(200);
    const names = cities.map((c) => c.name);
    expect(names).toEqual([...names].sort(new Intl.Collator('he').compare));
    expect(cities.find((c) => c.id === 1383631)?.name).toBe('כפר סבא');
  });

  it('marks regional councils', () => {
    const regional = cities.filter((c) => c.regional);
    expect(regional.length).toBeGreaterThan(30);
    expect(regional.every((c) => c.name.includes('מועצה אזורית'))).toBe(true);
  });

  it('type-ahead matches Hebrew prefixes, English names and ignores punctuation', () => {
    const ks = cities.find((c) => c.id === 1383631)!;
    expect(matchesCity(ks, 'כפר')).toBe(true);
    expect(matchesCity(ks, 'kfar')).toBe(true);
    expect(matchesCity(ks, 'רעננה')).toBe(false);
    const mj = cities.find((c) => c.name.includes('שמס'))!;
    expect(matchesCity(mj, 'מגדל')).toBe(true);
  });
});
