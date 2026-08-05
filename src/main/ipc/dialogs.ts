/**
 * @fileoverview IPC handlers for native file and folder selection dialogs.
 * Provides file picker functionality bridged to Electron's dialog module.
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import { FILE_EXTENSIONS } from '../../shared/file-extensions';

const log = new Logger('main/ipc/dialogs');

export function registerDialogHandlers(win: BrowserWindow): void {
  ipcMain.handle(IPC.SELECT_FILE, async (_event, filters?: Electron.FileFilter[]) => {
    log.debug('SELECT_FILE called', { filters });
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: filters || [{ name: 'Media Files', extensions: [...FILE_EXTENSIONS.MEDIA_INPUT] }],
    });
    log.info('SELECT_FILE result:', result.canceled ? 'cancelled' : result.filePaths[0]);
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(IPC.SELECT_FILES, async (_event, filters?: Electron.FileFilter[]) => {
    log.debug('SELECT_FILES called', { filters });
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: filters || [{ name: 'Media Files', extensions: [...FILE_EXTENSIONS.MEDIA_INPUT] }],
    });
    log.info('SELECT_FILES result:', result.canceled ? 'cancelled' : `${result.filePaths.length} files`);
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle(IPC.SELECT_OUTPUT, async () => {
    log.debug('SELECT_OUTPUT called');
    const result = await dialog.showSaveDialog(win, {
      filters: [{ name: 'Media Files', extensions: [...FILE_EXTENSIONS.MEDIA_OUTPUT] }],
    });
    log.info('SELECT_OUTPUT result:', result.canceled ? 'cancelled' : result.filePath);
    return result.canceled ? null : result.filePath;
  });
}
