import { ipcMain, dialog, BrowserWindow } from 'electron';
import { FfmpegCore } from '../transcoders/ffmpeg-core';
import { FFToolCore } from '../transcoders/fftool-core';
import { BmfCore } from '../transcoders/bmf-core';
import { JobQueue } from '../queue/job-queue';
import { FrameDecoder, DecodedFrame } from '../player/frame-decoder';
import { Logger } from '../../shared/logger';
import { ConversionOptions, QueueJob, TranscoderType, ConversionProgress } from '../../shared/types';
import { IPC } from '../../shared/ipc-channels';
import { FILE_EXTENSIONS, FILE_FILTERS } from '../../shared/ui-constants';
import { TRANSCODER_DEFAULTS } from '../../shared/transcoder-constants';
import { formatError } from '../../shared/errors';

const log = new Logger('main/ipc/handlers');
const jobQueue = new JobQueue();
let currentTranscoder: FfmpegCore | FFToolCore | BmfCore | null = null;

export function registerIpcHandlers(win: BrowserWindow): void {
  log.info('Registering IPC handlers');

  const send = (channel: string, ...args: unknown[]) => {
    if (!win.isDestroyed()) win.webContents.send(channel, ...args);
  };

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

  ipcMain.handle(IPC.QUEUE_ADD, async (_event, input: string, output: string, options: ConversionOptions, transcoder: TranscoderType) => {
    log.info('QUEUE_ADD:', input, '->', output, 'transcoder:', transcoder);
    return jobQueue.addJob(input, output, options, transcoder);
  });

  ipcMain.handle(IPC.QUEUE_REMOVE, async (_event, id: string) => {
    log.info('QUEUE_REMOVE:', id);
    jobQueue.cancelJob(id);
  });

  ipcMain.handle(IPC.QUEUE_LIST, async () => {
    const jobs = jobQueue.getJobs();
    log.debug('QUEUE_LIST:', jobs.length, 'jobs');
    return jobs;
  });

  ipcMain.handle(IPC.QUEUE_CANCEL_ALL, async () => {
    log.info('QUEUE_CANCEL_ALL called');
    jobQueue.cancelAll();
  });

  jobQueue.on('added', (job: QueueJob) => {
    log.info('Queue job added:', job.id, job.input);
    send(IPC.QUEUE_ADDED, job);
  });
  jobQueue.on('removed', (id: string) => {
    log.info('Queue job removed:', id);
    send(IPC.QUEUE_REMOVED, id);
  });
  jobQueue.on('statusChange', (job: QueueJob) => {
    log.debug('Queue job status change:', job.id, job.status);
    send(IPC.QUEUE_STATUS_CHANGE, job);
  });
  jobQueue.on('progress', ({ job, progress }: { job: QueueJob; progress: ConversionProgress }) => {
    send(IPC.QUEUE_PROGRESS, { job, progress });
  });
  jobQueue.on('cancelled', () => {
    log.info('Queue cancelled');
    send(IPC.QUEUE_CANCELLED);
  });

  const decoder = new FrameDecoder();
  let decoderInput = '';

  ipcMain.handle(IPC.PLAYER_OPEN, async (_event, filePath: string) => {
    log.info('PLAYER_OPEN:', filePath);
    try {
      decoderInput = filePath;
      const info = await new FfmpegCore().getInfo(filePath);
      const videoStream = info.streams?.find((s) => s.type === 'video');
      if (videoStream?.width && videoStream?.height) {
        decoder.open(filePath, videoStream.width, videoStream.height);
      } else {
        decoder.open(filePath);
      }
    } catch (err: unknown) {
      log.error('PLAYER_OPEN failed, falling back to default resolution:', err);
      decoder.open(filePath);
    }
  });

  ipcMain.handle(IPC.PLAYER_SEEK, async (_event, time: string) => {
    log.debug('PLAYER_SEEK:', time);
    decoder.seek(time);
  });

  ipcMain.handle(IPC.PLAYER_CLOSE, async () => {
    log.debug('PLAYER_CLOSE');
    decoder.close();
  });

  ipcMain.handle(IPC.PLAYER_GET_FRAME, async () => {
    return new Promise<DecodedFrame | null>((resolve) => {
      const onFrame = (frame: DecodedFrame) => {
        decoder.removeListener('frame', onFrame);
        resolve(frame);
      };
      decoder.on('frame', onFrame);
      setTimeout(() => {
        decoder.removeListener('frame', onFrame);
        resolve(null);
      }, TRANSCODER_DEFAULTS.PLAYER_FRAME_TIMEOUT_MS);
    });
  });

  decoder.on('frame', (frame: DecodedFrame) => {
    send(IPC.PLAYER_FRAME, {
      data: frame.buffer.buffer,
      width: frame.width,
      height: frame.height,
      pts: frame.pts,
    });
  });
}

function createTranscoder(type: TranscoderType): FfmpegCore | FFToolCore | BmfCore {
  log.debug('Creating transcoder:', type);
  switch (type) {
    case 'FFMPEG':
      return new FfmpegCore();
    case 'FFTOOL':
      return new FFToolCore();
    case 'BMF':
      return new BmfCore();
  }
}
