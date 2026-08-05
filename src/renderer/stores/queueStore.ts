/**
 * @fileoverview Zustand store for conversion queue state management.
 * Manages queue of conversion jobs and their statuses.
 */

import { create } from 'zustand';
import { Logger } from '../../shared/logger';
import { QueueJob } from '../../shared/types';
import { LOG_ADD_JOB, LOG_CLEAR_JOBS, LOG_REMOVE_JOB, LOG_SET_JOBS, LOG_UPDATE_JOB } from '../../shared/log-constants';
import type { QueueState } from './types';

const log = new Logger('renderer/stores/queueStore');

export const useQueueStore = create<QueueState>((set) => ({
  jobs: [],
  setJobs: (jobs) => {
    log.debug(LOG_SET_JOBS, jobs.length, 'jobs');
    set({ jobs });
  },
  addJob: (job) => {
    log.info(LOG_ADD_JOB, job.id, job.input);
    set((s) => ({ jobs: [...s.jobs, job] }));
  },
  removeJob: (id) => {
    log.info(LOG_REMOVE_JOB, id);
    set((s) => ({ jobs: s.jobs.filter((j: QueueJob) => j.id !== id) }));
  },
  updateJob: (job) => {
    log.debug(LOG_UPDATE_JOB, job.id, job.status, job.progress.toFixed(0) + '%');
    set((s) => ({
      jobs: s.jobs.map((j: QueueJob) => (j.id === job.id ? job : j)),
    }));
  },
  clearJobs: () => {
    log.info(LOG_CLEAR_JOBS);
    set({ jobs: [] });
  },
}));
