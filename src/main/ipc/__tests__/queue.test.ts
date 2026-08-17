import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IPC } from '../../../shared/ipc-channels';
import { WHEN_DONE_ACTION_DELAY_MS } from '../../../shared/constants';
import { performPowerAction } from '../../power-actions';

vi.mock('../../power-actions', () => ({
  performPowerAction: vi.fn(),
}));

interface FakeJobQueue {
  addJob: ReturnType<typeof vi.fn>;
  cancelJob: ReturnType<typeof vi.fn>;
  getJobs: ReturnType<typeof vi.fn>;
  cancelAll: ReturnType<typeof vi.fn>;
  clearCompleted: ReturnType<typeof vi.fn>;
  setConcurrency: ReturnType<typeof vi.fn>;
  moveJobTo: ReturnType<typeof vi.fn>;
  updateJobOptions: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  getConcurrency: ReturnType<typeof vi.fn>;
  isPaused: ReturnType<typeof vi.fn>;
  emit: (ev: string, ...args: unknown[]) => void;
}

const {
  ipcMainMock,
  dialogMock,
  getHandlers,
  jobQueueInstances,
  existsSyncMock,
  readFileSyncMock,
  writeFileSyncMock,
  unlinkSyncMock,
  appEventHandlers,
} = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  const appEventHandlers: Record<string, () => void> = {};
  return {
    ipcMainMock: {
      handle: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
        handlers[channel] = fn;
      }),
    },
    dialogMock: {
      showOpenDialog: vi.fn(),
      showSaveDialog: vi.fn(),
    },
    jobQueueInstances: [] as FakeJobQueue[],
    existsSyncMock: vi.fn(() => false),
    readFileSyncMock: vi.fn(),
    writeFileSyncMock: vi.fn(),
    unlinkSyncMock: vi.fn(),
    appEventHandlers,
    getHandlers: () => handlers,
  };
});

vi.mock('electron', () => ({
  ipcMain: ipcMainMock,
  BrowserWindow: class {},
  dialog: dialogMock,
  app: {
    getPath: () => 'C:/temp/encodex-user-data',
    on: vi.fn((event: string, callback: () => void) => {
      appEventHandlers[event] = callback;
    }),
  },
}));

vi.mock('fs', () => ({
  existsSync: existsSyncMock,
  readFileSync: readFileSyncMock,
  writeFileSync: writeFileSyncMock,
  mkdirSync: vi.fn(),
  unlinkSync: unlinkSyncMock,
  rmSync: vi.fn(),
  default: {
    existsSync: existsSyncMock,
    readFileSync: readFileSyncMock,
    writeFileSync: writeFileSyncMock,
    mkdirSync: vi.fn(),
    unlinkSync: unlinkSyncMock,
    rmSync: vi.fn(),
  },
}));

