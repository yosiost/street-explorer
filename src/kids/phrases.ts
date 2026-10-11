import { KID_STEP_M } from '../config';
import type { Street } from '../geo/streets';
import { stringsFor } from '../i18n';
import { NAMESAKES } from './namesakes';
import { formatRatio, niceRound, sentence, spokenLength, spokenNamesake } from './units';

/** The longest street, and the biggest "N times", that have recordings. */
const MAX_RECORDED_M = 20_000;
const MAX_RECORDED_TIMES = 100;

/**
 * Every piece of Hebrew the app can say, for recording ahead of time (scripts/speech):
 * the street names of the given streets and each sentence the read-aloud is built from,
 * with every number it can have. Must run with Hebrew as the language (the default outside
 * a browser), since the sentences come from the same code that says them.
 */
export function hebrewPhrases(streets: Pick<Street, 'name' | 'altNames'>[]): Set<string> {
  const s = stringsFor('he');
  const out = new Set<string>();
  const add = (text: string) => out.add(text);

  for (const street of streets) {
    add(street.name);
    if (street.altNames?.he) add(street.altNames.he);
  }

  // A street's facts (spokenStreet).
  for (let m = 10; m <= MAX_RECORDED_M; m += m < 1_000 ? 10 : 100) {
    add(sentence(s.spokenLength(spokenLength(m))));
  }
  for (const text of Object.values(s.spokenDirection)) add(sentence(text));
  add(sentence(s.spokenIsHome));
  for (const text of [s.homeSame, s.homeHalf, s.homeQuarter, s.homeMuchShorter]) {
    add(sentence(text));
  }
  for (let n = 2; n <= MAX_RECORDED_TIMES; n++) add(sentence(s.homeTimes(n)));
  const steps = new Set<number>();
  for (let n = 1; n <= MAX_RECORDED_M / KID_STEP_M; n++) steps.add(niceRound(n));
  for (const n of steps) add(sentence(s.spokenKidSteps(n)));
  for (const person of NAMESAKES) add(spokenNamesake(person).text);

  // Which is longer?
  add(s.spokenQuestion[0]);
  add(s.spokenQuestion[1]);
  add(s.spokenRight);
  add(s.almost(s.sideWord.red));
  add(s.almost(s.sideWord.blue));
  add(sentence(formatRatio(1, 1)));
  for (let n = 2; n <= MAX_RECORDED_TIMES; n++) add(sentence(s.ratioTimes(n)));

  // Find it!
  for (const text of [...s.spokenFind, ...s.spokenWrong]) if (text) add(text);
  add(s.spokenFound);
  add(s.spokenClue);
  add(s.spokenReveal);
  return out;
}
