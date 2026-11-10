/**
 * @fileoverview Pure helpers shared by the batch job queue and the dedicated
 * remux/demux mux queue.
 *
 * These functions are deliberately side-effect free so both queue engines can
 * agree on the edge cases that are easy to get subtly wrong: a non-finite
 * concurrency cap, a non-finite reorder target, and the ordering of the
 * QUEUED subsequence when a job is moved.
 */

import { MAX_QUEUE_CONCURRENCY } from '../../shared/constants';
import { QUEUE_STATUS } from '../../shared/media-options';
import type { MuxQueueJob, QueueJob } from '../../shared/types';

/**
 * Clamps a caller-supplied concurrency cap into the legal integer range.
 *
 * Every value that reaches this function arrives over IPC from the renderer or
 * out of a JSON snapshot, and `structuredClone` carries `NaN` across the
 * boundary while `1e999` parses to `Infinity`. Those are not theoretical:
 * `Math.min(Math.max(NaN, 1), 4)` is `NaN`, and a queue whose cap is `NaN`
 * satisfies `activeJobs.size < NaN` never - so the drain loop starts nothing,
 * forever, with no error anywhere.
 *
 * Non-finite input is rejected rather than "fixed": an unrecognisable request
 * must not change the state the queue is already in. Everything else is
 * truncated (a cap of 2.5 would otherwise behave as 3, because `size < 2.5`
 * admits three jobs) and clamped to `1..MAX_QUEUE_CONCURRENCY`.
 * @param {unknown} value - The raw value received from the caller.
 * @param {number} fallback - Value to use when `value` is not finite.
 * @returns {number} An integer in `1..MAX_QUEUE_CONCURRENCY`.
 */
export function clampConcurrency(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), 1), MAX_QUEUE_CONCURRENCY);
}

/**
 * Picks the next job to run: highest priority first, then insertion order.
 * @param {T[]} queue - All known jobs.
 * @returns {T | undefined} The job that should start next, or undefined when
 *   nothing is queued.
 */
export function nextQueuedJob<T extends { status: string; priority?: number }>(queue: T[]): T | undefined {
  const queued = queue.filter((job) => job.status === QUEUE_STATUS.QUEUED);
  if (queued.length === 0) return undefined;
  const maxPriority = Math.max(...queued.map((job) => job.priority ?? 0));
  return queued.find((job) => (job.priority ?? 0) === maxPriority);
}

/**
 * Reorders the QUEUED subsequence of a job list, keeping the slots of
 * non-queued jobs (running/done/errored) untouched.
 *
 * A non-finite target is refused rather than clamped: `Math.floor(NaN)` is
 * `NaN`, which survives `Math.max(0, Math.min(NaN, n))`, and
 * `Array.splice(NaN, 0, x)` moves the job to the front while the `moved`
 * event would advertise `toPosition: NaN`.
 * @param {T[]} queue - The job list, mutated in place when a move succeeds.
 * @param {string} id - Id of the QUEUED job to move.
 * @param {number} toPosition - Target index within the QUEUED subsequence.
 * @returns {number} The applied position, or -1 when the move was rejected.
 */
export function moveQueuedJob<T extends { id: string; status: string }>(queue: T[], id: string, toPosition: number): number {
  if (typeof toPosition !== 'number' || !Number.isFinite(toPosition)) return -1;
  const queuedIndexes = queue.map((job, index) => (job.status === QUEUE_STATUS.QUEUED ? index : -1)).filter((index) => index !== -1);
  const fromPos = queuedIndexes.findIndex((index) => queue[index].id === id);
  if (fromPos === -1) return -1;
  const toPos = Math.max(0, Math.min(Math.floor(toPosition), queuedIndexes.length - 1));
  if (toPos === fromPos) return -1;
  const ordered = queuedIndexes.map((index) => queue[index]);
  const [moved] = ordered.splice(fromPos, 1);
  ordered.splice(toPos, 0, moved);
  queuedIndexes.forEach((index, k) => {
    queue[index] = ordered[k];
  });
  return toPos;
}

/**
 * Normalizes a file path for duplicate comparison: lowercases and unifies
 * Windows backslashes with POSIX forward slashes.
 *
 * A non-string input normalizes to the empty string instead of throwing: the
 * value can come from a hostile renderer or a hand-edited snapshot, and a
 * comparison must not be the thing that crashes the queue.
 * @param {unknown} value - The file path to normalize.
 * @returns {string} The normalized path, or '' for a non-string input.
 */
export function normalizeOutputPath(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\\/g, '/').toLowerCase();
}

/**
 * Collects every output path claimed by the given jobs.
 * @param {Array<QueueJob | MuxQueueJob>} jobs - The jobs to inspect.
 * @returns {Set<string>} Normalized output paths claimed by the jobs.
 */
export function collectOutputPaths(jobs: Array<QueueJob | MuxQueueJob>): Set<string> {
  const paths = new Set<string>();
  for (const job of jobs) {
    const targets = (job as MuxQueueJob).targets;
    if (Array.isArray(targets)) {
      for (const target of targets) {
        paths.add(normalizeOutputPath(target.output));
      }
      continue;
    }
    paths.add(normalizeOutputPath((job as QueueJob).output));
  }
  return paths;
}
