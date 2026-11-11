/**
 * @fileoverview Unit tests for the global mux queue sync component.
 *
 * The component is mounted once in the app shell, so its two failure modes are
 * the ones that matter: it must mirror every push event into the store, and it
 * must remove every listener on unmount (a leaked listener would double-apply
 * events after a route change).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import MuxQueueSync from '../MuxQueueSync';
import { useMuxQueueStore } from '../../stores/muxQueueStore';
import { QUEUE_STATUS } from '../../../shared/media-options';
import type { MuxQueueJob } from '../../../shared/types';
import { expectAppLog } from '../../../test-utils/crash-tripwire';

type Handler = (payload?: unknown) => void;

const handlers: Record<string, Handler> = {};
const unsubscribed: string[] = [];

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

beforeEach(() => {
  for (const key of Object.keys(handlers)) delete handlers[key];
  unsubscribed.length = 0;
  useMuxQueueStore.setState({ jobs: [], progress: {}, paused: false, concurrency: 1 });

  const subscribe = (channel: string) => (cb: Handler) => {
    handlers[channel] = cb;
    return () => {
      unsubscribed.push(channel);
      delete handlers[channel];
    };
  };

  window.electronAPI.muxQueueList = vi.fn().mockResolvedValue([makeJob('from-list')]);
  window.electronAPI.muxQueueGetState = vi.fn().mockResolvedValue({ paused: true, concurrency: 3 });
  window.electronAPI.onMuxQueueAdded = vi.fn(subscribe('added')) as never;
  window.electronAPI.onMuxQueueRemoved = vi.fn(subscribe('removed')) as never;
  window.electronAPI.onMuxQueueStatusChange = vi.fn(subscribe('statusChange')) as never;
  window.electronAPI.onMuxQueueProgress = vi.fn(subscribe('progress')) as never;
  window.electronAPI.onMuxQueueCancelled = vi.fn(subscribe('cancelled')) as never;
  window.electronAPI.onMuxQueueMoved = vi.fn(subscribe('moved')) as never;
});

describe('MuxQueueSync', () => {
  it('loads the initial job list and queue state', async () => {
    render(<MuxQueueSync />);
    await waitFor(() => expect(useMuxQueueStore.getState().jobs).toHaveLength(1));
    expect(useMuxQueueStore.getState().jobs[0].id).toBe('from-list');
    await waitFor(() => expect(useMuxQueueStore.getState().paused).toBe(true));
    expect(useMuxQueueStore.getState().concurrency).toBe(3);
  });

  it('mirrors the push events into the store', async () => {
    render(<MuxQueueSync />);
    await waitFor(() => expect(useMuxQueueStore.getState().jobs).toHaveLength(1));

    handlers.added?.(makeJob('added'));
    expect(useMuxQueueStore.getState().jobs.map((job) => job.id)).toContain('added');

    handlers.statusChange?.(makeJob('added', QUEUE_STATUS.RUNNING));
    expect(useMuxQueueStore.getState().jobs.find((job) => job.id === 'added')?.status).toBe(QUEUE_STATUS.RUNNING);

    handlers.progress?.({
      job: makeJob('added', QUEUE_STATUS.RUNNING),
      progress: { percent: 25, time: '00:00:01', fps: 30, speed: '1x', eta: '1', bitrate: '1k' },
    });
    expect(useMuxQueueStore.getState().progress['added']?.percent).toBe(25);

    handlers.removed?.('added');
    expect(useMuxQueueStore.getState().jobs.map((job) => job.id)).not.toContain('added');

    handlers.cancelled?.();
    expect(useMuxQueueStore.getState().jobs).toHaveLength(0);
  });

  it('removes every listener on unmount', async () => {
    const { unmount } = render(<MuxQueueSync />);
    await waitFor(() => expect(useMuxQueueStore.getState().jobs).toHaveLength(1));
    unmount();
    expect(unsubscribed).toEqual(expect.arrayContaining(['added', 'removed', 'statusChange', 'progress', 'cancelled', 'moved']));
  });

  it('mirrors a reorder event into the store', async () => {
    const { rerender } = render(<MuxQueueSync />);
    await waitFor(() => expect(useMuxQueueStore.getState().jobs).toHaveLength(1));
    useMuxQueueStore.setState({ jobs: [makeJob('a'), makeJob('b')] });
    handlers.moved?.({ id: 'a', toPosition: 1 });
    expect(useMuxQueueStore.getState().jobs.map((entry) => entry.id)).toEqual(['b', 'a']);
    rerender(<MuxQueueSync />);
  });

  it('keeps the order when a reorder event names an unknown job', async () => {
    render(<MuxQueueSync />);
    await waitFor(() => expect(useMuxQueueStore.getState().jobs).toHaveLength(1));
    useMuxQueueStore.setState({ jobs: [makeJob('a'), makeJob('b')] });
    handlers.moved?.({ id: 'missing', toPosition: 0 });
    expect(useMuxQueueStore.getState().jobs.map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('survives a bridge whose list and state calls reject', async () => {
    expectAppLog('warn', 'renderer/MuxQueueSync');
    vi.mocked(window.electronAPI.muxQueueList).mockRejectedValue(new Error('list failed'));
    vi.mocked(window.electronAPI.muxQueueGetState).mockRejectedValue(new Error('state failed'));
    expect(() => render(<MuxQueueSync />)).not.toThrow();
    await waitFor(() => expect(useMuxQueueStore.getState().jobs).toEqual([]));
  });

  it('survives a bridge without the mux queue methods', async () => {
    expectAppLog('warn', 'renderer/MuxQueueSync');
    const api = window.electronAPI as unknown as Record<string, unknown>;
    const methods = [
      'muxQueueList',
      'muxQueueGetState',
      'onMuxQueueAdded',
      'onMuxQueueRemoved',
      'onMuxQueueStatusChange',
      'onMuxQueueProgress',
      'onMuxQueueCancelled',
      'onMuxQueueMoved',
    ];
    const saved = Object.fromEntries(methods.map((name) => [name, api[name]]));
    for (const name of methods) delete api[name];
    try {
      expect(() => render(<MuxQueueSync />)).not.toThrow();
      await waitFor(() => expect(useMuxQueueStore.getState().jobs).toEqual([]));
    } finally {
      Object.assign(api, saved);
    }
  });

  it('survives a bridge whose subscription throws', async () => {
    expectAppLog('warn', 'renderer/MuxQueueSync');
    const api = window.electronAPI as unknown as Record<string, unknown>;
    const saved = api.onMuxQueueAdded;
    api.onMuxQueueAdded = () => {
      throw new Error('hostile bridge');
    };
    try {
      expect(() => render(<MuxQueueSync />)).not.toThrow();
      await waitFor(() => expect(useMuxQueueStore.getState().jobs).toHaveLength(1));
    } finally {
      api.onMuxQueueAdded = saved;
    }
  });
});
