import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { registerIpcHandlers } from './ipc/handlers';
import { runCli } from './cli';
import { Logger } from '../shared/logger';
import { WINDOW_SIZE, DEV_SERVER_URL, APP_NAME, EXIT_CODES } from '../shared/ui-constants';

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

  function createWindow(): void {
    log.info('Creating main window');
    mainWindow = new BrowserWindow({
      width: WINDOW_SIZE.WIDTH,
      height: WINDOW_SIZE.HEIGHT,
      minWidth: WINDOW_SIZE.MIN_WIDTH,
      minHeight: WINDOW_SIZE.MIN_HEIGHT,
      title: APP_NAME,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    registerIpcHandlers(mainWindow);

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
    log.info('App ready, creating window');
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
