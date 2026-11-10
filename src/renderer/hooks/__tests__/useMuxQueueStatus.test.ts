/**
 * @fileoverview Unit tests for the mux queue status selector hook.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { computeMuxQueueStatus, useMuxQueueStatus } from '../useMuxQueueStatus';
import { useMuxQueueStore } from '../../stores/muxQueueStore';
import { QUEUE_STATUS } from '../../../shared/media-options';
import type { MuxQueueJob } from '../../../shared/types';

function makeJob(id: string, status: string): MuxQueueJob {
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

describe('computeMuxQueueStatus', () => {
  it('reports an empty queue', () => {
    const status = computeMuxQueueStatus([], false);
    expect(status).toMatchObject({ total: 0, queued: 0, running: 0, done: 0, failed: 0, active: 0, empty: true });
  });

  it('counts each status', () => {
    const jobs = [
      makeJob('a', QUEUE_STATUS.QUEUED),
      makeJob('b', QUEUE_STATUS.QUEUED),
      makeJob('c', QUEUE_STATUS.RUNNING),
      makeJob('d', QUEUE_STATUS.DONE),
      makeJob('e', QUEUE_STATUS.ERROR),
    ];
    const status = computeMuxQueueStatus(jobs, false);
    expect(status).toMatchObject({ total: 5, queued: 2, running: 1, done: 1, failed: 1, active: 3, empty: false });
  });

  it('reports the paused flag', () => {
    expect(computeMuxQueueStatus([], true).paused).toBe(true);
  });
});

describe('useMuxQueueStatus', () => {
  beforeEach(() => {
    useMuxQueueStore.setState({ jobs: [], progress: {}, paused: false, concurrency: 1 });
  });

  it('reflects the store', () => {
    const { result } = renderHook(() => useMuxQueueStatus());
    expect(result.current.empty).toBe(true);

    act(() => {
      useMuxQueueStore.setState({ jobs: [makeJob('a', QUEUE_STATUS.RUNNING)], paused: true });
    });
    expect(result.current.running).toBe(1);
    expect(result.current.paused).toBe(true);
  });
});
