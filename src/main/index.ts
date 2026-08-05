/**
 * @fileoverview Main process entry point for the EncodeX Electron application.
 * Handles window creation, IPC registration, CLI mode, and application lifecycle.
 */

import { app, BrowserWindow, Menu } from 'electron';
import * as path from 'path';
import { registerIpcHandlers } from './ipc/handlers';
import { runCli } from './cli';
import { Logger } from '../shared/logger';
import { WINDOW_SIZE, DEV_SERVER_URL, APP_NAME, EXIT_CODES, SPLASH_SIZE, SPLASH_IMAGE, SPLASH_BACKGROUND } from '../shared/app-constants';
import { IPC } from '../shared/ipc-channels';
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
} from '../shared/log-constants';

const log = new Logger('main/index');

function isCliMode(): boolean {
  const argv = process.argv;
  if (argv.includes('--cli') || argv.includes('-h') || argv.includes('--help')) {
    return true;
  }
  const args = argv.slice(2).filter((a) => !a.startsWith('-'));
  return args.length >= 2;
}

if (isCliMode()) {
  log.info(LOG_STARTING_IN_CLI_MODE_ARGV, process.argv.slice(2));
  app.whenReady().then(() => {
    runCli()
      .then(() => {
        log.info(LOG_CLI_COMPLETED_SUCCESSFULLY);
        app.exit(EXIT_CODES.SUCCESS);
      })
      .catch((err) => {
        log.error(LOG_CLI_FAILED, err);
        app.exit(EXIT_CODES.ERROR);
      });
  });
} else {
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
  let mainWindow: BrowserWindow | null = null;
  let splashWindow: BrowserWindow | null = null;

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
      backgroundColor: SPLASH_BACKGROUND,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    splashWindow.loadFile(path.join(app.getAppPath(), SPLASH_IMAGE));
    splashWindow.on('closed', () => {
      log.info(LOG_SPLASH_WINDOW_CLOSED);
      splashWindow = null;
    });
  }

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
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    registerIpcHandlers(mainWindow);
    patchConsole(mainWindow);

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
}

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
