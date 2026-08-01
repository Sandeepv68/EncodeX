import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DEV_SERVER_URL, EXIT_CODES, WINDOW_SIZE, SPLASH_SIZE } from '../../shared/app-constants';
import { IPC } from '../../shared/ipc-channels';

const { appMock, getWhenReadyCbs, getAppOnHandlers, BrowserWindowMock, getWindowInstances, runCliMock, registerIpcHandlersMock, menuMock } =
  vi.hoisted(() => {
    const whenReadyCbs: Array<() => void> = [];
    const appOnHandlers: Record<string, (...args: unknown[]) => void> = {};
    const windowInstances: Array<{
      loadURL: ReturnType<typeof vi.fn>;
      loadFile: ReturnType<typeof vi.fn>;
      openDevTools: ReturnType<typeof vi.fn>;
      isDestroyed: ReturnType<typeof vi.fn>;
      show: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
      webContents: { send: ReturnType<typeof vi.fn>; openDevTools: ReturnType<typeof vi.fn> };
      on: ReturnType<typeof vi.fn>;
    }> = [];
    const appMock = {
      whenReady: vi.fn(() => ({
        then: (cb: () => void) => {
          whenReadyCbs.push(cb);
        },
      })),
      getAppPath: vi.fn(() => 'C:\\project'),
      exit: vi.fn(),
      quit: vi.fn(),
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        appOnHandlers[event] = cb;
      }),
    };
    const menuMock = {
      setApplicationMenu: vi.fn(),
    };
    const BrowserWindowMock = vi.fn(function (this: {
      loadURL: ReturnType<typeof vi.fn>;
      loadFile: ReturnType<typeof vi.fn>;
      openDevTools: ReturnType<typeof vi.fn>;
      isDestroyed: ReturnType<typeof vi.fn>;
      show: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
      webContents: { send: ReturnType<typeof vi.fn>; openDevTools: ReturnType<typeof vi.fn> };
      on: ReturnType<typeof vi.fn>;
    }) {
      this.loadURL = vi.fn();
      this.loadFile = vi.fn();
      this.openDevTools = vi.fn();
      this.isDestroyed = vi.fn(() => false);
      this.show = vi.fn();
      this.close = vi.fn();
      this.webContents = { send: vi.fn(), openDevTools: vi.fn() };
      this.on = vi.fn();
      windowInstances.push(this as never);
    });
    return {
      appMock,
      BrowserWindowMock: BrowserWindowMock,
      getWhenReadyCbs: () => whenReadyCbs,
      getAppOnHandlers: () => appOnHandlers,
      getWindowInstances: () => windowInstances,
      runCliMock: vi.fn(),
      registerIpcHandlersMock: vi.fn(),
      menuMock,
    };
  });

vi.mock('electron', () => ({ app: appMock, BrowserWindow: BrowserWindowMock, Menu: menuMock }));
vi.mock('../cli', () => ({ runCli: runCliMock }));
vi.mock('../ipc/handlers', () => ({ registerIpcHandlers: registerIpcHandlersMock }));

const ORIGINAL_ARGV = process.argv;
const ORIGINAL_PLATFORM = process.platform;
const ORIGINAL_LOG = console.log;
const ORIGINAL_WARN = console.warn;
const ORIGINAL_ERROR = console.error;

const getMainWindows = () => registerIpcHandlersMock.mock.calls.map((call) => call[0]);

