import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { IPC } from '../../../shared/ipc-channels';
import { createAutomationDefinition } from '../../../shared/automations/defaults';
import type { AutomationDefinition } from '../../../shared/automations/types';

const mocks = vi.hoisted(() => ({
  handlers: {} as Record<string, (event: unknown, ...args: unknown[]) => unknown>,
  showOpenDialog: vi.fn(),
  showSaveDialog: vi.fn(),
  userDataDir: '',
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

const { registerAutomationHandlers, resetAutomationStore } = await import('../automations');

function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = mocks.handlers[channel];
  if (!handler) throw new Error(`missing handler for ${channel}`);
  return Promise.resolve(handler({}, ...args));
}

describe('automation IPC handlers', () => {
  const definition = createAutomationDefinition('auto-1', 'Saved', 1000);

  beforeEach(() => {
    mocks.userDataDir = mkdtempSync(join(tmpdir(), 'encodex-automation-ipc-'));
    mocks.handlers = {};
    mocks.showOpenDialog.mockReset();
    mocks.showSaveDialog.mockReset();
    resetAutomationStore();
    registerAutomationHandlers({} as never);
  });

  afterEach(() => {
    rmSync(mocks.userDataDir, { recursive: true, force: true });
  });

  it('registers only the seven library channels', () => {
    expect(Object.keys(mocks.handlers).sort()).toEqual(
      [
        IPC.AUTOMATION_DELETE,
        IPC.AUTOMATION_DUPLICATE,
        IPC.AUTOMATION_EXPORT,
        IPC.AUTOMATION_GET,
        IPC.AUTOMATION_IMPORT,
        IPC.AUTOMATION_LIST,
        IPC.AUTOMATION_SAVE,
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
});
