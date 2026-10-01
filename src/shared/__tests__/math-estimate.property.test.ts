/**
 * @fileoverview Property-based tests for numeric helpers and queue estimates (Phase 1).
 *
 * The invariant that matters to a progress bar is "never show the user NaN or
 * Infinity". A queue ETA of `NaN` renders as a literal `NaNm 12s` or an
 * infinitely long bar, and `estimateRemaining` divides by the count of usable
 * ETAs, so a division by zero is a live possibility rather than a theoretical
 * one.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { clamp, toPercent } from '../math';
import { estimateRemaining, formatDurationCompact } from '../estimate';
import { QUEUE_STATUS } from '../media-options';
import type { ConversionProgress, QueueJob } from '../types';

describe('clamp', () => {
  it('always returns a value inside the bounds', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        (value, a, b) => {
          const min = Math.min(a, b);
          const max = Math.max(a, b);
          const result = clamp(value, min, max);
          expect(result).toBeGreaterThanOrEqual(min);
          expect(result).toBeLessThanOrEqual(max);
        },
      ),
      { seed: 12345 },
    );
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        (value, a, b) => {
          const min = Math.min(a, b);
          const max = Math.max(a, b);
          expect(clamp(clamp(value, min, max), min, max)).toBe(clamp(value, min, max));
        },
      ),
      { seed: 12345 },
    );
  });
});

describe('toPercent', () => {
  it('never returns NaN or Infinity for any finite input', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        (value, total) => {
          const result = toPercent(value, total);
          expect(Number.isNaN(result)).toBe(false);
          expect(Number.isFinite(result)).toBe(true);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(100);
        },
      ),
      { seed: 12345 },
    );
  });

  it('returns 0 for a non-positive total instead of dividing by zero', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (value) => {
        for (const total of [0, -0, -1, -1e9]) {
          expect(toPercent(value, total)).toBe(0);
        }
      }),
      { seed: 12345 },
    );
  });

  it('is 100 when value equals total and total is positive', () => {
    fc.assert(
      fc.property(fc.double({ min: 1e-6, max: 1e9, noNaN: true }), (total) => {
        expect(toPercent(total, total)).toBe(100);
      }),
      { seed: 12345 },
    );
  });
});

describe('formatDurationCompact', () => {
  it('never emits NaN or Infinity for any finite input', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (seconds) => {
        const formatted = formatDurationCompact(seconds);
        expect(formatted).not.toMatch(/NaN|Infinity|undefined/);
        expect(formatted.length).toBeGreaterThan(0);
      }),
      { seed: 12345 },
    );
  });

  it('never emits a negative duration', () => {
    fc.assert(
      fc.property(fc.double({ min: -1e9, max: 0, noNaN: true }), (seconds) => {
        expect(formatDurationCompact(seconds)).not.toMatch(/-/);
      }),
      { seed: 12345 },
    );
  });

  it('renders sub-minute values as plain seconds', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 59 }), (seconds) => {
        expect(formatDurationCompact(seconds)).toBe(`${seconds}s`);
      }),
      { seed: 12345 },
    );
  });
});

describe('estimateRemaining', () => {
  const job = (id: string, status: QueueJob['status']): QueueJob => ({ id, status }) as QueueJob;

  it('returns null when nothing is running', () => {
    fc.assert(
      fc.property(fc.array(fc.string(), { maxLength: 8 }), (ids) => {
        const jobs = ids.map((id, i) => job(id, QUEUE_STATUS.QUEUED));
        expect(estimateRemaining(jobs)).toBeNull();
      }),
      { seed: 12345 },
    );
  });

  it('never returns NaN, Infinity, or a negative number', () => {
    const etaArbitrary = fc.oneof(
      fc.constant(null),
      fc.constant(Number.NaN),
      fc.constant(Number.POSITIVE_INFINITY),
      fc.double({ min: -1e6, max: 1e6, noNaN: false }),
    );

    fc.assert(
      fc.property(
        fc.array(fc.string(), { maxLength: 6 }),
        fc.array(fc.constantFrom(QUEUE_STATUS.RUNNING, QUEUE_STATUS.QUEUED, QUEUE_STATUS.DONE), { maxLength: 6 }),
        etaArbitrary,
        (ids, statuses, eta) => {
          const jobs = ids.map((id, i) => job(id, statuses[i % statuses.length] ?? QUEUE_STATUS.QUEUED));
          const progress: Record<string, ConversionProgress> = { [ids[0] ?? 'x']: { eta } as unknown as ConversionProgress };
          const result = estimateRemaining(jobs, progress);
          if (result !== null) {
            expect(Number.isFinite(result)).toBe(true);
            expect(result).toBeGreaterThan(0);
          }
        },
      ),
      { seed: 12345 },
    );
  });

  it('returns null when running jobs have no usable ETA', () => {
    const jobs = [job('a', QUEUE_STATUS.RUNNING), job('b', QUEUE_STATUS.QUEUED)];
    expect(estimateRemaining(jobs, { a: { eta: Number.NaN } as unknown as ConversionProgress })).toBeNull();
    expect(estimateRemaining(jobs, { a: { eta: 0 } as unknown as ConversionProgress })).toBeNull();
    expect(estimateRemaining(jobs, { a: { eta: -5 } as unknown as ConversionProgress })).toBeNull();
    expect(estimateRemaining(jobs, {})).toBeNull();
    expect(estimateRemaining(jobs)).toBeNull();
  });

  it('scales with the number of queued jobs', () => {
    const oneQueued = [job('r', QUEUE_STATUS.RUNNING), job('q1', QUEUE_STATUS.QUEUED)];
    const twoQueued = [...oneQueued, job('q2', QUEUE_STATUS.QUEUED)];
    const progress = { r: { eta: 10 } as unknown as ConversionProgress };
    expect(estimateRemaining(twoQueued, progress)).toBeGreaterThan(estimateRemaining(oneQueued, progress)!);
  });
});
