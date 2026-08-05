/**
 * @fileoverview IPC handlers for video timeline operations.
 * Handles waveform extraction, thumbnail generation for timeline visualization.
 */

import { ipcMain } from 'electron';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import { extractWaveform, extractThumbnails } from '../timeline/timeline-media';
import { formatError } from '../../shared/errors';

const log = new Logger('main/ipc/timeline');

export function registerTimelineHandlers(): void {
  ipcMain.handle(IPC.EXTRACT_WAVEFORM, async (_event, filePath: string, duration: number) => {
    log.info('EXTRACT_WAVEFORM:', filePath, 'duration:', duration);
    try {
      return await extractWaveform(filePath, duration);
    } catch (err: unknown) {
      log.error('EXTRACT_WAVEFORM failed:', err);
      throw formatError(err);
    }
  });

  ipcMain.handle(IPC.EXTRACT_THUMBNAILS, async (_event, filePath: string, duration: number) => {
    log.info('EXTRACT_THUMBNAILS:', filePath, 'duration:', duration);
    try {
      return await extractThumbnails(filePath, duration);
    } catch (err: unknown) {
      log.error('EXTRACT_THUMBNAILS failed:', err);
      throw formatError(err);
    }
  });
}
