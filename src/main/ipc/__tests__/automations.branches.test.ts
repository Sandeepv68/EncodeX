import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { EventEmitter } from 'events';
import { IPC } from '../../../shared/ipc-channels';
import { AUTOMATION_LIMITS } from '../../../shared/automations/limits';
import type { AutomationDefinition } from '../../../shared/automations/types';

const mocks = vi.hoisted(() => ({
  handlers: {} as Record<string, (event: unknown, ...args: unknown[]) => unknown>,
  showOpenDialog: vi.fn(),
  showSaveDialog: vi.fn(),
  userDataDir: '',
  send: vi.fn(),
  fstatSync: vi.fn(),
  readSync: vi.fn(),
  actualFstatSync: undefined as unknown,
  actualReadSync: undefined as unknown,
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

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  mocks.actualFstatSync = actual.fstatSync;
  mocks.actualReadSync = actual.readSync;
  const mocked = {
    ...actual,
    fstatSync: (...args: Parameters<typeof actual.fstatSync>) => mocks.fstatSync(...args),
    readSync: (...args: Parameters<typeof actual.readSync>) => mocks.readSync(...args),
  };
  return { ...mocked, default: mocked };
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  mocks.actualFstatSync = actual.fstatSync;
  mocks.actualReadSync = actual.readSync;
  const mocked = {
    ...actual,
    fstatSync: (...args: Parameters<typeof actual.fstatSync>) => mocks.fstatSync(...args),
    readSync: (...args: Parameters<typeof actual.readSync>) => mocks.readSync(...args),
  };
  return { ...mocked, default: mocked };
});

class FakeTranscoder {
  emitter = new EventEmitter();
  convert() {
    return this.emitter;
  }
  cancel() {}
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

function definition(id = 'auto-branch'): AutomationDefinition {
  return {
    id,
    name: 'Branch',
    version: 1,
    createdAt: 1000,
    updatedAt: 1000,
    graph: { nodes: [], edges: [] },
    settings: {
      defaultBackend: 'FFMPEG',
      tempDirectoryMode: 'app-data',
      keepIntermediateFiles: false,
      conflictPolicy: 'unique-suffix',
    },
  };
}

describe('automation IPC branch coverage', () => {
  beforeEach(() => {
    mocks.userDataDir = mkdtempSync(join(tmpdir(), 'encodex-automation-ipc-branches-'));
    mocks.handlers = {};
    mocks.showOpenDialog.mockReset();
    mocks.showSaveDialog.mockReset();
    mocks.send.mockReset();
    mocks.fstatSync.mockImplementation(mocks.actualFstatSync as never);
    mocks.readSync.mockImplementation(mocks.actualReadSync as never);
    resetAutomationStore();
    resetAutomationRunner();
    registerAutomationHandlers({} as never, mocks.send as never);
  });

  afterEach(() => {
    rmSync(mocks.userDataDir, { recursive: true, force: true });
  });

  it('rejects import files that are not bounded regular files', async () => {
    const invalidPath = join(mocks.userDataDir, 'directory.json');
    writeFileSync(invalidPath, '{}', 'utf8');
    mocks.fstatSync.mockReturnValue({ isFile: () => false, size: 0 });
    mocks.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [invalidPath] });
    await expect(invoke(IPC.AUTOMATION_IMPORT)).rejects.toMatchObject({
      code: 'INVALID_AUTOMATION_FILE',
      detail: expect.stringContaining('not a bounded regular file'),
    });
    expect(mocks.fstatSync).toHaveBeenCalled();

    mocks.fstatSync.mockReturnValue({ isFile: () => true, size: AUTOMATION_LIMITS.maxFileBytes + 1 });
    await expect(invoke(IPC.AUTOMATION_IMPORT)).rejects.toMatchObject({
      code: 'INVALID_AUTOMATION_FILE',
      detail: expect.stringContaining('not a bounded regular file'),
    });
  });

  it('rejects import files whose read loop ends immediately', async () => {
    const path = join(mocks.userDataDir, 'empty.json');
    writeFileSync(path, '{}', 'utf8');
    mocks.fstatSync.mockReturnValue({ isFile: () => true, size: 2 });
    mocks.readSync.mockReturnValue(0);
    mocks.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [path] });
    await expect(invoke(IPC.AUTOMATION_IMPORT)).rejects.toMatchObject({ code: 'INVALID_AUTOMATION_FILE' });
  });

  it('returns null when exporting an unknown definition', async () => {
    mocks.showSaveDialog.mockResolvedValue({ canceled: false, filePath: join(mocks.userDataDir, 'unused.json') });
    expect(await invoke(IPC.AUTOMATION_EXPORT, 'missing')).toBeNull();
    expect(mocks.showSaveDialog).not.toHaveBeenCalled();
  });

  it('uses the default export filename for hostile names', async () => {
    await invoke(IPC.AUTOMATION_SAVE, definition('auto-name'));
    const saved = definition('auto-name');
    saved.name = '...';
    await invoke(IPC.AUTOMATION_SAVE, saved);
    mocks.showSaveDialog.mockResolvedValue({ canceled: true, filePath: '' });
    expect(await invoke(IPC.AUTOMATION_EXPORT, saved.id)).toBeNull();
    expect(mocks.showSaveDialog.mock.calls[0][1]).toMatchObject({ defaultPath: 'automation.json' });
  });
});
