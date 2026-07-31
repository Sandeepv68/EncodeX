import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IPC } from '../../../shared/ipc-channels';

interface FakeJobQueue {
  addJob: ReturnType<typeof vi.fn>;
  cancelJob: ReturnType<typeof vi.fn>;
  getJobs: ReturnType<typeof vi.fn>;
  cancelAll: ReturnType<typeof vi.fn>;
  emit: (ev: string, ...args: unknown[]) => void;
}

const { ipcMainMock, getHandlers, jobQueueInstances } = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  return {
    ipcMainMock: {
      handle: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
        handlers[channel] = fn;
      }),
    },
    jobQueueInstances: [] as FakeJobQueue[],
    getHandlers: () => handlers,
  };
});

vi.mock('electron', () => ({ ipcMain: ipcMainMock, BrowserWindow: class {} }));

vi.mock('../../queue/job-queue', () => {
  const { EventEmitter } = require('events') as typeof import('events');
  return {
    JobQueue: class extends EventEmitter {
      addJob: ReturnType<typeof vi.fn>;
      cancelJob: ReturnType<typeof vi.fn>;
      getJobs: ReturnType<typeof vi.fn>;
      cancelAll: ReturnType<typeof vi.fn>;
      constructor() {
        super();
        this.addJob = vi.fn();
        this.cancelJob = vi.fn();
        this.getJobs = vi.fn();
        this.cancelAll = vi.fn();
        jobQueueInstances.push(this as never);
      }
    },
  };
});

const { registerQueueHandlers } = await import('../queue');

describe('registerQueueHandlers', () => {
  const send = vi.fn();
  let jobQueue: FakeJobQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    jobQueueInstances.length = 0;
    registerQueueHandlers({} as never, send);
    jobQueue = jobQueueInstances[0];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('QUEUE_ADD delegates to addJob and returns the id', async () => {
    jobQueue.addJob.mockReturnValue('id-1');
    const result = await getHandlers()[IPC.QUEUE_ADD]({}, 'in.mp4', 'out.mp4', {}, 'FFMPEG');
    expect(jobQueue.addJob).toHaveBeenCalledWith('in.mp4', 'out.mp4', {}, 'FFMPEG');
    expect(result).toBe('id-1');
  });

  it('QUEUE_REMOVE delegates to cancelJob', async () => {
    await getHandlers()[IPC.QUEUE_REMOVE]({}, 'id-1');
    expect(jobQueue.cancelJob).toHaveBeenCalledWith('id-1');
  });

  it('QUEUE_LIST returns the jobs', async () => {
    jobQueue.getJobs.mockReturnValue([{ id: 'id-1' }]);
    expect(await getHandlers()[IPC.QUEUE_LIST]()).toEqual([{ id: 'id-1' }]);
  });

  it('QUEUE_CANCEL_ALL delegates to cancelAll', async () => {
    await getHandlers()[IPC.QUEUE_CANCEL_ALL]();
    expect(jobQueue.cancelAll).toHaveBeenCalled();
  });

  it('forwards queue events to the renderer', () => {
    const job = { id: 'id-1', input: 'in.mp4' };
    const progress = { percent: 30, time: '00:00:01', speed: '1x', eta: '5' };
    jobQueue.emit('added', job);
    expect(send).toHaveBeenCalledWith(IPC.QUEUE_ADDED, job);
    jobQueue.emit('removed', 'id-1');
    expect(send).toHaveBeenCalledWith(IPC.QUEUE_REMOVED, 'id-1');
    jobQueue.emit('statusChange', job);
    expect(send).toHaveBeenCalledWith(IPC.QUEUE_STATUS_CHANGE, job);
    jobQueue.emit('progress', { job, progress });
    expect(send).toHaveBeenCalledWith(IPC.QUEUE_PROGRESS, { job, progress });
    jobQueue.emit('cancelled');
    expect(send).toHaveBeenCalledWith(IPC.QUEUE_CANCELLED);
  });
});
