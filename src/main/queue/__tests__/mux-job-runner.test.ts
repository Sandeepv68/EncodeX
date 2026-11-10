/**
 * @fileoverview Unit tests for the sequential mux job runner.
 *
 * The runner is exercised with a fake transcoder so no FFmpeg process is
 * started: the tests pin target order, progress aggregation, the
 * fail-fast behaviour, cancellation, and pause/resume forwarding.
 */

import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
import { MuxJobRunner, aggregateProgress } from '../mux-job-runner';
import { ErrorCode } from '../../../shared/errors';
import { QUEUE_STATUS } from '../../../shared/media-options';
import type { ConversionProgress, MuxQueueJob, MuxQueueTarget, TranscoderType } from '../../../shared/types';
import type { ITranscoder } from '../../transcoders/types';

/** A fake transcoder that records the conversions it was asked to run. */
class FakeTranscoder implements ITranscoder {
  static instances: FakeTranscoder[] = [];

  readonly emitter = new EventEmitter();
  readonly calls: Array<{ input: string; output: string }> = [];
  cancelled = false;
  paused = false;
  resumed = false;

  constructor() {
    FakeTranscoder.instances.push(this);
  }

  convert(input: string, output: string): EventEmitter {
    this.calls.push({ input, output });
    return this.emitter;
  }

  cancel(): void {
    this.cancelled = true;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.resumed = true;
  }

  getType(): string {
    return 'FFMPEG';
  }

  async getInfo(): Promise<never> {
    throw new Error('not under test');
  }
}

function target(output: string, label?: string): MuxQueueTarget {
  return { output, options: { copy: true }, label };
}

function job(targets: MuxQueueTarget[]): MuxQueueJob {
  return {
    id: 'mux-1',
    kind: targets.length > 1 ? 'demux' : 'remux',
    input: 'C:/in/a.mp4',
    output: targets[0]?.output ?? '',
    targets,
    transcoder: 'FFMPEG' as TranscoderType,
    status: QUEUE_STATUS.RUNNING,
    progress: 0,
    createdAt: 1_700_000_000_000,
  };
}

const PROGRESS = (percent: number): ConversionProgress => ({
  percent,
  time: '00:01',
  fps: 30,
  speed: '1.0x',
  eta: '00:10',
  bitrate: '1500k',
});

describe('aggregateProgress', () => {
  it('maps a single target onto the whole job', () => {
    expect(aggregateProgress(0, 1, 0)).toBe(0);
    expect(aggregateProgress(0, 1, 50)).toBe(50);
    expect(aggregateProgress(0, 1, 100)).toBe(100);
  });

  it('splits the job across its targets', () => {
    expect(aggregateProgress(0, 2, 100)).toBe(50);
    expect(aggregateProgress(1, 2, 0)).toBe(50);
    expect(aggregateProgress(1, 2, 50)).toBe(75);
    expect(aggregateProgress(2, 4, 100)).toBe(75);
    expect(aggregateProgress(3, 4, 100)).toBe(100);
  });

  it('clamps out-of-range and non-finite input', () => {
    expect(aggregateProgress(0, 1, 150)).toBe(100);
    expect(aggregateProgress(0, 1, -20)).toBe(0);
    expect(aggregateProgress(0, 1, Number.NaN)).toBe(0);
    expect(aggregateProgress(0, 0, 50)).toBe(0);
  });
});

describe('MuxJobRunner', () => {
  it('runs the targets in order and only after the previous one ends', async () => {
    FakeTranscoder.instances = [];
    const muxJob = job([target('C:/out/a.mkv', 'video:0'), target('C:/out/b.m4a', 'audio:1')]);
    const runner = new MuxJobRunner(muxJob, () => new FakeTranscoder());
    const ended = vi.fn();
    runner.on('end', ended);
    runner.start();

    await Promise.resolve();
    expect(FakeTranscoder.instances).toHaveLength(1);
    expect(FakeTranscoder.instances[0].calls[0]).toEqual({ input: 'C:/in/a.mp4', output: 'C:/out/a.mkv' });

    FakeTranscoder.instances[0].emitter.emit('end');
    await Promise.resolve();
    await Promise.resolve();
    expect(FakeTranscoder.instances).toHaveLength(2);
    expect(FakeTranscoder.instances[1].calls[0].output).toBe('C:/out/b.m4a');

    FakeTranscoder.instances[1].emitter.emit('end');
    await Promise.resolve();
    await Promise.resolve();
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('emits job-level progress aggregated over the targets', async () => {
    FakeTranscoder.instances = [];
    const muxJob = job([target('C:/out/a.mkv'), target('C:/out/b.m4a')]);
    const runner = new MuxJobRunner(muxJob, () => new FakeTranscoder());
    const progress = vi.fn();
    runner.on('progress', progress);
    runner.start();

    await Promise.resolve();
    FakeTranscoder.instances[0].emitter.emit('progress', PROGRESS(50));
    expect(progress.mock.calls[0][0].progress.percent).toBe(25);

    FakeTranscoder.instances[0].emitter.emit('end');
    await Promise.resolve();
    await Promise.resolve();
    FakeTranscoder.instances[1].emitter.emit('progress', PROGRESS(50));
    expect(progress.mock.calls[1][0].progress.percent).toBe(75);
  });

  it('fails fast on the first failing target and names it', async () => {
    FakeTranscoder.instances = [];
    const muxJob = job([target('C:/out/a.mkv', 'video:0'), target('C:/out/b.m4a', 'audio:1')]);
    const runner = new MuxJobRunner(muxJob, () => new FakeTranscoder());
    const failed = vi.fn();
    runner.on('error', failed);
    runner.start();

    await Promise.resolve();
    FakeTranscoder.instances[0].emitter.emit('error', new Error('boom'));
    await Promise.resolve();
    await Promise.resolve();

    expect(failed).toHaveBeenCalledTimes(1);
    expect(failed.mock.calls[0][0].message).toContain('video:0');
    expect(FakeTranscoder.instances).toHaveLength(1);
  });

  it('reports a cancellation with the CANCELLED code', async () => {
    FakeTranscoder.instances = [];
    const muxJob = job([target('C:/out/a.mkv')]);
    const runner = new MuxJobRunner(muxJob, () => new FakeTranscoder());
    const failed = vi.fn();
    runner.on('error', failed);
    runner.start();

    await Promise.resolve();
    runner.cancel();
    expect(FakeTranscoder.instances[0].cancelled).toBe(true);

    const cancelled = new Error('cancelled');
    (cancelled as { code?: string }).code = ErrorCode.CANCELLED;
    FakeTranscoder.instances[0].emitter.emit('error', cancelled);
    await Promise.resolve();
    await Promise.resolve();

    expect(failed.mock.calls[0][0].code).toBe(ErrorCode.CANCELLED);
  });

  it('forwards pause and resume to the running transcoder', async () => {
    FakeTranscoder.instances = [];
    const muxJob = job([target('C:/out/a.mkv')]);
    const runner = new MuxJobRunner(muxJob, () => new FakeTranscoder());
    runner.on('error', () => undefined);
    runner.start();

    await Promise.resolve();
    runner.pause();
    expect(FakeTranscoder.instances[0].paused).toBe(true);
    runner.resume();
    expect(FakeTranscoder.instances[0].resumed).toBe(true);
  });
});
