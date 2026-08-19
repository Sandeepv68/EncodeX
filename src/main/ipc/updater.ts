/**
 * @fileoverview IPC handlers for the in-app update manager.
 *
 * Registers renderer-invocable channels (check-for-updates, download-update,
 * install-update, cancel-download, open-release-notes) and pushes asynchronous
 * status events (update-available, update-not-available, update-progress,
 * update-downloaded, update-error) back to the renderer.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import { checkForUpdate, downloadUpdate, installUpdate, cancelDownload, openReleaseNotes } from '../updater';
import type { UpdateInfo } from '../../shared/types';
import {
  LOG_IPC_CHECK_FOR_UPDATES,
  LOG_IPC_DOWNLOAD_UPDATE,
  LOG_IPC_INSTALL_UPDATE,
  LOG_IPC_CANCEL_DOWNLOAD,
  LOG_UPDATER_ERROR,
} from '../../shared/log-constants';

const log = new Logger('main/ipc/updater');

/** Cached update info from the last successful check, used to avoid re-checking before download. @type {UpdateInfo | null} */
let cachedUpdateInfo: UpdateInfo | null = null;

/**
 * Registers the update IPC handlers for the given BrowserWindow.
 *
 * @param {BrowserWindow} win - The main application window used as the
 *   target for progress/status events.
 * @returns {void}
 */
export function registerUpdaterHandlers(win: BrowserWindow): void {
  /**
   * Handles IPC.CHECK_FOR_UPDATES ('check-for-updates').
   * Queries the GitHub Releases API, compares versions, and sends either
   * UPDATE_AVAILABLE (with update info) or UPDATE_NOT_AVAILABLE to the renderer.
   */
  ipcMain.handle(IPC.CHECK_FOR_UPDATES, async () => {
    log.info(LOG_IPC_CHECK_FOR_UPDATES);
    try {
      const info = await checkForUpdate();
      if (info) {
        cachedUpdateInfo = info;
        if (!win.isDestroyed()) {
          win.webContents.send(IPC.UPDATE_AVAILABLE, info);
        }
      } else {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC.UPDATE_NOT_AVAILABLE);
        }
      }
    } catch (err) {
      log.error(LOG_UPDATER_ERROR, err);
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.UPDATE_ERROR, (err as Error).message);
      }
    }
  });

  /**
   * Handles IPC.DOWNLOAD_UPDATE ('download-update').
   * Downloads the platform-specific installer for the cached update info.
   * Sends UPDATE_PROGRESS events during download and UPDATE_DOWNLOADED on
   * completion with the installer file path.
   */
  ipcMain.handle(IPC.DOWNLOAD_UPDATE, async () => {
    log.info(LOG_IPC_DOWNLOAD_UPDATE);
    const info = cachedUpdateInfo;
    if (!info) {
      const msg = 'No update info available. Run check-for-updates first.';
      log.error(LOG_UPDATER_ERROR, msg);
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.UPDATE_ERROR, msg);
      }
      return;
    }
    try {
      const filePath = await downloadUpdate(info, win);
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.UPDATE_DOWNLOADED, filePath);
      }
    } catch (err) {
      log.error(LOG_UPDATER_ERROR, err);
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.UPDATE_ERROR, (err as Error).message);
      }
    }
  });

  /**
   * Handles IPC.INSTALL_UPDATE ('install-update').
   * Launches the downloaded installer and quits the application.
   * @param {_event} - The IPC event (unused).
   * @param {string} installerPath - Absolute path to the downloaded installer.
   */
  ipcMain.handle(IPC.INSTALL_UPDATE, async (_event, installerPath: string) => {
    log.info(LOG_IPC_INSTALL_UPDATE, installerPath);
    try {
      await installUpdate(installerPath);
    } catch (err) {
      log.error(LOG_UPDATER_ERROR, err);
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.UPDATE_ERROR, (err as Error).message);
      }
    }
  });

  /**
   * Handles IPC.CANCEL_DOWNLOAD ('cancel-download').
   * Aborts an in-progress download.
   */
  ipcMain.handle(IPC.CANCEL_DOWNLOAD, async () => {
    log.info(LOG_IPC_CANCEL_DOWNLOAD);
    cancelDownload();
  });

  /**
   * Handles IPC.OPEN_RELEASE_NOTES ('open-release-notes').
   * Opens the release page URL in the system browser.
   * @param {_event} - The IPC event (unused).
   * @param {string} url - The release page URL.
   */
  ipcMain.handle(IPC.OPEN_RELEASE_NOTES, async (_event, url: string) => {
    try {
      await openReleaseNotes(url);
    } catch (err) {
      log.error(LOG_UPDATER_ERROR, err);
    }
  });
}
