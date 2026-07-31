import { ipcMain, BrowserWindow } from 'electron';
import { createTranscoder } from '../transcoders/factory';
import { ITranscoder } from '../transcoders/interface';
import { Logger } from '../../shared/logger';
import { ConversionOptions, TranscoderType, ConversionProgress } from '../../shared/types';
import { IPC } from '../../shared/ipc-channels';
import { formatError } from '../../shared/errors';
import { IpcSender } from './send';

const log = new Logger('main/ipc/conversion');

export function registerConversionHandlers(_win: BrowserWindow, send: IpcSender): void {
  let currentTranscoder: ITranscoder | null = null;

  ipcMain.handle(IPC.GET_MEDIA_INFO, async (_event, filePath: string, transcoderType: TranscoderType) => {
    log.info('GET_MEDIA_INFO:', filePath, 'transcoder:', transcoderType);
    try {
      const transcoder = createTranscoder(transcoderType);
      const info = await transcoder.getInfo(filePath);
      log.info('GET_MEDIA_INFO completed:', info.format, info.duration.toFixed(2) + 's');
      return info;
    } catch (err: unknown) {
      log.error('GET_MEDIA_INFO failed:', err);
      throw formatError(err);
    }
  });

  ipcMain.handle(
    IPC.CONVERT_FILE,
    async (_event, input: string, output: string, options: ConversionOptions, transcoderType: TranscoderType) => {
      log.info('CONVERT_FILE:', input, '->', output, 'transcoder:', transcoderType, 'options:', JSON.stringify(options));
      try {
        const transcoder = createTranscoder(transcoderType);
        currentTranscoder = transcoder;
        const emitter = transcoder.convert(input, output, options);

        return await new Promise<void>((resolve, reject) => {
          emitter.on('progress', (progress: ConversionProgress) => {
            send(IPC.CONVERSION_PROGRESS, { input, output, progress });
          });
          emitter.on('error', (err: Error) => {
            log.error('CONVERT_FILE failed:', err);
            reject(formatError(err));
          });
          emitter.on('end', () => {
            log.info('CONVERT_FILE completed successfully');
            resolve();
          });
        });
      } catch (err: unknown) {
        log.error('CONVERT_FILE threw:', err);
        throw formatError(err);
      }
    },
  );

  ipcMain.handle(IPC.PAUSE_CONVERSION, async () => {
    log.info('PAUSE_CONVERSION called');
    if (currentTranscoder) {
      currentTranscoder.pause();
    }
  });

  ipcMain.handle(IPC.RESUME_CONVERSION, async () => {
    log.info('RESUME_CONVERSION called');
    if (currentTranscoder) {
      currentTranscoder.resume();
    }
  });

  ipcMain.handle(IPC.CANCEL_CONVERSION, async () => {
    log.info('CANCEL_CONVERSION called');
    if (currentTranscoder) {
      currentTranscoder.cancel();
      currentTranscoder = null;
      log.info('Conversion cancelled');
    }
  });
}
