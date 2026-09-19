import { describe, it, expect } from 'vitest';
import { clamp, toPercent } from '../math';

describe('clamp', () => {
  it('returns the value when within bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('clamps below the minimum', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps above the maximum', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('toPercent', () => {
  it('converts a value to a clamped percentage', () => {
    expect(toPercent(50, 200)).toBe(25);
    expect(toPercent(200, 200)).toBe(100);
    expect(toPercent(0, 200)).toBe(0);
  });

  it('returns 0 for non-positive totals', () => {
    expect(toPercent(50, 0)).toBe(0);
    expect(toPercent(50, -10)).toBe(0);
  });
});
