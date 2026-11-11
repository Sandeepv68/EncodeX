/**
 * @fileoverview Selector hook for the mux queue's status counters.
 *
 * The Remux and Demux pages show a compact queue status ("3 queued", "1
 * running"), and the Mux Queue tab shows per-tab counters. Both need the same
 * derived numbers, and both need them without re-rendering on every progress
 * event - the counters are computed from the job list's statuses only, and the
 * hook subscribes to that slice alone.
 */

import { useMemo } from 'react';
import { useMuxQueueStore } from '../stores/muxQueueStore';
import { QUEUE_STATUS } from '../../shared/media-options';
import type { MuxQueueJob } from '../../shared/types';
import type { MuxQueueStatus } from './types';

/**
 * Computes the mux queue counters from a job list.
 * @param {MuxQueueJob[]} jobs - The queue's jobs.
 * @returns {MuxQueueStatus} The derived counters.
 */
export function computeMuxQueueStatus(jobs: MuxQueueJob[], paused: boolean): MuxQueueStatus {
  let queued = 0;
  let running = 0;
  let done = 0;
  let failed = 0;
  for (const job of jobs) {
    if (job.status === QUEUE_STATUS.QUEUED) queued += 1;
    else if (job.status === QUEUE_STATUS.RUNNING) running += 1;
    else if (job.status === QUEUE_STATUS.DONE) done += 1;
    else if (job.status === QUEUE_STATUS.ERROR) failed += 1;
  }
  return {
    total: jobs.length,
    queued,
    running,
    done,
    failed,
    active: queued + running,
    empty: jobs.length === 0,
    paused,
  };
}

/**
 * Returns the mux queue's status counters.
 *
 * The hook subscribes to the job list and the paused flag only: a progress
 * event rewrites the job objects, but the counters depend on the statuses, so
 * the memoized result stays stable for as long as the statuses do.
 * @returns {MuxQueueStatus} The queue's counters.
 */
export function useMuxQueueStatus(): MuxQueueStatus {
  const jobs = useMuxQueueStore((s) => s.jobs);
  const paused = useMuxQueueStore((s) => s.paused);
  return useMemo(() => computeMuxQueueStatus(jobs, paused), [jobs, paused]);
}