vi.mock('../../queue/job-queue', () => {
  const { EventEmitter } = require('events') as typeof import('events');
  return {
    JobQueue: class extends EventEmitter {
      addJob: ReturnType<typeof vi.fn>;
      cancelJob: ReturnType<typeof vi.fn>;
      getJobs: ReturnType<typeof vi.fn>;
      cancelAll: ReturnType<typeof vi.fn>;
      clearCompleted: ReturnType<typeof vi.fn>;
      setConcurrency: ReturnType<typeof vi.fn>;
      moveJobTo: ReturnType<typeof vi.fn>;
      updateJobOptions: ReturnType<typeof vi.fn>;
      pause: ReturnType<typeof vi.fn>;
      resume: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
      getConcurrency: ReturnType<typeof vi.fn>;
      isPaused: ReturnType<typeof vi.fn>;
      constructor() {
        super();
        this.addJob = vi.fn();
        this.cancelJob = vi.fn();
        this.getJobs = vi.fn(() => []);
        this.cancelAll = vi.fn();
        this.clearCompleted = vi.fn();
        this.setConcurrency = vi.fn();
        this.moveJobTo = vi.fn();
        this.updateJobOptions = vi.fn();
        this.pause = vi.fn();
        this.resume = vi.fn();
        this.start = vi.fn();
        this.getConcurrency = vi.fn();
        this.isPaused = vi.fn();
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

  it('QUEUE_ADD rejects with OUTPUT_EXISTS when the output exists and overwrite is disabled', async () => {
    existsSyncMock.mockReturnValue(true);
    await expect(getHandlers()[IPC.QUEUE_ADD]({}, 'in.mp4', 'out.mp4', {}, 'FFMPEG', false)).rejects.toMatchObject({
      code: 'OUTPUT_EXISTS',
    });
    expect(jobQueue.addJob).not.toHaveBeenCalled();
    existsSyncMock.mockReturnValue(false);
  });

  it('QUEUE_ADD allows enqueueing an existing output when overwrite is enabled', async () => {
    existsSyncMock.mockReturnValue(true);
    jobQueue.addJob.mockReturnValue('id-2');
    const result = await getHandlers()[IPC.QUEUE_ADD]({}, 'in.mp4', 'out.mp4', {}, 'FFMPEG', true);
    expect(jobQueue.addJob).toHaveBeenCalledWith('in.mp4', 'out.mp4', {}, 'FFMPEG');
    expect(result).toBe('id-2');
    existsSyncMock.mockReturnValue(false);
  });

  it('QUEUE_REMOVE delegates to cancelJob', async () => {
    await getHandlers()[IPC.QUEUE_REMOVE]({}, 'id-1');
    expect(jobQueue.cancelJob).toHaveBeenCalledWith('id-1');
  });

  it('QUEUE_LIST returns the jobs', async () => {
    jobQueue.getJobs.mockReturnValue([{ id: 'id-1' }]);
    expect(await getHandlers()[IPC.QUEUE_LIST]()).toEqual([{ id: 'id-1' }]);
  });

  it('QUEUE_GET_STATE returns the paused flag and concurrency', async () => {
    jobQueue.isPaused.mockReturnValue(true);
    jobQueue.getConcurrency.mockReturnValue(2);
    expect(await getHandlers()[IPC.QUEUE_GET_STATE]()).toEqual({ paused: true, concurrency: 2 });
  });

  it('QUEUE_CANCEL_ALL delegates to cancelAll', async () => {
    await getHandlers()[IPC.QUEUE_CANCEL_ALL]();
    expect(jobQueue.cancelAll).toHaveBeenCalled();
  });

  it('QUEUE_CLEAR_COMPLETED delegates to clearCompleted and returns the count', async () => {
    jobQueue.clearCompleted.mockReturnValue(2);
    const result = await getHandlers()[IPC.QUEUE_CLEAR_COMPLETED]();
    expect(jobQueue.clearCompleted).toHaveBeenCalled();
    expect(result).toBe(2);
  });

  it('QUEUE_SET_CONCURRENCY delegates to setConcurrency', async () => {
    await getHandlers()[IPC.QUEUE_SET_CONCURRENCY]({}, 3);
    expect(jobQueue.setConcurrency).toHaveBeenCalledWith(3);
  });

  it('QUEUE_MOVE_TO delegates to moveJobTo and returns the result', async () => {
    jobQueue.moveJobTo.mockReturnValue(true);
    const result = await getHandlers()[IPC.QUEUE_MOVE_TO]({}, 'id-1', 2);
    expect(jobQueue.moveJobTo).toHaveBeenCalledWith('id-1', 2);
    expect(result).toBe(true);
  });

  it('QUEUE_UPDATE_OPTIONS delegates to updateJobOptions and returns the result', async () => {
    jobQueue.updateJobOptions.mockReturnValue(true);
    const options = { videoCodec: 'libx265' };
    const result = await getHandlers()[IPC.QUEUE_UPDATE_OPTIONS]({}, 'id-1', options, '/tmp/new.mp4');
    expect(jobQueue.updateJobOptions).toHaveBeenCalledWith('id-1', options, '/tmp/new.mp4');
    expect(result).toBe(true);
  });

  it('QUEUE_UPDATE_OPTIONS forwards without an output when none is given', async () => {
    jobQueue.updateJobOptions.mockReturnValue(false);
    const result = await getHandlers()[IPC.QUEUE_UPDATE_OPTIONS]({}, 'id-1', { videoCodec: 'libx265' });
    expect(jobQueue.updateJobOptions).toHaveBeenCalledWith('id-1', { videoCodec: 'libx265' }, undefined);
    expect(result).toBe(false);
  });

  it('QUEUE_PAUSE delegates to pause', async () => {
    await getHandlers()[IPC.QUEUE_PAUSE]();
    expect(jobQueue.pause).toHaveBeenCalledOnce();
  });

  it('QUEUE_RESUME delegates to resume', async () => {
    await getHandlers()[IPC.QUEUE_RESUME]();
    expect(jobQueue.resume).toHaveBeenCalledOnce();
  });

  it('QUEUE_START delegates to start', async () => {
    await getHandlers()[IPC.QUEUE_START]();
    expect(jobQueue.start).toHaveBeenCalledOnce();
  });

  it('QUEUE_EXPORT writes a portable snapshot and returns the job count', async () => {
    dialogMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: 'C:/tmp/queue.json' });
    jobQueue.getJobs.mockReturnValue([
      { id: 'id-1', input: 'in.mp4', output: 'out.mp4', options: { videoCodec: 'libx264' }, transcoder: 'FFMPEG', status: 'queued' },
      { id: 'id-2', input: 'b.png', output: 'c.png', options: {}, transcoder: 'FFMPEG', status: 'done' },
    ]);
    jobQueue.getConcurrency.mockReturnValue(3);
    const result = await getHandlers()[IPC.QUEUE_EXPORT]();
    expect(result).toBe(2);
    expect(writeFileSyncMock).toHaveBeenCalledWith('C:/tmp/queue.json', expect.stringContaining('"version": 1'), 'utf8');
    const written = JSON.parse(writeFileSyncMock.mock.calls[0][1]);
    expect(written.concurrency).toBe(3);
    expect(written.jobs).toEqual([
      { input: 'in.mp4', output: 'out.mp4', options: { videoCodec: 'libx264' }, transcoder: 'FFMPEG' },
      { input: 'b.png', output: 'c.png', options: {}, transcoder: 'FFMPEG' },
    ]);
    expect(written.jobs[0]).not.toHaveProperty('id');
    expect(written.jobs[0]).not.toHaveProperty('status');
  });

  it('QUEUE_EXPORT returns 0 without writing when the dialog is cancelled', async () => {
    dialogMock.showSaveDialog.mockResolvedValue({ canceled: true, filePath: '' });
    expect(await getHandlers()[IPC.QUEUE_EXPORT]()).toBe(0);
    expect(writeFileSyncMock).not.toHaveBeenCalled();
  });

  it('QUEUE_IMPORT reads a queue file and enqueues each job', async () => {
    dialogMock.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['C:/tmp/queue.json'] });
    readFileSyncMock.mockReturnValue(
      JSON.stringify({
        version: 1,
        concurrency: 2,
        jobs: [
          { input: 'in.mp4', output: 'out.mp4', options: { videoCodec: 'libx264' }, transcoder: 'FFMPEG' },
          { input: 'b.png', output: 'c.png', options: {}, transcoder: 'FFMPEG' },
        ],
      }),
    );
    jobQueue.getJobs.mockReturnValue([]);
    jobQueue.addJob.mockReturnValue('imported-1');
    const result = await getHandlers()[IPC.QUEUE_IMPORT]();
    expect(result).toBe(2);
    expect(jobQueue.setConcurrency).toHaveBeenCalledWith(2);
    expect(jobQueue.addJob).toHaveBeenNthCalledWith(1, 'in.mp4', 'out.mp4', { videoCodec: 'libx264' }, 'FFMPEG');
    expect(jobQueue.addJob).toHaveBeenNthCalledWith(2, 'b.png', 'c.png', {}, 'FFMPEG');
  });

  it('QUEUE_IMPORT skips jobs whose input/output pair is already queued', async () => {
    dialogMock.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['C:/tmp/queue.json'] });
    readFileSyncMock.mockReturnValue(
      JSON.stringify({
        version: 1,
        concurrency: 2,
        jobs: [
          { input: 'in.mp4', output: 'out.mp4', options: { videoCodec: 'libx264' }, transcoder: 'FFMPEG' },
          { input: 'b.png', output: 'c.png', options: {}, transcoder: 'FFMPEG' },
          { input: 'fresh.mp4', output: 'fresh_out.mp4', options: {}, transcoder: 'FFMPEG' },
        ],
      }),
    );
    jobQueue.getJobs.mockReturnValue([
      { id: 'id-1', input: 'in.mp4', output: 'out.mp4', options: {}, transcoder: 'FFMPEG', status: 'queued' },
      { id: 'id-2', input: 'x.mkv', output: 'c.png', options: {}, transcoder: 'FFMPEG', status: 'queued' },
    ]);
    jobQueue.addJob.mockReturnValue('imported-1');
    const result = await getHandlers()[IPC.QUEUE_IMPORT]();
    expect(result).toBe(1);
    expect(jobQueue.addJob).toHaveBeenCalledTimes(1);
    expect(jobQueue.addJob).toHaveBeenCalledWith('fresh.mp4', 'fresh_out.mp4', {}, 'FFMPEG');
  });

  it('QUEUE_IMPORT skips jobs colliding on an existing output path', async () => {
    dialogMock.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['C:/tmp/queue.json'] });
    readFileSyncMock.mockReturnValue(
      JSON.stringify({
        version: 1,
        concurrency: 1,
        jobs: [{ input: 'other.mp4', output: 'taken.mp4', options: {}, transcoder: 'FFMPEG' }],
      }),
    );
    jobQueue.getJobs.mockReturnValue([
      { id: 'id-1', input: 'in.mp4', output: 'taken.mp4', options: {}, transcoder: 'FFMPEG', status: 'queued' },
    ]);
    const result = await getHandlers()[IPC.QUEUE_IMPORT]();
    expect(result).toBe(0);
    expect(jobQueue.addJob).not.toHaveBeenCalled();
  });

  it('QUEUE_IMPORT returns 0 without reading when the dialog is cancelled', async () => {
    dialogMock.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    expect(await getHandlers()[IPC.QUEUE_IMPORT]()).toBe(0);
    expect(readFileSyncMock).not.toHaveBeenCalled();
  });

  it('QUEUE_IMPORT rejects with INVALID_QUEUE_FILE for unreadable files', async () => {
    dialogMock.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['C:/tmp/queue.json'] });
    readFileSyncMock.mockImplementation(() => {
      throw new Error('ENOENT: no such file');
    });
    await expect(getHandlers()[IPC.QUEUE_IMPORT]()).rejects.toMatchObject({ code: 'INVALID_QUEUE_FILE' });
    expect(jobQueue.addJob).not.toHaveBeenCalled();
  });

  it('QUEUE_IMPORT rejects with INVALID_QUEUE_FILE for malformed content', async () => {
    dialogMock.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['C:/tmp/queue.json'] });
    readFileSyncMock.mockReturnValue('{"version": 99, "concurrency": 1, "jobs": []}');
    await expect(getHandlers()[IPC.QUEUE_IMPORT]()).rejects.toMatchObject({ code: 'INVALID_QUEUE_FILE' });
    expect(jobQueue.addJob).not.toHaveBeenCalled();
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
    jobQueue.emit('moved', { id: 'id-1', toPosition: 2 });
    expect(send).toHaveBeenCalledWith(IPC.QUEUE_MOVED, { id: 'id-1', toPosition: 2 });
  });

  it('deletes the persisted queue snapshot when the app quits', () => {
    const quitHandler = appEventHandlers['will-quit'];
    expect(quitHandler).toBeTypeOf('function');
    quitHandler();
    expect(unlinkSyncMock).toHaveBeenCalledWith(expect.stringMatching(/queue-state\.json$/));
  });

  it('keeps clearing the persisted queue snapshot after a window re-create', () => {
    registerQueueHandlers({} as never, send);
    const quitHandler = appEventHandlers['will-quit'];
    quitHandler();
    expect(unlinkSyncMock).toHaveBeenCalledWith(expect.stringMatching(/queue-state\.json$/));
  });

  it('QUEUE_SET_WHEN_DONE records the config and runs the action after the delay on drain', async () => {
    vi.useFakeTimers();
    try {
      await getHandlers()[IPC.QUEUE_SET_WHEN_DONE]({}, { enabled: true, action: 'shutdown', force: true });
      jobQueue.emit('drained');
      expect(performPowerAction).not.toHaveBeenCalled();
      vi.advanceTimersByTime(WHEN_DONE_ACTION_DELAY_MS);
      expect(performPowerAction).toHaveBeenCalledWith('shutdown', true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('QUEUE_SET_WHEN_DONE with enabled false never runs the power action', async () => {
    vi.useFakeTimers();
    try {
      await getHandlers()[IPC.QUEUE_SET_WHEN_DONE]({}, { enabled: false, action: 'sleep', force: false });
      jobQueue.emit('drained');
      vi.advanceTimersByTime(WHEN_DONE_ACTION_DELAY_MS);
      expect(performPowerAction).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('adding a job after a drain cancels the pending power action', async () => {
    vi.useFakeTimers();
    try {
      await getHandlers()[IPC.QUEUE_SET_WHEN_DONE]({}, { enabled: true, action: 'hibernate', force: false });
      jobQueue.emit('drained');
      jobQueue.emit('added', { id: 'x' });
      vi.advanceTimersByTime(WHEN_DONE_ACTION_DELAY_MS);
      expect(performPowerAction).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
