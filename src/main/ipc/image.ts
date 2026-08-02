import { ipcMain } from 'electron';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import { getImageInfo } from '../image-info';
import { getImagePreview } from '../image-preview';
import { getImageFileInfo } from '../image-file-info';
import { getVideoPreview } from '../video-preview';
import { formatError } from '../../shared/errors';

const log = new Logger('main/ipc/image');

export function registerImageHandlers(): void {
  ipcMain.handle(IPC.GET_IMAGE_INFO, async (_event, filePath: string) => {
    log.info('GET_IMAGE_INFO:', filePath);
    try {
      return await getImageInfo(filePath);
    } catch (err: unknown) {
      log.error('GET_IMAGE_INFO failed:', err);
      throw formatError(err);
    }
  });

  ipcMain.handle(IPC.GET_IMAGE_PREVIEW, async (_event, filePath: string) => {
    log.info('GET_IMAGE_PREVIEW:', filePath);
    try {
      return await getImagePreview(filePath);
    } catch (err: unknown) {
      log.error('GET_IMAGE_PREVIEW failed:', err);
      throw formatError(err);
    }
  });

  ipcMain.handle(IPC.GET_IMAGE_FILE_INFO, async (_event, filePath: string) => {
    log.info('GET_IMAGE_FILE_INFO:', filePath);
    try {
      return await getImageFileInfo(filePath);
    } catch (err: unknown) {
      log.error('GET_IMAGE_FILE_INFO failed:', err);
      throw formatError(err);
    }
  });

  ipcMain.handle(IPC.GET_VIDEO_PREVIEW, async (_event, filePath: string) => {
    log.info('GET_VIDEO_PREVIEW:', filePath);
    try {
      return await getVideoPreview(filePath);
    } catch (err: unknown) {
      log.error('GET_VIDEO_PREVIEW failed:', err);
      throw formatError(err);
    }
  });
}
