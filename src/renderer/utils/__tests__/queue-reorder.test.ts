import { describe, it, expect } from 'vitest';
import { computeQueuedTargetPosition, reorderJob } from '../queue-reorder';
import type { QueueJob } from '../../../shared/types';

function job(id: string, status: QueueJob['status']): QueueJob {
  return {
    id,
    input: `${id}.mp4`,
    output: `${id}_out.mp4`,
    options: {},
    transcoder: 'FFMPEG',
    status,
    progress: 0,
    createdAt: 1,
  };
}

describe('computeQueuedTargetPosition', () => {
  it('moves a queued job down past another queued job', () => {
    const jobs = [job('running', 'running'), job('q1', 'queued'), job('done', 'done'), job('q2', 'queued')];
    expect(computeQueuedTargetPosition(jobs, 'q1', ['running', 'q2', 'done', 'q1'])).toBe(1);
  });

  it('moves a queued job up to the front of the queued subsequence', () => {
    const jobs = [job('running', 'running'), job('q1', 'queued'), job('done', 'done'), job('q2', 'queued')];
    expect(computeQueuedTargetPosition(jobs, 'q2', ['q2', 'running', 'q1', 'done'])).toBe(0);
  });

  it('counts hidden queued jobs that stay before the dragged job', () => {
    // q1 is hidden (not visible); it sits before the dragged job in the queue
    // and is never crossed, so it still counts towards the target position.
    const jobs = [job('q1', 'queued'), job('v1', 'queued'), job('v2', 'queued'), job('v3', 'queued')];
    expect(computeQueuedTargetPosition(jobs, 'v3', ['v3', 'v1', 'v2'])).toBe(1);
  });

  it('ignores non-queued visible jobs when computing the target', () => {
    const jobs = [job('q1', 'queued'), job('running', 'running'), job('q2', 'queued')];
    expect(computeQueuedTargetPosition(jobs, 'q2', ['q1', 'q2', 'running'])).toBe(1);
  });

  it('returns the queued count when the job is dragged to the very end', () => {
    const jobs = [job('q1', 'queued'), job('q2', 'queued'), job('q3', 'queued'), job('q4', 'queued')];
    expect(computeQueuedTargetPosition(jobs, 'q1', ['q2', 'q3', 'q4', 'q1'])).toBe(3);
  });
});

describe('reorderJob', () => {
  it('repositions a job within the queued subsequence, keeping non-queued slots', () => {
    const jobs = [job('running', 'running'), job('q1', 'queued'), job('done', 'done'), job('q2', 'queued')];
    expect(reorderJob(jobs, 'q2', 0).map((j) => j.id)).toEqual(['running', 'q2', 'done', 'q1']);
  });

  it('moves a job down among queued jobs only', () => {
    const jobs = [job('running', 'running'), job('q1', 'queued'), job('done', 'done'), job('q2', 'queued')];
    expect(reorderJob(jobs, 'q1', 1).map((j) => j.id)).toEqual(['running', 'q2', 'done', 'q1']);
  });

  it('clamps the target position to the queued range', () => {
    const jobs = [job('q1', 'queued'), job('q2', 'queued')];
    expect(reorderJob(jobs, 'q1', 99).map((j) => j.id)).toEqual(['q2', 'q1']);
    const jobs2 = [job('q1', 'queued'), job('q2', 'queued')];
    expect(reorderJob(jobs2, 'q2', -5).map((j) => j.id)).toEqual(['q2', 'q1']);
  });

  it('returns the same array for missing, non-queued, and no-op jobs', () => {
    const jobs = [job('q1', 'queued'), job('running', 'running'), job('q2', 'queued')];
    expect(reorderJob(jobs, 'missing', 0)).toBe(jobs);
    expect(reorderJob(jobs, 'running', 0)).toBe(jobs);
    expect(reorderJob(jobs, 'q1', 0)).toBe(jobs);
  });

  it('does not mutate the input array', () => {
    const jobs = [job('q1', 'queued'), job('q2', 'queued'), job('q3', 'queued')];
    const snapshot = jobs.map((j) => j.id);
    reorderJob(jobs, 'q3', 0);
    expect(jobs.map((j) => j.id)).toEqual(snapshot);
  });
});
