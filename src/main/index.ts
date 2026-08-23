/**
 * @fileoverview Main process entry point for the EncodeX Electron application.
 * Handles window creation, IPC registration, CLI mode, and application lifecycle.
 *
 * On startup, {@link isCliMode} decides between two mutually exclusive modes:
 *
 *  - CLI mode (started with `--cli`, `-h`/`--help`, a subcommand, or two
 *    positional args):
 *    waits for `app.whenReady()`, runs {@link runCli}, and exits with the
 *    mapped exit code.
 *  - GUI mode (default): appends an `autoplay-policy` switch, creates a
 *    frameless splash window followed by the main window, registers IPC
 *    handlers, patches `console` methods so renderer-visible logs are forwarded
 *    over IPC, and wires the `window-all-closed` / `activate` lifecycle events.
 *
 * The module has no exports; its top-level code runs once when loaded.
 */

/**
 * Load the repo-root `.env` before anything reads `process.env` (monitoring
 * bootstrap runs at module load). Real environment variables always win over
 * file values; a missing file is not an error.
 */
import { config as loadDotenv } from 'dotenv';
loadDotenv({ quiet: true });

import { app, BrowserWindow, Menu, shell } from 'electron';
import * as path from 'path';
import { registerIpcHandlers } from './ipc/handlers';
import { runCli, mapCliErrorToExitCode } from './cli/cli';
import { Logger } from '../shared/logger';
import {
  WINDOW_SIZE,
  DEV_SERVER_URL,
  APP_NAME,
  EXIT_CODES,
  SPLASH_SIZE,
  SPLASH_HTML,
  SPLASH_BACKGROUND,
  APP_ICON,
} from '../shared/app-constants';
import { IPC } from '../shared/ipc-channels';
import { CLI_SUBCOMMANDS } from '../shared/constants';
import {
  LOG_ACTIVATE_EVENT_MAIN_WINDOW_NULL,
  LOG_ALL_WINDOWS_CLOSED_PLATFORM,
  LOG_APP_READY_CREATING_SPLASH_AND_MAIN_WINDOWS,
  LOG_CLI_COMPLETED_SUCCESSFULLY,
  LOG_CLI_FAILED,
  LOG_CREATING_MAIN_WINDOW,
  LOG_CREATING_SPLASH_WINDOW,
  LOG_LOADING_DEV_SERVER_URL,
  LOG_LOADING_PRODUCTION_RENDERER,
  LOG_MAIN_WINDOW_CLOSED,
  LOG_MAIN_WINDOW_READY_SHOWING,
  LOG_SPLASH_WINDOW_CLOSED,
  LOG_STARTING_IN_CLI_MODE_ARGV,
  LOG_MONITORING_UNCAUGHT_EXCEPTION,
  LOG_MONITORING_UNHANDLED_REJECTION,
  LOG_MONITORING_RENDER_PROCESS_GONE,
  LOG_MONITORING_CHILD_PROCESS_GONE,
} from '../shared/log-constants';
import { captureException, closeMonitoring, initMonitoring } from '../shared/monitoring/MonitoringService';
import type { MonitoringConfig } from '../shared/monitoring/types';
import { SENTRY_BUILD_CONFIG } from './generated/sentryBuildConfig';
import { readMonitoringConsent } from './monitoring/consent';
import { registerMonitoringIpcBridge } from './monitoring/ipcBridge';
import { resolveMainMonitorProvider } from './monitoring/providerFactory';

const log = new Logger('main/index');

/** Consent state read during {@link bootstrapMonitoring}; consumed by the IPC bridge registration. @type {boolean} */
let monitoringConsentAtBoot = true;

/**
 * Initializes the monitoring subsystem as early as possible in the main
 * process (both GUI and CLI modes share this path).
 *
 * Reads the persisted user consent (`userData/monitoring-consent.json`,
 * defaulting to enabled) and activates the provider resolved by
 * {@link resolveMainMonitorProvider} - Sentry when a DSN is configured, the
 * no-op fallback otherwise. Failures are swallowed: monitoring must never
 * prevent startup.
 *
 * @returns {Promise<void>} Resolves once initialization attempts have settled.
 */
async function bootstrapMonitoring(): Promise<void> {
  try {
    const consent = readMonitoringConsent(app.getPath('userData'));
    monitoringConsentAtBoot = consent;
    const config: MonitoringConfig = {
      enabled: consent,
      // Runtime env wins; the generated build-time value covers packaged
      // releases where end users cannot set SENTRY_DSN.
      dsn: process.env.SENTRY_DSN ?? SENTRY_BUILD_CONFIG.dsn,
      environment: process.env.SENTRY_ENVIRONMENT || (process.env.NODE_ENV === 'development' ? 'development' : 'production'),
      release: `encodex@${app.getVersion()}`,
      // Set SENTRY_DEBUG=1 to watch the SDK log envelope delivery locally.
      debug: process.env.SENTRY_DEBUG === '1',
    };
    await initMonitoring(config, resolveMainMonitorProvider);
  } catch (err) {
    log.error('Monitoring bootstrap failed:', err);
  }
}

