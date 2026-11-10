import { describe, it, expect, beforeEach } from 'vitest';
import { useMuxQueueStore } from '../muxQueueStore';
import { QUEUE_STATUS } from '../../../shared/media-options';
import { expectAppLog } from '../../../test-utils/crash-tripwire';
import type { MuxQueueJob } from '../../../shared/types';

function makeJob(id: string, status: string = QUEUE_STATUS.QUEUED): MuxQueueJob {
  return {
    id,
    kind: 'remux',
    input: `${id}.mp4`,
    output: `${id}_out.mkv`,
    targets: [{ output: `${id}_out.mkv`, options: {} }],
    transcoder: 'FFMPEG',
    status: status as MuxQueueJob['status'],
    progress: 0,
    createdAt: Date.now(),
  };
}

describe('muxQueueStore', () => {
  beforeEach(() => {
    useMuxQueueStore.setState({ jobs: [], progress: {}, paused: false, concurrency: 1 });
  });

  it('starts empty', () => {
    expect(useMuxQueueStore.getState().jobs).toEqual([]);
    expect(useMuxQueueStore.getState().progress).toEqual({});
    expect(useMuxQueueStore.getState().paused).toBe(false);
    expect(useMuxQueueStore.getState().concurrency).toBe(1);
  });

  it('adds, updates, and removes a job', () => {
    useMuxQueueStore.getState().addJob(makeJob('a'));
    expect(useMuxQueueStore.getState().jobs).toHaveLength(1);

    useMuxQueueStore.getState().updateJob({ ...makeJob('a'), progress: 40, status: QUEUE_STATUS.RUNNING });
    expect(useMuxQueueStore.getState().jobs[0].progress).toBe(40);

    useMuxQueueStore.getState().removeJob('a');
    expect(useMuxQueueStore.getState().jobs).toHaveLength(0);
  });

  it('stores a live progress snapshot and drops it with the job', () => {
    useMuxQueueStore.getState().addJob(makeJob('a'));
    useMuxQueueStore.getState().updateProgress('a', { percent: 40, time: '00:00:10', fps: 30, speed: '2.5x', eta: '5', bitrate: '1200k' });
    expect(useMuxQueueStore.getState().progress['a']).toMatchObject({ percent: 40 });
    useMuxQueueStore.getState().removeJob('a');
    expect(useMuxQueueStore.getState().progress).toEqual({});
  });

  it('does not store a non-array job list from the bridge', () => {
    expectAppLog('warn', /muxQueueStore/);
    useMuxQueueStore.setState({ jobs: [makeJob('keep')] });
    useMuxQueueStore.getState().setJobs({ notAnArray: true } as unknown as never[]);
    expect(useMuxQueueStore.getState().jobs).toEqual([]);
  });

  it('rejects a non-finite progress value', () => {
    expectAppLog('warn', /muxQueueStore/);
    useMuxQueueStore.getState().updateProgress('a', { percent: Number.NaN, time: '', fps: 0, speed: '', eta: '', bitrate: '' });
    expect(useMuxQueueStore.getState().progress).toEqual({});
  });

  it('rejects a non-finite concurrency', () => {
    expectAppLog('warn', /muxQueueStore/);
    useMuxQueueStore.getState().setConcurrency(Number.NaN);
    expect(useMuxQueueStore.getState().concurrency).toBe(1);
    useMuxQueueStore.getState().setConcurrency(3);
    expect(useMuxQueueStore.getState().concurrency).toBe(3);
  });

  it('records the paused flag', () => {
    useMuxQueueStore.getState().setPaused(true);
    expect(useMuxQueueStore.getState().paused).toBe(true);
  });

  it('clears all jobs and progress', () => {
    useMuxQueueStore.getState().addJob(makeJob('a'));
    useMuxQueueStore.getState().updateProgress('a', { percent: 10, time: '', fps: 0, speed: '', eta: '', bitrate: '' });
    useMuxQueueStore.getState().clearJobs();
    expect(useMuxQueueStore.getState().jobs).toEqual([]);
    expect(useMuxQueueStore.getState().progress).toEqual({});
  });
});
