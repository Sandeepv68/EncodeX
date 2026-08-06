/**
 * @fileoverview IPC handlers for native file and folder selection dialogs.
 * Registers handlers for the SELECT_FILE, SELECT_FILES and SELECT_OUTPUT
 * channels, bridging the renderer to Electron's dialog module so the UI can
 * pick input media files or choose an output destination. All dialogs are
 * attached to the owning BrowserWindow and are therefore modal to the
 * application frame. When the renderer does not supply filters, the media
 * input/output extension whitelists from src/shared/file-extensions.ts
 * (FILE_EXTENSIONS.MEDIA_INPUT / MEDIA_OUTPUT) are applied to restrict what
 * can be selected. Cancelled dialogs resolve with null (or an empty array for
 * multi-select) rather than rejecting.
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import { FILE_EXTENSIONS } from '../../shared/file-extensions';
import {
  LOG_IPC_SELECT_FILES_CALLED,
  LOG_IPC_SELECT_FILES_RESULT,
  LOG_IPC_SELECT_FILE_CALLED,
  LOG_IPC_SELECT_FILE_RESULT,
  LOG_IPC_SELECT_OUTPUT_CALLED,
  LOG_IPC_SELECT_OUTPUT_RESULT,
} from '../../shared/log-constants';

const log = new Logger('main/ipc/dialogs');

/**
 * Registers the native file/folder dialog IPC handlers for the given window.
 *
 * @param {BrowserWindow} win - The BrowserWindow the dialogs are attached to
 *   (acts as the modal parent of the native dialogs).
 * @returns {void} Nothing is returned.
 */
export function registerDialogHandlers(win: BrowserWindow): void {
  /**
   * Handles the IPC.SELECT_FILE channel (select-file).
   * Opens a single-file open dialog with the `openFile` property. On success
   * returns the chosen path; a cancelled dialog resolves with null.
   *
   * @param {Electron.FileFilter[]} [filters] - Optional dialog file filters.
   *   Defaults to a 'Media Files' filter built from
   *   FILE_EXTENSIONS.MEDIA_INPUT.
   * @returns {Promise<string | null>} The selected file path, or null when
   *   the dialog was cancelled.
   */
  ipcMain.handle(IPC.SELECT_FILE, async (_event, filters?: Electron.FileFilter[]) => {
    log.debug(LOG_IPC_SELECT_FILE_CALLED, { filters });
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: filters || [{ name: 'Media Files', extensions: [...FILE_EXTENSIONS.MEDIA_INPUT] }],
    });
    log.info(LOG_IPC_SELECT_FILE_RESULT, result.canceled ? 'cancelled' : result.filePaths[0]);
    return result.canceled ? null : result.filePaths[0];
  });

  /**
   * Handles the IPC.SELECT_FILES channel (select-files).
   * Opens a multi-select file open dialog (`openFile` + `multiSelections`
   * properties). On success returns all chosen paths; a cancelled dialog
   * resolves with an empty array.
   *
   * @param {Electron.FileFilter[]} [filters] - Optional dialog file filters.
   *   Defaults to a 'Media Files' filter built from
   *   FILE_EXTENSIONS.MEDIA_INPUT.
   * @returns {Promise<string[]>} The selected file paths, or an empty array
   *   when the dialog was cancelled.
   */
  ipcMain.handle(IPC.SELECT_FILES, async (_event, filters?: Electron.FileFilter[]) => {
    log.debug(LOG_IPC_SELECT_FILES_CALLED, { filters });
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: filters || [{ name: 'Media Files', extensions: [...FILE_EXTENSIONS.MEDIA_INPUT] }],
    });
    log.info(LOG_IPC_SELECT_FILES_RESULT, result.canceled ? 'cancelled' : `${result.filePaths.length} files`);
    return result.canceled ? [] : result.filePaths;
  });

  /**
   * Handles the IPC.SELECT_OUTPUT channel (select-output).
   * Opens a save dialog restricted to the media output extension whitelist
   * (FILE_EXTENSIONS.MEDIA_OUTPUT). On success returns the chosen destination
   * path; a cancelled dialog resolves with null.
   *
   * @returns {Promise<string | null>} The chosen output file path, or null
   *   when the dialog was cancelled.
   */
  ipcMain.handle(IPC.SELECT_OUTPUT, async () => {
    log.debug(LOG_IPC_SELECT_OUTPUT_CALLED);
    const result = await dialog.showSaveDialog(win, {
      filters: [{ name: 'Media Files', extensions: [...FILE_EXTENSIONS.MEDIA_OUTPUT] }],
    });
    log.info(LOG_IPC_SELECT_OUTPUT_RESULT, result.canceled ? 'cancelled' : result.filePath);
    return result.canceled ? null : result.filePath;
  });
}
