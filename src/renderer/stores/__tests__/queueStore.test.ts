import { describe, it, expect, beforeEach } from 'vitest';
import { useQueueStore } from '../queueStore';
import { QUEUE_STATUS } from '../../../shared/media-options';

function makeJob(id: string) {
  return {
    id,
    input: `${id}.mp4`,
    output: `${id}_out.mp4`,
    options: {},
    transcoder: 'FFMPEG' as const,
    status: QUEUE_STATUS.QUEUED,
    progress: 0,
    createdAt: Date.now(),
  };
}

describe('queueStore', () => {
  beforeEach(() => {
    useQueueStore.setState({ jobs: [], progress: {} });
  });

  it('starts empty', () => {
    expect(useQueueStore.getState().jobs).toEqual([]);
    expect(useQueueStore.getState().progress).toEqual({});
  });

  it('adds a job', () => {
    const job = makeJob('abc');
    useQueueStore.getState().addJob(job);
    expect(useQueueStore.getState().jobs).toHaveLength(1);
    expect(useQueueStore.getState().jobs[0].id).toBe('abc');
  });

  it('removes a job by id', () => {
    useQueueStore.getState().addJob(makeJob('a'));
    useQueueStore.getState().addJob(makeJob('b'));
    useQueueStore.getState().removeJob('a');
    expect(useQueueStore.getState().jobs).toHaveLength(1);
    expect(useQueueStore.getState().jobs[0].id).toBe('b');
  });

  it('updates a job', () => {
    useQueueStore.getState().addJob(makeJob('a'));
    const updated = { ...makeJob('a'), progress: 50, status: QUEUE_STATUS.RUNNING };
    useQueueStore.getState().updateJob(updated);
    const job = useQueueStore.getState().jobs[0];
    expect(job.progress).toBe(50);
    expect(job.status).toBe(QUEUE_STATUS.RUNNING);
  });

  it('stores a live progress snapshot per job id', () => {
    useQueueStore.getState().addJob(makeJob('a'));
    useQueueStore.getState().updateProgress('a', { percent: 40, time: '00:00:10', fps: 30, speed: '2.5x', eta: '5', bitrate: '1200k' });
    expect(useQueueStore.getState().progress['a']).toMatchObject({ percent: 40, speed: '2.5x' });
  });

  it('drops the progress snapshot when a job is removed', () => {
    useQueueStore.getState().addJob(makeJob('a'));
    useQueueStore.getState().updateProgress('a', { percent: 40, time: '00:00:10', fps: 30, speed: '2.5x', eta: '5', bitrate: '1200k' });
    useQueueStore.getState().removeJob('a');
    expect(useQueueStore.getState().progress).toEqual({});
  });

  it('sets all jobs', () => {
    const jobs = [makeJob('a'), makeJob('b')];
    useQueueStore.getState().setJobs(jobs);
    expect(useQueueStore.getState().jobs).toHaveLength(2);
  });

  it('clears all jobs and progress', () => {
    useQueueStore.getState().addJob(makeJob('a'));
    useQueueStore.getState().updateProgress('a', { percent: 10, time: '00:00:01', fps: 0, speed: '0x', eta: '0', bitrate: '' });
    useQueueStore.getState().clearJobs();
    expect(useQueueStore.getState().jobs).toEqual([]);
    expect(useQueueStore.getState().progress).toEqual({});
  });
});
