import { KID_STEP_M } from '../config';
import type { Orientation } from '../geo/orientation';
import { getLang, locale, t } from '../i18n';

/** The family's own street, the yardstick for every other street. */
export interface HomeStreet {
  cityId: number;
  streetId: string;
  name: string;
  lengthM: number;
}

/** Rounds to a number a kid can say: 10s under 100, 50s under 1,000, then 100s and 1,000s. */
export function niceRound(n: number): number {
  const step = n < 100 ? 10 : n < 1_000 ? 50 : n < 10_000 ? 100 : 1_000;
  return Math.max(step, Math.round(n / step) * step);
}

export function kidSteps(meters: number): number {
  return niceRound(meters / KID_STEP_M);
}

/** "בערך 6,600 צעדים של ילד" */
export function formatSteps(meters: number): string {
  return t().kidSteps(kidSteps(meters).toLocaleString(locale()));
}

/**
 * The street compared with our street, in words a young kid gets: whole multiples when
 * it is longer, "half" or "a quarter" when shorter. Null when it is our street.
 */
export function compareToHome(meters: number, home: HomeStreet, streetId: string): string | null {
  if (streetId === home.streetId) return null;
  const s = t();
  const r = meters / home.lengthM;
  if (r >= 1.5) return s.homeTimes(Math.round(r));
  if (r >= 0.75) return s.homeSame;
  if (r >= 0.35) return s.homeHalf;
  if (r >= 0.15) return s.homeQuarter;
  return s.homeMuchShorter;
}

/** How much longer the winner is, for the game: "ארוך בערך פי 3". */
export function formatRatio(longM: number, shortM: number): string {
  const r = longM / shortM;
  if (r < 1.5) return t().ratioLittle;
  return t().ratioTimes(Math.round(r));
}

// --- Read-aloud ---

/** Length as it should be said, without abbreviations a voice would stumble on. */
export function spokenLength(meters: number): string {
  const rounded = Math.round(meters / 10) * 10;
  if (rounded < 1_000) return t().spokenMeters(rounded);
  const km = (meters / 1_000).toFixed(1).replace(/\.0$/, '');
  return t().spokenKm(km);
}

/** Which voice reads a piece: Hebrew, English, or the browser default for other scripts. */
export type VoiceLang = 'he' | 'en' | 'other';

export interface SpeechPart {
  text: string;
  voice: VoiceLang;
}

const HEBREW = /[֐-׿]/;
const LATIN = /[A-Za-z]/;

/** The voice for a name, by its script. */
export function voiceFor(text: string): VoiceLang {
  if (HEBREW.test(text)) return 'he';
  return LATIN.test(text) ? 'en' : 'other';
}

/** A sentence in the UI language. */
export const say = (text: string): SpeechPart => ({ text, voice: getLang() });
/** A name, in the voice of its own script. */
export const sayName = (name: string): SpeechPart => ({ text: name, voice: voiceFor(name) });

export function spokenStreet(
  street: { id: string; name: string; lengthM: number; orientation: Orientation },
  home: HomeStreet | null,
): SpeechPart[] {
  const s = t();
  const facts = [
    s.spokenLength(spokenLength(street.lengthM)),
    s.spokenDirection[street.orientation],
  ];
  if (home?.streetId === street.id) facts.push(s.spokenIsHome);
  else {
    const vsHome = home && compareToHome(street.lengthM, home, street.id);
    // Plain digits: "6,600" can come out as "six comma six hundred".
    facts.push(vsHome ?? s.spokenKidSteps(kidSteps(street.lengthM)));
  }
  return [sayName(street.name), say(facts.join('. '))];
}
