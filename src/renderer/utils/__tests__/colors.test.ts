import { describe, it, expect } from 'vitest';
import { isNearBlack } from '../colors';

describe('isNearBlack', () => {
  it('flags truly black', () => {
    expect(isNearBlack('#000000')).toBe(true);
  });

  it('accepts a hex without a leading hash', () => {
    expect(isNearBlack('000000')).toBe(true);
  });

  it('flags a very dark brand color', () => {
    expect(isNearBlack('#0f0f0f')).toBe(true);
  });

  it('accepts a mid-dark color', () => {
    expect(isNearBlack('#444444')).toBe(false);
  });

  it('accepts white', () => {
    expect(isNearBlack('#ffffff')).toBe(false);
  });

  it('accepts bright brand colors', () => {
    expect(isNearBlack('#e60023')).toBe(false);
    expect(isNearBlack('#1da1f2')).toBe(false);
  });
});
