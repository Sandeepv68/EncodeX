/**
 * @fileoverview IPC handlers for window management operations.
 * Registers fire-and-forget window control channels (WINDOW_MINIMIZE,
 * WINDOW_MAXIMIZE_TOGGLE, WINDOW_CLOSE, WINDOW_SET_ALWAYS_ON_TOP) plus the
 * main→renderer WINDOW_MAXIMIZED_CHANGED notifications emitted whenever the
 * window's maximize state changes. Window control uses ipcMain.on rather than
 * ipcMain.handle because none of these commands need to return a value to the
 * renderer. The always-on-top setting mirrors the renderer UI preference onto
 * the window via setAlwaysOnTop.
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

/**
 * Registers the window-management IPC handlers for the given window.
 *
 * @param {BrowserWindow} win - The window that is controlled by these handlers
 *   and whose maximize state changes are reported back to the renderer on
 *   IPC.WINDOW_MAXIMIZED_CHANGED.
 * @returns {void} Nothing is returned.
 */
export function registerWindowHandlers(win: BrowserWindow): void {
  /**
   * Handles the IPC.WINDOW_MINIMIZE channel (window-minimize).
   * Minimizes the window. Fire-and-forget; no return value.
   * @returns {void} Nothing is returned.
   */
  ipcMain.on(IPC.WINDOW_MINIMIZE, () => {
    log.debug(LOG_IPC_WINDOW_MINIMIZE);
    win.minimize();
  });

  /**
   * Handles the IPC.WINDOW_MAXIMIZE_TOGGLE channel (window-maximize-toggle).
   * Toggles the window between maximized and restored state based on its
   * current isMaximized() state.
   * @returns {void} Nothing is returned.
   */
  ipcMain.on(IPC.WINDOW_MAXIMIZE_TOGGLE, () => {
    log.debug(LOG_IPC_WINDOW_MAXIMIZE_TOGGLE, { maximized: win.isMaximized() });
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  /**
   * Handles the IPC.WINDOW_CLOSE channel (window-close).
   * Closes the window, which triggers the normal window close lifecycle.
   * @returns {void} Nothing is returned.
   */
  ipcMain.on(IPC.WINDOW_CLOSE, () => {
    log.debug(LOG_IPC_WINDOW_CLOSE);
    win.close();
  });

  /**
   * Handles the IPC.WINDOW_SET_ALWAYS_ON_TOP channel (window-set-always-on-top).
   * Sets or clears the always-on-top window flag.
   *
   * @param {boolean} flag - Desired always-on-top state. Coerced via Boolean()
   *   so any truthy/falsy payload is accepted.
   * @returns {void} Nothing is returned.
   */
  ipcMain.on(IPC.WINDOW_SET_ALWAYS_ON_TOP, (_event, flag: boolean) => {
    log.debug(LOG_IPC_WINDOW_SET_ALWAYS_ON_TOP, { flag });
    win.setAlwaysOnTop(Boolean(flag));
  });

  /**
   * Notifies the renderer on IPC.WINDOW_MAXIMIZED_CHANGED with `true` when the
   * window becomes maximized, provided the window is still alive.
   * @returns {void} Nothing is returned.
   */
  win.on('maximize', () => {
    if (!win.isDestroyed()) win.webContents.send(IPC.WINDOW_MAXIMIZED_CHANGED, true);
  });

  /**
   * Notifies the renderer on IPC.WINDOW_MAXIMIZED_CHANGED with `false` when
   * the window is restored from a maximized state, provided the window is
   * still alive.
   * @returns {void} Nothing is returned.
   */
  win.on('unmaximize', () => {
    if (!win.isDestroyed()) win.webContents.send(IPC.WINDOW_MAXIMIZED_CHANGED, false);
  });
}
