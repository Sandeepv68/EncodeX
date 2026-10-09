/**
 * @fileoverview Unit tests for the `batch` CLI subcommand (cli-batch.ts):
 * success/failure reporting, the cancellation and timeout exit codes, progress
 * rendering (TTY and non-TTY), quiet mode, output-directory creation, and the
 * no-inputs guard. The in-memory JobQueue and the terminal side effects
 * (cli-ui / cli-util) are mocked so every branch is driven deterministically.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ConvertCliFlags } from '../cli-convert';
import type { RunBatchParams } from '../cli-batch';
import type { CliThemeId } from '../../cli-logo';
import { QUEUE_STATUS } from '../../../shared/media-options';
import { CLI_EXIT_CANCELLED, CLI_EXIT_TIMEOUT, CLI_EXIT_NOT_FOUND, MAX_QUEUE_CONCURRENCY } from '../../../shared/constants';

interface FakeJob {
  id: string;
  input: string;
  output: string;
  status: string;
  error?: string;
}

interface FakeQueue {
  jobs: FakeJob[];
  concurrency?: number;
  started: boolean;
  cancelAllCount: number;
  emit: (event: string, ...args: unknown[]) => boolean;
}

interface FakeBar {
  update: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

const { queueInstances, createdBars, mkdirSyncMock, statusMock, successMock, warnMock, createMultiBarMock } = vi.hoisted(() => ({
  queueInstances: [] as FakeQueue[],
  createdBars: [] as FakeBar[],
  mkdirSyncMock: vi.fn(),
  statusMock: vi.fn(),
  successMock: vi.fn(),
  warnMock: vi.fn(),
  createMultiBarMock: vi.fn(),
}));

vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  mkdirSync: mkdirSyncMock,
}));

vi.mock('../../queue/job-queue', async () => {
  const { EventEmitter } = await import('events');
  class FakeJobQueue extends EventEmitter {
    jobs: FakeJob[] = [];
    concurrency: number | undefined;
    started = false;
    cancelAllCount = 0;

    constructor(options: { concurrency?: number } | number = {}) {
      super();
      this.concurrency = typeof options === 'number' ? options : options.concurrency;
      queueInstances.push(this as unknown as FakeQueue);
    }

    addJob(input: string, output: string): string {
      const id = `job-${this.jobs.length + 1}`;
      this.jobs.push({ id, input, output, status: QUEUE_STATUS.QUEUED });
      return id;
    }

    start(): void {
      this.started = true;
    }

    cancelAll(): void {
      this.cancelAllCount += 1;
    }
  }
  return { JobQueue: FakeJobQueue };
});

vi.mock('../cli-ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../cli-ui')>()),
  status: statusMock,
  success: successMock,
  warn: warnMock,
  createMultiBar: createMultiBarMock,
}));

vi.mock('../cli-util', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../cli-util')>()),
  expandInputs: (inputs: string[]) => inputs,
  registerCliSignalCancel: () => () => {},
}));

import { runBatch } from '../cli-batch';
import { cliConfig } from '../cli-ui';

/**
 * Builds RunBatchParams with sensible defaults.
 * @param {Partial<RunBatchParams>} overrides - Fields to override.
 * @returns {RunBatchParams} Complete batch parameters.
 */
function params(overrides: Partial<RunBatchParams> = {}): RunBatchParams {
  return {
    inputs: ['/media/a.mkv', '/media/b.mkv'],
    flags: {} as ConvertCliFlags,
    transcoder: 'ffmpeg',
    timeoutSeconds: 3600,
    themeId: 'default' as CliThemeId,
    ...overrides,
  };
}

/**
 * Returns the most recently constructed fake queue.
 * @returns {FakeQueue} The active fake queue.
 */
function lastQueue(): FakeQueue {
  return queueInstances[queueInstances.length - 1];
}

/**
 * Emits a terminal status change for a fake job.
 * @param {FakeQueue} queue - The queue to emit on.
 * @param {FakeJob} job - The job reaching a terminal state.
 * @param {string} status - Terminal status (done or error).
 * @returns {void}
 */
function finishJob(queue: FakeQueue, job: FakeJob, status: string): void {
  queue.emit('statusChange', { id: job.id, status, input: job.input, output: job.output, error: job.error });
}