describe('main/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWhenReadyCbs().length = 0;
    getWindowInstances().length = 0;
    delete getAppOnHandlers()['window-all-closed'];
    delete getAppOnHandlers()['activate'];
    runCliMock.mockResolvedValue(undefined);
    Object.defineProperty(process, 'platform', { value: 'win32' });
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.argv = ORIGINAL_ARGV;
    delete process.env.NODE_ENV;
    Object.defineProperty(process, 'platform', { value: ORIGINAL_PLATFORM });
    console.log = ORIGINAL_LOG;
    console.warn = ORIGINAL_WARN;
    console.error = ORIGINAL_ERROR;
    vi.resetModules();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('runs the CLI and exits with success in CLI mode', async () => {
    process.argv = ['node', 'C:\\project\\index.js', '--cli'];
    await import('../index');
    expect(appMock.whenReady).toHaveBeenCalled();
    getWhenReadyCbs()[0]();
    await vi.waitFor(() => expect(appMock.exit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS));
    expect(runCliMock).toHaveBeenCalled();
  });

  it('exits with an error when the CLI fails', async () => {
    process.argv = ['node', 'C:\\project\\index.js', '--cli'];
    runCliMock.mockRejectedValue(new Error('cli boom'));
    await import('../index');
    getWhenReadyCbs()[0]();
    await vi.waitFor(() => expect(appMock.exit).toHaveBeenCalledWith(EXIT_CODES.ERROR));
  });

  it('creates a production window and registers IPC handlers', async () => {
    process.argv = ['node', 'x.js'];
    await import('../index');
    expect(appMock.whenReady).toHaveBeenCalled();
    getWhenReadyCbs()[0]();
    const win = getMainWindows()[0];
    expect(menuMock.setApplicationMenu).toHaveBeenCalledWith(null);
    expect(BrowserWindowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        width: WINDOW_SIZE.WIDTH,
        height: WINDOW_SIZE.HEIGHT,
        title: 'EncodeX',
        frame: false,
      }),
    );
    expect(registerIpcHandlersMock).toHaveBeenCalledWith(win);
    expect(win.loadFile).toHaveBeenCalledWith(expect.stringContaining('index.html'));
    expect(win.loadURL).not.toHaveBeenCalled();
  });

  it('shows a splash window that loads the splash image', async () => {
    process.argv = ['node', 'x.js'];
    await import('../index');
    getWhenReadyCbs()[0]();
    expect(BrowserWindowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        width: SPLASH_SIZE.WIDTH,
        height: SPLASH_SIZE.HEIGHT,
        frame: false,
        skipTaskbar: true,
        alwaysOnTop: true,
      }),
    );
    const splash = getWindowInstances()[0];
    expect(splash.loadFile).toHaveBeenCalledWith(expect.stringContaining('splash_screen.png'));
  });

  it('shows the main window and closes the splash when ready', async () => {
    process.argv = ['node', 'x.js'];
    await import('../index');
    getWhenReadyCbs()[0]();
    const splash = getWindowInstances()[0];
    const win = getMainWindows()[0];
    const readyCb = win.on.mock.calls.find(([event]) => event === 'ready-to-show')?.[1] as () => void;
    readyCb();
    expect(win.show).toHaveBeenCalled();
    expect(splash.close).toHaveBeenCalled();
  });

  it('loads the dev server URL in development mode', async () => {
    process.argv = ['node', 'x.js'];
    process.env.NODE_ENV = 'development';
    await import('../index');
    getWhenReadyCbs()[0]();
    const win = getMainWindows()[0];
    expect(win.loadURL).toHaveBeenCalledWith(DEV_SERVER_URL);
    expect(win.webContents.openDevTools).toHaveBeenCalled();
  });

  it('patches console to forward log messages to the window', async () => {
    process.argv = ['node', 'x.js'];
    await import('../index');
    getWhenReadyCbs()[0]();
    const win = getMainWindows()[0];
    console.log('hello');
    expect(win.webContents.send).toHaveBeenCalledWith(
      IPC.LOG_MESSAGE,
      expect.objectContaining({ level: 'INFO', text: 'hello', source: 'main' }),
    );
    win.webContents.send.mockClear();
    console.warn({ a: 1 });
    expect(win.webContents.send).toHaveBeenCalledWith(
      IPC.LOG_MESSAGE,
      expect.objectContaining({ level: 'WARN', text: '{"a":1}', source: 'main' }),
    );
    win.webContents.send.mockClear();
    console.error('boom');
    expect(win.webContents.send).toHaveBeenCalledWith(
      IPC.LOG_MESSAGE,
      expect.objectContaining({ level: 'ERROR', text: 'boom', source: 'main' }),
    );
  });

  it('skips forwarding when the window is destroyed', async () => {
    process.argv = ['node', 'x.js'];
    await import('../index');
    getWhenReadyCbs()[0]();
    const win = getMainWindows()[0];
    win.isDestroyed.mockReturnValue(true);
    win.webContents.send.mockClear();
    console.log('hello');
    expect(win.webContents.send).not.toHaveBeenCalled();
  });

  it('recreates the window on activate after it was closed', async () => {
    process.argv = ['node', 'x.js'];
    await import('../index');
    getWhenReadyCbs()[0]();
    const win = getMainWindows()[0];
    const closedCb = win.on.mock.calls.find(([event]) => event === 'closed')?.[1] as () => void;
    closedCb();
    getAppOnHandlers()['activate']();
    expect(getMainWindows()).toHaveLength(2);
  });

  it('quits on window-all-closed on non-darwin platforms', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    process.argv = ['node', 'x.js'];
    await import('../index');
    getAppOnHandlers()['window-all-closed']();
    expect(appMock.quit).toHaveBeenCalled();
  });

  it('does not quit on window-all-closed on darwin', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    process.argv = ['node', 'x.js'];
    await import('../index');
    getAppOnHandlers()['window-all-closed']();
    expect(appMock.quit).not.toHaveBeenCalled();
  });
});
