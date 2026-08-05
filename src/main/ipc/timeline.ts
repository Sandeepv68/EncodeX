/**
 * @fileoverview IPC handlers for video timeline operations.
 * Handles waveform extraction, thumbnail generation for timeline visualization.
 */

import { ipcMain } from 'electron';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import { extractWaveform, extractThumbnails } from '../timeline/timeline-media';
import { formatError } from '../../shared/errors';
import {
  LOG_DURATION,
  LOG_IPC_EXTRACT_THUMBNAILS,
  LOG_IPC_EXTRACT_THUMBNAILS_FAILED,
  LOG_IPC_EXTRACT_WAVEFORM,
  LOG_IPC_EXTRACT_WAVEFORM_FAILED,
} from '../../shared/log-constants';

const log = new Logger('main/ipc/timeline');

export function registerTimelineHandlers(): void {
  ipcMain.handle(IPC.EXTRACT_WAVEFORM, async (_event, filePath: string, duration: number) => {
    log.info(LOG_IPC_EXTRACT_WAVEFORM, filePath, LOG_DURATION, duration);
    try {
      return await extractWaveform(filePath, duration);
    } catch (err: unknown) {
      log.error(LOG_IPC_EXTRACT_WAVEFORM_FAILED, err);
      throw formatError(err);
    }
  });

  ipcMain.handle(IPC.EXTRACT_THUMBNAILS, async (_event, filePath: string, duration: number) => {
    log.info(LOG_IPC_EXTRACT_THUMBNAILS, filePath, LOG_DURATION, duration);
    try {
      return await extractThumbnails(filePath, duration);
    } catch (err: unknown) {
      log.error(LOG_IPC_EXTRACT_THUMBNAILS_FAILED, err);
      throw formatError(err);
    }
  });
}
