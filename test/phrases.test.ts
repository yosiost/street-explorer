import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUNDLED_CITY_IDS } from '../src/config';
import { splitCityResponse } from '../src/data/loader';
import { processCity } from '../src/geo/pipeline';
import { findNamesake } from '../src/kids/namesakes';
import { hebrewPhrases } from '../src/kids/phrases';
import { formatRatio, sentence, spokenStreet, type HomeStreet } from '../src/kids/units';
import { loadRecordings, recordingsFor } from '../src/ui/recorded';

const bundled = BUNDLED_CITY_IDS.flatMap((id) => {
  const res = JSON.parse(readFileSync(`public/data/${id}.json`, 'utf8'));
  return processCity(splitCityResponse(res)).streets;
});
const phrases = hebrewPhrases(bundled);

describe('Hebrew phrases to record', () => {
  it('cover everything said about every street of the bundled cities', () => {
    const [first, second] = bundled;
    const homes: (HomeStreet | null)[] = [null, first!, second!].map((s) =>
      s ? { cityId: 1, streetId: s.id, name: s.name, lengthM: s.lengthM } : null,
    );
    for (const home of homes) {
      for (const street of bundled) {
        for (const part of spokenStreet(street, home, findNamesake(street))) {
          expect(phrases, part.text).toContain(part.text);
        }
      }
    }
  });

  it('cover the games', () => {
    for (const [a, b] of [
      [1_000, 900],
      [3_000, 1_000],
      [20_000, 210],
    ] as const) {
      expect(phrases).toContain(sentence(formatRatio(a, b)));
    }
    expect(phrases).toContain('מצאו במפה את');
    expect(phrases).toContain('כמעט! הרחוב הכחול ארוך יותר.');
  });
});

describe('recordings', () => {
  const index = 'public/audio/he/index.json';

  it('every phrase is recorded (after changing what the app says: scripts/speech)', () => {
    const { clips } = JSON.parse(readFileSync(index, 'utf8')) as { clips: Record<string, string> };
    const missing = [...phrases].filter((p) => !clips[p]);
    expect(missing).toEqual([]);
    for (const id of new Set(Object.values(clips))) {
      expect(existsSync(`public/audio/he/${id}.mp3`), id).toBe(true);
    }
  });

  it('a sentence plays from recordings only when every part has one', async () => {
    globalThis.AudioContext ??= class {} as unknown as typeof AudioContext;
    const fetchIndex = (async () => new Response(readFileSync(index))) as typeof fetch;
    await loadRecordings(fetchIndex);
    const he = (text: string) => ({ text, voice: 'he' as const });
    expect(recordingsFor([he('מצאו במפה את'), he('הרצל')])).toHaveLength(2);
    expect(recordingsFor([he('מצאו במפה את'), he('רחוב שלא קיים')])).toBeNull();
  });
});
