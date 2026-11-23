import { describe, it, expect } from 'vitest';
import {
  createAnalyticsExceptionPayload,
  parseAnalyticsExceptionPayload,
  sanitizeAnalyticsProps,
  sanitizeExceptionContext,
} from '../sanitize';

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

describe('exception sanitization', () => {
  it('drops sensitive, empty, and non-primitive context values', () => {
    expect(
      sanitizeExceptionContext({
        tags: { handler: 'window.error', filePath: '/secret', email: 'user@example.com', empty: '' },
        extra: { process: 'renderer', nested: { secret: true }, count: 2, enabled: false },
      }),
    ).toEqual({ tags: { handler: 'window.error' }, extra: { process: 'renderer', count: 2, enabled: false } });
  });

  it('serializes an Error with bounded message and stack', () => {
    const error = new Error('boom');
    const payload = createAnalyticsExceptionPayload(error, { tags: { handler: 'window.error' } });
    expect(payload).toMatchObject({
      name: 'Error',
      message: 'boom',
      context: { tags: { handler: 'window.error' } },
    });
    expect(payload.stack).toEqual(expect.any(String));
  });

  it('bounds hostile IPC exception payloads', () => {
    const payload = parseAnalyticsExceptionPayload({
      name: 'A'.repeat(500),
      message: 'B'.repeat(5000),
      stack: 'C'.repeat(20000),
      context: { extra: { path: '/secret', process: 'renderer' } },
    });
    expect(payload?.name).toHaveLength(100);
    expect(payload?.message).toHaveLength(1000);
    expect(payload?.stack).toHaveLength(8000);
    expect(payload?.context).toEqual({ extra: { process: 'renderer' } });
  });
});
