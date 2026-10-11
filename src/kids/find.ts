import type { Street } from '../geo/streets';
import { gameCandidates, type Rng } from './pair';

/** How many of the longest streets are asked about, by streak: long streets are easy to see. */
export const FIND_LEVELS = [
  { fromStreak: 0, pool: 20 },
  { fromStreak: 3, pool: 50 },
  { fromStreak: 6, pool: Infinity },
] as const;

export function poolSizeFor(streak: number): number {
  let size: number = FIND_LEVELS[0].pool;
  for (const level of FIND_LEVELS) if (streak >= level.fromStreak) size = level.pool;
  return size;
}

/**
 * Streets fair to ask about, one per name: a street split in two pieces is still one
 * street to find, and the longest piece stands for it.
 */
export function findCandidates(streets: Street[]): Street[] {
  const byName = new Map<string, Street>();
  for (const s of gameCandidates(streets)) {
    const best = byName.get(s.name);
    if (!best || s.lengthM > best.lengthM) byName.set(s.name, s);
  }
  return [...byName.values()].sort((a, b) => b.lengthM - a.lengthM);
}

/**
 * The street to find: one of the longest, growing to all of them as the streak grows.
 * `favorites` (names of streets we walked, and our street) are always in the pool and
 * twice as likely, since he knows them. Names asked about recently are skipped while there are others.
 */
export function pickTarget(
  candidates: Street[],
  opts: { streak: number; recent?: Set<string>; favorites?: Set<string>; rng?: Rng },
): Street | null {
  const { streak, recent = new Set(), favorites = new Set(), rng = Math.random } = opts;
  if (!candidates.length) return null;
  const size = poolSizeFor(streak);
  const pool = candidates.filter((s, i) => i < size || favorites.has(s.name));
  const fresh = pool.filter((s) => !recent.has(s.name));
  const from = fresh.length ? fresh : pool;
  const weighted = from.flatMap((s) => (favorites.has(s.name) ? [s, s] : [s]));
  return weighted[Math.floor(rng() * weighted.length)]!;
}

/** A tap is right when it hits any piece of a street with the same name. */
export const isTarget = (tapped: Pick<Street, 'name'>, target: Pick<Street, 'name'>) =>
  tapped.name === target.name;
