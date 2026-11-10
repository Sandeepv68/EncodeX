/**
 * @fileoverview Unit tests for the dedicated remux/demux queue engine.
 *
 * The queue is exercised with a fake transcoder so no FFmpeg process is
 * started: the tests pin the add/start lifecycle, concurrency, reordering,
 * duplicate-output rejection, cancellation, and persistence restore.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { EventEmitter } from 'events';
import { MuxQueue } from '../mux-queue';
import { FileMuxQueuePersistence } from '../persistence';
import { batchOutputClaims, muxOutputClaims } from '../output-claims';
import { QUEUE_STATUS } from '../../../shared/media-options';
import { MUX_QUEUE_STATE_VERSION } from '../../../shared/constants';
import type { ConversionProgress, MuxQueueAddPayload, MuxQueueJob, TranscoderType } from '../../../shared/types';
import type { ITranscoder } from '../../transcoders/types';

class FakeTranscoder implements ITranscoder {
  static instances: FakeTranscoder[] = [];

  readonly emitter = new EventEmitter();
  cancelled = false;

  constructor() {
    FakeTranscoder.instances.push(this);
  }

  convert(): EventEmitter {
    return this.emitter;
  }
  cancel(): void {
    this.cancelled = true;
  }
  pause(): void {}
  resume(): void {}
  getType(): string {
    return 'FFMPEG';
  }
  async getInfo(): Promise<never> {
    throw new Error('not under test');
  }
}

function payload(overrides: Partial<MuxQueueAddPayload> = {}): MuxQueueAddPayload {
  return {
    kind: 'remux',
    input: 'C:/in/a.mp4',
    output: 'C:/out/a.mkv',
    targets: [{ output: 'C:/out/a.mkv', options: { copy: true } }],
    ...overrides,
  };
}

function makeQueue(options: Record<string, unknown> = {}): MuxQueue {
  return new MuxQueue({
    persistDelayMs: 1,
    transcoderFactory: () => new FakeTranscoder(),
    ...options,
  });
}

const PROGRESS = (percent: number): ConversionProgress => ({
  percent,
  time: '00:01',
  fps: 30,
  speed: '1.0x',
  eta: '00:10',
  bitrate: '1500k',
});

describe('MuxQueue lifecycle', () => {
  beforeEach(() => {
    FakeTranscoder.instances = [];
  });

  it('adds a job without starting it', () => {
    const queue = makeQueue();
    const added = vi.fn();
    queue.on('added', added);
    const id = queue.addJob(payload());
    expect(id).toBeTypeOf('string');
    expect(queue.getJobs()).toHaveLength(1);
    expect(queue.getJobs()[0].status).toBe(QUEUE_STATUS.QUEUED);
    expect(queue.getJobs()[0].kind).toBe('remux');
    expect(queue.getJobs()[0].progress).toBe(0);
    expect(added).toHaveBeenCalledTimes(1);
    expect(FakeTranscoder.instances).toHaveLength(0);
  });

  it('starts a queued job and reports the terminal status', async () => {
    const queue = makeQueue();
    const statusChange = vi.fn();
    queue.on('statusChange', statusChange);
    queue.addJob(payload());
    queue.start();

    expect(FakeTranscoder.instances).toHaveLength(1);
    expect(queue.getJobs()[0].status).toBe(QUEUE_STATUS.RUNNING);

    FakeTranscoder.instances[0].emitter.emit('progress', PROGRESS(50));
    expect(queue.getJobs()[0].progress).toBe(50);

    FakeTranscoder.instances[0].emitter.emit('end');
    await Promise.resolve();
    await Promise.resolve();

    expect(queue.getJobs()[0].status).toBe(QUEUE_STATUS.DONE);
    expect(queue.getJobs()[0].progress).toBe(100);
    expect(statusChange).toHaveBeenCalled();
  });

  it('marks a job as failed when its target fails', async () => {
    const queue = makeQueue();
    queue.addJob(payload());
    queue.start();
    FakeTranscoder.instances[0].emitter.emit('error', new Error('boom'));
    await Promise.resolve();
    await Promise.resolve();

    const job = queue.getJobs()[0];
    expect(job.status).toBe(QUEUE_STATUS.ERROR);
    expect(job.error).toContain('boom');
  });

  it('runs at most one job at a time by default and honours the cap', async () => {
    const queue = makeQueue();
    queue.addJob(payload());
    queue.addJob(payload({ input: 'C:/in/b.mp4', output: 'C:/out/b.mkv', targets: [{ output: 'C:/out/b.mkv', options: {} }] }));
    queue.start();
    expect(FakeTranscoder.instances).toHaveLength(1);

    const wide = makeQueue({ concurrency: 2 });
    wide.addJob(payload());
    wide.addJob(payload({ input: 'C:/in/b.mp4', output: 'C:/out/b.mkv', targets: [{ output: 'C:/out/b.mkv', options: {} }] }));
    wide.start();
    expect(FakeTranscoder.instances.length).toBe(3);
  });

  it('starts the next job when the running one finishes', async () => {
    const queue = makeQueue();
    queue.addJob(payload());
    queue.addJob(payload({ input: 'C:/in/b.mp4', output: 'C:/out/b.mkv', targets: [{ output: 'C:/out/b.mkv', options: {} }] }));
    queue.start();
    expect(FakeTranscoder.instances).toHaveLength(1);

    FakeTranscoder.instances[0].emitter.emit('end');
    await Promise.resolve();
    await Promise.resolve();
    expect(FakeTranscoder.instances).toHaveLength(2);
  });

  it('removes, clears completed, and cancels jobs', async () => {
    const queue = makeQueue();
    const first = queue.addJob(payload());
    const second = queue.addJob(
      payload({ input: 'C:/in/b.mp4', output: 'C:/out/b.mkv', targets: [{ output: 'C:/out/b.mkv', options: {} }] }),
    );
    queue.start();
    FakeTranscoder.instances[0].emitter.emit('end');
    await Promise.resolve();
    await Promise.resolve();

    expect(queue.clearCompleted()).toBe(1);
    expect(queue.getJobs().map((job) => job.id)).toEqual([second]);

    queue.removeJob(second);
    expect(queue.getJobs()).toHaveLength(0);
    expect(queue.getJobs()).not.toContainEqual(expect.objectContaining({ id: first }));
  });

  it('cancels every job and clears the queue', async () => {
    const queue = makeQueue();
    const cancelled = vi.fn();
    queue.on('cancelled', cancelled);
    queue.addJob(payload());
    queue.start();
    queue.cancelAll();
    expect(FakeTranscoder.instances[0].cancelled).toBe(true);
    expect(queue.getJobs()).toHaveLength(0);
    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('reorders queued jobs and refuses invalid moves', () => {
    const queue = makeQueue();
    const first = queue.addJob(payload());
    queue.addJob(payload({ input: 'C:/in/b.mp4', output: 'C:/out/b.mkv', targets: [{ output: 'C:/out/b.mkv', options: {} }] }));
    const moved = vi.fn();
    queue.on('moved', moved);

    expect(queue.moveJobTo(first, 1)).toBe(true);
    expect(queue.getJobs().map((job) => job.id)).toEqual([expect.any(String), first]);
    expect(moved).toHaveBeenCalledWith({ id: first, toPosition: 1 });

    expect(queue.moveJobTo(first, Number.NaN)).toBe(false);
    expect(queue.moveJobTo('missing', 0)).toBe(false);
  });

  it('rejects a job whose output is already claimed', () => {
    const queue = makeQueue();
    queue.addJob(payload());
    expect(() => queue.addJob(payload())).toThrow();
    expect(() =>
      queue.addJob(payload({ input: 'C:/in/b.mp4', output: 'c:/OUT/A.MKV', targets: [{ output: 'c:/OUT/A.MKV', options: {} }] })),
    ).toThrow();
    expect(queue.getJobs()).toHaveLength(1);
  });

  it('reports whether an output path is claimed', () => {
    const queue = makeQueue();
    queue.addJob(payload());
    expect(queue.hasOutputPath('C:/out/a.mkv')).toBe(true);
    expect(queue.hasOutputPath('C:/out/other.mkv')).toBe(false);
  });

  it('rejects a target output the batch queue already claims', () => {
    batchOutputClaims.claim('C:/out/shared.mkv', 'batch-1');
    try {
      const queue = makeQueue();
      expect(() =>
        queue.addJob(payload({ output: 'C:/out/shared.mkv', targets: [{ output: 'C:/out/shared.mkv', options: {} }] })),
      ).toThrow();
      expect(queue.getJobs()).toHaveLength(0);
    } finally {
      batchOutputClaims.releaseAll('batch-1');
    }
  });

  it('claims its target outputs so the batch queue cannot take them', () => {
    const queue = makeQueue();
    // A path of its own: the claim registry is process-wide, so a shared
    // output would still be claimed by another test's job.
    queue.addJob(payload({ output: 'C:/out/claimed.mkv', targets: [{ output: 'C:/out/claimed.mkv', options: {} }] }));
    expect(muxOutputClaims.isClaimed('C:/out/claimed.mkv')).toBe(true);
    queue.removeJob(queue.getJobs()[0].id);
    expect(muxOutputClaims.isClaimed('C:/out/claimed.mkv')).toBe(false);
  });

  it('rejects a job that lists the same output twice', () => {
    const queue = makeQueue();
    expect(() =>
      queue.addJob(
        payload({
          targets: [
            { output: 'C:/out/a.mkv', options: {} },
            { output: 'c:/OUT/A.MKV', options: {} },
          ],
        }),
      ),
    ).toThrow();
    expect(queue.getJobs()).toHaveLength(0);
  });

  it('rejects a target output that already exists unless overwrite is set', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-mux-queue-files-'));
    try {
      const existing = path.join(dir, 'existing.mkv');
      fs.writeFileSync(existing, 'x', 'utf8');
      const queue = makeQueue();
      expect(() => queue.addJob(payload({ output: existing, targets: [{ output: existing, options: {} }] }))).toThrow();
      expect(queue.getJobs()).toHaveLength(0);
      expect(() =>
        queue.addJob(payload({ output: existing, targets: [{ output: existing, options: {} }], overwrite: true })),
      ).not.toThrow();
      expect(queue.getJobs()).toHaveLength(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('MuxQueue persistence', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-mux-queue-engine-'));
    FakeTranscoder.instances = [];
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('restores a snapshot with RUNNING jobs downgraded to QUEUED', () => {
    const persistence = new FileMuxQueuePersistence(dir);
    const snapshot = {
      version: MUX_QUEUE_STATE_VERSION,
      concurrency: 1,
      jobs: [
        {
          id: 'restored',
          kind: 'remux' as const,
          input: 'C:/in/a.mp4',
          output: 'C:/out/a.mkv',
          targets: [{ output: 'C:/out/a.mkv', options: { copy: true } }],
          transcoder: 'FFMPEG' as TranscoderType,
          status: QUEUE_STATUS.RUNNING,
          progress: 61,
          paused: true,
          createdAt: 1_700_000_000_000,
        },
      ],
    };
    persistence.save(snapshot);

    const queue = new MuxQueue({ persistence, transcoderFactory: () => new FakeTranscoder() });
    const job = queue.getJobs()[0];
    expect(job.id).toBe('restored');
    expect(job.status).toBe(QUEUE_STATUS.QUEUED);
    expect(job.progress).toBe(0);
    expect(job.paused).toBe(false);
    expect(job.targets).toHaveLength(1);
    expect(FakeTranscoder.instances).toHaveLength(0);
  });

  it('writes the current state to disk on flush', () => {
    const persistence = new FileMuxQueuePersistence(dir);
    const queue = new MuxQueue({ persistence, transcoderFactory: () => new FakeTranscoder() });
    queue.addJob(payload());
    queue.flushState();
    const raw = JSON.parse(fs.readFileSync(path.join(dir, 'mux-queue-state.json'), 'utf8')) as { jobs: MuxQueueJob[] };
    expect(raw.jobs).toHaveLength(1);
  });
});
