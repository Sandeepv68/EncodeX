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
import { expectAppLog } from '../../../test-utils/crash-tripwire';

describe('registerSystemHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The launch-at-login handler is a no-op on Linux (no login-items API),
    // but CI runs on ubuntu-latest, so pin the platform for these tests.
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
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

  it('REVEAL_FILE ignores a payload that is not a usable string instead of crashing the handler', async () => {
    expectAppLog('warn', 'main/ipc/system');

    // Found by `e2e/specs/ipc-abuse.spec.ts`: every one of these reached `shell.showItemInFolder`
    // and made Electron throw a raw `TypeError: Argument must be a string`, so the renderer's
    // promise rejected with a crash signature instead of a formatted AppError.
    registerSystemHandlers({} as never);
    for (const hostile of [10n ** 30n, 0, NaN, null, undefined, true, { path: '/out/a.mp4' }, ['/out/a.mp4'], '', '   ']) {
      vi.clearAllMocks();
      await expect(getHandleHandlers()[IPC.REVEAL_FILE]({}, hostile)).resolves.toBeUndefined();
      expect(shellMock.showItemInFolder, `payload ${String(hostile)} must not reach the OS`).not.toHaveBeenCalled();
    }
  });

  it('REVEAL_FILE ignores a string too long to be a path', async () => {
    expectAppLog('warn', 'main/ipc/system');

    // A type check alone does not stop this one: a megabyte-long string *is* a string, it is
    // simply not a path, and the OS layer still has to hold and reject it.
    registerSystemHandlers({} as never);
    vi.clearAllMocks();
    await expect(getHandleHandlers()[IPC.REVEAL_FILE]({}, 'x'.repeat(1024 * 1024))).resolves.toBeUndefined();
    expect(shellMock.showItemInFolder).not.toHaveBeenCalled();
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

  it('SET_LAUNCH_AT_LOGIN is ignored on Linux', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    registerSystemHandlers({} as never);
    getOnHandlers()[IPC.SET_LAUNCH_AT_LOGIN]({}, true);
    expect(appMock.setLoginItemSettings).not.toHaveBeenCalled();
  });
});
