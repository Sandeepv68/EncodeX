import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { EventEmitter } from 'events';
import { IPC } from '../../../shared/ipc-channels';
import { createAutomationDefinition, createAutomationEdge, createAutomationNode } from '../../../shared/automations/defaults';
import { expectAppLog } from '../../../test-utils/crash-tripwire';
import type { AutomationDefinition } from '../../../shared/automations/types';

const mocks = vi.hoisted(() => ({
  handlers: {} as Record<string, (event: unknown, ...args: unknown[]) => unknown>,
  showOpenDialog: vi.fn(),
  showSaveDialog: vi.fn(),
  userDataDir: '',
  send: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { getPath: () => mocks.userDataDir },
  dialog: { showOpenDialog: mocks.showOpenDialog, showSaveDialog: mocks.showSaveDialog },
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, ...args: unknown[]) => unknown) => {
      mocks.handlers[channel] = handler;
    },
  },
}));

class FakeTranscoder {
  static behavior: 'succeed' | 'fail' = 'succeed';
  static instances: FakeTranscoder[] = [];
  emitter = new EventEmitter();
  cancelled = false;
  convert(_input: string, _output: string, _options: unknown) {
    FakeTranscoder.instances.push(this);
    queueMicrotask(() => {
      this.emitter.emit('progress', { percent: 50, time: '00:01', fps: 1, speed: '1x', eta: '0', bitrate: '1k' });
      if (FakeTranscoder.behavior === 'fail') this.emitter.emit('error', new Error('boom'));
      else this.emitter.emit('end');
    });
    return this.emitter;
  }
  cancel() {
    this.cancelled = true;
    this.emitter.emit('error', Object.assign(new Error('cancelled'), { code: 'CANCELLED' }));
  }
  pause() {}
  resume() {}
  getType() {
    return 'FFMPEG';
  }
  async getInfo() {
    throw new Error('unused');
  }
}

vi.mock('../../transcoders/factory', () => ({
  createTranscoder: () => new FakeTranscoder(),
}));

const { registerAutomationHandlers, resetAutomationStore, resetAutomationRunner } = await import('../automations');

function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = mocks.handlers[channel];
  if (!handler) throw new Error(`missing handler for ${channel}`);
  return Promise.resolve(handler({}, ...args));
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

function runnableDefinition(id = 'auto-1'): AutomationDefinition {
  return createAutomationDefinition(id, 'Run', 1000, {
    graph: {
      nodes: [
        createAutomationNode('in', 'input', { x: 0, y: 0 }, { data: { kind: 'input', path: 'C:/in.mov' } }),
        createAutomationNode('op', 'transcode', { x: 1, y: 0 }, { data: { kind: 'transcode', options: { videoCodec: 'libx264' } } }),
        createAutomationNode('out', 'output', { x: 2, y: 0 }, { data: { kind: 'output', path: 'C:/out.mp4' } }),
      ],
      edges: [createAutomationEdge('in', 'op'), createAutomationEdge('op', 'out')],
    },
  });
}

