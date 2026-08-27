import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { checkForUpdateMock, downloadUpdateMock, installUpdateMock, cancelDownloadMock, openReleaseNotesMock } = vi.hoisted(() => ({
  checkForUpdateMock: vi.fn(),
  downloadUpdateMock: vi.fn(),
  installUpdateMock: vi.fn(),
  cancelDownloadMock: vi.fn(),
  openReleaseNotesMock: vi.fn(),
}));

const { handleSpy, ipcMainMock, winMock } = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const handleSpy = vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
    handlers.set(channel, handler);
  });
  const getHandler = (channel: string) => handlers.get(channel);
  const ipcMainMock = { handle: handleSpy, _getHandler: getHandler, _handlers: handlers };
  const winMock = {
    isDestroyed: vi.fn(() => false),
    webContents: { send: vi.fn() },
  };
  return { handleSpy, ipcMainMock, winMock };
});

vi.mock('electron', () => ({ ipcMain: ipcMainMock, BrowserWindow: class {} }));
vi.mock('../../updater', () => ({
  checkForUpdate: checkForUpdateMock,
  downloadUpdate: downloadUpdateMock,
  installUpdate: installUpdateMock,
  cancelDownload: cancelDownloadMock,
  openReleaseNotes: openReleaseNotesMock,
}));

import { IPC } from '../../../shared/ipc-channels';

