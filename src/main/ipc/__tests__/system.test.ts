import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { ipcMainMock, getHandleHandlers, getOnHandlers } = vi.hoisted(() => {
  const handleHandlers: Record<string, (...args: unknown[]) => void> = {};
  const onHandlers: Record<string, (...args: unknown[]) => void> = {};
  return {
    ipcMainMock: {
      handle: vi.fn((channel: string, fn: (...args: unknown[]) => void) => {
        handleHandlers[channel] = fn;
      }),
      on: vi.fn((channel: string, fn: (...args: unknown[]) => void) => {
        onHandlers[channel] = fn;
      }),
    },
    getHandleHandlers: () => handleHandlers,
    getOnHandlers: () => onHandlers,
  };
});

const { shellMock } = vi.hoisted(() => ({ shellMock: { showItemInFolder: vi.fn() } }));

const { appMock } = vi.hoisted(() => ({
  appMock: { getLoginItemSettings: vi.fn(), setLoginItemSettings: vi.fn() },
}));

vi.mock('electron', () => ({ ipcMain: ipcMainMock, shell: shellMock, app: appMock, BrowserWindow: class {} }));

const { registerSystemHandlers } = await import('../system');
import { IPC } from '../../../shared/ipc-channels';

describe('registerSystemHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers the REVEAL_FILE handler', () => {
    registerSystemHandlers({} as never);
    expect(ipcMainMock.handle).toHaveBeenCalledWith(IPC.REVEAL_FILE, expect.any(Function));
  });

  it('REVEAL_FILE reveals the requested path in the file manager', async () => {
    registerSystemHandlers({} as never);
    await getHandleHandlers()[IPC.REVEAL_FILE]({}, '/out/video_converted.mp4');
    expect(shellMock.showItemInFolder).toHaveBeenCalledWith('/out/video_converted.mp4');
  });

  it('registers the SET_LAUNCH_AT_LOGIN handler', () => {
    registerSystemHandlers({} as never);
    expect(ipcMainMock.on).toHaveBeenCalledWith(IPC.SET_LAUNCH_AT_LOGIN, expect.any(Function));
  });

  it('SET_LAUNCH_AT_LOGIN registers the app in the OS login items', () => {
    registerSystemHandlers({} as never);
    getOnHandlers()[IPC.SET_LAUNCH_AT_LOGIN]({}, true);
    expect(appMock.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true });
  });

  it('SET_LAUNCH_AT_LOGIN removes the app from the OS login items', () => {
    registerSystemHandlers({} as never);
    getOnHandlers()[IPC.SET_LAUNCH_AT_LOGIN]({}, false);
    expect(appMock.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: false });
  });
});