describe('automation IPC handlers', () => {
  const definition = createAutomationDefinition('auto-1', 'Saved', 1000);

  beforeEach(() => {
    mocks.userDataDir = mkdtempSync(join(tmpdir(), 'encodex-automation-ipc-'));
    mocks.handlers = {};
    mocks.showOpenDialog.mockReset();
    mocks.showSaveDialog.mockReset();
    mocks.send.mockReset();
    FakeTranscoder.behavior = 'succeed';
    FakeTranscoder.instances = [];
    resetAutomationStore();
    resetAutomationRunner();
    registerAutomationHandlers({} as never, mocks.send as never);
  });

  afterEach(() => {
    rmSync(mocks.userDataDir, { recursive: true, force: true });
  });

  it('registers library and runtime channels', () => {
    expect(Object.keys(mocks.handlers).sort()).toEqual(
      [
        IPC.AUTOMATION_CANCEL,
        IPC.AUTOMATION_DELETE,
        IPC.AUTOMATION_DUPLICATE,
        IPC.AUTOMATION_EXPORT,
        IPC.AUTOMATION_GET,
        IPC.AUTOMATION_IMPORT,
        IPC.AUTOMATION_LIST,
        IPC.AUTOMATION_SAVE,
        IPC.AUTOMATION_START,
      ].sort(),
    );
  });

  it('performs the full list/get/save/duplicate/delete round trip', async () => {
    expect(await invoke(IPC.AUTOMATION_LIST)).toEqual([]);
    expect(await invoke(IPC.AUTOMATION_GET, definition.id)).toBeNull();

    const saved = (await invoke(IPC.AUTOMATION_SAVE, definition)) as AutomationDefinition;
    expect(saved).toEqual(definition);
    expect(await invoke(IPC.AUTOMATION_LIST)).toEqual([definition]);
    expect(await invoke(IPC.AUTOMATION_GET, definition.id)).toEqual(definition);

    const copy = (await invoke(IPC.AUTOMATION_DUPLICATE, { id: definition.id })) as AutomationDefinition;
    expect(copy.id).not.toBe(definition.id);
    expect(copy.name).toBe('Saved (Copy)');
    expect(await invoke(IPC.AUTOMATION_DELETE, definition.id)).toBe(true);
    expect(await invoke(IPC.AUTOMATION_DELETE, definition.id)).toBe(false);
  });

  it('rejects hostile arguments as AppErrors rather than raw engine errors', async () => {
    const hostile: Array<[string, unknown[]]> = [
      [IPC.AUTOMATION_GET, [{}]],
      [IPC.AUTOMATION_SAVE, [null]],
      [IPC.AUTOMATION_SAVE, [{ ...definition, name: { toString: null } }]],
      [IPC.AUTOMATION_DELETE, [42]],
      [IPC.AUTOMATION_DUPLICATE, [{ id: 'auto-1', admin: true }]],
      [IPC.AUTOMATION_EXPORT, [[]]],
      [IPC.AUTOMATION_START, [{ definition: null }]],
      [IPC.AUTOMATION_CANCEL, [{ runId: 1 }]],
    ];
    for (const [channel, args] of hostile) {
      await expect(invoke(channel, ...args)).rejects.toMatchObject({ name: 'AppError' });
    }
  });

  it('returns null when a native file dialog is cancelled', async () => {
    mocks.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    mocks.showSaveDialog.mockResolvedValue({ canceled: true, filePath: '' });
    await invoke(IPC.AUTOMATION_SAVE, definition);
    expect(await invoke(IPC.AUTOMATION_IMPORT)).toBeNull();
    expect(await invoke(IPC.AUTOMATION_EXPORT, definition.id)).toBeNull();
  });

  it('exports and re-imports a definition through native dialogs', async () => {
    await invoke(IPC.AUTOMATION_SAVE, definition);
    const exportPath = join(mocks.userDataDir, 'exported.json');
    mocks.showSaveDialog.mockResolvedValue({ canceled: false, filePath: exportPath });
    expect(await invoke(IPC.AUTOMATION_EXPORT, definition.id)).toBe(exportPath);

    expect(await invoke(IPC.AUTOMATION_DELETE, definition.id)).toBe(true);
    mocks.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [exportPath] });
    const imported = (await invoke(IPC.AUTOMATION_IMPORT)) as AutomationDefinition;
    expect(imported).toEqual(definition);
    expect(await invoke(IPC.AUTOMATION_GET, definition.id)).toEqual(definition);
  });

  it('rejects an invalid import file with INVALID_AUTOMATION_FILE', async () => {
    const badPath = join(mocks.userDataDir, 'bad.json');
    writeFileSync(badPath, '{ broken', 'utf8');
    mocks.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [badPath] });
    await expect(invoke(IPC.AUTOMATION_IMPORT)).rejects.toMatchObject({ code: 'INVALID_AUTOMATION_FILE' });
  });

  it('starts and cancels runs and forwards events through send', async () => {
    expectAppLog('warn', 'main/transcoders/bmf-availability');
    const runId = (await invoke(IPC.AUTOMATION_START, {
      definition: runnableDefinition(),
      runtime: { tempRoot: 'tmp' },
    })) as string;
    expect(typeof runId).toBe('string');
    await waitFor(() => mocks.send.mock.calls.some(([channel]) => channel === IPC.AUTOMATION_STATUS));
    expect(mocks.send.mock.calls.some(([channel]) => channel === IPC.AUTOMATION_PROGRESS)).toBe(true);
    expect(mocks.send.mock.calls.some(([channel]) => channel === IPC.AUTOMATION_EVENT)).toBe(true);

    const cancelResult = await invoke(IPC.AUTOMATION_CANCEL, { runId });
    expect(typeof cancelResult).toBe('boolean');
  });
});
