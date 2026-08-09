/**
 * @fileoverview IPC handlers for window management operations.
 * Registers fire-and-forget window control channels (WINDOW_MINIMIZE,
 * WINDOW_MAXIMIZE_TOGGLE, WINDOW_CLOSE, WINDOW_SET_ALWAYS_ON_TOP) plus the
 * main→renderer WINDOW_MAXIMIZED_CHANGED notifications emitted whenever the
 * window's maximize state changes. Window control uses ipcMain.on rather than
 * ipcMain.handle because none of these commands need to return a value to the
 * renderer. The always-on-top setting mirrors the renderer UI preference onto
 * the window via setAlwaysOnTop.
 *
 * The window close lifecycle is guarded: whenever the BrowserWindow `close`
 * event fires (title-bar X, Alt+F4, taskbar close, Cmd+Q), the event is
 * prevented and a WINDOW_CLOSE_REQUESTED notification is pushed to the
 * renderer so it can verify whether any jobs are still in progress. The
 * renderer responds with WINDOW_CONFIRM_CLOSE once the user (or the absence of
 * active jobs) allows the close, which re-invokes win.close(). A destroyed or
 * crashed webContents skips the round-trip so a dead renderer can never trap
 * the window.
 */

import { BrowserWindow, ipcMain } from 'electron';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import {
  LOG_IPC_WINDOW_CLOSE,
  LOG_IPC_WINDOW_CONFIRM_CLOSE,
  LOG_IPC_WINDOW_CLOSE_REQUESTED,
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
   * Set once the renderer has confirmed the close is safe (either no jobs are
   * in progress or the user chose to close anyway). While false, every close
   * attempt is redirected to the renderer for confirmation.
   * @type {boolean}
   */
  let closeConfirmed = false;

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
   * Closes the window, which triggers the normal window close lifecycle and
   * therefore the close-confirmation guard.
   * @returns {void} Nothing is returned.
   */
  ipcMain.on(IPC.WINDOW_CLOSE, () => {
    log.debug(LOG_IPC_WINDOW_CLOSE);
    win.close();
  });

  /**
   * Handles the IPC.WINDOW_CONFIRM_CLOSE channel (window-confirm-close).
   * Marks the close as confirmed by the renderer (either no jobs were in
   * progress or the user chose to close anyway) and re-invokes win.close(),
   * which now passes the close guard and completes the window teardown.
   * @returns {void} Nothing is returned.
   */
  ipcMain.on(IPC.WINDOW_CONFIRM_CLOSE, () => {
    log.debug(LOG_IPC_WINDOW_CONFIRM_CLOSE);
    closeConfirmed = true;
    win.close();
  });

  /**
   * Intercepts every window close attempt (title-bar X, Alt+F4, taskbar close,
   * Cmd+Q). While the close has not been confirmed, the event is prevented and
   * a WINDOW_CLOSE_REQUESTED notification is sent to the renderer so it can
   * check for in-progress jobs and either confirm immediately or surface a
   * confirmation dialog. When the renderer is destroyed or crashed the
   * round-trip is skipped and the window is allowed to close so a dead
   * renderer can never block quitting.
   * @param {Electron.Event} event - The close event; preventDefault halts teardown.
   * @returns {void} Nothing is returned.
   */
  win.on('close', (event) => {
    if (closeConfirmed) return;
    if (win.webContents.isDestroyed() || win.webContents.isCrashed()) {
      log.info(LOG_IPC_WINDOW_CLOSE_REQUESTED, 'renderer unavailable, closing');
      closeConfirmed = true;
      win.close();
      return;
    }
    event.preventDefault();
    log.info(LOG_IPC_WINDOW_CLOSE_REQUESTED);
    win.webContents.send(IPC.WINDOW_CLOSE_REQUESTED);
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
