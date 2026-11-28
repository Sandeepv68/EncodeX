import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createAutomationDefinition, createAutomationEdge, createAutomationNode } from '../../../shared/automations/defaults';
import { expectAppLog } from '../../../test-utils/crash-tripwire';
import { AutomationRunner, cancelAllAutomationRuns } from '../index';
import { AutomationEventBus } from '../events';
import type { AutomationProgressEvent } from '../../../shared/automations/types';
import type { ConversionProgress, TranscoderType } from '../../../shared/types';
import type { ITranscoder } from '../../transcoders/types';

class FakeTranscoder implements ITranscoder {
  static instances: FakeTranscoder[] = [];
  readonly emitter = new EventEmitter();
  readonly calls: Array<{ input: string; output: string; options: Record<string, unknown> }> = [];
  cancelled = false;
  cancelCount = 0;
  constructor(private readonly behavior: 'succeed' | 'fail' | 'wait' = 'succeed') {
    FakeTranscoder.instances.push(this);
  }
  convert(input: string, output: string, options: Record<string, unknown>): EventEmitter {
    this.calls.push({ input, output, options });
    if (this.behavior !== 'wait') {
      queueMicrotask(() => {
        this.emitter.emit('progress', {
          percent: 50,
          time: '00:01',
          fps: 30,
          speed: '1x',
          eta: '00:01',
          bitrate: '100k',
        } satisfies ConversionProgress);
        if (this.behavior === 'fail') this.emitter.emit('error', new Error('boom'));
        else this.emitter.emit('end');
      });
    }
    return this.emitter;
  }
  cancel(): void {
    this.cancelled = true;
    this.cancelCount += 1;
    this.emitter.emit('error', Object.assign(new Error('cancelled'), { code: 'CANCELLED' }));
  }
  pause(): void {}
  resume(): void {}
  getType(): string {
    return 'FFMPEG';
  }
  async getInfo(): Promise<never> {
    throw new Error('unused');
  }
}

function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('timeout'));
      setTimeout(tick, 10);
    };
    tick();
  });
}

function availableBmf(): { available: boolean; missing: string[] } {
  return { available: true, missing: [] };
}

function twoStageDefinition() {
  return createAutomationDefinition('auto-1', 'Two stage', 1, {
    graph: {
      nodes: [
        createAutomationNode('input-1', 'input', { x: 0, y: 0 }, { data: { kind: 'input', path: 'C:/source.mov' } }),
        createAutomationNode('op-1', 'transcode', { x: 1, y: 0 }, { data: { kind: 'transcode', options: { videoCodec: 'libx264' } } }),
        createAutomationNode('op-2', 'extractAudio', { x: 2, y: 0 }, { data: { kind: 'extractAudio', options: { audioCodec: 'aac' } } }),
        createAutomationNode('output-1', 'output', { x: 3, y: 0 }, { data: { kind: 'output', path: 'C:/final.m4a', extension: 'm4a' } }),
      ],
      edges: [createAutomationEdge('input-1', 'op-1'), createAutomationEdge('op-1', 'op-2'), createAutomationEdge('op-2', 'output-1')],
    },
  });
}

