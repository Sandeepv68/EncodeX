import { create } from 'zustand';

interface QueueState {
  jobs: any[];
  setJobs: (jobs: any[]) => void;
  addJob: (job: any) => void;
  removeJob: (id: string) => void;
  updateJob: (job: any) => void;
  clearJobs: () => void;
}

export const useQueueStore = create<QueueState>((set) => ({
  jobs: [],
  setJobs: (jobs) => set({ jobs }),
  addJob: (job) => set((s) => ({ jobs: [...s.jobs, job] })),
  removeJob: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),
  updateJob: (job) => set((s) => ({
    jobs: s.jobs.map((j) => (j.id === job.id ? job : j)),
  })),
  clearJobs: () => set({ jobs: [] }),
}));
