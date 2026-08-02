import { ipcMain } from 'electron';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import { getImageInfo } from '../image-info';
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
}