describe('registerUpdaterHandlers', () => {
  let registerUpdaterHandlers: (win: never) => void;

  async function freshModule() {
    vi.resetModules();
    const mod = await import('../updater');
    return mod.registerUpdaterHandlers;
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    winMock.isDestroyed.mockReturnValue(false);
    winMock.webContents.send.mockClear();
    ipcMainMock._handlers.clear();
    registerUpdaterHandlers = await freshModule();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers five IPC handlers', () => {
    registerUpdaterHandlers(winMock as never);
    expect(handleSpy).toHaveBeenCalledTimes(5);
    const channels = Array.from(ipcMainMock._handlers.keys());
    expect(channels).toContain(IPC.CHECK_FOR_UPDATES);
    expect(channels).toContain(IPC.DOWNLOAD_UPDATE);
    expect(channels).toContain(IPC.INSTALL_UPDATE);
    expect(channels).toContain(IPC.CANCEL_DOWNLOAD);
    expect(channels).toContain(IPC.OPEN_RELEASE_NOTES);
  });

  describe('CHECK_FOR_UPDATES handler', () => {
    it('sends UPDATE_AVAILABLE when a newer version exists', async () => {
      registerUpdaterHandlers(winMock as never);
      const info = {
        version: '2.0.0',
        releaseNotes: 'notes',
        releaseUrl: 'https://',
        asset: { name: 'app.exe', url: 'https://', size: 100 },
      };
      checkForUpdateMock.mockResolvedValue(info);

      await ipcMainMock._getHandler(IPC.CHECK_FOR_UPDATES)!();

      expect(winMock.webContents.send).toHaveBeenCalledWith(IPC.UPDATE_AVAILABLE, info);
    });

    it('sends UPDATE_NOT_AVAILABLE when no update found', async () => {
      registerUpdaterHandlers(winMock as never);
      checkForUpdateMock.mockResolvedValue(null);

      await ipcMainMock._getHandler(IPC.CHECK_FOR_UPDATES)!();

      expect(winMock.webContents.send).toHaveBeenCalledWith(IPC.UPDATE_NOT_AVAILABLE);
    });

    it('sends UPDATE_ERROR when checkForUpdate throws', async () => {
      registerUpdaterHandlers(winMock as never);
      checkForUpdateMock.mockRejectedValue(new Error('network fail'));

      await ipcMainMock._getHandler(IPC.CHECK_FOR_UPDATES)!();

      expect(winMock.webContents.send).toHaveBeenCalledWith(IPC.UPDATE_ERROR, 'network fail');
    });

    it('does not send when window is destroyed', async () => {
      registerUpdaterHandlers(winMock as never);
      winMock.isDestroyed.mockReturnValue(true);
      checkForUpdateMock.mockResolvedValue(null);

      await ipcMainMock._getHandler(IPC.CHECK_FOR_UPDATES)!();

      expect(winMock.webContents.send).not.toHaveBeenCalled();
      winMock.isDestroyed.mockReturnValue(false);
    });
  });

  describe('DOWNLOAD_UPDATE handler', () => {
    it('downloads and sends UPDATE_DOWNLOADED', async () => {
      registerUpdaterHandlers(winMock as never);

      const info = { version: '2.0.0', releaseNotes: '', releaseUrl: 'https://', asset: { name: 'app.exe', url: 'https://', size: 100 } };
      checkForUpdateMock.mockResolvedValue(info);
      await ipcMainMock._getHandler(IPC.CHECK_FOR_UPDATES)!();
      winMock.webContents.send.mockClear();

      downloadUpdateMock.mockResolvedValue('/tmp/app.exe');
      await ipcMainMock._getHandler(IPC.DOWNLOAD_UPDATE)!();

      expect(downloadUpdateMock).toHaveBeenCalledWith(info, winMock);
      expect(winMock.webContents.send).toHaveBeenCalledWith(IPC.UPDATE_DOWNLOADED, '/tmp/app.exe');
    });

    it('sends UPDATE_ERROR when download throws', async () => {
      registerUpdaterHandlers(winMock as never);

      const info = { version: '2.0.0', releaseNotes: '', releaseUrl: 'https://', asset: { name: 'app.exe', url: 'https://', size: 100 } };
      checkForUpdateMock.mockResolvedValue(info);
      await ipcMainMock._getHandler(IPC.CHECK_FOR_UPDATES)!();
      winMock.webContents.send.mockClear();

      downloadUpdateMock.mockRejectedValue(new Error('download fail'));
      await ipcMainMock._getHandler(IPC.DOWNLOAD_UPDATE)!();

      expect(winMock.webContents.send).toHaveBeenCalledWith(IPC.UPDATE_ERROR, 'download fail');
    });

    it('does not send when window is destroyed during download', async () => {
      registerUpdaterHandlers(winMock as never);

      const info = { version: '2.0.0', releaseNotes: '', releaseUrl: 'https://', asset: { name: 'app.exe', url: 'https://', size: 100 } };
      checkForUpdateMock.mockResolvedValue(info);
      await ipcMainMock._getHandler(IPC.CHECK_FOR_UPDATES)!();
      winMock.webContents.send.mockClear();

      downloadUpdateMock.mockResolvedValue('/tmp/app.exe');
      winMock.isDestroyed.mockReturnValue(true);
      await ipcMainMock._getHandler(IPC.DOWNLOAD_UPDATE)!();

      expect(winMock.webContents.send).not.toHaveBeenCalledWith(IPC.UPDATE_DOWNLOADED, expect.anything());
      winMock.isDestroyed.mockReturnValue(false);
    });

    it('sends UPDATE_ERROR when no cached info exists', async () => {
      registerUpdaterHandlers(winMock as never);
      // Do NOT call CHECK_FOR_UPDATES first, so cachedUpdateInfo is null

      await ipcMainMock._getHandler(IPC.DOWNLOAD_UPDATE)!();

      expect(winMock.webContents.send).toHaveBeenCalledWith(IPC.UPDATE_ERROR, 'No update info available. Run check-for-updates first.');
      expect(downloadUpdateMock).not.toHaveBeenCalled();
    });
  });

  describe('INSTALL_UPDATE handler', () => {
    it('calls installUpdate with the path', async () => {
      registerUpdaterHandlers(winMock as never);
      installUpdateMock.mockResolvedValue(undefined);

      await ipcMainMock._getHandler(IPC.INSTALL_UPDATE)!({}, '/tmp/app.exe');

      expect(installUpdateMock).toHaveBeenCalledWith('/tmp/app.exe');
    });

    it('sends UPDATE_ERROR when installUpdate throws', async () => {
      registerUpdaterHandlers(winMock as never);
      installUpdateMock.mockRejectedValue(new Error('install fail'));

      await ipcMainMock._getHandler(IPC.INSTALL_UPDATE)!({}, '/tmp/app.exe');

      expect(winMock.webContents.send).toHaveBeenCalledWith(IPC.UPDATE_ERROR, 'install fail');
    });
  });

  describe('CANCEL_DOWNLOAD handler', () => {
    it('calls cancelDownload', async () => {
      registerUpdaterHandlers(winMock as never);
      await ipcMainMock._getHandler(IPC.CANCEL_DOWNLOAD)!();
      expect(cancelDownloadMock).toHaveBeenCalledOnce();
    });
  });

  describe('OPEN_RELEASE_NOTES handler', () => {
    it('calls openReleaseNotes with the url', async () => {
      registerUpdaterHandlers(winMock as never);
      openReleaseNotesMock.mockResolvedValue(undefined);
      await ipcMainMock._getHandler(IPC.OPEN_RELEASE_NOTES)!({}, 'https://github.com/releases');
      expect(openReleaseNotesMock).toHaveBeenCalledWith('https://github.com/releases');
    });

    it('logs error when openReleaseNotes throws', async () => {
      registerUpdaterHandlers(winMock as never);
      openReleaseNotesMock.mockRejectedValue(new Error('open fail'));
      await expect(ipcMainMock._getHandler(IPC.OPEN_RELEASE_NOTES)!({}, 'https://bad')).resolves.toBeUndefined();
    });
  });
});
