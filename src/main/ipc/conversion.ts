/**
 * @fileoverview IPC handlers for media file conversion operations.
 * Registers the main-process handlers for the single-file conversion
 * workflow: media probing (GET_MEDIA_INFO), conversion start (CONVERT_FILE)
 * and lifecycle control (PAUSE_CONVERSION, RESUME_CONVERSION,
 * CANCEL_CONVERSION). Progress is streamed back to the renderer on the
 * CONVERSION_PROGRESS channel while a conversion runs. The module keeps a
 * reference to the active transcoder (currentTranscoder) so pause, resume and
 * cancel commands target the conversion currently in flight; starting a new
 * CONVERT_FILE replaces that reference. Errors are logged and re-thrown as
 * formatted AppError values so the renderer receives consistent typed errors.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { unlink } from 'fs';
import { createTranscoder } from '../transcoders/factory';
import type { ITranscoder } from '../transcoders/types';
import { Logger } from '../../shared/logger';
import { ConversionOptions, TranscoderType, ConversionProgress } from '../../shared/types';
import { IPC } from '../../shared/ipc-channels';
import { formatError } from '../../shared/errors';
import type { IpcSender } from './types';
import {
  LOG_ARROW,
  LOG_CONVERSION_CANCELLED,
  LOG_FAILED_TO_CLEAN_UP_PARTIAL_OUTPUT,
  LOG_IPC_CANCEL_CONVERSION_CALLED,
  LOG_IPC_CONVERT_FILE,
  LOG_IPC_CONVERT_FILE_COMPLETED_SUCCESSFULLY,
  LOG_IPC_CONVERT_FILE_FAILED,
  LOG_IPC_CONVERT_FILE_THREW,
  LOG_IPC_GET_MEDIA_INFO,
  LOG_IPC_GET_MEDIA_INFO_COMPLETED,
  LOG_IPC_GET_MEDIA_INFO_FAILED,
  LOG_IPC_PAUSE_CONVERSION_CALLED,
  LOG_IPC_RESUME_CONVERSION_CALLED,
  LOG_OPTIONS,
  LOG_REMOVED_PARTIAL_OUTPUT,
  LOG_TRANSCODER,
} from '../../shared/log-constants';

const log = new Logger('main/ipc/conversion');

/**
 * Registers all single-file conversion IPC handlers for the given window.
 *
 * The handlers close over the module-scoped `currentTranscoder`, which points
 * at the transcoder of the most recently started conversion. PAUSE /
 * RESUME / CANCEL act on that instance only; once a conversion completes or
 * is cancelled the reference is cleared.
 *
 * @param {BrowserWindow} _win - The BrowserWindow associated with the
 *   renderer. Retained for API symmetry with the other registration modules;
 *   conversion handlers do not use the window directly.
 * @param {IpcSender} send - Main→renderer sender used to push conversion
 *   progress notifications on the IPC.CONVERSION_PROGRESS channel.
 * @returns {void} Nothing is returned.
 */
