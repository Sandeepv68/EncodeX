import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DEV_SERVER_URL, EXIT_CODES, WINDOW_SIZE, SPLASH_SIZE } from '../../shared/app-constants';
import { IPC } from '../../shared/ipc-channels';
import type { McpSettings } from '../../shared/mcp-settings';
import { expectAppLog, expectCrash, getAppLogs } from '../../test-utils/crash-tripwire';

const {
  appMock,
  getWhenReadyCbs,
  getAppOnHandlers,
  BrowserWindowMock,
  getWindowInstances,
  runCliMock,
  registerIpcHandlersMock,
  menuMock,
  shellMock,
  aptabaseMainMock,
  sessionMock,
  runMcpServerMock,
  registerMcpSettingsIpcMock,
  startMcpHttpServerMock,
  getMcpHandles,
  createMcpServerMock,
  registerGuiToolsMock,
  MCPJobManagerMock,
} = vi.hoisted(() => {
  const whenReadyCbs: Array<() => void> = [];
  const appOnHandlers: Record<string, (...args: unknown[]) => void> = {};
  /** Handles handed out by the `startMcpHttpServer` stub, oldest first. */
  const mcpHandles: Array<{ close: ReturnType<typeof vi.fn> }> = [];
  const windowInstances: Array<{
    loadURL: ReturnType<typeof vi.fn>;
    loadFile: ReturnType<typeof vi.fn>;
    openDevTools: ReturnType<typeof vi.fn>;
    isDestroyed: ReturnType<typeof vi.fn>;
    show: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    webContents: {
      send: ReturnType<typeof vi.fn>;
      openDevTools: ReturnType<typeof vi.fn>;
      setWindowOpenHandler: ReturnType<typeof vi.fn>;
      on: ReturnType<typeof vi.fn>;
      once: ReturnType<typeof vi.fn>;
    };
    onceHandlers: Record<string, (...args: unknown[]) => void>;
    on: ReturnType<typeof vi.fn>;
  }> = [];
  const appMock = {
    whenReady: vi.fn(() => ({
      then: (cb: () => void) => {
        whenReadyCbs.push(cb);
      },
    })),
    getAppPath: vi.fn(() => 'C:\\project'),
    getPath: vi.fn((_name: string) => 'C:\\tmp\\encodex-userdata'),
    getVersion: vi.fn(() => '1.0.0'),
    exit: vi.fn(),
    quit: vi.fn(),
    commandLine: {
      appendSwitch: vi.fn(),
    },
    disableHardwareAcceleration: vi.fn(),
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      appOnHandlers[event] = cb;
    }),
  };
  const menuMock = {
    setApplicationMenu: vi.fn(),
  };
  const aptabaseMainMock = {
    initialize: vi.fn(async () => undefined),
    trackEvent: vi.fn(async () => undefined),
  };
  const shellMock = {
    openExternal: vi.fn(),
  };
  const BrowserWindowMock = vi.fn(function (this: {
    loadURL: ReturnType<typeof vi.fn>;
    loadFile: ReturnType<typeof vi.fn>;
    openDevTools: ReturnType<typeof vi.fn>;
    isDestroyed: ReturnType<typeof vi.fn>;
    show: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    webContents: {
      send: ReturnType<typeof vi.fn>;
      openDevTools: ReturnType<typeof vi.fn>;
      setWindowOpenHandler: ReturnType<typeof vi.fn>;
      on: ReturnType<typeof vi.fn>;
      once: ReturnType<typeof vi.fn>;
    };
    onceHandlers: Record<string, (...args: unknown[]) => void>;
    on: ReturnType<typeof vi.fn>;
  }) {
    this.loadURL = vi.fn();
    this.loadFile = vi.fn();
    this.openDevTools = vi.fn();
    this.isDestroyed = vi.fn(() => false);
    this.show = vi.fn();
    this.close = vi.fn();
    this.onceHandlers = {};
    this.webContents = {
      send: vi.fn(),
      openDevTools: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      on: vi.fn(),
      once: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        this.onceHandlers[event] = cb;
      }),
    };
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
    shellMock,
    aptabaseMainMock,
    sessionMock: {
      defaultSession: {
        webRequest: {
          onHeadersReceived: vi.fn(),
        },
      },
    },
    runMcpServerMock: vi.fn(),
    registerMcpSettingsIpcMock: vi.fn(),
    startMcpHttpServerMock: vi.fn(() => {
      const handle = { close: vi.fn(() => Promise.resolve(undefined)) };
      mcpHandles.push(handle);
      return Promise.resolve(handle);
    }),
    getMcpHandles: () => mcpHandles,
    createMcpServerMock: vi.fn(() => ({ registerTool: vi.fn() })),
    registerGuiToolsMock: vi.fn(),
    // A `function` implementation, because index.ts does `new MCPJobManager`.
    MCPJobManagerMock: vi.fn(function MCPJobManagerMock(_options: unknown) {
      return {};
    }),
  };
});