beforeEach(() => {
  vi.clearAllMocks();
  queueInstances.length = 0;
  createdBars.length = 0;
  cliConfig.quiet = false;
  createMultiBarMock.mockImplementation(() => ({
    create: vi.fn(() => {
      const bar: FakeBar = { update: vi.fn(), stop: vi.fn() };
      createdBars.push(bar);
      return bar;
    }),
    stop: vi.fn(),
  }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('runBatch', () => {
  it('reports success for every job and starts the queue', async () => {
    const promise = runBatch(params());
    const queue = lastQueue();
    expect(queue.started).toBe(true);
    finishJob(queue, queue.jobs[0], QUEUE_STATUS.DONE);
    finishJob(queue, queue.jobs[1], QUEUE_STATUS.DONE);
    await expect(promise).resolves.toBeUndefined();
    expect(successMock).toHaveBeenCalledTimes(2);
    expect(statusMock).toHaveBeenCalledTimes(1);
    expect(warnMock).not.toHaveBeenCalled();
    expect(createdBars[0].stop).toHaveBeenCalled();
  });

  it('throws a conversion-failed error and warns for a failed job', async () => {
    const promise = runBatch(params());
    const queue = lastQueue();
    queue.jobs[0].error = 'boom';
    finishJob(queue, queue.jobs[0], QUEUE_STATUS.ERROR);
    finishJob(queue, queue.jobs[1], QUEUE_STATUS.DONE);
    await expect(promise).rejects.toThrow('Batch finished with 1 failure');
    expect(warnMock).toHaveBeenCalledWith(expect.stringContaining('failed: boom'));
  });

  it('maps a queue cancellation to the cancellation exit code', async () => {
    const promise = runBatch(params());
    lastQueue().emit('cancelled');
    await expect(promise).rejects.toMatchObject({ name: 'CliExitError', exitCode: CLI_EXIT_CANCELLED });
  });

  it('rejects with a not-found error when no inputs match', async () => {
    await expect(runBatch(params({ inputs: [] }))).rejects.toMatchObject({
      name: 'CliExitError',
      exitCode: CLI_EXIT_NOT_FOUND,
    });
    expect(queueInstances).toHaveLength(0);
  });

  it('creates the output directory when --output-dir is given', async () => {
    const promise = runBatch(params({ outputDir: '/out/dir' }));
    const queue = lastQueue();
    finishJob(queue, queue.jobs[0], QUEUE_STATUS.DONE);
    finishJob(queue, queue.jobs[1], QUEUE_STATUS.DONE);
    await promise;
    expect(mkdirSyncMock).toHaveBeenCalledWith('/out/dir', { recursive: true });
    expect(queue.jobs[0].output).toContain('out');
  });

  it('keeps the source extension in copy mode', async () => {
    const promise = runBatch(params({ flags: { copy: true } as ConvertCliFlags, inputs: ['/media/movie.mkv'] }));
    const queue = lastQueue();
    expect(queue.jobs[0].output).toMatch(/\.mkv$/);
    finishJob(queue, queue.jobs[0], QUEUE_STATUS.DONE);
    await promise;
  });

  it('renders progress updates for known jobs and ignores unknown ones', async () => {
    const promise = runBatch(params());
    const queue = lastQueue();
    queue.emit('statusChange', { id: queue.jobs[0].id, status: QUEUE_STATUS.RUNNING });
    queue.emit('progress', {
      job: { id: queue.jobs[0].id },
      progress: { percent: 42, time: '00:01', speed: '2x', fps: 30, eta: '00:02', bitrate: '1 Mbps' },
    });
    queue.emit('progress', { job: { id: 'missing' }, progress: { percent: 1 } });
    finishJob(queue, queue.jobs[0], QUEUE_STATUS.DONE);
    finishJob(queue, queue.jobs[1], QUEUE_STATUS.DONE);
    await promise;
    expect(createdBars[0].update).toHaveBeenCalledWith(42, expect.objectContaining({ speed: '2x', fps: 30 }));
  });

  it('skips status output when quiet and progress bars when non-interactive', async () => {
    createMultiBarMock.mockReturnValue(null);
    cliConfig.quiet = true;
    const promise = runBatch(params());
    const queue = lastQueue();
    finishJob(queue, queue.jobs[0], QUEUE_STATUS.DONE);
    finishJob(queue, queue.jobs[1], QUEUE_STATUS.DONE);
    await promise;
    expect(statusMock).not.toHaveBeenCalled();
    expect(successMock).toHaveBeenCalledTimes(2);
    expect(createdBars).toHaveLength(0);
  });

  it('clamps the requested concurrency into the supported range', async () => {
    const low = runBatch(params({ concurrency: 0 }));
    const lowQueue = lastQueue();
    finishJob(lowQueue, lowQueue.jobs[0], QUEUE_STATUS.DONE);
    finishJob(lowQueue, lowQueue.jobs[1], QUEUE_STATUS.DONE);
    await low;
    expect(lowQueue.concurrency).toBe(MAX_QUEUE_CONCURRENCY);

    const capped = runBatch(params({ concurrency: 99 }));
    const cappedQueue = lastQueue();
    finishJob(cappedQueue, cappedQueue.jobs[0], QUEUE_STATUS.DONE);
    finishJob(cappedQueue, cappedQueue.jobs[1], QUEUE_STATUS.DONE);
    await capped;
    expect(cappedQueue.concurrency).toBe(MAX_QUEUE_CONCURRENCY);
  });

  it('fails a stalled job with the timeout exit code', async () => {
    vi.useFakeTimers();
    const promise = runBatch(params({ timeoutSeconds: 0 }));
    const queue = lastQueue();
    const rejection = expect(promise).rejects.toMatchObject({ name: 'CliExitError', exitCode: CLI_EXIT_TIMEOUT });
    queue.emit('statusChange', { id: queue.jobs[0].id, status: QUEUE_STATUS.RUNNING });
    await vi.advanceTimersByTimeAsync(1000);
    await rejection;
    expect(queue.cancelAllCount).toBeGreaterThan(0);
  });

  it('keeps waiting while jobs are inside the timeout window', async () => {
    vi.useFakeTimers();
    const promise = runBatch(params({ timeoutSeconds: 3600 }));
    const queue = lastQueue();
    queue.emit('statusChange', { id: queue.jobs[0].id, status: QUEUE_STATUS.RUNNING });
    await vi.advanceTimersByTimeAsync(1000);
    expect(queue.cancelAllCount).toBe(0);
    finishJob(queue, queue.jobs[0], QUEUE_STATUS.DONE);
    finishJob(queue, queue.jobs[1], QUEUE_STATUS.DONE);
    await expect(promise).resolves.toBeUndefined();
  });
});
