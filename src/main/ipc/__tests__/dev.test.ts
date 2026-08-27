import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mkdirSyncSpy, writeFileSyncSpy, existsSyncSpy } = vi.hoisted(() => ({
  mkdirSyncSpy: vi.fn(),
  writeFileSyncSpy: vi.fn(),
  existsSyncSpy: vi.fn(() => true),
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
    webContents: {
      capturePage: vi.fn().mockResolvedValue({ toPNG: () => Buffer.from('png-data') }),
    },
  };
  return { handleSpy, ipcMainMock, winMock, mkdirSyncSpy, writeFileSyncSpy, existsSyncSpy };
});

vi.mock('electron', () => ({ ipcMain: ipcMainMock, BrowserWindow: class {} }));
vi.mock('fs', () => ({
  existsSync: existsSyncSpy,
  mkdirSync: mkdirSyncSpy,
  writeFileSync: writeFileSyncSpy,
}));

const { registerDevHandlers, isDevMode } = await import('../dev');
import { IPC } from '../../../shared/ipc-channels';

describe('isDevMode', () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
  const ORIGINAL_ARGV = [...process.argv];

  afterEach(() => {
    if (ORIGINAL_NODE_ENV === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    }
    process.argv = ORIGINAL_ARGV;
  });

  it('returns true when NODE_ENV is development', () => {
    process.env.NODE_ENV = 'development';
    expect(isDevMode()).toBe(true);
  });

  it('returns true when --dev flag is present', () => {
    process.env.NODE_ENV = 'production';
    process.argv = [...ORIGINAL_ARGV, '--dev'];
    expect(isDevMode()).toBe(true);
  });

  it('returns false in production without --dev', () => {
    process.env.NODE_ENV = 'production';
    process.argv = ORIGINAL_ARGV.filter(a => a !== '--dev');
    expect(isDevMode()).toBe(false);
  });
});

describe('registerDevHandlers', () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
  const ORIGINAL_ARGV = [...process.argv];

  beforeEach(() => {
    vi.clearAllMocks();
    ipcMainMock._handlers.clear();
    winMock.isDestroyed.mockReturnValue(false);
    winMock.webContents.capturePage.mockResolvedValue({ toPNG: () => Buffer.from('png-data') });
    process.argv = ORIGINAL_ARGV.filter(a => a !== '--dev');
  });

  afterEach(() => {
    if (ORIGINAL_NODE_ENV === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    }
    process.argv = ORIGINAL_ARGV;
    vi.restoreAllMocks();
  });

  it('does not register handlers when not in dev mode', () => {
    process.env.NODE_ENV = 'production';
    registerDevHandlers(winMock as never);
    expect(handleSpy).not.toHaveBeenCalled();
  });

  it('registers the DEV_CAPTURE_SCREENSHOT handler in dev mode', () => {
    process.env.NODE_ENV = 'development';
    registerDevHandlers(winMock as never);
    expect(handleSpy).toHaveBeenCalledWith(IPC.DEV_CAPTURE_SCREENSHOT, expect.any(Function));
  });

  it('captures page and writes PNG file', async () => {
    process.env.NODE_ENV = 'development';
    registerDevHandlers(winMock as never);

    const handler = ipcMainMock._getHandler(IPC.DEV_CAPTURE_SCREENSHOT)!;
    const result = await handler();

    expect(winMock.webContents.capturePage).toHaveBeenCalledOnce();
    expect(mkdirSyncSpy).toHaveBeenCalled();
    expect(writeFileSyncSpy).toHaveBeenCalled();
    expect(typeof result).toBe('string');
    expect(result).toContain('encodex-dev-');
    expect(result).toContain('.png');
  });

  it('throws when window is destroyed', async () => {
    process.env.NODE_ENV = 'development';
    winMock.isDestroyed.mockReturnValue(true);
    registerDevHandlers(winMock as never);

    const handler = ipcMainMock._getHandler(IPC.DEV_CAPTURE_SCREENSHOT)!;
    await expect(handler()).rejects.toThrow('Cannot capture screenshot: main window is destroyed');
  });

  it('formats timestamp correctly', async () => {
    process.env.NODE_ENV = 'development';
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 24, 14, 5, 3));

    registerDevHandlers(winMock as never);
    const handler = ipcMainMock._getHandler(IPC.DEV_CAPTURE_SCREENSHOT)!;
    const result = await handler();

    expect(result).toContain('encodex-dev-20260824-140503');
    vi.useRealTimers();
  });
});
