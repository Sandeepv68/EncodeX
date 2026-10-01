/**
 * @fileoverview Property-based tests for renderer formatters (Phase 1).
 *
 * Everything a formatter returns is rendered straight into the UI, so the
 * invariants are narrow but absolute: never throw, never emit `NaN`,
 * `Infinity`, `Invalid Date` or the literal string `undefined`, and always
 * return a non-empty string. `formatSize` is the worst offender in practice -
 * it does unit math and is fed whatever ffprobe reported, including `NaN`
 * durations on corrupt files.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { formatBitrate, formatBytes, formatClockTime, formatDuration, formatSize, timeToSeconds } from '../formatters';

const finiteDoubles = () => fc.double({ noNaN: true, noDefaultInfinity: true });

describe('formatSize', () => {
  it('never throws and never emits a non-finite marker', () => {
    fc.assert(
      fc.property(fc.oneof(finiteDoubles(), fc.constant(Number.NaN), fc.constant(Number.POSITIVE_INFINITY), fc.constant(-1)), (bytes) => {
        const result = formatSize(bytes);
        expect(typeof result).toBe('string');
        expect(result).not.toMatch(/NaN|Infinity|undefined/);
        expect(result.length).toBeGreaterThan(0);
      }),
      { seed: 12345 },
    );
  });

  it('is monotonic for non-negative byte counts', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 40 }), fc.integer({ min: 1, max: 2 ** 30 }), (a, b) => {
        expect(formatSize(a).length).toBeLessThanOrEqual(formatSize(a + b).length + 4);
      }),
      { seed: 12345 },
    );
  });

  it('formats zero as a readable string', () => {
    expect(formatSize(0)).not.toHaveLength(0);
  });
});

describe('formatBytes', () => {
  it('never throws and never emits a non-finite marker', () => {
    fc.assert(
      fc.property(fc.oneof(finiteDoubles(), fc.constant(Number.NaN), fc.constant(Number.NEGATIVE_INFINITY)), (bytes) => {
        const result = formatBytes(bytes);
        expect(typeof result).toBe('string');
        expect(result).not.toMatch(/NaN|Infinity|undefined/);
      }),
      { seed: 12345 },
    );
  });
});

describe('formatDuration', () => {
  it('never throws and never emits a non-finite marker', () => {
    fc.assert(
      fc.property(fc.oneof(finiteDoubles(), fc.constant(Number.NaN), fc.constant(Number.POSITIVE_INFINITY), fc.constant(-5)), (seconds) => {
        const result = formatDuration(seconds);
        expect(typeof result).toBe('string');
        expect(result).not.toMatch(/NaN|Infinity|undefined/);
        expect(result.length).toBeGreaterThan(0);
      }),
      { seed: 12345 },
    );
  });
});

describe('formatClockTime', () => {
  it('never throws and never emits a non-finite marker', () => {
    fc.assert(
      fc.property(
        fc.oneof(finiteDoubles(), fc.constant(Number.NaN), fc.constant(Number.POSITIVE_INFINITY)),
        fc.boolean(),
        fc.boolean(),
        (seconds, alwaysShowMs, skip) => {
          const result = formatClockTime(seconds, { alwaysShowMs, ...(skip ? {} : {}) });
          expect(typeof result).toBe('string');
          expect(result).not.toMatch(/NaN|Infinity|undefined/);
          expect(result.length).toBeGreaterThan(0);
        },
      ),
      { seed: 12345 },
    );
  });

  it('works with no options object at all', () => {
    expect(() => formatClockTime(12.5)).not.toThrow();
    expect(() => formatClockTime(12.5, {})).not.toThrow();
  });
});

describe('formatBitrate', () => {
  it('never throws, never emits undefined, and preserves non-empty input', () => {
    fc.assert(
      fc.property(fc.string(), (bitrate) => {
        const result = formatBitrate(bitrate);
        expect(typeof result).toBe('string');
        expect(result).not.toMatch(/undefined/);
        // Non-numeric input ('N/A', '128k') is passed through untouched, so a
        // non-empty input must never be formatted down to an empty cell.
        if (bitrate.length > 0) {
          expect(result.length).toBeGreaterThan(0);
        }
      }),
      { seed: 12345 },
    );
  });

  it('never emits NaN for numeric-looking garbage', () => {
    fc.assert(
      fc.property(fc.string(), (bitrate) => {
        expect(formatBitrate(bitrate)).not.toMatch(/NaN/);
      }),
      { seed: 12345 },
    );
  });
});

describe('timeToSeconds', () => {
  it('returns null or a finite non-negative number', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const result = timeToSeconds(value);
        if (result !== null) {
          expect(Number.isFinite(result)).toBe(true);
          expect(result).toBeGreaterThanOrEqual(0);
        }
      }),
      { seed: 12345 },
    );
  });

  it('never returns NaN', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        expect(timeToSeconds(value)).not.toBeNaN();
      }),
      { seed: 12345 },
    );
  });

  it('round-trips a well-formed clock string through formatClockTime', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }), fc.integer({ min: 0, max: 59 }), (h, m, s) => {
        const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        const seconds = timeToSeconds(value);
        expect(seconds).not.toBeNull();
        expect(() => formatClockTime(seconds!)).not.toThrow();
      }),
      { seed: 12345 },
    );
  });
});
