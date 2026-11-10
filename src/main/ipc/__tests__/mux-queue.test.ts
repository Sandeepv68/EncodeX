/**
 * @fileoverview Unit tests for the mux queue IPC handlers.
 *
 * The handlers are the renderer's only door into the mux queue, so the tests
 * cover both directions: a hostile payload is rejected before it reaches the
 * queue, and every queue event is forwarded to the matching push channel.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IPC } from '../../../shared/ipc-channels';
import { QUEUE_STATUS } from '../../../shared/media-options';

interface FakeMuxQueue {
  addJob: ReturnType<typeof vi.fn>;
  cancelJob: ReturnType<typeof vi.fn>;
  getJobs: ReturnType<typeof vi.fn>;
  getState: ReturnType<typeof vi.fn>;
  cancelAll: ReturnType<typeof vi.fn>;
  clearCompleted: ReturnType<typeof vi.fn>;
  setConcurrency: ReturnType<typeof vi.fn>;
  moveJobTo: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  emit: (ev: string, ...args: unknown[]) => void;
}

const { ipcMainMock, getHandlers, muxQueueInstances, appEventHandlers } = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  const appEventHandlers: Record<string, () => void> = {};
  return {
    ipcMainMock: {
      handle: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
        handlers[channel] = fn;
      }),
    },
    getHandlers: () => handlers,
    muxQueueInstances: [] as FakeMuxQueue[],
    appEventHandlers,
  };
});

vi.mock('electron', () => ({
  ipcMain: ipcMainMock,
  app: {
    getPath: () => 'C:/temp/encodex-user-data',
    on: vi.fn((event: string, callback: () => void) => {
      appEventHandlers[event] = callback;
    }),
  },
}));

vi.mock('../../queue/mux-queue', () => {
  const { EventEmitter } = require('events') as typeof import('events');
  class MuxQueue extends EventEmitter {
    addJob = vi.fn(() => 'mux-1');
    cancelJob = vi.fn();
    getJobs = vi.fn(() => [] as unknown[]);
    getState = vi.fn(() => ({ paused: false, concurrency: 1 }));
    cancelAll = vi.fn();
    clearCompleted = vi.fn(() => 0);
    setConcurrency = vi.fn();
    moveJobTo = vi.fn(() => false);
    pause = vi.fn();
    resume = vi.fn();
    start = vi.fn();
    constructor() {
      super();
      muxQueueInstances.push(this as unknown as FakeMuxQueue);
    }
  }
  return { MuxQueue };
});

vi.mock('../../queue/persistence', () => ({
  FileMuxQueuePersistence: class {
    clear = vi.fn();
  },
}));

const { registerMuxQueueHandlers } = await import('../mux-queue');

const VALID_PAYLOAD = {
  kind: 'remux',
  input: 'C:/in/a.mp4',
  output: 'C:/out/a.mkv',
  targets: [{ output: 'C:/out/a.mkv', options: { copy: true } }],
};

describe('registerMuxQueueHandlers', () => {
  const send = vi.fn();
  let muxQueue: FakeMuxQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    muxQueueInstances.length = 0;
    registerMuxQueueHandlers({} as never, send);
    muxQueue = muxQueueInstances[0];
  });

  it('registers every mux queue channel', () => {
    const handlers = getHandlers();
    expect(handlers[IPC.MUX_QUEUE_ADD]).toBeTypeOf('function');
    expect(handlers[IPC.MUX_QUEUE_REMOVE]).toBeTypeOf('function');
    expect(handlers[IPC.MUX_QUEUE_LIST]).toBeTypeOf('function');
    expect(handlers[IPC.MUX_QUEUE_GET_STATE]).toBeTypeOf('function');
    expect(handlers[IPC.MUX_QUEUE_START]).toBeTypeOf('function');
    expect(handlers[IPC.MUX_QUEUE_PAUSE]).toBeTypeOf('function');
    expect(handlers[IPC.MUX_QUEUE_RESUME]).toBeTypeOf('function');
    expect(handlers[IPC.MUX_QUEUE_CANCEL_ALL]).toBeTypeOf('function');
    expect(handlers[IPC.MUX_QUEUE_CLEAR_COMPLETED]).toBeTypeOf('function');
    expect(handlers[IPC.MUX_QUEUE_SET_CONCURRENCY]).toBeTypeOf('function');
    expect(handlers[IPC.MUX_QUEUE_MOVE_TO]).toBeTypeOf('function');
  });

  it('accepts a valid payload and returns the new job id', async () => {
    const id = await getHandlers()[IPC.MUX_QUEUE_ADD]({}, VALID_PAYLOAD);
    expect(id).toBe('mux-1');
    expect(muxQueue.addJob).toHaveBeenCalledWith(VALID_PAYLOAD);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'remux'],
    ['an empty target list', { ...VALID_PAYLOAD, targets: [] }],
    [
      'a duplicate target output',
      {
        ...VALID_PAYLOAD,
        targets: [
          { output: 'a.mkv', options: {} },
          { output: 'A.MKV', options: {} },
        ],
      },
    ],
    ['an unknown kind', { ...VALID_PAYLOAD, kind: 'convert' }],
    ['an empty input', { ...VALID_PAYLOAD, input: '' }],
    ['a hostile options object', { ...VALID_PAYLOAD, targets: [{ output: 'a.mkv', options: { copy: 'yes' } }] }],
  ])('rejects %s before it reaches the queue', async (_label, payload) => {
    await expect(getHandlers()[IPC.MUX_QUEUE_ADD]({}, payload)).rejects.toMatchObject({ code: 'QUEUE_ERROR' });
    expect(muxQueue.addJob).not.toHaveBeenCalled();
  });

  it('forwards the lifecycle channels to the queue', async () => {
    const handlers = getHandlers();
    await handlers[IPC.MUX_QUEUE_REMOVE]({}, 'mux-1');
    expect(muxQueue.cancelJob).toHaveBeenCalledWith('mux-1');
    await handlers[IPC.MUX_QUEUE_START]({});
    expect(muxQueue.start).toHaveBeenCalled();
    await handlers[IPC.MUX_QUEUE_PAUSE]({});
    expect(muxQueue.pause).toHaveBeenCalled();
    await handlers[IPC.MUX_QUEUE_RESUME]({});
    expect(muxQueue.resume).toHaveBeenCalled();
    await handlers[IPC.MUX_QUEUE_CANCEL_ALL]({});
    expect(muxQueue.cancelAll).toHaveBeenCalled();
    await handlers[IPC.MUX_QUEUE_CLEAR_COMPLETED]({});
    expect(muxQueue.clearCompleted).toHaveBeenCalled();
    await handlers[IPC.MUX_QUEUE_SET_CONCURRENCY]({}, 2);
    expect(muxQueue.setConcurrency).toHaveBeenCalledWith(2);
    await handlers[IPC.MUX_QUEUE_MOVE_TO]({}, 'mux-1', 0);
    expect(muxQueue.moveJobTo).toHaveBeenCalledWith('mux-1', 0);
    expect(await handlers[IPC.MUX_QUEUE_LIST]({})).toEqual([]);
    expect(await handlers[IPC.MUX_QUEUE_GET_STATE]({})).toEqual({ paused: false, concurrency: 1 });
  });

  it('forwards queue events to the matching push channels', () => {
    const job = { id: 'mux-1', kind: 'remux', status: QUEUE_STATUS.QUEUED };
    muxQueue.emit('added', job);
    expect(send).toHaveBeenCalledWith(IPC.MUX_QUEUE_ADDED, job);
    muxQueue.emit('removed', 'mux-1');
    expect(send).toHaveBeenCalledWith(IPC.MUX_QUEUE_REMOVED, 'mux-1');
    muxQueue.emit('statusChange', job);
    expect(send).toHaveBeenCalledWith(IPC.MUX_QUEUE_STATUS_CHANGE, job);
    muxQueue.emit('progress', { job, progress: { percent: 10 } });
    expect(send).toHaveBeenCalledWith(IPC.MUX_QUEUE_PROGRESS, { job, progress: { percent: 10 } });
    muxQueue.emit('cancelled');
    expect(send).toHaveBeenCalledWith(IPC.MUX_QUEUE_CANCELLED);
    muxQueue.emit('moved', { id: 'mux-1', toPosition: 2 });
    expect(send).toHaveBeenCalledWith(IPC.MUX_QUEUE_MOVED, { id: 'mux-1', toPosition: 2 });
  });
});
