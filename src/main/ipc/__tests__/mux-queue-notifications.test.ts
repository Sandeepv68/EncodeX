import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { QUEUE_STATUS } from '../../../shared/media-options';

const notifyMock = vi.fn();
vi.mock('../../notifications/notifier', () => ({ getNotifier: () => ({ notify: notifyMock }) }));
vi.mock('../../notifications/strings', () => ({ tNotification: (k: string, vars?: any) => `${k}:${JSON.stringify(vars || {})}` }));
vi.mock('../../queue/persistence', () => ({
  FileMuxQueuePersistence: class {
    clear() {}
  },
}));

const handlers: Record<string, Function> = {};
vi.mock('electron', () => ({
  ipcMain: {
    handle: (ch: string, fn: Function) => {
      handlers[ch] = fn;
    },
  },
  app: { getPath: () => 'C:/tmp', on: vi.fn() },
}));

let q: any;
vi.mock('../../queue/mux-queue', () => ({
  MuxQueue: class extends EventEmitter {
    getJobs = vi.fn(() => [{ status: QUEUE_STATUS.DONE }, { status: QUEUE_STATUS.ERROR }]);
    constructor() {
      super();
      q = this;
    }
  },
}));

describe('mux queue notification wiring', () => {
  beforeEach(async () => {
    notifyMock.mockClear();
    for (const k of Object.keys(handlers)) delete handlers[k];
    vi.resetModules();
    q = undefined;
    const mod = await import('../mux-queue');
    mod.registerMuxQueueHandlers({} as any, vi.fn() as any);
  });

  it('notifies on terminal status and drained', () => {
    q.emit('statusChange', { id: 'm1', input: 'a/in.mkv', output: 'a/out.mp4', status: QUEUE_STATUS.DONE });
    q.emit('statusChange', { id: 'm2', input: 'a/in2.mkv', output: 'a/out2.mp4', status: QUEUE_STATUS.ERROR });
    q.emit('drained');
    expect(notifyMock).toHaveBeenCalledTimes(3);
    expect(notifyMock.mock.calls[0][3]).toEqual({ target: 'mux' });
    expect(notifyMock.mock.calls[2][2]).toBe('mux:drained');
  });
});
