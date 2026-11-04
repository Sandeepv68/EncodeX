import { describe, it, expect } from 'vitest';
import { coerceProfileKind, coerceHardwareClass, PROFILE_KINDS, HARDWARE_CLASSES } from '../groups';

describe('groups', () => {
  it('coerces profile kind', () => {
    expect(coerceProfileKind('web')).toBe('web');
    expect(coerceProfileKind('nope')).toBe('custom');
    expect(coerceProfileKind(undefined)).toBe('custom');
  });
  it('coerces hardware class', () => {
    expect(coerceHardwareClass(true)).toBe('gpu_hw');
    expect(coerceHardwareClass(false)).toBe('cpu');
    expect(coerceHardwareClass(undefined)).toBe('gpu_sw');
  });
  it('enums are bounded', () => {
    expect(PROFILE_KINDS.size).toBeGreaterThan(0);
    expect(HARDWARE_CLASSES.size).toBe(3);
  });
});
