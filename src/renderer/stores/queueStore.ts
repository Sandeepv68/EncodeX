import { create } from 'zustand';
import { QueueJob } from '../../shared/types';

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
  setJobs: (jobs) => set({ jobs }),
  addJob: (job) => set((s) => ({ jobs: [...s.jobs, job] })),
  removeJob: (id) => set((s) => ({ jobs: s.jobs.filter((j: QueueJob) => j.id !== id) })),
  updateJob: (job) =>
    set((s) => ({
      jobs: s.jobs.map((j: QueueJob) => (j.id === job.id ? job : j)),
    })),
  clearJobs: () => set({ jobs: [] }),
}));
