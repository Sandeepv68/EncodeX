/**
 * @fileoverview Unit tests for the queue helpers both engines share.
 *
 * The helpers are pure, so they are tested directly rather than through a
 * queue: the clamping rules and the QUEUED-subset reordering are the two
 * places where a subtle mistake would corrupt a queue's order.
 */

import { describe, it, expect } from 'vitest';
import { clampConcurrency, moveQueuedJob, nextQueuedJob, normalizeOutputPath } from '../queue-utils';
import { QUEUE_STATUS } from '../../../shared/media-options';

/**
 * A minimal queued job shape for the ordering helpers.
 * @param {string} id - The job id.
 * @param {string} [status] - The job's queue status.
 * @returns {{ id: string; status: string }} The job.
 */
function job(id: string, status: string = QUEUE_STATUS.QUEUED): { id: string; status: string } {
  return { id, status };
}

describe('clampConcurrency', () => {
  it('keeps a legal cap unchanged', () => {
    expect(clampConcurrency(3, 1)).toBe(3);
    expect(clampConcurrency(1, 2)).toBe(1);
  });

  it('truncates a fractional cap', () => {
    expect(clampConcurrency(2.5, 1)).toBe(2);
  });

  it('clamps a cap outside the legal range', () => {
    expect(clampConcurrency(0, 1)).toBe(1);
    expect(clampConcurrency(99, 1)).toBe(4);
  });

  it('falls back for a non-finite or non-numeric cap', () => {
    expect(clampConcurrency(Number.NaN, 2)).toBe(2);
    expect(clampConcurrency(Number.POSITIVE_INFINITY, 2)).toBe(2);
    expect(clampConcurrency('3', 2)).toBe(2);
    expect(clampConcurrency(undefined, 2)).toBe(2);
  });
});

describe('nextQueuedJob', () => {
  it('returns undefined when nothing is queued', () => {
    expect(nextQueuedJob([job('a', QUEUE_STATUS.DONE), job('b', QUEUE_STATUS.RUNNING)])).toBeUndefined();
    expect(nextQueuedJob([])).toBeUndefined();
  });

  it('picks the first queued job in insertion order', () => {
    const queue = [job('a', QUEUE_STATUS.DONE), job('b'), job('c')];
    expect(nextQueuedJob(queue)?.id).toBe('b');
  });

  it('prefers the highest priority', () => {
    const queue = [
      { id: 'a', status: QUEUE_STATUS.QUEUED, priority: 0 },
      { id: 'b', status: QUEUE_STATUS.QUEUED, priority: 5 },
    ];
    expect(nextQueuedJob(queue)?.id).toBe('b');
  });
});

describe('moveQueuedJob', () => {
  it('moves a queued job within the queued subsequence', () => {
    const queue = [job('a'), job('b'), job('c')];
    expect(moveQueuedJob(queue, 'a', 2)).toBe(2);
    expect(queue.map((entry) => entry.id)).toEqual(['b', 'c', 'a']);
  });

  it('keeps the slots of non-queued jobs', () => {
    const queue = [job('a', QUEUE_STATUS.RUNNING), job('b'), job('c')];
    expect(moveQueuedJob(queue, 'b', 1)).toBe(1);
    expect(queue.map((entry) => entry.id)).toEqual(['a', 'c', 'b']);
  });

  it('refuses a move of a job that is not queued', () => {
    const queue = [job('a', QUEUE_STATUS.RUNNING), job('b')];
    expect(moveQueuedJob(queue, 'a', 1)).toBe(-1);
  });

  it('refuses an unknown job', () => {
    expect(moveQueuedJob([job('a')], 'missing', 0)).toBe(-1);
  });

  it('refuses a non-finite target and a no-op move', () => {
    const queue = [job('a'), job('b')];
    expect(moveQueuedJob(queue, 'a', Number.NaN)).toBe(-1);
    expect(moveQueuedJob(queue, 'a', 0)).toBe(-1);
  });
});

describe('normalizeOutputPath', () => {
  it('unifies separators and case', () => {
    expect(normalizeOutputPath('C:\\Out\\A.MKV')).toBe('c:/out/a.mkv');
  });

  it('returns an empty path for a non-string', () => {
    expect(normalizeOutputPath(undefined)).toBe('');
    expect(normalizeOutputPath(42)).toBe('');
  });
});
