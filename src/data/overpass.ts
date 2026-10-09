import {
  HIGHWAY_TYPES,
  OVERPASS_BUSY_WAIT_MS,
  OVERPASS_ENDPOINTS,
  OVERPASS_ROUNDS,
  OVERPASS_TIMEOUT_MS,
} from '../config';
import type { OverpassResponse } from './osm';

export function cityListQuery(): string {
  return `[out:json][timeout:60];
area["ISO3166-1"="IL"][admin_level=2]->.il;
rel(area.il)[boundary=administrative][admin_level=8][name];
out tags;`;
}

/**
 * Boundary and streets of one city in a single request: the boundary relation with member
 * geometry, then named roads inside it. One request instead of two halves the exposure to
 * Overpass "too busy" errors.
 */
export function cityQuery(relationId: number): string {
  return `[out:json][timeout:120];
rel(${relationId})->.r;
.r out geom;
.r map_to_area->.city;
way(area.city)[highway~"^(${HIGHWAY_TYPES.join('|')})$"][name];
out tags geom;`;
}

export class OverpassError extends Error {
  constructor(
    message: string,
    readonly aborted = false,
  ) {
    super(message);
    this.name = 'OverpassError';
  }
}

export interface RunQueryOptions {
  signal?: AbortSignal;
  endpoints?: string[];
  timeoutMs?: number;
  busyWaitMs?: number;
  rounds?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Called before each retry, e.g. to tell the user the server is busy. */
  onRetry?: (info: { endpoint: string; reason: string }) => void;
}

class BusyError extends Error {}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new OverpassError('aborted', true));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new OverpassError('aborted', true));
      },
      { once: true },
    );
  });
}

async function requestOnce(
  endpoint: string,
  query: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<OverpassResponse> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  // A form-encoded POST is a CORS "simple request": no preflight.
  const res = await fetchImpl(endpoint, {
    method: 'POST',
    body: new URLSearchParams({ data: query }),
    signal: combined,
  });
  if (res.status === 429 || res.status === 504) throw new BusyError(`HTTP ${res.status}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  let json: OverpassResponse;
  try {
    json = JSON.parse(text) as OverpassResponse;
  } catch {
    throw new Error('response is not JSON');
  }
  // Overpass reports query timeouts / memory errors as a 200 with a remark.
  if (json.remark && /runtime error|timed out|out of memory/i.test(json.remark)) {
    throw new BusyError(json.remark);
  }
  if (!Array.isArray(json.elements)) throw new Error('response has no elements');
  return json;
}

/**
 * Runs a query with the policy from DESIGN.md: one request at a time; on 429/504 wait and
 * retry once on the same endpoint, otherwise move to the next endpoint.
 */
export async function runQuery(
  query: string,
  opts: RunQueryOptions = {},
): Promise<OverpassResponse> {
  const {
    signal,
    endpoints = OVERPASS_ENDPOINTS,
    timeoutMs = OVERPASS_TIMEOUT_MS,
    busyWaitMs = OVERPASS_BUSY_WAIT_MS,
    rounds = OVERPASS_ROUNDS,
    fetchImpl = (...args) => fetch(...args),
    sleep = defaultSleep,
    onRetry,
  } = opts;

  const failures: string[] = [];
  for (let round = 0; round < rounds; round++) {
    for (const endpoint of endpoints) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          return await requestOnce(endpoint, query, fetchImpl, timeoutMs, signal);
        } catch (err) {
          if (signal?.aborted) throw new OverpassError('aborted', true);
          const reason = err instanceof Error ? err.message : String(err);
          failures.push(`${new URL(endpoint).host}: ${reason}`);
          const isLast =
            round === rounds - 1 &&
            endpoint === endpoints[endpoints.length - 1] &&
            (attempt === 1 || !(err instanceof BusyError));
          if (isLast) break;
          onRetry?.({ endpoint, reason });
          if (err instanceof BusyError && attempt === 0) {
            await sleep(busyWaitMs, signal);
            continue;
          }
          break;
        }
      }
    }
  }
  throw new OverpassError(`Overpass failed: ${failures.join('; ')}`);
}
