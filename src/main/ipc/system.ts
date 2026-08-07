/**
 * @fileoverview IPC handlers for OS integration utilities.
 * Registers the REVEAL_FILE channel (queue-reveal), which reveals a file in
 * the operating system's default file manager via Electron's shell module.
 */

import { ipcMain, shell, BrowserWindow } from 'electron';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import { LOG_IPC_REVEAL_FILE } from '../../shared/log-constants';

const log = new Logger('main/ipc/system');

/**
 * Registers the OS integration IPC handlers for the given window.
 *
 * @param {BrowserWindow} win - The BrowserWindow associated with the renderer.
 *   Unused directly; retained for API symmetry with the other registration
 *   modules.
 * @returns {void} Nothing is returned.
 */
export function registerSystemHandlers(win: BrowserWindow): void {
  /**
   * Handles the IPC.REVEAL_FILE channel (queue-reveal).
   * Opens the OS file manager and selects the given path. The path is expected
   * to exist; revealing a non-existent file falls back to opening its parent
   * directory in most operating systems.
   *
   * @param {string} filePath - Absolute path of the file (or folder) to reveal.
   * @returns {Promise<void>} Resolves after the reveal request is issued.
   */
  ipcMain.handle(IPC.REVEAL_FILE, async (_event, filePath: string) => {
    log.debug(LOG_IPC_REVEAL_FILE, filePath);
    shell.showItemInFolder(filePath);
  });
}
