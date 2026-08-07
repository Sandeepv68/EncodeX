/**
 * @fileoverview Best-effort estimated remaining time for the batch queue.
 *
 * Durations are never probed (that would require decoding every input), so the
 * estimate is derived entirely from the live ETA snapshots of running jobs and
 * extrapolated across the jobs still waiting in line. It is deliberately
 * experimental: the total is a rough upper bound that assumes every queued job
 * takes roughly as long as the running ones, so it is surfaced only in the
 * stats row rather than treated as authoritative.
 */

import { QUEUE_STATUS } from './media-options';
import type { ConversionProgress, QueueJob } from './types';

/**
 * Estimates the total number of seconds remaining for the queue using the live
 * ETA of running jobs extrapolated across queued ones.
 *
 * @param {QueueJob[]} jobs - The current queue jobs.
 * @param {Record<string, ConversionProgress>} [progress] - Live progress
 *   snapshots keyed by job id (as kept in `useQueueStore`).
 * @returns {number | null} Estimated seconds remaining, or null when nothing
 *   is running or no usable ETA is available.
 */
export function estimateRemaining(jobs: QueueJob[], progress?: Record<string, ConversionProgress>): number | null {
  const running = jobs.filter((job) => job.status === QUEUE_STATUS.RUNNING);
  if (running.length === 0) {
    return null;
  }
  const etas = running.map((job) => Number(progress?.[job.id]?.eta)).filter((eta) => Number.isFinite(eta) && eta > 0);
  if (etas.length === 0) {
    return null;
  }
  const avgEta = etas.reduce((sum, eta) => sum + eta, 0) / etas.length;
  const queued = jobs.filter((job) => job.status === QUEUE_STATUS.QUEUED).length;
  return Math.ceil(avgEta * (queued + running.length));
}

/**
 * Formats a number of seconds as a compact human-readable duration.
 *
 * @param {number} seconds - Total seconds to format.
 * @returns {string} e.g. '45s', '1m 30s', '1h 5m'.
 */
export function formatEstimate(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) {
    return `${total}s`;
  }
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  if (minutes < 60) {
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
