/**
 * @fileoverview Property-based tests for error mapping (Phase 1).
 *
 * `formatError` is the single funnel every rejection in the app passes through
 * before reaching the UI, including values thrown by child processes and by
 * native modules. The property that matters is total: whatever gets thrown, the
 * user must see a non-empty message and a code that exists in `ErrorCode`. A
 * throw here means an error dialog with a blank body, which is exactly the
 * failure mode that is invisible in hand-written tests because hand-written
 * tests only throw things the author imagined.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { ErrorCode, ERROR_MESSAGES, formatError, isAppError } from '../errors';
import type { ErrorCodeType } from '../types';

const VALID_CODES = new Set<string>(Object.values(ErrorCode));

/** Anything at all, including values JSON and `String()` handle badly. */
const anything: fc.Arbitrary<unknown> = fc.anything({ withMap: false, withSet: false, withObjectString: true });

describe('formatError totality', () => {
  it('never throws for any value, including cyclic objects', () => {
    const cyclic: Record<string, unknown> = { name: 'loop' };
    cyclic.self = cyclic;
    const throwingProxy = new Proxy(
      {},
      {
        get() {
          throw new Error('property access exploded');
        },
      },
    );

    fc.assert(
      fc.property(fc.oneof(anything, fc.constant(cyclic), fc.constant(throwingProxy), fc.constant(Symbol('s'))), (value) => {
        expect(() => formatError(value)).not.toThrow();
      }),
      { seed: 12345 },
    );
  });

  it('always returns a valid AppError with a non-empty canonical message', () => {
    fc.assert(
      fc.property(fc.oneof(anything, fc.constant(Symbol('s')), fc.constant(10n)), (value) => {
        const result = formatError(value);

        expect(isAppError(result)).toBe(true);
        expect(VALID_CODES.has(result.code)).toBe(true);
        expect(typeof result.message).toBe('string');
        expect(result.message.length).toBeGreaterThan(0);
        expect(Number.isFinite(result.timestamp)).toBe(true);
      }),
      { seed: 12345 },
    );
  });

  it('never leaves the canonical message empty even when ERROR_MESSAGES is consulted', () => {
    fc.assert(
      fc.property(fc.string(), (message) => {
        const result = formatError(message);
        // The message shown to the user is the canonical one, never the raw text.
        expect(result.message).toBe(ERROR_MESSAGES[result.code as ErrorCodeType]);
        expect(result.message).not.toHaveLength(0);
      }),
      { seed: 12345 },
    );
  });

  it('passes through an existing AppError unchanged', () => {
    fc.assert(
      fc.property(fc.constantFrom(...Object.values(ErrorCode)), fc.string(), (code, message) => {
        const original = { code, message, timestamp: 1700000000000 };
        expect(formatError(original)).toBe(original);
      }),
      { seed: 12345 },
    );
  });

  it('preserves a non-string message as a usable detail without throwing', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(null), fc.constant(undefined), fc.integer(), fc.boolean(), fc.constant({ nested: true })),
        (message) => {
          const result = formatError({ message, code: 'ENOENT' });
          expect(isAppError(result)).toBe(true);
          expect(VALID_CODES.has(result.code)).toBe(true);
        },
      ),
      { seed: 12345 },
    );
  });

  it('infers a code that exists for any message-shaped object', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (message, code) => {
        const result = formatError({ message, code });
        expect(VALID_CODES.has(result.code)).toBe(true);
        expect(ERROR_MESSAGES[result.code as ErrorCodeType]).toBe(result.message);
      }),
      { seed: 12345 },
    );
  });

  it('degrades to UNKNOWN when reading message throws', () => {
    const hostile = {
      get message(): string {
        throw new Error('nope');
      },
    };
    const result = formatError(hostile);
    expect(result.code).toBe(ErrorCode.UNKNOWN);
    expect(result.message).toBe(ERROR_MESSAGES[ErrorCode.UNKNOWN]);
  });

  it('survives a Proxy that throws on every get and has', () => {
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error('get exploded');
        },
        has() {
          throw new Error('has exploded');
        },
      },
    );
    const result = formatError(hostile);
    expect(VALID_CODES.has(result.code)).toBe(true);
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('survives an object with a throwing toString', () => {
    const hostile = {
      toString() {
        throw new Error('toString exploded');
      },
    };
    const result = formatError(hostile);
    expect(VALID_CODES.has(result.code)).toBe(true);
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('survives a non-object whose stringification throws', () => {
    // A function is `typeof 'function'`, not `'object'`, so it skips the
    // object branch and reaches `String(err)` directly. A throwing
    // Symbol.toPrimitive there must not escape the error path either.
    const hostileFn = new Proxy(function noop() {}, {
      get(target, prop) {
        if (prop === Symbol.toPrimitive) {
          return () => {
            throw new Error('toPrimitive exploded');
          };
        }
        return Reflect.get(target, prop);
      },
    });
    expect(typeof hostileFn).toBe('function');
    const result = formatError(hostileFn);
    expect(VALID_CODES.has(result.code)).toBe(true);
    expect(result.message.length).toBeGreaterThan(0);
  });
});

describe('formatError code inference', () => {
  it('maps the documented Node codes to specific errors', () => {
    expect(formatError(Object.assign(new Error('x'), { code: 'ENOENT' })).code).toBe(ErrorCode.FILE_NOT_FOUND);
    expect(formatError(Object.assign(new Error('x'), { code: 'EACCES' })).code).toBe(ErrorCode.PERMISSION_DENIED);
  });

  it('prefers ffmpeg/ffprobe specific codes over the generic not-found', () => {
    expect(formatError('ffmpeg not found').code).toBe(ErrorCode.FFMPEG_NOT_FOUND);
    expect(formatError('ffprobe not found').code).toBe(ErrorCode.FFPROBE_NOT_FOUND);
  });

  it('maps AggregateError and cancellation-ish text', () => {
    const agg = new AggregateError([new Error('a')], 'conversion failed');
    expect(VALID_CODES.has(formatError(agg).code)).toBe(true);
    expect(formatError('operation cancelled').code).toBe(ErrorCode.CANCELLED);
  });

  it('falls back to UNKNOWN for unrecognised text', () => {
    expect(formatError('a wholly novel failure mode').code).toBe(ErrorCode.UNKNOWN);
  });

  it('handles a BigInt without throwing', () => {
    const result = formatError(10n);
    expect(VALID_CODES.has(result.code)).toBe(true);
    expect(result.message).toBe(ERROR_MESSAGES[result.code as ErrorCodeType]);
  });
});