vi.mock('electron', () => ({
  app: appMock,
  BrowserWindow: BrowserWindowMock,
  Menu: menuMock,
  shell: shellMock,
  session: sessionMock,
  ipcMain: { handle: vi.fn() },
}));
vi.mock('@aptabase/electron/main', () => aptabaseMainMock);
vi.mock('../cli/cli', () => ({
  runCli: runCliMock,
  mapCliErrorToExitCode: (err: unknown) => (err instanceof Error && err.message === 'usage' ? 2 : 1),
  cliErrorMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));
vi.mock('../ipc/handlers', () => ({ registerIpcHandlers: registerIpcHandlersMock }));
vi.mock('../updater', () => ({
  autoInstallPendingUpdate: vi.fn().mockResolvedValue(undefined),
  checkForUpdate: vi.fn().mockResolvedValue(null),
}));
// The MCP surface is exercised through `index.ts`'s own glue - mode dispatch,
// session-server construction, and settings reconciliation - so the collaborators
// behind it are stubbed: a real HTTP server would bind a port, and the real
// server factory would build a protocol object this file has no opinion about.
vi.mock('../../mcp/run', () => ({ runMcpServer: runMcpServerMock }));
vi.mock('../../mcp/server', () => ({ createMcpServer: createMcpServerMock }));
vi.mock('../../mcp/jobs/manager', () => ({ MCPJobManager: MCPJobManagerMock }));
vi.mock('../mcp/gui-tools', () => ({ registerGuiTools: registerGuiToolsMock }));
vi.mock('../mcp/http-server', () => ({ startMcpHttpServer: startMcpHttpServerMock }));
vi.mock('../mcp/settings-ipc', () => ({ registerMcpSettingsIpc: registerMcpSettingsIpcMock }));

const ORIGINAL_ARGV = process.argv;
const ORIGINAL_PLATFORM = process.platform;
const ORIGINAL_LOG = console.log;
const ORIGINAL_WARN = console.warn;
const ORIGINAL_ERROR = console.error;

const getMainWindows = () => registerIpcHandlersMock.mock.calls.map((call) => call[0]);

/** Application error/warning records emitted by `main/index`'s own logger. */
const mainIndexLogs = () => getAppLogs().filter((entry) => entry.context === 'main/index');

/** Options of the most recently constructed window - the main window, after the splash. */
const mainWindowOptions = (): { webPreferences: { preload?: string } } => {
  const constructor = BrowserWindowMock as unknown as { mock: { calls: unknown[][] } };
  return constructor.mock.calls.at(-1)![0] as { webPreferences: { preload?: string } };
};

/** The `registerMcpSettingsIpc` options captured when this test started the app. */
const mcpSettingsOptions = (): { apply: (settings: McpSettings) => void } =>
  registerMcpSettingsIpcMock.mock.calls[0]?.[0] as { apply: (settings: McpSettings) => void };

/**
 * Fires the app.whenReady callback and flushes the microtask chain so the
 * awaited autoInstallPendingUpdate().then(...) window creation has run.
 */
/**
 * `src/main/index.ts` calls `registerProcessCrashHandlers()` at module scope,
 * and this file re-imports it in nearly every test after `vi.resetModules()`.
 * Without the sweep below, each import stacks another `uncaughtException` /
 * `unhandledRejection` pair onto the shared `process`, Node emits
 * `MaxListenersExceededWarning` about the tenth import, and the survivors are
 * not inert: every one of them logs and calls `captureException` when a real
 * fault fires, so a single unhandled rejection in this file fans out into a
 * dozen reports. The baseline is captured here, before the first dynamic
 * import, so the crash tripwire's own listeners are never removed.
 */
const PROCESS_CRASH_EVENTS = ['uncaughtException', 'unhandledRejection'] as const;
const baselineProcessListeners = PROCESS_CRASH_EVENTS.map((event) => process.listeners(event));

/** Removes every `process` listener that a `../index` import added. */
function removeProcessListenersAddedSinceBaseline(): void {
  PROCESS_CRASH_EVENTS.forEach((event, index) => {
    for (const listener of process.listeners(event)) {
      if (!baselineProcessListeners[index].includes(listener)) {
        process.removeListener(event, listener as () => void);
      }
    }
  });
}

async function triggerStartup(): Promise<void> {
  getWhenReadyCbs()[0]();
  await Promise.resolve();
  await Promise.resolve();
}

/**
 * Imports the main entry point and lets its fire-and-forget bootstraps settle.
 *
 * `index.ts` starts monitoring and analytics with `void bootstrap...()` on
 * purpose, so module evaluation is not blocked and the SDKs register their IPC
 * schemes in a defined order. The consequence here is that `await import()`
 * resolves *before* those bootstraps finish, so their `log.error` calls arrive
 * after the test has ended and are dropped by the tripwire as unattributed -
 * two real errors that nothing ever checks.
 *
 * Draining to the next macrotask lets the whole promise chain finish, which
 * keeps those failures inside the test that caused them. Both are expected: the
 * SDKs have no DSN or App Key under test, and both call sites catch and swallow
 * the failure by design, since neither may prevent startup.
 */
async function importIndex(): Promise<void> {
  expectAppLog('error', 'shared/monitoring');
  expectAppLog('error', 'main/analytics/aptabaseMainProvider');
  // This suite pins `process.platform` to win32, so on a non-Windows host
  // `ffmpeg-static` resolves to `ffmpeg.exe`, which does not exist. The module
  // scope of `ffmpeg-core` then calls `getFfmpegPath()` and falls back to the
  // system ffmpeg with a warning - an environment artifact of the platform pin,
  // not a fault this file provokes.
  expectAppLog('warn', 'main/media-binaries');
  await import('../index');
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('main/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWhenReadyCbs().length = 0;
    getWindowInstances().length = 0;
    delete getAppOnHandlers()['window-all-closed'];
    delete getAppOnHandlers()['activate'];
    runCliMock.mockResolvedValue(undefined);
    runMcpServerMock.mockResolvedValue(undefined);
    getMcpHandles().length = 0;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.argv = ORIGINAL_ARGV;
    delete process.env.NODE_ENV;
    delete process.env.ENCODEX_HOSTILE_MODE;
    delete process.env.ENCODEX_TEST_MODE;
    // Tests that point userData at a temp directory must not leak that path
    // into the next test: `vi.clearAllMocks()` keeps mock implementations.
    appMock.getPath.mockImplementation((_name: string) => 'C:\\tmp\\encodex-userdata');
    Object.defineProperty(process, 'platform', { value: ORIGINAL_PLATFORM });
    console.log = ORIGINAL_LOG;
    console.warn = ORIGINAL_WARN;
    console.error = ORIGINAL_ERROR;
    removeProcessListenersAddedSinceBaseline();
    vi.resetModules();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('runs the CLI and exits with success in CLI mode', async () => {
    process.argv = ['node', 'C:\\project\\index.js', '--cli'];
    await importIndex();
    expect(appMock.whenReady).toHaveBeenCalled();
    await triggerStartup();
    await vi.waitFor(() => expect(appMock.exit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS));
    expect(runCliMock).toHaveBeenCalled();
  });

  it('exits with an error when the CLI fails', async () => {
    process.argv = ['node', 'C:\\project\\index.js', '--cli'];
    runCliMock.mockRejectedValue(new Error('cli boom'));
    await importIndex();
    await triggerStartup();
    await vi.waitFor(() => expect(appMock.exit).toHaveBeenCalledWith(EXIT_CODES.ERROR));
  });

  it('creates a production window and registers IPC handlers', async () => {
    process.argv = ['node', 'x.js'];
    await importIndex();
    expect(appMock.whenReady).toHaveBeenCalled();
    await triggerStartup();
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

  it('registers the Content-Security-Policy response-header hook before any window loads', async () => {
    process.argv = ['node', 'x.js'];
    await importIndex();
    await triggerStartup();
    expect(sessionMock.defaultSession.webRequest.onHeadersReceived).toHaveBeenCalledTimes(1);
    const children = sessionMock.defaultSession.webRequest.onHeadersReceived.mock.calls[0]?.[0];
    expect(children).toBeTypeOf('function');
  });

  it('shows a splash window that loads the splash image', async () => {
    process.argv = ['node', 'x.js'];
    await importIndex();
    await triggerStartup();
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
    expect(splash.loadFile).toHaveBeenCalledWith(expect.stringContaining('splash.html'));
  });

  it('keeps the splash hidden until its content has finished loading', async () => {
    process.argv = ['node', 'x.js'];
    await importIndex();
    await triggerStartup();
    expect(BrowserWindowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        show: false,
      }),
    );
    const splash = getWindowInstances()[0];
    expect(splash.show).not.toHaveBeenCalled();
    const didFinishLoad = splash.onceHandlers['did-finish-load'];
    expect(didFinishLoad).toBeTypeOf('function');
    didFinishLoad();
    expect(splash.show).toHaveBeenCalledTimes(1);
  });

  it('shows the main window and closes the splash when ready', async () => {
    process.argv = ['node', 'x.js'];
    await importIndex();
    await triggerStartup();
    const splash = getWindowInstances()[0];
    const win = getMainWindows()[0];
    const readyCb = win.on.mock.calls.find((call: unknown[]) => call[0] === 'ready-to-show')?.[1] as () => void;
    readyCb();
    expect(win.show).toHaveBeenCalled();
    expect(splash.close).toHaveBeenCalled();
  });

  it('loads the dev server URL in development mode', async () => {
    process.argv = ['node', 'x.js'];
    process.env.NODE_ENV = 'development';
    await importIndex();
    await triggerStartup();
    const win = getMainWindows()[0];
    expect(win.loadURL).toHaveBeenCalledWith(DEV_SERVER_URL);
    expect(win.webContents.openDevTools).toHaveBeenCalled();
  });

  it('opens external http(s) links in the system browser and denies new windows', async () => {
    process.argv = ['node', 'x.js'];
    await importIndex();
    await triggerStartup();
    const win = getMainWindows()[0];
    const handler = win.webContents.setWindowOpenHandler.mock.calls[0][0] as (details: { url: string }) => { action: string };
    expect(handler({ url: 'https://github.com/Sandeepv68/EncodeX' })).toEqual({ action: 'deny' });
    expect(shellMock.openExternal).toHaveBeenCalledWith('https://github.com/Sandeepv68/EncodeX');
    handler({ url: 'javascript:alert(1)' });
    expect(shellMock.openExternal).toHaveBeenCalledTimes(1);
  });

  it('patches console to forward log messages to the window', async () => {
    // The point of this test is to drive every console level, so the tripwire's
    // own records of that output have to be declared up front. The patterns match
    // what the tripwire *records* - `util.inspect` spacing, so `{ a: 1 }` - which
    // is not the JSON form the IPC forwarding below asserts on.
    expectCrash('consoleWarn', '{ a: 1 }');
    expectCrash('consoleError', 'boom');
    process.argv = ['node', 'x.js'];
    await importIndex();
    await triggerStartup();
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
    await importIndex();
    await triggerStartup();
    const win = getMainWindows()[0];
    win.isDestroyed.mockReturnValue(true);
    win.webContents.send.mockClear();
    console.log('hello');
    expect(win.webContents.send).not.toHaveBeenCalled();
  });

  it('recreates the window on activate after it was closed', async () => {
    process.argv = ['node', 'x.js'];
    await importIndex();
    await triggerStartup();
    const win = getMainWindows()[0];
    const closedCb = win.on.mock.calls.find((call: unknown[]) => call[0] === 'closed')?.[1] as () => void;
    closedCb();
    getAppOnHandlers()['activate']();
    expect(getMainWindows()).toHaveLength(2);
  });

  it('quits on window-all-closed on non-darwin platforms', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    process.argv = ['node', 'x.js'];
    await importIndex();
    getAppOnHandlers()['window-all-closed']();
    expect(appMock.quit).toHaveBeenCalled();
  });

  it('does not quit on window-all-closed on darwin', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    process.argv = ['node', 'x.js'];
    await importIndex();
    getAppOnHandlers()['window-all-closed']();
    expect(appMock.quit).not.toHaveBeenCalled();
  });

  it('enters CLI mode for a bare subcommand', async () => {
    process.argv = ['node', 'C:\\project\\index.js', 'convert'];
    await importIndex();
    await triggerStartup();
    await vi.waitFor(() => expect(appMock.exit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS));
    expect(runCliMock).toHaveBeenCalled();
  });

  it('enters CLI mode when two positional arguments follow the script path', async () => {
    process.argv = ['node', 'C:\\project\\index.js', 'input.mp4', 'output.mp4'];
    await importIndex();
    await triggerStartup();
    await vi.waitFor(() => expect(appMock.exit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS));
    expect(runCliMock).toHaveBeenCalled();
  });

  it('redirects CLI-mode stdout to stderr so --json output stays parseable', async () => {
    process.argv = ['node', 'C:\\project\\index.js', '--cli'];
    await importIndex();
    await triggerStartup();
    await vi.waitFor(() => expect(runCliMock).toHaveBeenCalled());
    const written: string[] = [];
    const originalWrite = process.stderr.write;
    process.stderr.write = ((chunk: unknown) => {
      written.push(String(chunk));
      return true;
    }) as unknown as typeof process.stderr.write;
    try {
      console.log('cli stdout probe');
    } finally {
      process.stderr.write = originalWrite;
    }
    expect(written.join('')).toContain('cli stdout probe');
  });

  it('logs the full CLI failure when verbose output is enabled', async () => {
    process.argv = ['node', 'C:\\project\\index.js', '--cli'];
    runCliMock.mockRejectedValue(new Error('cli boom'));
    expectAppLog('error', 'main/index');
    await importIndex();
    // `vi.resetModules()` gives index.ts a fresh cli-ui instance on every
    // import, so the flag has to be set on that instance, not a static one.
    const { cliConfig } = await import('../cli/cli-ui');
    cliConfig.verbose = true;
    await triggerStartup();
    await vi.waitFor(() => expect(appMock.exit).toHaveBeenCalledWith(EXIT_CODES.ERROR));
    expect(getAppLogs().some((entry) => entry.context === 'main/index' && entry.text.includes('cli boom'))).toBe(true);
  });

  it('loads the hostile e2e preload when ENCODEX_HOSTILE_MODE is set', async () => {
    process.argv = ['node', 'x.js'];
    process.env.ENCODEX_HOSTILE_MODE = '1';
    await importIndex();
    await triggerStartup();
    expect(mainWindowOptions().webPreferences.preload).toContain(path.join('e2e', 'mocks', 'hostile-preload.js'));
  });

  it('loads the mock e2e preload when ENCODEX_TEST_MODE is set', async () => {
    process.argv = ['node', 'x.js'];
    process.env.ENCODEX_TEST_MODE = '1';
    await importIndex();
    await triggerStartup();
    expect(mainWindowOptions().webPreferences.preload).toContain(path.join('e2e', 'mocks', 'preload.js'));
  });

  it('reports an unexpected renderer death and ignores a clean exit', async () => {
    process.argv = ['node', 'x.js'];
    await importIndex();
    await triggerStartup();
    const win = getMainWindows()[0];
    const handler = win.webContents.on.mock.calls.find((call: unknown[]) => call[0] === 'render-process-gone')?.[1] as
      ((event: unknown, details: { reason: string; exitCode: number }) => void) | undefined;
    expect(handler).toBeTypeOf('function');
    handler!({}, { reason: 'clean-exit', exitCode: 0 });
    expect(mainIndexLogs()).toHaveLength(0);
    handler!({}, { reason: 'crashed', exitCode: 139 });
    expect(mainIndexLogs()).toEqual([expect.objectContaining({ kind: 'appError' })]);
  });

  it('reports an unclean child-process death and ignores a clean one', async () => {
    expectAppLog('warn', 'main/index');
    process.argv = ['node', 'x.js'];
    await importIndex();
    const handler = getAppOnHandlers()['child-process-gone'];
    expect(handler).toBeTypeOf('function');
    handler('child-process-gone', { type: 'GPU', reason: 'clean-exit' });
    expect(mainIndexLogs()).toHaveLength(0);
    handler('child-process-gone', { type: 'Utility', reason: 'crashed' });
    expect(mainIndexLogs()).toEqual([expect.objectContaining({ kind: 'appWarn' })]);
  });

  it('ignores a late splash load after the splash window has closed', async () => {
    process.argv = ['node', 'x.js'];
    await importIndex();
    await triggerStartup();
    const splash = getWindowInstances()[0];
    const closed = splash.on.mock.calls.find((call: unknown[]) => call[0] === 'closed')?.[1] as (() => void) | undefined;
    expect(closed).toBeTypeOf('function');
    closed!();
    // The module-level splash reference is cleared by `closed`, so a
    // did-finish-load landing afterwards must not resurrect the window.
    splash.onceHandlers['did-finish-load']!();
    expect(splash.show).not.toHaveBeenCalled();
  });

  it('writes the install marker on the first launch of a version', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-marker-'));
    appMock.getPath.mockImplementation((name: string) => (name === 'userData' ? userDataDir : 'C:\\tmp\\encodex-userdata'));
    process.argv = ['node', 'x.js'];
    let marker: string | undefined;
    try {
      await importIndex();
      await triggerStartup();
      marker = fs.readFileSync(path.join(userDataDir, 'analytics-install-marker.json'), 'utf8');
    } finally {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
    expect(marker).toBe(appMock.getVersion());
  });

  it('keeps the install marker when it already matches the running version', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-marker-'));
    fs.writeFileSync(path.join(userDataDir, 'analytics-install-marker.json'), '1.0.0', 'utf8');
    appMock.getPath.mockImplementation((name: string) => (name === 'userData' ? userDataDir : 'C:\\tmp\\encodex-userdata'));
    process.argv = ['node', 'x.js'];
    let marker: string | undefined;
    try {
      await importIndex();
      await triggerStartup();
      // Startup got past the early return: the main window still exists.
      expect(getMainWindows()).toHaveLength(1);
      marker = fs.readFileSync(path.join(userDataDir, 'analytics-install-marker.json'), 'utf8');
    } finally {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
    expect(marker).toBe('1.0.0');
  });

  it('starts the MCP server in --mcp mode and exits cleanly', async () => {
    process.argv = ['node', 'x.js', '--mcp'];
    await importIndex();
    expect(appMock.disableHardwareAcceleration).toHaveBeenCalledTimes(1);
    expect(runMcpServerMock).not.toHaveBeenCalled();
    await triggerStartup();
    await vi.waitFor(() => expect(appMock.exit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS));
    expect(runMcpServerMock).toHaveBeenCalledTimes(1);
    // No windows are created in headless MCP mode.
    expect(getWindowInstances()).toHaveLength(0);
  });

  it('exits with an error when the MCP server fails', async () => {
    process.argv = ['node', 'x.js', '--mcp'];
    runMcpServerMock.mockRejectedValue(new Error('mcp boom'));
    expectAppLog('error', 'main/index');
    await importIndex();
    await triggerStartup();
    await vi.waitFor(() => expect(appMock.exit).toHaveBeenCalledWith(EXIT_CODES.ERROR));
    expect(appMock.exit).not.toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    expect(getAppLogs().some((entry) => entry.context === 'main/index' && entry.text.includes('mcp boom'))).toBe(true);
  });

  it('redirects MCP-mode stdout to stderr so the JSON-RPC stream stays parseable', async () => {
    process.argv = ['node', 'x.js', '--mcp'];
    await importIndex();
    const written: string[] = [];
    const originalWrite = process.stderr.write;
    process.stderr.write = ((chunk: unknown) => {
      written.push(String(chunk));
      return true;
    }) as unknown as typeof process.stderr.write;
    try {
      console.log('mcp stdout probe');
    } finally {
      process.stderr.write = originalWrite;
    }
    expect(written.join('')).toContain('mcp stdout probe');
  });

  it('starts the embedded MCP server when settings enable it', async () => {
    process.argv = ['node', 'x.js'];
    await importIndex();
    await triggerStartup();
    const options = mcpSettingsOptions();
    expect(options.apply).toBeTypeOf('function');
    options.apply({ enabled: true, port: 3847, token: 'secret' });
    await vi.waitFor(() => expect(startMcpHttpServerMock).toHaveBeenCalledTimes(1));
    const startCalls = (startMcpHttpServerMock as unknown as { mock: { calls: [unknown, unknown][] } }).mock.calls;
    expect(startCalls[0]?.[1]).toEqual({ enabled: true, port: 3847, token: 'secret' });
    // Each HTTP session gets a server, but they share one job manager so
    // queue operations observe every conversion regardless of the session.
    const factory = startCalls[0]?.[0] as (() => unknown) | undefined;
    expect(factory).toBeTypeOf('function');
    factory!();
    factory!();
    expect(MCPJobManagerMock).toHaveBeenCalledTimes(1);
    expect(createMcpServerMock).toHaveBeenCalledTimes(2);
    expect(registerGuiToolsMock).toHaveBeenCalledTimes(2);
    // Enabling again restarts the server so a changed port or token takes effect.
    options.apply({ enabled: true, port: 3848, token: 'secret' });
    await vi.waitFor(() => expect(startMcpHttpServerMock).toHaveBeenCalledTimes(2));
    expect(getMcpHandles()[0]!.close).toHaveBeenCalled();
  });

  it('stops the embedded MCP server when settings disable it', async () => {
    process.argv = ['node', 'x.js'];
    await importIndex();
    await triggerStartup();
    const options = mcpSettingsOptions();
    options.apply({ enabled: true, port: 3847, token: '' });
    await vi.waitFor(() => expect(startMcpHttpServerMock).toHaveBeenCalledTimes(1));
    const handle = getMcpHandles()[0]!;
    options.apply({ enabled: false, port: 3847, token: '' });
    await vi.waitFor(() => expect(handle.close).toHaveBeenCalled());
    expect(startMcpHttpServerMock).toHaveBeenCalledTimes(1);
  });

  it('logs a failure to start the embedded server and keeps the app alive', async () => {
    expectAppLog('error', 'main/index');
    process.argv = ['node', 'x.js'];
    await importIndex();
    await triggerStartup();
    startMcpHttpServerMock.mockRejectedValueOnce(new Error('port in use'));
    mcpSettingsOptions().apply({ enabled: true, port: 3847, token: '' });
    await vi.waitFor(() => expect(startMcpHttpServerMock).toHaveBeenCalledTimes(1));
    await vi.waitFor(() =>
      expect(getAppLogs().some((entry) => entry.context === 'main/index' && entry.text.includes('port in use'))).toBe(true),
    );
    // The failed handle is dropped, so a later disable has nothing to close.
    expect(getMcpHandles()).toHaveLength(0);
  });

  it('swallows a failure to close the embedded server', async () => {
    expectAppLog('warn', 'main/index');
    process.argv = ['node', 'x.js'];
    await importIndex();
    await triggerStartup();
    const options = mcpSettingsOptions();
    options.apply({ enabled: true, port: 3847, token: '' });
    await vi.waitFor(() => expect(startMcpHttpServerMock).toHaveBeenCalledTimes(1));
    const handle = getMcpHandles()[0]!;
    handle.close.mockRejectedValueOnce(new Error('close boom'));
    options.apply({ enabled: false, port: 3847, token: '' });
    await vi.waitFor(() => expect(getAppLogs().some((entry) => entry.kind === 'appWarn' && entry.text.includes('close boom'))).toBe(true));
  });

  it('flushes telemetry and stops the embedded server on will-quit', async () => {
    process.argv = ['node', 'x.js'];
    await importIndex();
    await triggerStartup();
    const options = mcpSettingsOptions();
    options.apply({ enabled: true, port: 3847, token: '' });
    await vi.waitFor(() => expect(startMcpHttpServerMock).toHaveBeenCalledTimes(1));
    const handle = getMcpHandles()[0]!;
    getAppOnHandlers()['will-quit']!();
    await vi.waitFor(() => expect(handle.close).toHaveBeenCalled());
  });
});
