import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EventEmitter } from 'events';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createAutomationDefinition, createAutomationEdge, createAutomationNode } from '../../../shared/automations/defaults';
import { expectAppLog } from '../../../test-utils/crash-tripwire';
import { AutomationRunner, forwardAutomationEvents } from '../runner';
import { AutomationEventBus } from '../events';
import { IPC } from '../../../shared/ipc-channels';
import type { AutomationDefinition, AutomationProgressEvent, AutomationRuntime } from '../../../shared/automations/types';
import type { ConversionProgress, TranscoderType } from '../../../shared/types';
import type { ITranscoder } from '../../transcoders/types';

class BranchTranscoder implements ITranscoder {
  static instances: BranchTranscoder[] = [];
  readonly emitter = new EventEmitter();
  behavior: 'succeed' | 'cancel-after-resolve' | 'cancelled-error' = 'succeed';
  cancelCount = 0;
  constructor() {
    BranchTranscoder.instances.push(this);
  }
  convert(): EventEmitter {
    queueMicrotask(() => {
      this.emitter.emit('progress', { percent: 25, time: '00:01' } as ConversionProgress);
      if (this.behavior === 'cancelled-error') {
        this.emitter.emit('error', Object.assign(new Error('cancelled'), { code: 'CANCELLED' }));
      } else {
        this.emitter.emit('end');
      }
    });
    return this.emitter;
  }
  cancel(): void {
    this.cancelCount += 1;
    if (this.behavior === 'cancel-after-resolve') this.emitter.emit('end');
    if (this.behavior === 'cancelled-error') {
      this.emitter.emit('error', Object.assign(new Error('cancelled'), { code: 'CANCELLED' }));
    }
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

class ThrowingEventBus extends AutomationEventBus {
  constructor(private readonly shouldThrow: (event: AutomationProgressEvent) => boolean) {
    super();
  }

  emitStatus(event: AutomationProgressEvent): void {
    if (this.shouldThrow(event)) throw new Error('event bus crashed');
    super.emitStatus(event);
  }
}

function definition(inputPath = '/in.mov'): AutomationDefinition {
  return createAutomationDefinition('auto-branch', 'Branch', 1000, {
    graph: {
      nodes: [
        createAutomationNode('in', 'input', { x: 0, y: 0 }, { data: { kind: 'input', path: inputPath } }),
        createAutomationNode('op-1', 'transcode', { x: 1, y: 0 }, { data: { kind: 'transcode', options: { videoCodec: 'libx264' } } }),
        createAutomationNode('op-2', 'transcode', { x: 2, y: 0 }, { data: { kind: 'transcode', options: { videoCodec: 'libx264' } } }),
        createAutomationNode('out', 'output', { x: 3, y: 0 }, { data: { kind: 'output', path: '/final.mp4' } }),
      ],
      edges: [createAutomationEdge('in', 'op-1'), createAutomationEdge('op-1', 'op-2'), createAutomationEdge('op-2', 'out')],
    },
  });
}

function statuses(events: AutomationProgressEvent[], status: AutomationProgressEvent['status']): AutomationProgressEvent[] {
  return events.filter((event) => event.nodeId === '' && event.status === status);
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

describe('automation runner branch coverage', () => {
  let userDataDir: string;
  let bus: AutomationEventBus;
  let events: AutomationProgressEvent[];

  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'encodex-runner-branches-'));
    BranchTranscoder.instances = [];
    bus = new AutomationEventBus();
    events = [];
    bus.on('status', (event: AutomationProgressEvent) => events.push(event));
  });

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true });
  });

  function runner(options: { behavior?: BranchTranscoder['behavior']; factoryThrows?: boolean } = {}): AutomationRunner {
    return new AutomationRunner({
      userDataDir,
      eventBus: bus,
      checkBmfAvailability: () => ({ available: true, missing: [] }),
      transcoderFactory: (_type: TranscoderType) => {
        if (options.factoryThrows) throw new Error('factory crashed');
        const transcoder = new BranchTranscoder();
        transcoder.behavior = options.behavior ?? 'succeed';
        return transcoder;
      },
      runIdGenerator: () => 'run-branch',
    });
  }

  it('reports a missing input path as a run failure', async () => {
    expectAppLog('error', 'main/automations/runner');
    const instance = runner();
    instance.start(definition(''));
    await waitFor(() => statuses(events, 'failed').length > 0);
    expect(statuses(events, 'failed')[0].error).toMatch(/input/i);
  });

  it('ignores cancellation before the first step and before execution starts', async () => {
    expectAppLog('warn', 'main/transcoders/bmf-availability');
    let early: AutomationRunner | undefined;
    bus.on('status', (event: AutomationProgressEvent) => {
      if (event.nodeId === '' && event.status === 'queued') early?.cancel('run-early');
    });
    early = new AutomationRunner({
      userDataDir,
      eventBus: bus,
      transcoderFactory: () => new BranchTranscoder(),
      runIdGenerator: () => 'run-early',
    });
    early.start(definition());
    await waitFor(() => statuses(events, 'cancelled').length > 0);
    expect(BranchTranscoder.instances).toHaveLength(0);
  });

  it('cancels remaining steps when cancellation arrives during a step', async () => {
    const instance = runner({ behavior: 'cancel-after-resolve' });
    bus.on('status', (event: AutomationProgressEvent) => {
      if (event.nodeId === 'op-1' && event.status === 'running') instance.cancel('run-branch');
    });

    instance.start(definition());
    await waitFor(() => statuses(events, 'cancelled').length > 0);

    expect(events.some((event) => event.nodeId === 'op-2' && event.status === 'cancelled')).toBe(true);
    expect(BranchTranscoder.instances[0].cancelCount).toBe(0);
  });

  it('treats cancellation error codes as cancellation rather than failure', async () => {
    const instance = runner({ behavior: 'cancelled-error' });
    instance.start(definition());
    await waitFor(() => statuses(events, 'cancelled').length > 0);
    expect(statuses(events, 'failed')).toHaveLength(0);
  });

  it('ignores node and run emissions after the run is terminal', () => {
    const instance = runner();
    const active = {
      runId: 'run-branch',
      automationId: 'auto-branch',
      runDirectory: join(userDataDir, 'run-branch'),
      keepIntermediateFiles: false,
      cancelled: false,
      terminal: true,
    };
    const internals = instance as unknown as {
      emitNode: (run: typeof active, step: { nodeId: string; stageId?: string }, status: AutomationProgressEvent['status']) => void;
      finishRun: (run: typeof active, status: AutomationProgressEvent['status']) => void;
    };
    internals.emitNode(active, { nodeId: 'op-1' }, 'running');
    internals.finishRun(active, 'succeeded');
    expect(events).toHaveLength(0);
  });

  it('cleans up from cancelAll with no active runs', () => {
    expect(runner().cancelAll()).toBe(0);
  });

  it('logs unexpected crashes from the run bootstrap', async () => {
    expectAppLog('error', 'main/automations/runner');
    const instance = runner({ factoryThrows: true });
    instance.start(definition());
    await waitFor(() => statuses(events, 'failed').length > 0);
  });

  it('forwards status, progress, and generic event payloads', () => {
    const send = (() => undefined) as (channel: string, ...args: unknown[]) => void;
    const sent: Array<[string, unknown]> = [];
    const forwarding = (channel: string, ...args: unknown[]) => {
      sent.push([channel, args[0]]);
      send(channel, ...args);
    };
    const instance = runner();
    forwardAutomationEvents(instance, forwarding as never);
    const payload = { runId: 'r', automationId: 'a', nodeId: 'n', status: 'running' as const };

    instance.events.emitStatus(payload);
    instance.events.emitProgress(payload);
    instance.events.emitEvent(payload);

    expect(sent.map(([channel]) => channel)).toEqual([
      IPC.AUTOMATION_STATUS,
      IPC.AUTOMATION_EVENT,
      IPC.AUTOMATION_PROGRESS,
      IPC.AUTOMATION_EVENT,
      IPC.AUTOMATION_EVENT,
      IPC.AUTOMATION_EVENT,
    ]);
  });

  it('rejects inline temp roots through runtime validation', () => {
    const runtime: AutomationRuntime = { inputPath: '/in.mov', tempRoot: '..' };
    expect(() => runner().start(definition(), runtime)).toThrow(/temp root|relative directory/i);
  });

  it('logs crashes thrown from the run bootstrap before the plan body', async () => {
    expectAppLog('error', 'main/automations/runner');
    const crashBus = new ThrowingEventBus((event) => event.nodeId === '' && event.status === 'running');
    const instance = new AutomationRunner({
      userDataDir,
      eventBus: crashBus,
      checkBmfAvailability: () => ({ available: true, missing: [] }),
      transcoderFactory: () => new BranchTranscoder(),
      runIdGenerator: () => 'run-crash',
    });
    const internals = instance as unknown as { activeRuns: Map<string, unknown> };

    instance.start(definition());
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(internals.activeRuns.size).toBe(0);
  });

  it('emits cancellation for the current and remaining steps at the loop boundary', async () => {
    const instance = runner();
    bus.on('status', (event: AutomationProgressEvent) => {
      if (event.nodeId === '' && event.status === 'queued') {
        const active = (instance as unknown as { activeRuns: Map<string, { cancelled: boolean }> }).activeRuns.get('run-branch');
        if (!active) return;
        let reads = 0;
        Object.defineProperty(active, 'cancelled', {
          configurable: true,
          get: () => {
            reads += 1;
            return reads === 2;
          },
          set: () => undefined,
        });
      }
    });

    instance.start(definition());
    await waitFor(() => statuses(events, 'cancelled').some((event) => event.nodeId === ''));

    expect(events.filter((event) => event.status === 'cancelled').map((event) => event.nodeId)).toEqual(['op-1', 'op-2', '']);
    expect(BranchTranscoder.instances).toHaveLength(0);
  });
});