describe('AutomationRunner', () => {
  let userDataDir: string;
  let events: AutomationProgressEvent[];
  let bus: AutomationEventBus;

  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'encodex-automation-runner-'));
    FakeTranscoder.instances = [];
    events = [];
    bus = new AutomationEventBus();
    bus.on('status', (event: AutomationProgressEvent) => events.push(event));
  });

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true });
  });

  function runDirectory(runId: string, tempRoot?: string): string {
    return join(userDataDir, 'automations', 'tmp', ...(tempRoot ? [tempRoot] : []), runId);
  }

  function writeRunSentinel(directory: string): void {
    writeFileSync(join(directory, 'sentinel.bin'), 'data', 'utf8');
  }

  function hasRunStatus(status: AutomationProgressEvent['status']): boolean {
    return events.some((event) => event.nodeId === '' && event.status === status);
  }

  it('runs a two-stage pipeline, emits progress/status events, and removes the run directory', async () => {
    const historyRecorder = { record: vi.fn().mockResolvedValue({ id: 'entry' }) };
    const runner = new AutomationRunner({
      userDataDir,
      eventBus: bus,
      checkBmfAvailability: availableBmf,
      transcoderFactory: (_type: TranscoderType) => new FakeTranscoder('succeed'),
      runIdGenerator: () => 'run-1',
      historyRecorder,
    });
    const directory = runDirectory('run-1', 'custom');

    bus.on('status', (event: AutomationProgressEvent) => {
      if (event.nodeId === '' && event.status === 'running') writeRunSentinel(directory);
    });
    const runId = runner.start(twoStageDefinition(), { tempRoot: 'custom' });
    expect(runId).toBe('run-1');
    await waitFor(() => hasRunStatus('succeeded'));
    await waitFor(() => !existsSync(directory));

    expect(FakeTranscoder.instances).toHaveLength(2);
    expect(FakeTranscoder.instances[0].calls[0].output.replace(/\\/g, '/')).toBe(`${directory.replace(/\\/g, '/')}/step-000-op-1.m4a`);
    expect(FakeTranscoder.instances[1].calls[0].input.replace(/\\/g, '/')).toBe(`${directory.replace(/\\/g, '/')}/step-000-op-1.m4a`);
    expect(FakeTranscoder.instances[1].calls[0].output).toBe('C:/final.m4a');
    expect(events.some((event) => event.nodeId === 'op-1' && event.status === 'running' && typeof event.progress === 'number')).toBe(true);
    expect(events.some((event) => event.nodeId === 'op-2' && event.status === 'succeeded')).toBe(true);
    expect(historyRecorder.record).toHaveBeenCalledTimes(1);
    expect(historyRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({ family: 'automation', source: 'automation', status: 'succeeded', runId: 'run-1' }),
    );
  });

  it('keeps the whole run directory when intermediate files are retained', async () => {
    const runner = new AutomationRunner({
      userDataDir,
      eventBus: bus,
      checkBmfAvailability: availableBmf,
      transcoderFactory: () => new FakeTranscoder('succeed'),
      runIdGenerator: () => 'run-keep',
    });
    const directory = runDirectory('run-keep');
    const definition = twoStageDefinition();
    definition.settings.keepIntermediateFiles = true;
    bus.on('status', (event: AutomationProgressEvent) => {
      if (event.nodeId === '' && event.status === 'running') writeRunSentinel(directory);
    });

    runner.start(definition);
    await waitFor(() => hasRunStatus('succeeded'));

    expect(existsSync(join(directory, 'sentinel.bin'))).toBe(true);
  });

  it('does not create a temp root for an invalid plan', () => {
    const runner = new AutomationRunner({
      userDataDir,
      checkBmfAvailability: availableBmf,
      transcoderFactory: () => new FakeTranscoder('succeed'),
      runIdGenerator: () => 'run-invalid',
    });
    const definition = twoStageDefinition();
    definition.graph.nodes = definition.graph.nodes.filter((node) => node.kind !== 'input');

    expect(() => runner.start(definition)).toThrow();
    expect(existsSync(join(userDataDir, 'automations', 'tmp'))).toBe(false);
  });

  it('fails clearly and does not create a temp root when BMF is unavailable', () => {
    const runner = new AutomationRunner({
      userDataDir,
      checkBmfAvailability: () => ({ available: false, missing: ['bmf_ffmpeg'] }),
      transcoderFactory: () => new FakeTranscoder('succeed'),
    });
    const definition = twoStageDefinition();
    definition.settings.defaultBackend = 'BMF';

    expect(() => runner.start(definition)).toThrow(/BMF/);
    expect(existsSync(join(userDataDir, 'automations', 'tmp'))).toBe(false);
  });

  it('rejects a temp root that escapes the automation temp directory', () => {
    const runner = new AutomationRunner({
      userDataDir,
      checkBmfAvailability: availableBmf,
      transcoderFactory: () => new FakeTranscoder('succeed'),
      runIdGenerator: () => 'run-escape',
    });

    expect(() => runner.start(twoStageDefinition(), { tempRoot: '../escape' })).toThrow(/temp root/);
    expect(existsSync(join(userDataDir, 'automations', 'tmp'))).toBe(false);
  });

  it('cancels the active transcoder, emits cancelled statuses, and removes the run directory', async () => {
    const historyRecorder = { record: vi.fn().mockResolvedValue({ id: 'entry' }) };
    const runner = new AutomationRunner({
      userDataDir,
      eventBus: bus,
      checkBmfAvailability: availableBmf,
      transcoderFactory: () => new FakeTranscoder('wait'),
      runIdGenerator: () => 'run-cancel',
      historyRecorder,
    });
    const directory = runDirectory('run-cancel');

    runner.start(twoStageDefinition());
    await waitFor(() => FakeTranscoder.instances.length === 1);
    writeRunSentinel(directory);
    expect(runner.cancel('run-cancel')).toBe(true);

    await waitFor(() => hasRunStatus('cancelled'));
    await waitFor(() => !existsSync(directory));
    expect(FakeTranscoder.instances[0].cancelCount).toBe(1);
    expect(events.some((event) => event.nodeId === 'op-2' && event.status === 'cancelled')).toBe(true);
    expect(historyRecorder.record).toHaveBeenCalledTimes(1);
    expect(historyRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({ family: 'automation', status: 'cancelled', runId: 'run-cancel' }),
    );
  });

  it('treats repeated cancels as idempotent and ignores late cancels after a terminal state', async () => {
    const runner = new AutomationRunner({
      userDataDir,
      eventBus: bus,
      checkBmfAvailability: availableBmf,
      transcoderFactory: () => new FakeTranscoder('wait'),
      runIdGenerator: () => 'run-idempotent',
    });

    runner.start(twoStageDefinition());
    await waitFor(() => FakeTranscoder.instances.length === 1);
    expect(runner.cancel('run-idempotent')).toBe(true);
    expect(runner.cancel('run-idempotent')).toBe(true);
    await waitFor(() => hasRunStatus('cancelled'));

    expect(FakeTranscoder.instances[0].cancelCount).toBe(1);
    expect(runner.cancel('run-idempotent')).toBe(false);
    expect(events.filter((event) => event.nodeId === '' && event.status === 'cancelled')).toHaveLength(1);
    expect(hasRunStatus('failed')).toBe(false);
  });

  it('ignores a cancel raised synchronously from a terminal event listener', async () => {
    const runner = new AutomationRunner({
      userDataDir,
      eventBus: bus,
      checkBmfAvailability: availableBmf,
      transcoderFactory: () => new FakeTranscoder('succeed'),
      runIdGenerator: () => 'run-late',
    });
    let lateCancelResult: boolean | undefined;
    bus.on('status', (event: AutomationProgressEvent) => {
      if (event.nodeId === '' && event.status === 'succeeded') lateCancelResult = runner.cancel('run-late');
    });

    runner.start(twoStageDefinition());
    await waitFor(() => lateCancelResult !== undefined);

    expect(lateCancelResult).toBe(false);
    expect(FakeTranscoder.instances.every((instance) => instance.cancelCount === 0)).toBe(true);
  });

  it('removes the run directory after a failed run', async () => {
    expectAppLog('error', 'main/automations/runner');
    const historyRecorder = { record: vi.fn().mockResolvedValue({ id: 'entry' }) };
    const runner = new AutomationRunner({
      userDataDir,
      eventBus: bus,
      checkBmfAvailability: availableBmf,
      transcoderFactory: () => new FakeTranscoder('fail'),
      runIdGenerator: () => 'run-fail',
      historyRecorder,
    });
    const directory = runDirectory('run-fail');
    bus.on('status', (event: AutomationProgressEvent) => {
      if (event.nodeId === '' && event.status === 'running') writeRunSentinel(directory);
    });

    runner.start(twoStageDefinition());
    await waitFor(() => hasRunStatus('failed'));
    await waitFor(() => !existsSync(directory));

    expect(events.some((event) => event.nodeId === 'op-1' && event.status === 'failed')).toBe(true);
    expect(historyRecorder.record).toHaveBeenCalledTimes(1);
    expect(historyRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        family: 'automation',
        status: 'failed',
        runId: 'run-fail',
        error: expect.objectContaining({ message: 'An unexpected error occurred. Please try again.' }),
      }),
    );
  });

  it('cancels all active runs on one runner and process-wide', async () => {
    const runnerA = new AutomationRunner({
      userDataDir,
      eventBus: bus,
      checkBmfAvailability: availableBmf,
      transcoderFactory: () => new FakeTranscoder('wait'),
      runIdGenerator: () => 'run-all-a',
    });
    const eventsB: AutomationProgressEvent[] = [];
    const busB = new AutomationEventBus();
    busB.on('status', (event: AutomationProgressEvent) => eventsB.push(event));
    const runnerB = new AutomationRunner({
      userDataDir,
      eventBus: busB,
      checkBmfAvailability: availableBmf,
      transcoderFactory: () => new FakeTranscoder('wait'),
      runIdGenerator: () => 'run-all-b',
    });

    runnerA.start(twoStageDefinition());
    runnerB.start(twoStageDefinition());
    await waitFor(() => FakeTranscoder.instances.length === 2);

    expect(runnerA.cancelAll()).toBe(1);
    await waitFor(() => !existsSync(runDirectory('run-all-a')));
    expect(cancelAllAutomationRuns()).toBe(1);
    await waitFor(() => eventsB.some((event) => event.nodeId === '' && event.status === 'cancelled'));
    await waitFor(() => !existsSync(runDirectory('run-all-b')));
    expect(cancelAllAutomationRuns()).toBe(0);
    expect(FakeTranscoder.instances.map((instance) => instance.cancelCount)).toEqual([1, 1]);
  });
});
