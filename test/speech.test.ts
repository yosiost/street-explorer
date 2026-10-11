import { describe, expect, it } from 'vitest';
import { voiceQuality } from '../src/ui/speech';

describe('voice quality', () => {
  it('ranks neural over Premium over Enhanced over basic', () => {
    const names = [
      'Carmit',
      'Carmit (Enhanced)',
      'Carmit (Premium)',
      'Microsoft Hila Online (Natural) - Hebrew (Israel)',
    ];
    expect(names.map((name) => voiceQuality({ name }))).toEqual([0, 1, 2, 3]);
  });
});
