/**
 * Normalizes a street name for grouping: trims, collapses whitespace and unifies
 * geresh/gershayim variants. Prefixes like "שדרות" are kept on purpose.
 */
export function normalizeName(raw: string): string {
  return (
    raw
      .trim()
      .replace(/\s+/g, ' ')
      // Two apostrophes are a common ASCII stand-in for gershayim (e.g. האר''י).
      .replace(/(?:''|’’|׳׳)/g, '״')
      .replace(/["”“]/g, '״')
      .replace(/['’‘`]/g, '׳')
  );
}

export function streetNameOf(tags: Record<string, string> | undefined): string | null {
  const raw = tags?.['name:he'] ?? tags?.name;
  if (!raw) return null;
  const name = normalizeName(raw);
  return name || null;
}
