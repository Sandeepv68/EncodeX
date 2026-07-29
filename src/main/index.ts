import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { registerIpcHandlers } from './ipc/handlers';
import { runCli } from './cli';
import { WINDOW_SIZE, DEV_SERVER_URL, APP_NAME, EXIT_CODES } from '../shared/ui-constants';

function isCliMode(): boolean {
  const argv = process.argv;
  if (argv.includes('--headless') || argv.includes('-h') || argv.includes('--help')) {
    return true;
  }
  const args = argv.slice(2).filter(a => !a.startsWith('-'));
  return args.length >= 2;
}

if (isCliMode()) {
  runCli()
    .then(() => {
      app.exit(EXIT_CODES.SUCCESS);
    })
    .catch((err) => {
      console.error(err);
      app.exit(EXIT_CODES.ERROR);
    });
} else {
  let mainWindow: BrowserWindow | null = null;

  function createWindow(): void {
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
      mainWindow.loadURL(DEV_SERVER_URL);
      mainWindow.webContents.openDevTools();
    } else {
      mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
    }

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  app.whenReady().then(createWindow);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (mainWindow === null) createWindow();
  });
}
