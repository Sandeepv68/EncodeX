/**
 * @fileoverview IPC handlers for window management operations.
 * Handles window state changes, resizing, and other window control commands.
 */

import { BrowserWindow, ipcMain } from 'electron';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import {
  LOG_IPC_WINDOW_CLOSE,
  LOG_IPC_WINDOW_MAXIMIZE_TOGGLE,
  LOG_IPC_WINDOW_MINIMIZE,
  LOG_IPC_WINDOW_SET_ALWAYS_ON_TOP,
} from '../../shared/log-constants';

const log = new Logger('main/ipc/window');

export function registerWindowHandlers(win: BrowserWindow): void {
  ipcMain.on(IPC.WINDOW_MINIMIZE, () => {
    log.debug(LOG_IPC_WINDOW_MINIMIZE);
    win.minimize();
  });

  ipcMain.on(IPC.WINDOW_MAXIMIZE_TOGGLE, () => {
    log.debug(LOG_IPC_WINDOW_MAXIMIZE_TOGGLE, { maximized: win.isMaximized() });
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.on(IPC.WINDOW_CLOSE, () => {
    log.debug(LOG_IPC_WINDOW_CLOSE);
    win.close();
  });

  ipcMain.on(IPC.WINDOW_SET_ALWAYS_ON_TOP, (_event, flag: boolean) => {
    log.debug(LOG_IPC_WINDOW_SET_ALWAYS_ON_TOP, { flag });
    win.setAlwaysOnTop(Boolean(flag));
  });

  win.on('maximize', () => {
    if (!win.isDestroyed()) win.webContents.send(IPC.WINDOW_MAXIMIZED_CHANGED, true);
  });

  win.on('unmaximize', () => {
    if (!win.isDestroyed()) win.webContents.send(IPC.WINDOW_MAXIMIZED_CHANGED, false);
  });
}