/**
 * Registers process-level crash handlers so uncaught exceptions, unhandled
 * promise rejections, and unexpected child-process deaths are reported through
 * the monitoring facade. Installed immediately at module load; events raised
 * before a backend finishes initializing are absorbed by the facade's no-op.
 *
 * @returns {void}
 */
function registerProcessCrashHandlers(): void {
  process.on('uncaughtException', (err) => {
    log.error(LOG_MONITORING_UNCAUGHT_EXCEPTION, err);
    captureException(err, { tags: { handler: 'uncaughtException', process: 'main' } });
  });
  process.on('unhandledRejection', (reason) => {
    log.error(LOG_MONITORING_UNHANDLED_REJECTION, reason);
    captureException(reason, { tags: { handler: 'unhandledRejection', process: 'main' } });
  });
  app.on('child-process-gone', (_event, details) => {
    if (details.reason === 'clean-exit') return;
    log.warn(LOG_MONITORING_CHILD_PROCESS_GONE, details.type, details.reason);
    captureException(new Error(`Child ${details.type} process gone: ${details.reason}`), {
      tags: { handler: 'child-process-gone', processType: details.type, reason: details.reason },
    });
  });
}

// Start monitoring before anything else runs; do not block module execution.
void bootstrapMonitoring();
registerProcessCrashHandlers();

/**
 * Resolves the preload script path.
 *
 * In e2e test mode (`ENCODEX_TEST_MODE=1`) the mock preload
 * (e2e/mocks/preload.js) is loaded instead of the real bridge so specs can
 * drive `window.electronAPI` deterministically. The branch is inert outside of
 * e2e runs.
 *
 * @returns {string} Absolute path of the preload script to use.
 */
function resolvePreloadPath(): string {
  if (process.env.ENCODEX_TEST_MODE === '1') {
    return path.join(__dirname, '..', '..', 'e2e', 'mocks', 'preload.js');
  }
  return path.join(__dirname, '..', 'preload', 'index.js');
}

/**
 * Determines whether the app should start in CLI mode based on process args.
 *
 * Returns `true` when `--cli`, `-h`, `--help`, or a CLI subcommand name is
 * present, or when at least two non-option positional arguments (input and
 * output) follow the script path. Otherwise `false` (GUI mode).
 *
 * @returns {boolean} `true` if the app should run as a CLI, `false` for GUI.
 */
function isCliMode(): boolean {
  const argv = process.argv;
  if (argv.includes('--cli') || argv.includes('-h') || argv.includes('--help')) {
    return true;
  }
  if (argv.some((arg) => (CLI_SUBCOMMANDS as readonly string[]).includes(arg as never))) {
    return true;
  }
  const args = argv.slice(2).filter((a) => !a.startsWith('-'));
  return args.length >= 2;
}

