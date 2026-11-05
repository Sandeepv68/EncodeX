import { describe, it, expect } from 'vitest';
import { FEATURE_FLAGS, FEATURE_FLAG_DEFAULTS } from '../flags';

describe('flags', () => {
  it('has defaults for every flag', () => {
    for (const flag of FEATURE_FLAGS) {
      expect(FEATURE_FLAG_DEFAULTS[flag.name]).toBe(flag.defaultValue);
    }
  });
  it('flag names are unique', () => {
    const names = FEATURE_FLAGS.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