export function registerConversionHandlers(_win: BrowserWindow, send: IpcSender): void {
  /** Transcoder of the conversion currently in flight, or null when idle. */
  let currentTranscoder: ITranscoder | null = null;

  /**
   * Handles the IPC.GET_MEDIA_INFO channel (get-media-info).
   * Probes a media file with the selected transcoder backend and returns its
   * format and stream metadata for the UI.
   *
   * @param {string} filePath - Absolute path of the media file to probe.
   * @param {TranscoderType} transcoderType - Transcoder backend to use
   *   ('FFMPEG' | 'FFTOOL' | 'BMF'), resolved via createTranscoder().
   * @returns {Promise<MediaInfo>} Media format and stream information. On
   *   success a log line with the detected format and duration (2 decimals)
   *   is emitted.
   * @throws {Promise<AppError>} Rejects with a formatted AppError when the
   *   probe fails or the file cannot be read.
   */
  ipcMain.handle(IPC.GET_MEDIA_INFO, async (_event, filePath: string, transcoderType: TranscoderType) => {
    log.info(LOG_IPC_GET_MEDIA_INFO, filePath, LOG_TRANSCODER, transcoderType);
    try {
      const transcoder = createTranscoder(transcoderType);
      const info = await transcoder.getInfo(filePath);
      log.info(LOG_IPC_GET_MEDIA_INFO_COMPLETED, info.format, info.duration.toFixed(2) + 's');
      return info;
    } catch (err: unknown) {
      log.error(LOG_IPC_GET_MEDIA_INFO_FAILED, err);
      throw formatError(err);
    }
  });

  ipcMain.handle(
    IPC.CONVERT_FILE,
    async (_event, input: string, output: string, options: ConversionOptions, transcoderType: TranscoderType) => {
      /**
       * Handles the IPC.CONVERT_FILE channel (convert-file).
       * Starts a single-file conversion on the selected transcoder backend and
       * resolves once the conversion completes. The running transcoder is
       * stored in `currentTranscoder` so it can be paused, resumed or
       * cancelled from the lifecycle channels. Progress events are forwarded
       * to the renderer on IPC.CONVERSION_PROGRESS as
       * { input, output, progress }.
       *
       * @param {string} input - Absolute path of the source media file.
       * @param {string} output - Absolute path of the destination file. When
       *   output equals input (in-place conversion) partial output cleanup is
       *   skipped on failure.
       * @param {ConversionOptions} options - Codec, bitrate, scaling, quality
       *   and trim options for the conversion.
       * @param {TranscoderType} transcoderType - Backend used to perform the
       *   conversion ('FFMPEG' | 'FFTOOL' | 'BMF').
       * @returns {Promise<void>} Resolves when the transcoder emits 'end'. On
       *   failure the partial output file is unlinked best-effort (ENOENT is
       *   tolerated) before the rejection is propagated.
       * @throws {Promise<AppError>} Rejects with a formatted AppError when
       *   the transcoder emits an error or createTranscoder()/convert()
       *   throws.
       */
      log.info(LOG_IPC_CONVERT_FILE, input, LOG_ARROW, output, LOG_TRANSCODER, transcoderType, LOG_OPTIONS, JSON.stringify(options));
      try {
        const transcoder = createTranscoder(transcoderType);
        currentTranscoder = transcoder;
        const emitter = transcoder.convert(input, output, options);

        return await new Promise<void>((resolve, reject) => {
          emitter.on('progress', (progress: ConversionProgress) => {
            send(IPC.CONVERSION_PROGRESS, { input, output, progress });
          });
          emitter.on('error', (err: Error) => {
            log.error(LOG_IPC_CONVERT_FILE_FAILED, err);
            if (output !== input) {
              unlink(output, (unlinkErr) => {
                if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                  log.debug(LOG_FAILED_TO_CLEAN_UP_PARTIAL_OUTPUT, output, unlinkErr.message);
                } else {
                  log.debug(LOG_REMOVED_PARTIAL_OUTPUT, output);
                }
              });
            }
            reject(formatError(err));
          });
          emitter.on('end', () => {
            log.info(LOG_IPC_CONVERT_FILE_COMPLETED_SUCCESSFULLY);
            resolve();
          });
        });
      } catch (err: unknown) {
        log.error(LOG_IPC_CONVERT_FILE_THREW, err);
        throw formatError(err);
      }
    },
  );

  /**
   * Handles the IPC.PAUSE_CONVERSION channel (pause-conversion).
   * Pauses the conversion currently in flight, if any. No-op when no
   * conversion is active.
   *
   * @returns {Promise<void>} Resolves immediately after the pause is issued.
   */
  ipcMain.handle(IPC.PAUSE_CONVERSION, async () => {
    log.info(LOG_IPC_PAUSE_CONVERSION_CALLED);
    if (currentTranscoder) {
      currentTranscoder.pause();
    }
  });

  /**
   * Handles the IPC.RESUME_CONVERSION channel (resume-conversion).
   * Resumes the conversion currently in flight, if any. No-op when no
   * conversion is active.
   *
   * @returns {Promise<void>} Resolves immediately after the resume is issued.
   */
  ipcMain.handle(IPC.RESUME_CONVERSION, async () => {
    log.info(LOG_IPC_RESUME_CONVERSION_CALLED);
    if (currentTranscoder) {
      currentTranscoder.resume();
    }
  });

  /**
   * Handles the IPC.CANCEL_CONVERSION channel (cancel-conversion).
   * Cancels the conversion currently in flight, then clears the module's
   * reference to it so a second cancel becomes a no-op.
   *
   * @returns {Promise<void>} Resolves immediately after the cancel is issued.
   */
  ipcMain.handle(IPC.CANCEL_CONVERSION, async () => {
    log.info(LOG_IPC_CANCEL_CONVERSION_CALLED);
    if (currentTranscoder) {
      currentTranscoder.cancel();
      currentTranscoder = null;
      log.info(LOG_CONVERSION_CANCELLED);
    }
  });
}
