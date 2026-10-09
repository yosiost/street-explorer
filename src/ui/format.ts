import { FOOTBALL_PITCH_M } from '../config';

/** Under 1 km: meters rounded to 10 m ("430 מ׳"). From 1 km: km with one decimal ("2.3 ק״מ"). */
export function formatLength(meters: number): string {
  const rounded = Math.round(meters / 10) * 10;
  if (rounded < 1000) return `${rounded} מ׳`;
  return `${(meters / 1000).toFixed(1)} ק״מ`;
}

/** Kid-friendly comparison, e.g. "כמו 22 מגרשי כדורגל". */
export function formatPitches(meters: number): string {
  const n = Math.round(meters / FOOTBALL_PITCH_M);
  if (n < 1) return 'פחות ממגרש כדורגל אחד';
  if (n === 1) return 'כמו מגרש כדורגל אחד';
  return `כמו ${n} מגרשי כדורגל`;
}
