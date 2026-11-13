import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { QUEUE_STATUS } from '../../../shared/media-options';

const notifyMock = vi.fn();
vi.mock('../../notifications/notifier', () => ({ getNotifier: () => ({ notify: notifyMock }) }));
vi.mock('../../notifications/strings', () => ({ tNotification: (k: string, vars?: any) => `${k}:${JSON.stringify(vars || {})}` }));
vi.mock('../../power-actions', () => ({ performPowerAction: vi.fn() }));
vi.mock('../../queue/persistence', () => ({
  FileQueuePersistence: class {
    clear() {}
  },
}));
vi.mock('../../queue/output-claims', () => ({ muxOutputClaims: { isClaimed: () => false } }));

const handlers: Record<string, Function> = {};
vi.mock('electron', () => ({
  ipcMain: {
    handle: (ch: string, fn: Function) => {
      handlers[ch] = fn;
    },
  },
  app: { getPath: () => 'C:/tmp', on: vi.fn() },
  dialog: {},
}));
vi.mock('fs', () => ({
  existsSync: () => false,
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  unlinkSync: vi.fn(),
  rmSync: vi.fn(),
  default: { existsSync: () => false },
}));

let q: any;
vi.mock('../../queue/job-queue', () => ({
  JobQueue: class extends EventEmitter {
    getJobs = vi.fn(() => [{ status: QUEUE_STATUS.DONE }, { status: QUEUE_STATUS.ERROR }]);
    constructor() {
      super();
      q = this;
    }
  },
}));

describe('queue notification wiring', () => {
  beforeEach(async () => {
    notifyMock.mockClear();
    for (const k of Object.keys(handlers)) delete handlers[k];
    vi.resetModules();
    q = undefined;
    const mod = await import('../queue');
    mod.registerQueueHandlers({} as any, vi.fn() as any);
  });

  it('notifies on done/error status and drained', () => {
    q.emit('statusChange', { id: '1', input: 'a/in.mp4', output: 'a/out.mp4', status: QUEUE_STATUS.DONE });
    q.emit('statusChange', { id: '2', input: 'a/in2.mp4', output: 'a/out2.mp4', status: QUEUE_STATUS.ERROR });
    q.emit('drained');
    expect(notifyMock).toHaveBeenCalledTimes(3);
    expect(notifyMock.mock.calls[0][3]).toEqual({ target: 'queue' });
    expect(notifyMock.mock.calls[2][2]).toBe('queue:drained');
  });
});
