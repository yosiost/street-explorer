import type { Street } from '../geo/streets';

/**
 * The alef-bet hunt: one walked street for every letter. The letter is the first one on the
 * street sign, so it follows the city's own names (`street.name`), not the UI language.
 */
export type Alphabet = 'he' | 'en';

export const LETTERS: Record<Alphabet, string[]> = {
  he: [...'אבגדהוזחטיכלמנסעפצקרשת'],
  en: [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'],
};

const HEBREW_LETTER = /[א-ת]/;
const LATIN_LETTER = /[A-Za-z]/;

/** The first letter of a name in this alphabet, or null (digits, another script). */
export function firstLetter(name: string, alphabet: Alphabet): string | null {
  // Skip quotes, digits and the like; "É" counts as "E".
  const plain = name.normalize('NFD').replace(/\p{M}/gu, '');
  for (const ch of plain) {
    if (alphabet === 'he' && HEBREW_LETTER.test(ch)) return ch;
    if (alphabet === 'en' && LATIN_LETTER.test(ch)) return ch.toUpperCase();
    if (/\p{L}/u.test(ch)) return null; // a letter of some other script comes first
  }
  return null;
}

/** The alphabet most of the city's street names are written in; null for other scripts. */
export function cityAlphabet(streets: Pick<Street, 'name'>[]): Alphabet | null {
  let he = 0;
  let en = 0;
  for (const s of streets) {
    if (firstLetter(s.name, 'he')) he++;
    else if (firstLetter(s.name, 'en')) en++;
  }
  if (!streets.length || Math.max(he, en) < streets.length / 2) return null;
  return he >= en ? 'he' : 'en';
}

/**
 * Letter → the walked street that earned it: the first one walked, and of those the
 * longest. Only letters that have one are in the map.
 */
export function collectedLetters(
  streets: Street[],
  walked: Record<string, string>,
  alphabet: Alphabet,
): Map<string, Street> {
  const found = new Map<string, Street>();
  for (const s of streets) {
    const day = walked[s.id];
    const letter = day && firstLetter(s.name, alphabet);
    if (!letter) continue;
    const best = found.get(letter);
    const bestDay = best && walked[best.id]!;
    if (!best || day < bestDay! || (day === bestDay && s.lengthM > best.lengthM)) {
      found.set(letter, s);
    }
  }
  return found;
}

/** Letters this city has a street for at all (a city may have no "ט" street). */
export function availableLetters(streets: Street[], alphabet: Alphabet): Set<string> {
  const out = new Set<string>();
  for (const s of streets) {
    const letter = firstLetter(s.name, alphabet);
    if (letter) out.add(letter);
  }
  return out;
}
