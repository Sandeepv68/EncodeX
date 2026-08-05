/**
 * @fileoverview IPC handlers for media file conversion operations.
 * Manages conversion job lifecycle: start, progress tracking, cancellation, and completion.
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

export function registerConversionHandlers(_win: BrowserWindow, send: IpcSender): void {
  let currentTranscoder: ITranscoder | null = null;

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

  ipcMain.handle(IPC.PAUSE_CONVERSION, async () => {
    log.info(LOG_IPC_PAUSE_CONVERSION_CALLED);
    if (currentTranscoder) {
      currentTranscoder.pause();
    }
  });

  ipcMain.handle(IPC.RESUME_CONVERSION, async () => {
    log.info(LOG_IPC_RESUME_CONVERSION_CALLED);
    if (currentTranscoder) {
      currentTranscoder.resume();
    }
  });

  ipcMain.handle(IPC.CANCEL_CONVERSION, async () => {
    log.info(LOG_IPC_CANCEL_CONVERSION_CALLED);
    if (currentTranscoder) {
      currentTranscoder.cancel();
      currentTranscoder = null;
      log.info(LOG_CONVERSION_CANCELLED);
    }
  });
}
