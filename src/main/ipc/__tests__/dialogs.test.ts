import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { ipcMainMock, dialogMock, getHandlers } = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
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
    getHandlers: () => handlers,
  };
});

vi.mock('electron', () => ({ ipcMain: ipcMainMock, dialog: dialogMock, BrowserWindow: class {} }));

const { registerDialogHandlers } = await import('../dialogs');
import { IPC } from '../../../shared/ipc-channels';

describe('registerDialogHandlers', () => {
  const win = {} as never;

  beforeEach(() => {
    vi.clearAllMocks();
    registerDialogHandlers(win);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers SELECT_FILE, SELECT_FILES, SELECT_OUTPUT and SELECT_DIRECTORY handlers', () => {
    expect(ipcMainMock.handle).toHaveBeenCalledWith(IPC.SELECT_FILE, expect.any(Function));
    expect(ipcMainMock.handle).toHaveBeenCalledWith(IPC.SELECT_FILES, expect.any(Function));
    expect(ipcMainMock.handle).toHaveBeenCalledWith(IPC.SELECT_OUTPUT, expect.any(Function));
    expect(ipcMainMock.handle).toHaveBeenCalledWith(IPC.SELECT_DIRECTORY, expect.any(Function));
  });

  it('SELECT_FILE returns the selected path', async () => {
    dialogMock.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['in.mp4'] });
    const result = await getHandlers()[IPC.SELECT_FILE]({}, undefined);
    expect(result).toBe('in.mp4');
    expect(dialogMock.showOpenDialog).toHaveBeenCalledWith(win, {
      properties: ['openFile'],
      filters: [{ name: 'Media Files', extensions: expect.arrayContaining(['mp4']) }],
    });
  });

  it('SELECT_FILE uses custom filters when provided', async () => {
    dialogMock.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['in.mp4'] });
    const custom = [{ name: 'Custom', extensions: ['mkv'] }];
    await getHandlers()[IPC.SELECT_FILE]({}, custom);
    expect(dialogMock.showOpenDialog).toHaveBeenCalledWith(win, { properties: ['openFile'], filters: custom });
  });

  it('SELECT_FILE returns null when cancelled', async () => {
    dialogMock.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    expect(await getHandlers()[IPC.SELECT_FILE]({}, undefined)).toBeNull();
  });

  it('SELECT_FILES returns multiple paths', async () => {
    dialogMock.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['a.mp4', 'b.mp4'] });
    const result = await getHandlers()[IPC.SELECT_FILES]({}, undefined);
    expect(result).toEqual(['a.mp4', 'b.mp4']);
    expect(dialogMock.showOpenDialog).toHaveBeenCalledWith(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Media Files', extensions: expect.arrayContaining(['mp4']) }],
    });
  });

  it('SELECT_FILES returns an empty array when cancelled', async () => {
    dialogMock.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    expect(await getHandlers()[IPC.SELECT_FILES]({}, undefined)).toEqual([]);
  });

  it('SELECT_OUTPUT returns the save path', async () => {
    dialogMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: 'out.mp4' });
    const result = await getHandlers()[IPC.SELECT_OUTPUT]();
    expect(result).toBe('out.mp4');
    expect(dialogMock.showSaveDialog).toHaveBeenCalledWith(win, {
      filters: [{ name: 'Media Files', extensions: expect.arrayContaining(['mp4']) }],
    });
  });

  it('SELECT_OUTPUT returns null when cancelled', async () => {
    dialogMock.showSaveDialog.mockResolvedValue({ canceled: true, filePath: '' });
    expect(await getHandlers()[IPC.SELECT_OUTPUT]()).toBeNull();
  });

  it('SELECT_DIRECTORY returns the chosen directory', async () => {
    dialogMock.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/out'] });
    const result = await getHandlers()[IPC.SELECT_DIRECTORY]();
    expect(result).toBe('/out');
    expect(dialogMock.showOpenDialog).toHaveBeenCalledWith(win, {
      properties: ['openDirectory', 'createDirectory'],
    });
  });

  it('SELECT_DIRECTORY returns null when cancelled', async () => {
    dialogMock.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    expect(await getHandlers()[IPC.SELECT_DIRECTORY]()).toBeNull();
  });
});
