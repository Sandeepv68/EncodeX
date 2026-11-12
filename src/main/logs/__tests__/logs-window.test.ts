import { describe, it, expect, vi, beforeEach } from 'vitest';

const { BrowserWindowMock, getWindowInstances, appMock, hubSubscribeMock, hubUnsubscribeMock, resetWindowIds } = vi.hoisted(() => {
  const windowInstances: Array<{
    id: number;
    options: Record<string, unknown>;
    loadURL: ReturnType<typeof vi.fn>;
    loadFile: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
    isDestroyed: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    webContents: { id: number; isDestroyed: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> };
  }> = [];
  let nextId = 1;
  let nextWindowId = 1;
  return {
    BrowserWindowMock: vi.fn(function (this: Record<string, unknown>, options: Record<string, unknown>) {
      const self = this;
      self.id = nextWindowId++;
      self.options = options;
      self.loadURL = vi.fn();
      self.loadFile = vi.fn();
      self.focus = vi.fn();
      self.isDestroyed = vi.fn(() => false);
      self.on = vi.fn();
      self.webContents = { id: nextId++, isDestroyed: vi.fn(() => false), send: vi.fn() };
      windowInstances.push(self as never);
    }),
    getWindowInstances: () => windowInstances,
    appMock: { getAppPath: vi.fn(() => 'C:\\project') },
    hubSubscribeMock: vi.fn((_subscriber: unknown) => 1),
    hubUnsubscribeMock: vi.fn(),
    resetWindowIds: () => {
      nextId = 1;
      nextWindowId = 1;
    },
  };
});

vi.mock('electron', () => ({
  BrowserWindow: Object.assign(BrowserWindowMock, { getAllWindows: vi.fn(() => getWindowInstances()) }),
  app: appMock,
}));
vi.mock('../../logs/log-hub', () => ({
  logHub: { subscribe: hubSubscribeMock, unsubscribe: hubUnsubscribeMock },
}));
/**
 * Imports a fresh copy of the logs-window module.
 *
 * The module keeps the open window in module state, so each test needs its own
 * instance to start from a closed window.
 * @returns {Promise<typeof import('../logs-window')>} The module.
 */
async function importModule(): Promise<typeof import('../logs-window')> {
  vi.resetModules();
  return import('../logs-window');
}

describe('logs-window', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWindowInstances().length = 0;
    resetWindowIds();
    delete process.env.NODE_ENV;
    process.argv = ['node', 'app.js'];
  });

  it('opens a window with the real preload and the detached marker', async () => {
    const { openLogsWindow } = await importModule();
    openLogsWindow();
    const win = getWindowInstances()[0];
    expect(win.options).toMatchObject({ title: 'EncodeX - Logs' });
    expect((win.options.webPreferences as { preload: string }).preload).toContain('preload');
    expect(win.loadFile).toHaveBeenCalledWith(
      expect.stringContaining('index.html'),
      expect.objectContaining({ search: '?detached=1', hash: '/logs' }),
    );
  });

  it('subscribes the new window to the log hub', async () => {
    const { openLogsWindow } = await importModule();
    openLogsWindow();
    expect(hubSubscribeMock).toHaveBeenCalledTimes(1);
    expect(hubSubscribeMock.mock.calls[0][0]).toMatchObject({ webContentsId: 1 });
  });

  it('loads the dev server with the detached marker in development', async () => {
    process.env.NODE_ENV = 'development';
    const { openLogsWindow } = await importModule();
    openLogsWindow();
    const win = getWindowInstances()[0];
    expect(win.loadURL).toHaveBeenCalledWith(expect.stringContaining('detached=1'));
    expect(win.loadURL).toHaveBeenCalledWith(expect.stringContaining('#/logs'));
  });

  it('focuses the existing window instead of opening a second one', async () => {
    const { openLogsWindow } = await importModule();
    openLogsWindow();
    const win = getWindowInstances()[0];
    openLogsWindow();
    expect(getWindowInstances()).toHaveLength(1);
    expect(win.focus).toHaveBeenCalled();
  });

  it('reports whether the detached window is open', async () => {
    const { openLogsWindow, isLogsWindowOpen } = await importModule();
    expect(isLogsWindowOpen()).toBe(false);
    openLogsWindow();
    expect(isLogsWindowOpen()).toBe(true);
  });

  it('unsubscribes the window and announces the closed state when it closes', async () => {
    const { openLogsWindow, isLogsWindowOpen } = await importModule();
    openLogsWindow();
    const win = getWindowInstances()[0];
    const closedHandler = win.on.mock.calls.find((call: unknown[]) => call[0] === 'closed')?.[1] as () => void;
    expect(closedHandler).toBeTypeOf('function');
    closedHandler();
    expect(hubUnsubscribeMock).toHaveBeenCalledWith(expect.any(Number));
    expect(isLogsWindowOpen()).toBe(false);
  });

  it('broadcasts the open window id to every window', async () => {
    const { openLogsWindow } = await importModule();
    openLogsWindow();
    const win = getWindowInstances()[0];
    expect(win.webContents.send).toHaveBeenCalledWith('logs-window-state', win.id);
  });

  it('broadcasts the closed state to every window', async () => {
    const { openLogsWindow, broadcastLogsWindowState } = await importModule();
    openLogsWindow();
    const win = getWindowInstances()[0];
    win.webContents.send.mockClear();
    broadcastLogsWindowState(false);
    expect(win.webContents.send).toHaveBeenCalledWith('logs-window-state', null);
  });

  it('broadcasts a clear to every window', async () => {
    const { openLogsWindow, broadcastLogsCleared } = await importModule();
    openLogsWindow();
    const win = getWindowInstances()[0];
    win.webContents.send.mockClear();
    broadcastLogsCleared();
    expect(win.webContents.send).toHaveBeenCalledWith('logs-cleared');
  });

  it('subscribes an ordinary window to the hub and removes it again', async () => {
    const { subscribeWindowToLogHub, unsubscribeWindowFromLogHub } = await importModule();
    const win = {
      isDestroyed: vi.fn(() => false),
      webContents: { id: 42, isDestroyed: vi.fn(() => false), send: vi.fn() },
    };
    const id = subscribeWindowToLogHub(win as never);
    expect(hubSubscribeMock).toHaveBeenCalledWith(expect.objectContaining({ webContentsId: 42 }));
    unsubscribeWindowFromLogHub(id);
    expect(hubUnsubscribeMock).toHaveBeenCalledWith(id);
  });
});
