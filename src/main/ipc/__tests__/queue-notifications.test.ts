import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { QUEUE_STATUS } from '../../../shared/media-options';

const { notifyMock, notifierState, jobsState } = vi.hoisted(() => ({
  notifyMock: vi.fn(),
  notifierState: { enabled: true },
  jobsState: { jobs: [] as Array<{ status: string }> },
}));

vi.mock('../../notifications/notifier', () => ({
  getNotifier: () => (notifierState.enabled ? { notify: notifyMock } : null),
}));
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
    getJobs = vi.fn(() => jobsState.jobs);
    constructor() {
      super();
      q = this;
    }
  },
}));

describe('queue notification wiring', () => {
  beforeEach(async () => {
    notifyMock.mockClear();
    notifierState.enabled = true;
    jobsState.jobs = [{ status: QUEUE_STATUS.DONE }, { status: QUEUE_STATUS.ERROR }];
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

  it('does not notify when no notifier is registered', () => {
    notifierState.enabled = false;
    q.emit('statusChange', { id: '1', input: 'a/in.mp4', output: 'a/out.mp4', status: QUEUE_STATUS.DONE });
    q.emit('drained');
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('ignores a status change that is neither done nor error', () => {
    q.emit('statusChange', { id: '1', input: 'a/in.mp4', output: 'a/out.mp4', status: QUEUE_STATUS.RUNNING });
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('falls back to the input path when the job has no output', () => {
    q.emit('statusChange', { id: '1', input: 'a/in.mp4', output: '', status: QUEUE_STATUS.DONE });
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock.mock.calls[0][1]).toContain('in.mp4');
  });

  it('does not send a queue summary when no job finished', () => {
    jobsState.jobs = [{ status: QUEUE_STATUS.QUEUED }];
    q.emit('drained');
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('reports the succeeded and failed counts in the queue summary', () => {
    jobsState.jobs = [{ status: QUEUE_STATUS.DONE }, { status: QUEUE_STATUS.DONE }, { status: QUEUE_STATUS.ERROR }];
    q.emit('drained');
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock.mock.calls[0][1]).toContain('"succeeded":2');
    expect(notifyMock.mock.calls[0][1]).toContain('"failed":1');
  });
});
