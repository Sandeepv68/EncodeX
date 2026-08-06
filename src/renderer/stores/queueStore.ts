/**
 * @fileoverview Zustand store for conversion queue state management.
 * Holds the ordered list of conversion jobs (QueueJob) and the actions used to
 * bulk-set, add, remove, update, and clear them.
 *
 * State held:
 *  - jobs: the array of queued conversion jobs
 *
 * Consumers:
 *  - The queue panel / batch conversion UI (renderer)
 *  - Components that reflect queue state driven by the main-process queue
 *    events (onQueueAdded / onQueueRemoved / onQueueStatusChange)
 */

import { create } from 'zustand';
import { Logger } from '../../shared/logger';
import { QueueJob } from '../../shared/types';
import { LOG_ADD_JOB, LOG_CLEAR_JOBS, LOG_REMOVE_JOB, LOG_SET_JOBS, LOG_UPDATE_JOB } from '../../shared/log-constants';
import type { QueueState } from './types';

/**
 * Per-store logger for the queue store.
 * @const {Logger} log
 */
const log = new Logger('renderer/stores/queueStore');

/**
 * Zustand store for conversion queue state.
 * Holds the ordered list of jobs (QueueJob) and the actions setJobs / addJob /
 * removeJob / updateJob / clearJobs. Implemented as a module-level singleton so
 * queue components can read and mutate the job list outside of React.
 * @const {UseBoundStore<StoreApi<QueueState>>} useQueueStore
 */
export const useQueueStore = create<QueueState>((set) => ({
  jobs: [],
  /**
   * Replaces the entire job list with the given array.
   * @param {QueueJob[]} jobs - The new job list.
   */
  setJobs: (jobs) => {
    log.debug(LOG_SET_JOBS, jobs.length, 'jobs');
    set({ jobs });
  },
  /**
   * Appends a job to the end of the queue.
   * @param {QueueJob} job - The job to append.
   */
  addJob: (job) => {
    log.info(LOG_ADD_JOB, job.id, job.input);
    set((s) => ({ jobs: [...s.jobs, job] }));
  },
  /**
   * Removes the job with the given id from the queue.
   * @param {string} id - The id of the job to remove.
   */
  removeJob: (id) => {
    log.info(LOG_REMOVE_JOB, id);
    set((s) => ({ jobs: s.jobs.filter((j: QueueJob) => j.id !== id) }));
  },
  /**
   * Replaces the queue entry matching the given job's id with the provided job
   * (used to refresh status/progress). No-op when the id is not found.
   * @param {QueueJob} job - The updated job descriptor.
   */
  updateJob: (job) => {
    log.debug(LOG_UPDATE_JOB, job.id, job.status, job.progress.toFixed(0) + '%');
    set((s) => ({
      jobs: s.jobs.map((j: QueueJob) => (j.id === job.id ? job : j)),
    }));
  },
  /**
   * Removes all jobs from the queue.
   */
  clearJobs: () => {
    log.info(LOG_CLEAR_JOBS);
    set({ jobs: [] });
  },
}));
