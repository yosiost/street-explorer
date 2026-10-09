import { GAME_LEVELS, GAME_MIN_STREET_M } from '../config';
import type { Street } from '../geo/streets';

export type Rng = () => number;

/** Required length ratio for the current streak: the game gets harder as he gets it right. */
export function minRatioFor(streak: number): number {
  let ratio = GAME_LEVELS[0]!.minRatio;
  for (const level of GAME_LEVELS) if (streak >= level.fromStreak) ratio = level.minRatio;
  return ratio;
}

/** Streets fair to ask about: long enough to see, not a mapping fragment. */
export function gameCandidates(streets: Street[]): Street[] {
  return streets.filter((s) => s.lengthM >= GAME_MIN_STREET_M && !s.flags.includes('tiny'));
}

export interface Pair {
  red: Street;
  blue: Street;
}

/**
 * Picks two streets whose lengths differ by at least `minRatio`, avoiding the ones asked
 * about recently. When `homeId` is given, our street shows up in about a third of rounds.
 * Falls back to looser rules rather than failing; null only with fewer than two candidates.
 */
export function pickPair(
  candidates: Street[],
  opts: { minRatio: number; recent?: Set<string>; homeId?: string | null; rng?: Rng },
): Pair | null {
  const { minRatio, recent = new Set(), homeId, rng = Math.random } = opts;
  if (candidates.length < 2) return null;
  const any = () => candidates[Math.floor(rng() * candidates.length)]!;
  const home = homeId ? candidates.find((s) => s.id === homeId) : undefined;
  const ratio = (a: Street, b: Street) =>
    Math.max(a.lengthM, b.lengthM) / Math.min(a.lengthM, b.lengthM);

  const attempt = (fresh: boolean, needRatio: number): [Street, Street] | null => {
    for (let i = 0; i < 300; i++) {
      const a = home && !recent.has(home.id) && rng() < 1 / 3 ? home : any();
      const b = any();
      if (a.id === b.id) continue;
      if (fresh && (recent.has(a.id) || recent.has(b.id))) continue;
      if (ratio(a, b) >= needRatio) return [a, b];
    }
    return null;
  };

  let pair = attempt(true, minRatio) ?? attempt(false, minRatio);
  if (!pair) {
    // A city of near-identical streets: take the most different pair there is.
    const sorted = [...candidates].sort((x, y) => x.lengthM - y.lengthM);
    pair = [sorted[0]!, sorted[sorted.length - 1]!];
  }
  const [a, b] = pair;
  return rng() < 0.5 ? { red: a, blue: b } : { red: b, blue: a };
}
