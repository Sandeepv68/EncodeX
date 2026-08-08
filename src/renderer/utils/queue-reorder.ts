import type { QueueJob } from '../../shared/types';
import { QUEUE_STATUS } from '../../shared/media-options';

/**
 * @fileoverview Pure helpers for computing batch queue reorder targets.
 *
 * Drag-and-drop reordering only moves QUEUED jobs; running/done/errored jobs
 * keep their slots (enforced by the main-process `moveJobTo`). These helpers
 * derive the target queued-subsequence position from the visible reorder so
 * the renderer can issue a single `queueMoveTo(id, toPosition)` call. All
 * functions are pure and side-effect free.
 */

/**
 * Computes the target QUEUED-subsequence index for a dragged job after a
 * visible reorder.
 *
 * A dragged job only ever crosses the *visible* cards it passes over, never
 * the hidden (filtered-out) ones. So the number of QUEUED jobs that end up
 * before it is:
 *  - the QUEUED jobs that are hidden and were already before it, plus
 *  - the QUEUED jobs that are visible before it in the new visible order.
 *
 * @param {QueueJob[]} jobs - The full job list in current queue order.
 * @param {string} movedId - Id of the dragged (QUEUED) job.
 * @param {string[]} newVisibleIds - Visible job ids after `arrayMove` applied
 *   the drop (same set as before the drag, new order).
 * @returns {number} The moved job's index within the QUEUED subsequence of the
 *   reordered queue (0-based).
 */
export function computeQueuedTargetPosition(jobs: QueueJob[], movedId: string, newVisibleIds: string[]): number {
  const visibleSet = new Set(newVisibleIds);
  const statusById = new Map(jobs.map((job) => [job.id, job.status]));
  let beforeCount = 0;

  for (const job of jobs) {
    if (job.id === movedId) break;
    if (job.status === QUEUE_STATUS.QUEUED && !visibleSet.has(job.id)) beforeCount += 1;
  }
  for (const id of newVisibleIds) {
    if (id === movedId) break;
    if (statusById.get(id) === QUEUE_STATUS.QUEUED) beforeCount += 1;
  }
  return beforeCount;
}

/**
 * Mirrors the main-process `moveJobTo` reorder in the local jobs array.
 *
 * Permutes the QUEUED subsequence so the moved job lands at `toPosition`,
 * writing the reordered jobs back into their queued slots so non-queued jobs
 * keep their absolute positions. Must stay in lockstep with
 * `JobQueue.moveJobTo` in src/main/queue/job-queue.ts.
 * @param {QueueJob[]} jobs - The full job list to reorder (not mutated).
 * @param {string} id - Id of the QUEUED job that was moved.
 * @param {number} toPosition - Its new index within the QUEUED subsequence.
 * @returns {QueueJob[]} A new array with the reorder applied.
 */
export function reorderJob(jobs: QueueJob[], id: string, toPosition: number): QueueJob[] {
  const queuedIndexes = jobs.map((job, index) => (job.status === QUEUE_STATUS.QUEUED ? index : -1)).filter((index) => index !== -1);
  const fromPos = queuedIndexes.findIndex((index) => jobs[index].id === id);
  if (fromPos === -1) return jobs;
  const toPos = Math.max(0, Math.min(Math.floor(toPosition), queuedIndexes.length - 1));
  if (toPos === fromPos) return jobs;
  const ordered = queuedIndexes.map((index) => jobs[index]);
  const [moved] = ordered.splice(fromPos, 1);
  ordered.splice(toPos, 0, moved);
  const next = [...jobs];
  queuedIndexes.forEach((index, k) => {
    next[index] = ordered[k];
  });
  return next;
}
