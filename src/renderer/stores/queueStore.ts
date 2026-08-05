/**
 * @fileoverview Zustand store for conversion queue state management.
 * Manages queue of conversion jobs and their statuses.
 */

import { create } from 'zustand';
import { Logger } from '../../shared/logger';
import { QueueJob } from '../../shared/types';

const log = new Logger('renderer/stores/queueStore');

interface QueueState {
  jobs: QueueJob[];
  setJobs: (jobs: QueueJob[]) => void;
  addJob: (job: QueueJob) => void;
  removeJob: (id: string) => void;
  updateJob: (job: QueueJob) => void;
  clearJobs: () => void;
}

export const useQueueStore = create<QueueState>((set) => ({
  jobs: [],
  setJobs: (jobs) => {
    log.debug('setJobs:', jobs.length, 'jobs');
    set({ jobs });
  },
  addJob: (job) => {
    log.info('addJob:', job.id, job.input);
    set((s) => ({ jobs: [...s.jobs, job] }));
  },
  removeJob: (id) => {
    log.info('removeJob:', id);
    set((s) => ({ jobs: s.jobs.filter((j: QueueJob) => j.id !== id) }));
  },
  updateJob: (job) => {
    log.debug('updateJob:', job.id, job.status, job.progress.toFixed(0) + '%');
    set((s) => ({
      jobs: s.jobs.map((j: QueueJob) => (j.id === job.id ? job : j)),
    }));
  },
  clearJobs: () => {
    log.info('clearJobs');
    set({ jobs: [] });
  },
}));
