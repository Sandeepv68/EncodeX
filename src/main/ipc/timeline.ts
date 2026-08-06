/**
 * @fileoverview IPC handlers for video timeline operations.
 * Registers the EXTRACT_WAVEFORM and EXTRACT_THUMBNAILS channels, which
 * generate normalized waveform bucket data and a montage strip of evenly
 * spaced thumbnails used to render the timeline UI. Both delegate to
 * src/main/timeline/timeline-media.ts. Failures are logged and re-thrown as
 * formatted AppError values (via formatError) so the renderer receives
 * consistent, typed errors; benign extraction failures resolve with null.
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

/**
 * Registers the timeline extraction IPC handlers.
 *
 * @returns {void} Nothing is returned.
 */
export function registerTimelineHandlers(): void {
  /**
   * Handles the IPC.EXTRACT_WAVEFORM channel (extract-waveform).
   * Computes a normalized waveform representation of the media file for
   * timeline visualization.
   *
   * @param {string} filePath - Absolute path of the audio/video file.
   * @param {number} duration - Total media duration in seconds; used to
   *   derive the bucket layout and segmentation of the extraction.
   * @returns {Promise<WaveformData | null>} Waveform data (sampleRate,
   *   samplesPerBucket, min/max bucket pairs), or null when extraction could
   *   not be performed.
   * @throws {Promise<AppError>} Rejects with a formatted AppError when
   *   waveform extraction throws unexpectedly.
   */
  ipcMain.handle(IPC.EXTRACT_WAVEFORM, async (_event, filePath: string, duration: number) => {
    log.info(LOG_IPC_EXTRACT_WAVEFORM, filePath, LOG_DURATION, duration);
    try {
      return await extractWaveform(filePath, duration);
    } catch (err: unknown) {
      log.error(LOG_IPC_EXTRACT_WAVEFORM_FAILED, err);
      throw formatError(err);
    }
  });

  /**
   * Handles the IPC.EXTRACT_THUMBNAILS channel (extract-thumbnails).
   * Extracts a grid of evenly spaced thumbnail frames and returns them as a
   * single montage image.
   *
   * @param {string} filePath - Absolute path of the video file.
   * @param {number} duration - Total video duration in seconds; used to
   *   compute the thumbnail interval and count.
   * @returns {Promise<ThumbnailStrip | null>} Thumbnail montage (dataUrl,
   *   grid columns/rows, tile size, interval, count), or null when extraction
   *   could not be performed.
   * @throws {Promise<AppError>} Rejects with a formatted AppError when
   *   thumbnail extraction throws unexpectedly.
   */
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
