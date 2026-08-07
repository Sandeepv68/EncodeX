import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { ipcMainMock, getHandleHandlers } = vi.hoisted(() => {
  const handleHandlers: Record<string, (...args: unknown[]) => void> = {};
  return {
    ipcMainMock: {
      handle: vi.fn((channel: string, fn: (...args: unknown[]) => void) => {
        handleHandlers[channel] = fn;
      }),
    },
    getHandleHandlers: () => handleHandlers,
  };
});

const { shellMock } = vi.hoisted(() => ({ shellMock: { showItemInFolder: vi.fn() } }));

vi.mock('electron', () => ({ ipcMain: ipcMainMock, shell: shellMock, BrowserWindow: class {} }));

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
});
