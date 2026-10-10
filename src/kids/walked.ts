import type { Street } from '../geo/streets';
import type { Strings } from '../i18n';

/** Streets walked, per city: city id → street id → the day it was marked (YYYY-MM-DD). */
export type WalkedLog = Record<string, Record<string, string>>;

export function walkedIn(log: WalkedLog, cityId: number): Record<string, string> {
  return log[String(cityId)] ?? {};
}

/** Marks or unmarks one street; returns a new log. */
export function toggleWalked(
  log: WalkedLog,
  cityId: number,
  streetId: string,
  today: string,
): WalkedLog {
  const city = { ...walkedIn(log, cityId) };
  if (city[streetId]) delete city[streetId];
  else city[streetId] = today;
  return { ...log, [String(cityId)]: city };
}

export interface WalkProgress {
  count: number;
  lengthM: number;
  /** Share of the city's total street length, 0–1. */
  share: number;
}

export function walkProgress(streets: Street[], walked: Record<string, string>): WalkProgress {
  let lengthM = 0;
  let totalM = 0;
  let count = 0;
  for (const s of streets) {
    totalM += s.lengthM;
    if (walked[s.id]) {
      count++;
      lengthM += s.lengthM;
    }
  }
  return { count, lengthM, share: totalM ? lengthM / totalM : 0 };
}

interface StickerContext {
  streets: Street[];
  walked: Record<string, string>;
  progress: WalkProgress;
  homeId: string | null;
}

export interface Sticker {
  id: string;
  emoji: string;
  label: (s: Strings) => string;
  earned: (c: StickerContext) => boolean;
}

/** Fair "longest/shortest" candidates: not a mapping fragment. */
const real = (streets: Street[]) => streets.filter((s) => !s.flags.includes('tiny'));
const DIRECTIONS = ['N-S', 'E-W', 'NE-SW', 'NW-SE'] as const;

/** Goals to collect, in the order they are shown. Unearned ones show faded. */
export const STICKERS: Sticker[] = [
  { id: 'first', emoji: '👟', label: (s) => s.stickerFirst, earned: (c) => c.progress.count >= 1 },
  {
    id: 'five',
    emoji: '⭐',
    label: (s) => s.stickerStreets(5),
    earned: (c) => c.progress.count >= 5,
  },
  {
    id: 'ten',
    emoji: '🌟',
    label: (s) => s.stickerStreets(10),
    earned: (c) => c.progress.count >= 10,
  },
  {
    id: 'twentyfive',
    emoji: '🏅',
    label: (s) => s.stickerStreets(25),
    earned: (c) => c.progress.count >= 25,
  },
  {
    id: 'fifty',
    emoji: '🏆',
    label: (s) => s.stickerStreets(50),
    earned: (c) => c.progress.count >= 50,
  },
  {
    id: 'km1',
    emoji: '🚶',
    label: (s) => s.stickerKm(1),
    earned: (c) => c.progress.lengthM >= 1_000,
  },
  {
    id: 'km5',
    emoji: '🥾',
    label: (s) => s.stickerKm(5),
    earned: (c) => c.progress.lengthM >= 5_000,
  },
  {
    id: 'km10',
    emoji: '🗺️',
    label: (s) => s.stickerKm(10),
    earned: (c) => c.progress.lengthM >= 10_000,
  },
  {
    id: 'home',
    emoji: '🏠',
    label: (s) => s.stickerHome,
    earned: (c) => !!c.homeId && !!c.walked[c.homeId],
  },
  {
    id: 'longest',
    emoji: '🦒',
    label: (s) => s.stickerLongest,
    earned: (c) => {
      const longest = real(c.streets).reduce<Street | null>(
        (best, s) => (!best || s.lengthM > best.lengthM ? s : best),
        null,
      );
      return !!longest && !!c.walked[longest.id];
    },
  },
  {
    id: 'shortest',
    emoji: '🐜',
    label: (s) => s.stickerShortest,
    earned: (c) => {
      const shortest = real(c.streets).reduce<Street | null>(
        (best, s) => (!best || s.lengthM < best.lengthM ? s : best),
        null,
      );
      return !!shortest && !!c.walked[shortest.id];
    },
  },
  {
    id: 'compass',
    emoji: '🧭',
    label: (s) => s.stickerCompass,
    earned: (c) => {
      const seen = new Set(c.streets.filter((s) => c.walked[s.id]).map((s) => s.orientation));
      return DIRECTIONS.every((d) => seen.has(d));
    },
  },
  {
    id: 'pct10',
    emoji: '🎯',
    label: (s) => s.stickerShare(10),
    earned: (c) => c.progress.share >= 0.1,
  },
  {
    id: 'pct50',
    emoji: '🌗',
    label: (s) => s.stickerShare(50),
    earned: (c) => c.progress.share >= 0.5,
  },
  {
    id: 'pct100',
    emoji: '👑',
    label: (s) => s.stickerWholeCity,
    earned: (c) => c.progress.share >= 0.999,
  },
];

export function earnedStickers(
  streets: Street[],
  walked: Record<string, string>,
  homeId: string | null,
): Set<string> {
  const ctx = { streets, walked, progress: walkProgress(streets, walked), homeId };
  return new Set(STICKERS.filter((s) => s.earned(ctx)).map((s) => s.id));
}
