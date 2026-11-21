import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'events';
import { createAutomationDefinition, createAutomationEdge, createAutomationNode } from '../../../shared/automations/defaults';
import { expectAppLog } from '../../../test-utils/crash-tripwire';
import { AutomationRunner } from '../runner';
import { AutomationEventBus } from '../events';
import type { AutomationProgressEvent } from '../../../shared/automations/types';
import type { ConversionProgress, TranscoderType } from '../../../shared/types';
import type { ITranscoder } from '../../transcoders/types';

class FakeTranscoder implements ITranscoder {
  static instances: FakeTranscoder[] = [];
  readonly emitter = new EventEmitter();
  readonly calls: Array<{ input: string; output: string; options: Record<string, unknown> }> = [];
  cancelled = false;
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
  it('runs a two-stage pipeline and emits progress/status events', async () => {
    expectAppLog('warn', 'main/transcoders/bmf-availability');
    FakeTranscoder.instances = [];
    const events: AutomationProgressEvent[] = [];
    const bus = new AutomationEventBus();
    bus.on('status', (event: AutomationProgressEvent) => events.push(event));
    const runner = new AutomationRunner({
      userDataDir: 'C:/tmp/user',
      eventBus: bus,
      transcoderFactory: (_type: TranscoderType) => new FakeTranscoder('succeed'),
      runIdGenerator: () => 'run-1',
    });

    const runId = runner.start(twoStageDefinition(), { tempRoot: 'custom' });
    expect(runId).toBe('run-1');
    await waitFor(() => events.some((e) => e.nodeId === '' && e.status === 'succeeded'));

    expect(FakeTranscoder.instances).toHaveLength(2);
    expect(FakeTranscoder.instances[0].calls[0].output.replace(/\\/g, '/')).toBe(
      'C:/tmp/user/automations/tmp/custom/run-1/step-000-op-1.m4a',
    );
    expect(FakeTranscoder.instances[1].calls[0].input.replace(/\\/g, '/')).toBe(
      'C:/tmp/user/automations/tmp/custom/run-1/step-000-op-1.m4a',
    );
    expect(FakeTranscoder.instances[1].calls[0].output).toBe('C:/final.m4a');
    expect(events.some((e) => e.nodeId === 'op-1' && e.status === 'running' && typeof e.progress === 'number')).toBe(true);
    expect(events.some((e) => e.nodeId === 'op-2' && e.status === 'succeeded')).toBe(true);
  });

  it('fails clearly when BMF is unavailable', async () => {
    const runner = new AutomationRunner({
      userDataDir: 'C:/tmp/user',
      checkBmfAvailability: () => ({ available: false, missing: ['bmf_ffmpeg'] }),
      transcoderFactory: () => new FakeTranscoder('succeed'),
    });
    const def = twoStageDefinition();
    def.settings.defaultBackend = 'BMF';
    expect(() => runner.start(def)).toThrow(/BMF/);
  });

  it('rejects a temp root that escapes the automation temp directory', () => {
    const runner = new AutomationRunner({
      userDataDir: 'C:/tmp/user',
      transcoderFactory: () => new FakeTranscoder('succeed'),
      runIdGenerator: () => 'run-escape',
    });
    expect(() => runner.start(twoStageDefinition(), { tempRoot: '../escape' })).toThrow(/temp root/);
  });

  it('cancels the active transcoder and emits cancelled statuses', async () => {
    expectAppLog('warn', 'main/transcoders/bmf-availability');
    FakeTranscoder.instances = [];
    const events: AutomationProgressEvent[] = [];
    const bus = new AutomationEventBus();
    bus.on('status', (e: AutomationProgressEvent) => events.push(e));
    const runner = new AutomationRunner({
      userDataDir: 'C:/tmp/user',
      eventBus: bus,
      transcoderFactory: () => new FakeTranscoder('wait'),
      runIdGenerator: () => 'run-cancel',
    });
    runner.start(twoStageDefinition());
    await waitFor(() => FakeTranscoder.instances.length === 1);
    expect(runner.cancel('run-cancel')).toBe(true);
    await waitFor(() => events.some((e) => e.nodeId === '' && e.status === 'cancelled'));
    expect(FakeTranscoder.instances[0].cancelled).toBe(true);
    expect(events.some((e) => e.nodeId === 'op-2' && e.status === 'cancelled')).toBe(true);
  });

  it('marks run failed on step error', async () => {
    expectAppLog('warn', 'main/transcoders/bmf-availability');
    expectAppLog('error', 'main/automations/runner');
    FakeTranscoder.instances = [];
    const events: AutomationProgressEvent[] = [];
    const bus = new AutomationEventBus();
    bus.on('status', (e: AutomationProgressEvent) => events.push(e));
    const runner = new AutomationRunner({
      userDataDir: 'C:/tmp/user',
      eventBus: bus,
      transcoderFactory: () => new FakeTranscoder('fail'),
      runIdGenerator: () => 'run-fail',
    });
    runner.start(twoStageDefinition());
    await waitFor(() => events.some((e) => e.nodeId === '' && e.status === 'failed'));
    expect(events.some((e) => e.nodeId === 'op-1' && e.status === 'failed')).toBe(true);
  });
});
