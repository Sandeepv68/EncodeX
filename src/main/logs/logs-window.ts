/**
 * @fileoverview Detached Logs window lifecycle.
 *
 * The Logs page can be detached into its own OS window. That window is an
 * ordinary `BrowserWindow` that loads the same renderer bundle with a
 * `detached=1` marker in the URL, so the renderer can recognise it and render
 * the Logs page on its own - without the app shell around it.
 *
 * The window is a *subscriber* of the main-process log hub: every entry the
 * hub publishes is forwarded to it, so the detached view shows the same
 * entries as the in-app Logs page. The open/closed state is broadcast to every
 * window over `IPC.LOGS_WINDOW_STATE`, which is what hides the Logs entry in
 * the navigation drawer while the detached window is up.
 *
 * @module main/logs/logs-window
 */

import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { IPC } from '../../shared/ipc-channels';
import { APP_ICON, APP_NAME, DEV_SERVER_URL } from '../../shared/app-constants';
import { resolvePreloadPath, resolveRendererEntryPath } from '../paths';
import { logHub } from './log-hub';

/**
 * The detached Logs window, or `null` when none is open.
 * @type {BrowserWindow | null}
 */
let logsWindow: BrowserWindow | null = null;

/**
 * The URL query marker that tells the renderer it is running detached.
 *
 * The renderer reads it to decide whether to render the app shell or only the
 * Logs page, and to avoid mirroring its own console output back to the main
 * process (which would echo the detached window's noise into the shared log).
 * @const {string}
 */
export const DETACHED_QUERY = 'detached=1';

/**
 * True when the app runs in development mode, where the renderer is served by
 * the Vite dev server rather than loaded from disk.
 * @returns {boolean} True in development mode.
 */
function isDevRenderer(): boolean {
  return process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
}

/**
 * Subscribes a window to the log hub, so it receives every published entry.
 *
 * The main window subscribes as well: it shows the same entries in its in-app
 * Logs page, and the hub is what keeps both views in step.
 *
 * @param {BrowserWindow} win - The window to subscribe.
 * @returns {number} The subscription identity, for {@link unsubscribeWindowFromLogHub}.
 */
export function subscribeWindowToLogHub(win: BrowserWindow): number {
  return logHub.subscribe({
    webContentsId: win.webContents.id,
    isDestroyed: () => win.isDestroyed(),
    send: (entry) => win.webContents.send(IPC.LOG_MESSAGE, entry),
  });
}

/**
 * Removes a window from the log hub, so a closed window is never written to.
 *
 * @param {number} id - The subscription identity to remove.
 * @returns {void}
 */
export function unsubscribeWindowFromLogHub(id: number): void {
  logHub.unsubscribe(id);
}

/**
 * Broadcasts the open/closed state of the detached window to every window.
 *
 * The main window uses it to hide the Logs entry in the navigation drawer
 * while the detached window is up, and to show it again once it is closed.
 *
 * The payload is the id of the open window, or `null` when none is open - not
 * a bare boolean. A boolean channel carries no way to tell a real state from a
 * wrong-shaped payload, and the renderer's only safe reaction to an
 * unrecognised payload is to ignore it; a window id is recognisable, so a
 * payload that is not one is dropped instead of flipping the drawer.
 *
 * @param {boolean} open - True when the detached window is open.
 * @returns {void}
 */
export function broadcastLogsWindowState(open: boolean): void {
  const state = open && logsWindow ? logsWindow.id : null;
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed() || win.webContents.isDestroyed()) continue;
    win.webContents.send(IPC.LOGS_WINDOW_STATE, state);
  }
}

/**
 * True when a detached Logs window is currently open.
 *
 * @returns {boolean} True when the window exists and is alive.
 */
export function isLogsWindowOpen(): boolean {
  return logsWindow !== null && !logsWindow.isDestroyed();
}

/**
 * Opens the detached Logs window, or focuses it when it is already open.
 *
 * The window subscribes to the log hub, so it receives every entry published
 * from that moment on; the entries published before it opened are fetched
 * separately through the history channel. The hub subscription is removed
 * again when the window closes, so a closed window is never written to.
 *
 * @returns {void}
 */
export function openLogsWindow(): void {
  if (isLogsWindowOpen()) {
    logsWindow?.focus();
    return;
  }

  logsWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 520,
    minHeight: 380,
    title: `${APP_NAME} - Logs`,
    ...(process.platform !== 'darwin' ? { icon: path.join(app.getAppPath(), APP_ICON) } : {}),
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const webContents = logsWindow.webContents;
  const subscriptionId = logHub.subscribe({
    webContentsId: webContents.id,
    isDestroyed: () => webContents.isDestroyed(),
    send: (entry) => webContents.send(IPC.LOG_MESSAGE, entry),
  });

  if (isDevRenderer()) {
    logsWindow.loadURL(`${DEV_SERVER_URL}/?${DETACHED_QUERY}#/logs`);
  } else {
    logsWindow.loadFile(resolveRendererEntryPath(), { search: `?${DETACHED_QUERY}`, hash: '/logs' });
  }

  logsWindow.on('closed', () => {
    logHub.unsubscribe(subscriptionId);
    logsWindow = null;
    broadcastLogsWindowState(false);
  });

  broadcastLogsWindowState(true);
}