if (isCliMode()) {
  log.info(LOG_STARTING_IN_CLI_MODE_ARGV, process.argv.slice(2));
  app.whenReady().then(() => {
    runCli()
      .then(async () => {
        log.info(LOG_CLI_COMPLETED_SUCCESSFULLY);
        await closeMonitoring();
        app.exit(EXIT_CODES.SUCCESS);
      })
      .catch(async (err) => {
        log.error(LOG_CLI_FAILED, err);
        captureException(err, { tags: { handler: 'cli', process: 'main' } });
        await closeMonitoring();
        app.exit(mapCliErrorToExitCode(err));
      });
  });
} else {
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
  /** The main application window, or `null` once it has been closed. @type {BrowserWindow | null} */
  let mainWindow: BrowserWindow | null = null;
  /** The splash window shown while the app loads, or `null` once closed. @type {BrowserWindow | null} */
  let splashWindow: BrowserWindow | null = null;

  /**
   * Creates the frameless, always-on-top splash window shown while the main
   * window loads.
   *
   * The splash is a small fixed-size, non-resizable, non-minimizable,
   * taskbar-hidden BrowserWindow that loads `SPLASH_HTML` from the app path
   * with a sandboxed, context-isolated renderer. It is created hidden and only
   * shown once the page (including the banner image) has finished loading, so
   * the user never sees an empty container. Its `closed` event clears the
   * module variable so the window reference is not leaked.
   *
   * @returns {void}
   */
  function createSplashWindow(): void {
    log.info(LOG_CREATING_SPLASH_WINDOW);
    splashWindow = new BrowserWindow({
      width: SPLASH_SIZE.WIDTH,
      height: SPLASH_SIZE.HEIGHT,
      title: APP_NAME,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      center: true,
      show: false,
      backgroundColor: SPLASH_BACKGROUND,
      ...(process.platform !== 'darwin' ? { icon: path.join(app.getAppPath(), APP_ICON) } : {}),
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    splashWindow.loadFile(path.join(app.getAppPath(), SPLASH_HTML));
    splashWindow.webContents.once('did-finish-load', () => {
      splashWindow?.show();
    });
    splashWindow.on('closed', () => {
      log.info(LOG_SPLASH_WINDOW_CLOSED);
      splashWindow = null;
    });
  }

  /**
   * Creates the main application window and wires up its IPC, console, and
   * lifecycle handlers.
   *
   * The window is frameless, hidden until `ready-to-show`, and uses the preload
   * script with context isolation enabled and node integration disabled. It
   * registers IPC handlers via {@link registerIpcHandlers}, patches console
   * forwarding via {@link patchConsole}, closes the splash once ready, and
   * loads the Vite dev server in development/`--dev` mode (opening devtools)
   * or the built renderer HTML otherwise.
   *
   * @returns {void}
   */
  function createWindow(): void {
    log.info(LOG_CREATING_MAIN_WINDOW);
    Menu.setApplicationMenu(null);
    mainWindow = new BrowserWindow({
      width: WINDOW_SIZE.WIDTH,
      height: WINDOW_SIZE.HEIGHT,
      minWidth: WINDOW_SIZE.MIN_WIDTH,
      minHeight: WINDOW_SIZE.MIN_HEIGHT,
      title: APP_NAME,
      frame: false,
      show: false,
      ...(process.platform !== 'darwin' ? { icon: path.join(app.getAppPath(), APP_ICON) } : {}),
      webPreferences: {
        preload: resolvePreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    registerIpcHandlers(mainWindow);
    registerMonitoringIpcBridge({ userDataDir: app.getPath('userData'), consentEnabled: monitoringConsentAtBoot });
    patchConsole(mainWindow);

    /**
     * Reports unexpected renderer deaths (crashes, OOM kills) through the
     * monitoring facade. Clean exits are ignored.
     */
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      if (details.reason === 'clean-exit') return;
      log.error(LOG_MONITORING_RENDER_PROCESS_GONE, details.reason, details.exitCode);
      captureException(new Error(`Renderer process gone: ${details.reason} (exitCode ${details.exitCode})`), {
        tags: { handler: 'render-process-gone', reason: details.reason },
        extra: { exitCode: details.exitCode },
      });
    });

    /**
     * Routes external http(s) links opened from the renderer (e.g. the GitHub
     * links on the About page) to the system browser instead of navigating the
     * app window. All new windows are denied; allowed URLs are opened via
     * Electron's `shell.openExternal`.
     */
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://') || url.startsWith('http://')) {
        void shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    mainWindow.on('ready-to-show', () => {
      log.info(LOG_MAIN_WINDOW_READY_SHOWING);
      mainWindow?.show();
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
      }
    });

    if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
      log.info(LOG_LOADING_DEV_SERVER_URL, DEV_SERVER_URL);
      mainWindow.loadURL(DEV_SERVER_URL);
      mainWindow.webContents.openDevTools();
    } else {
      log.info(LOG_LOADING_PRODUCTION_RENDERER);
      mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
    }

    mainWindow.on('closed', () => {
      log.info(LOG_MAIN_WINDOW_CLOSED);
      mainWindow = null;
    });
  }

  app.whenReady().then(() => {
    log.info(LOG_APP_READY_CREATING_SPLASH_AND_MAIN_WINDOWS);
    createSplashWindow();
    createWindow();
  });

  app.on('window-all-closed', () => {
    log.info(LOG_ALL_WINDOWS_CLOSED_PLATFORM, process.platform);
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    log.info(LOG_ACTIVATE_EVENT_MAIN_WINDOW_NULL, mainWindow === null);
    if (mainWindow === null) createWindow();
  });

  app.on('will-quit', () => {
    // Flush any queued monitoring events before the process dies. Fire-and-
    // forget: quitting must never wait indefinitely on the network.
    void closeMonitoring();
  });
}

/**
 * Overrides `console.log`, `console.warn`, and `console.error` in the main
 * process so that main-process messages are also forwarded to the renderer.
 *
 * Each patched method first calls the original console method, then, if the
 * window is still alive, sends an `IPC.LOG_MESSAGE` payload with a timestamp,
 * severity level, joined message text, and `source: 'main'` over the window's
 * webContents. Non-string arguments are JSON-stringified.
 *
 * @param {BrowserWindow} win - The main window whose webContents receives the
 *   forwarded log messages.
 * @returns {void}
 */
function patchConsole(win: BrowserWindow) {
  const levels: Array<{ method: 'log' | 'warn' | 'error'; level: 'INFO' | 'WARN' | 'ERROR' }> = [
    { method: 'log', level: 'INFO' },
    { method: 'warn', level: 'WARN' },
    { method: 'error', level: 'ERROR' },
  ];
  for (const { method, level } of levels) {
    const original = console[method];
    console[method] = (...args: unknown[]) => {
      original.apply(console, args);
      if (!win.isDestroyed()) {
        const text = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
        win.webContents.send(IPC.LOG_MESSAGE, { timestamp: new Date().toISOString(), level, text, source: 'main' });
      }
    };
  }
}
