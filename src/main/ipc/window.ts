/**
 * @fileoverview IPC handlers for window management operations.
 * Handles window state changes, resizing, and other window control commands.
 */

import { BrowserWindow, ipcMain } from 'electron';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';

const log = new Logger('main/ipc/window');

export function registerWindowHandlers(win: BrowserWindow): void {
  ipcMain.on(IPC.WINDOW_MINIMIZE, () => {
    log.debug('WINDOW_MINIMIZE');
    win.minimize();
  });

  ipcMain.on(IPC.WINDOW_MAXIMIZE_TOGGLE, () => {
    log.debug('WINDOW_MAXIMIZE_TOGGLE', { maximized: win.isMaximized() });
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.on(IPC.WINDOW_CLOSE, () => {
    log.debug('WINDOW_CLOSE');
    win.close();
  });

  win.on('maximize', () => {
    if (!win.isDestroyed()) win.webContents.send(IPC.WINDOW_MAXIMIZED_CHANGED, true);
  });

  win.on('unmaximize', () => {
    if (!win.isDestroyed()) win.webContents.send(IPC.WINDOW_MAXIMIZED_CHANGED, false);
  });
}
