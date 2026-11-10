/**
 * @fileoverview Zustand store for the dedicated remux/demux mux queue state.
 * Holds the ordered list of mux jobs (MuxQueueJob), their live progress
 * snapshots, the queue's paused flag, and its concurrency cap.
 *
 * State held:
 *  - jobs: the array of mux queue jobs
 *  - progress: live progress snapshots keyed by job id
 *  - paused / concurrency: the queue's runtime state
 *
 * Consumers:
 *  - The Mux Queue tab of the batch queue page (renderer)
 *  - The MuxQueueStatusIndicator shown on the Remux and Demux pages
 *
 * Every setter validates its input: the store is fed straight by the preload
 * bridge, so a non-array list or a non-finite progress value must not reach a
 * render that assumes the shape.
 */

import { create } from 'zustand';
import { Logger } from '../../shared/logger';
import { MuxQueueJob } from '../../shared/types';
import type { MuxQueueState } from './types';

const log = new Logger('renderer/stores/muxQueueStore');

/**
 * Zustand store for the mux queue state.
 * Implemented as a module-level singleton so the sync component, the queue
 * panel, and the page status indicators share one copy of the state.
 * @const {UseBoundStore<StoreApi<MuxQueueState>>} useMuxQueueStore
 */
export const useMuxQueueStore = create<MuxQueueState>((set) => ({
  jobs: [],
  progress: {},
  paused: false,
  concurrency: 1,
  /**
   * Replaces the entire job list with the given array.
   *
   * Rejects a non-array payload instead of storing it verbatim: `muxQueueList`
   * is the one setter fed straight by the preload bridge, and a corrupted or
   * version-skewed response must not replace the list with a value that crashes
   * the next render.
   * @param {MuxQueueJob[]} jobs - The new job list.
   */
  setJobs: (jobs) => {
    if (!Array.isArray(jobs)) {
      log.warn('Ignoring non-array mux queue list from main process', typeof jobs);
      set({ jobs: [] });
      return;
    }
    log.debug('Mux queue jobs set:', jobs.length);
    set({ jobs });
  },
  /**
   * Appends a job to the end of the queue.
   * @param {MuxQueueJob} job - The job to append.
   */
  addJob: (job) => {
    log.info('Mux queue job added:', job.id);
    set((s) => ({ jobs: [...s.jobs, job] }));
  },
  /**
   * Removes the job with the given id from the queue.
   * @param {string} id - The id of the job to remove.
   */
  removeJob: (id) => {
    log.info('Mux queue job removed:', id);
    set((s) => {
      const progress = { ...s.progress };
      delete progress[id];
      return { jobs: s.jobs.filter((j: MuxQueueJob) => j.id !== id), progress };
    });
  },
  /**
   * Replaces the queue entry matching the given job's id with the provided job.
   * @param {MuxQueueJob} job - The updated job descriptor.
   */
  updateJob: (job) => {
    log.debug('Mux queue job updated:', job.id, job.status);
    set((s) => ({
      jobs: s.jobs.map((j: MuxQueueJob) => (j.id === job.id ? job : j)),
    }));
  },
  /**
   * Stores the latest live progress snapshot for the job with the given id.
   * @param {string} id - The id of the running job.
   * @param {import('../../shared/types').ConversionProgress} data - The latest
   *   progress snapshot.
   */
  updateProgress: (id, data) => {
    if (!data || !Number.isFinite(data.percent)) {
      log.warn('Ignoring non-finite mux queue progress');
      return;
    }
    set((s) => ({ progress: { ...s.progress, [id]: data } }));
  },
  /**
   * Removes all jobs from the queue.
   */
  clearJobs: () => {
    set({ jobs: [], progress: {} });
  },
  /**
   * Records the queue's paused flag.
   * @param {boolean} paused - True while the queue is paused.
   */
  setPaused: (paused) => set({ paused }),
  /**
   * Records the queue's concurrency cap.
   * @param {number} concurrency - The parallel-job cap.
   */
  setConcurrency: (concurrency) => {
    if (!Number.isFinite(concurrency)) {
      log.warn('Ignoring non-finite mux queue concurrency');
      return;
    }
    set({ concurrency });
  },
}));
