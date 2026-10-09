import { describe, expect, it } from 'vitest';
import { formatLength, formatPitches } from '../src/ui/format';

describe('formatLength', () => {
  it('shows meters rounded to 10 m under 1 km', () => {
    expect(formatLength(434)).toBe('430 מ׳');
    expect(formatLength(7)).toBe('10 מ׳');
  });

  it('shows km with one decimal from 1 km', () => {
    expect(formatLength(2300)).toBe('2.3 ק״מ');
    expect(formatLength(1000)).toBe('1.0 ק״מ');
  });

  it('switches to km when rounding reaches 1,000 m', () => {
    expect(formatLength(996)).toBe('1.0 ק״מ');
  });
});

describe('formatPitches', () => {
  it('expresses length as football pitches', () => {
    expect(formatPitches(2310)).toBe('כמו 22 מגרשי כדורגל');
    expect(formatPitches(100)).toBe('כמו מגרש כדורגל אחד');
    expect(formatPitches(20)).toBe('פחות ממגרש כדורגל אחד');
  });
});
