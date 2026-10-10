/**
 * @fileoverview Unit tests for the audit-trail contract (roadmap §6 / R2).
 */

import { describe, it, expect } from 'vitest';
import { createAuditEntry, digestArgs } from '../audit';

describe('digestArgs', () => {
  it('is stable regardless of object key order', () => {
    expect(digestArgs({ input: 'a.mp4', qscale: 23 })).toBe(digestArgs({ qscale: 23, input: 'a.mp4' }));
  });

  it('differs for different arguments', () => {
    expect(digestArgs({ input: 'a.mp4' })).not.toBe(digestArgs({ input: 'b.mp4' }));
  });

  it('is an 8-character hex string', () => {
    expect(digestArgs({})).toMatch(/^[0-9a-f]{8}$/);
  });

  it('normalizes arrays and sparse values without throwing', () => {
    expect(() => digestArgs({ list: [1, undefined, 'x'], nested: { a: undefined } })).not.toThrow();
  });
});

describe('createAuditEntry', () => {
  it('builds an ok entry with a digest and timestamp', () => {
    const now = new Date('2026-01-02T03:04:05.000Z');
    const entry = createAuditEntry({ tool: 'convert_media', tier: 2, args: { input: 'a.mp4' }, result: 'ok', now });
    expect(entry.tool).toBe('convert_media');
    expect(entry.tier).toBe(2);
    expect(entry.result).toBe('ok');
    expect(entry.timestamp).toBe('2026-01-02T03:04:05.000Z');
    expect(entry.argsDigest).toBe(digestArgs({ input: 'a.mp4' }));
    expect(entry.id).toBe(`${entry.timestamp}-${entry.argsDigest}`);
    expect(entry.detail).toBeUndefined();
  });

  it('records an error detail when provided', () => {
    const entry = createAuditEntry({ tool: 'cut_video', tier: 2, args: {}, result: 'error', detail: 'boom' });
    expect(entry.result).toBe('error');
    expect(entry.detail).toBe('boom');
  });
});
