import { describe, it, expect } from 'vitest';
import { sanitizeAnalyticsProps } from '../sanitize';

describe('sanitizeAnalyticsProps', () => {
  it('keeps primitives', () => {
    expect(sanitizeAnalyticsProps({ a: 'x', b: 1, c: true })).toEqual({ a: 'x', b: 1, c: true });
  });
  it('drops non-primitives and empty strings', () => {
    expect(sanitizeAnalyticsProps({ a: '', b: null as never, c: { x: 1 } as never, d: [1] as never })).toBeUndefined();
  });
  it('keeps a mix', () => {
    expect(sanitizeAnalyticsProps({ a: 'x', b: null as never })).toEqual({ a: 'x' });
  });
});
