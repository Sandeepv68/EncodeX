import { app, BrowserWindow, Menu } from 'electron';
import * as path from 'path';
import { registerIpcHandlers } from './ipc/handlers';
import { runCli } from './cli';
import { Logger } from '../shared/logger';
import { WINDOW_SIZE, DEV_SERVER_URL, APP_NAME, EXIT_CODES, SPLASH_SIZE, SPLASH_IMAGE, SPLASH_BACKGROUND } from '../shared/app-constants';
import { IPC } from '../shared/ipc-channels';

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
  log.info('Starting in CLI mode, argv:', process.argv.slice(2));
  app.whenReady().then(() => {
    runCli()
      .then(() => {
        log.info('CLI completed successfully');
        app.exit(EXIT_CODES.SUCCESS);
      })
      .catch((err) => {
        log.error('CLI failed:', err);
        app.exit(EXIT_CODES.ERROR);
      });
  });
} else {
  let mainWindow: BrowserWindow | null = null;
  let splashWindow: BrowserWindow | null = null;

  function createSplashWindow(): void {
    log.info('Creating splash window');
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
      log.info('Splash window closed');
      splashWindow = null;
    });
  }

  function createWindow(): void {
    log.info('Creating main window');
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
      log.info('Main window ready, showing');
      mainWindow?.show();
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
      }
    });

    if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
      log.info('Loading dev server URL:', DEV_SERVER_URL);
      mainWindow.loadURL(DEV_SERVER_URL);
      mainWindow.webContents.openDevTools();
    } else {
      log.info('Loading production renderer');
      mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
    }

    mainWindow.on('closed', () => {
      log.info('Main window closed');
      mainWindow = null;
    });
  }

  app.whenReady().then(() => {
    log.info('App ready, creating splash and main windows');
    createSplashWindow();
    createWindow();
  });

  app.on('window-all-closed', () => {
    log.info('All windows closed, platform:', process.platform);
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    log.info('Activate event, mainWindow null:', mainWindow === null);
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
