/**
 * @fileoverview IPC handlers for image and video file inspection.
 * Registers handlers for the GET_IMAGE_INFO, GET_IMAGE_PREVIEW,
 * GET_IMAGE_FILE_INFO and GET_VIDEO_PREVIEW channels. These expose image
 * metadata/EXIF + histogram extraction, base64 preview data-URL generation,
 * header-based dimension probing, and single-frame video previews, backed by
 * the helper modules in src/main (image-info, image-preview,
 * image-file-info, video-preview). All handler failures are logged and
 * re-thrown as formatted AppError values (via formatError) so the renderer
 * receives consistent, typed errors; benign outcomes such as "not a readable
 * file" resolve with null instead of throwing.
 */

import { ipcMain } from 'electron';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import { getImageInfo } from '../image-info';
import { getImagePreview } from '../image-preview';
import { getImageFileInfo } from '../image-file-info';
import { getVideoPreview } from '../video-preview';
import { formatError } from '../../shared/errors';
import {
  LOG_IPC_GET_IMAGE_FILE_INFO,
  LOG_IPC_GET_IMAGE_FILE_INFO_FAILED,
  LOG_IPC_GET_IMAGE_INFO,
  LOG_IPC_GET_IMAGE_INFO_FAILED,
  LOG_IPC_GET_IMAGE_PREVIEW,
  LOG_IPC_GET_IMAGE_PREVIEW_FAILED,
  LOG_IPC_GET_VIDEO_PREVIEW,
  LOG_IPC_GET_VIDEO_PREVIEW_FAILED,
} from '../../shared/log-constants';

const log = new Logger('main/ipc/image');

/**
 * Registers all image/video inspection IPC handlers.
 *
 * @returns {void} Nothing is returned.
 */
export function registerImageHandlers(): void {
  /**
   * Handles the IPC.GET_IMAGE_INFO channel (get-image-info).
   * Returns flattened EXIF metadata plus a per-channel RGB and luma
   * histogram for the image.
   *
   * @param {string} filePath - Absolute path of the image file.
   * @returns {Promise<ImageExifData | null>} { file, exif, histogram } data,
   *   or null when the file is not an image or yields no parseable EXIF or
   *   histogram data.
   * @throws {Promise<AppError>} Rejects with a formatted AppError when the
   *   underlying extraction throws unexpectedly.
   */
  ipcMain.handle(IPC.GET_IMAGE_INFO, async (_event, filePath: string) => {
    log.info(LOG_IPC_GET_IMAGE_INFO, filePath);
    try {
      return await getImageInfo(filePath);
    } catch (err: unknown) {
      log.error(LOG_IPC_GET_IMAGE_INFO_FAILED, err);
      throw formatError(err);
    }
  });

  /**
   * Handles the IPC.GET_IMAGE_PREVIEW channel (get-image-preview).
   * Reads the image file and returns a base64 data-URL
   * (`data:<mime>;base64,...`) derived from the file extension's MIME type,
   * suitable for direct use as an <img> src.
   *
   * @param {string} filePath - Absolute path of the image file.
   * @returns {Promise<string | null>} Data-URL preview string, or null when
   *   the file is not a readable image with a known MIME type.
   * @throws {Promise<AppError>} Rejects with a formatted AppError when the
   *   read operation throws unexpectedly.
   */
  ipcMain.handle(IPC.GET_IMAGE_PREVIEW, async (_event, filePath: string) => {
    log.info(LOG_IPC_GET_IMAGE_PREVIEW, filePath);
    try {
      return await getImagePreview(filePath);
    } catch (err: unknown) {
      log.error(LOG_IPC_GET_IMAGE_PREVIEW_FAILED, err);
      throw formatError(err);
    }
  });

  /**
   * Handles the IPC.GET_IMAGE_FILE_INFO channel (get-image-file-info).
   * Returns basic image file information (width, height, byte size) probed
   * from the file header and filesystem stat.
   *
   * @param {string} filePath - Absolute path of the image file.
   * @returns {Promise<ImageFileInfo | null>} { width, height, size } where
   *   width/height may be null if dimensions could not be parsed, or null
   *   when the file is not a readable image.
   * @throws {Promise<AppError>} Rejects with a formatted AppError when the
   *   probe throws unexpectedly.
   */
  ipcMain.handle(IPC.GET_IMAGE_FILE_INFO, async (_event, filePath: string) => {
    log.info(LOG_IPC_GET_IMAGE_FILE_INFO, filePath);
    try {
      return await getImageFileInfo(filePath);
    } catch (err: unknown) {
      log.error(LOG_IPC_GET_IMAGE_FILE_INFO_FAILED, err);
      throw formatError(err);
    }
  });

  /**
   * Handles the IPC.GET_VIDEO_PREVIEW channel (get-video-preview).
   * Extracts a single frame 10 seconds into the video (scaled to a max width
   * of 480px) as a PNG data-URL, skipping past the usually blank opening.
   *
   * @param {string} filePath - Absolute path of the video file.
   * @returns {Promise<string | null>} PNG data-URL of the preview frame, or
   *   null when the file is not a readable video or extraction produced no
   *   output.
   * @throws {Promise<AppError>} Rejects with a formatted AppError when the
   *   ffmpeg process fails to spawn.
   */
  ipcMain.handle(IPC.GET_VIDEO_PREVIEW, async (_event, filePath: string) => {
    log.info(LOG_IPC_GET_VIDEO_PREVIEW, filePath);
    try {
      return await getVideoPreview(filePath);
    } catch (err: unknown) {
      log.error(LOG_IPC_GET_VIDEO_PREVIEW_FAILED, err);
      throw formatError(err);
    }
  });
}
