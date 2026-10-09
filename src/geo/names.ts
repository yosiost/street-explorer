const HEBREW = /[֐-׿]/;

/**
 * Normalizes a street name for grouping: trims and collapses whitespace. Hebrew names also
 * get their geresh/gershayim variants unified; other scripts keep their apostrophes and
 * quotes ("Rue de l'Église"). Prefixes like "שדרות" are kept on purpose.
 */
export function normalizeName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!HEBREW.test(name)) return name;
  return (
    name
      // Two apostrophes are a common ASCII stand-in for gershayim (e.g. האר''י).
      .replace(/(?:''|’’|׳׳)/g, '״')
      .replace(/["”“]/g, '״')
      .replace(/['’‘`]/g, '׳')
  );
}

/** Tag keys to read a street's name from, in order of preference. */
export type NameKeys = readonly string[];
export const HEBREW_NAME_KEYS: NameKeys = ['name:he', 'name'];
// Outside Israel only a few famous streets have a Hebrew name; mixing those in would
// split streets whose ways are tagged unevenly, so we use the local name.
export const LOCAL_NAME_KEYS: NameKeys = ['name'];

export function streetNameOf(
  tags: Record<string, string> | undefined,
  keys: NameKeys = HEBREW_NAME_KEYS,
): string | null {
  if (!tags) return null;
  for (const key of keys) {
    const raw = tags[key];
    if (!raw) continue;
    const name = normalizeName(raw);
    if (name) return name;
  }
  return null;
}
