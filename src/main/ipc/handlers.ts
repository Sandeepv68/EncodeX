import { ipcMain, dialog, BrowserWindow } from 'electron';
import { FfmpegCore } from '../transcoders/ffmpeg-core';
import { FFToolCore } from '../transcoders/fftool-core';
import { BmfCore } from '../transcoders/bmf-core';
import { JobQueue } from '../queue/job-queue';
import { FrameDecoder, DecodedFrame } from '../player/frame-decoder';
import { ConversionOptions, QueueJob, TranscoderType, ConversionProgress } from '../../shared/types';
import { IPC } from '../../shared/ipc-channels';
import { FILE_EXTENSIONS, FILE_FILTERS } from '../../shared/ui-constants';
import { TRANSCODER_DEFAULTS } from '../../shared/transcoder-constants';
import { formatError } from '../../shared/errors';

const jobQueue = new JobQueue();
let currentTranscoder: FfmpegCore | FFToolCore | BmfCore | null = null;

export function registerIpcHandlers(win: BrowserWindow): void {
  const send = (channel: string, ...args: any[]) => {
    if (!win.isDestroyed()) win.webContents.send(channel, ...args);
  };

  ipcMain.handle(IPC.SELECT_FILE, async (_event, filters?: Electron.FileFilter[]) => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: filters || [{ name: 'Media Files', extensions: [...FILE_EXTENSIONS.MEDIA_INPUT] }],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(IPC.SELECT_FILES, async (_event, filters?: Electron.FileFilter[]) => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: filters || [{ name: 'Media Files', extensions: [...FILE_EXTENSIONS.MEDIA_INPUT] }],
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle(IPC.SELECT_OUTPUT, async () => {
    const result = await dialog.showSaveDialog(win, {
      filters: [{ name: 'Media Files', extensions: [...FILE_EXTENSIONS.MEDIA_OUTPUT] }],
    });
    return result.canceled ? null : result.filePath;
  });

  ipcMain.handle(IPC.GET_MEDIA_INFO, async (_event, filePath: string, transcoderType: TranscoderType) => {
    try {
      const transcoder = createTranscoder(transcoderType);
      return await transcoder.getInfo(filePath);
    } catch (err: any) {
      throw formatError(err);
    }
  });

  ipcMain.handle(IPC.CONVERT_FILE, async (_event, input: string, output: string, options: ConversionOptions, transcoderType: TranscoderType) => {
    try {
      const transcoder = createTranscoder(transcoderType);
      currentTranscoder = transcoder;
      const emitter = transcoder.convert(input, output, options);

      return await new Promise<void>((resolve, reject) => {
        emitter.on('progress', (progress: ConversionProgress) => {
          send(IPC.CONVERSION_PROGRESS, { input, output, progress });
        });
        emitter.on('error', (err: Error) => reject(formatError(err)));
        emitter.on('end', () => resolve());
      });
    } catch (err: any) {
      throw formatError(err);
    }
  });

  ipcMain.handle(IPC.CANCEL_CONVERSION, async () => {
    if (currentTranscoder) {
      currentTranscoder.cancel();
      currentTranscoder = null;
    }
  });

  ipcMain.handle(IPC.QUEUE_ADD, async (_event, input: string, output: string, options: ConversionOptions, transcoder: TranscoderType) => {
    return jobQueue.addJob(input, output, options, transcoder);
  });

  ipcMain.handle(IPC.QUEUE_REMOVE, async (_event, id: string) => {
    jobQueue.cancelJob(id);
  });

  ipcMain.handle(IPC.QUEUE_LIST, async () => {
    return jobQueue.getJobs();
  });

  ipcMain.handle(IPC.QUEUE_CANCEL_ALL, async () => {
    jobQueue.cancelAll();
  });

  jobQueue.on('added', (job: QueueJob) => send(IPC.QUEUE_ADDED, job));
  jobQueue.on('removed', (id: string) => send(IPC.QUEUE_REMOVED, id));
  jobQueue.on('statusChange', (job: QueueJob) => send(IPC.QUEUE_STATUS_CHANGE, job));
  jobQueue.on('progress', ({ job, progress }: { job: QueueJob; progress: ConversionProgress }) => {
    send(IPC.QUEUE_PROGRESS, { job, progress });
  });
  jobQueue.on('cancelled', () => send(IPC.QUEUE_CANCELLED));

  const decoder = new FrameDecoder();
  let decoderInput = '';

  ipcMain.handle(IPC.PLAYER_OPEN, async (_event, filePath: string) => {
    try {
      decoderInput = filePath;
      decoder.open(filePath);
    } catch (err: any) {
      throw formatError(err);
    }
  });

  ipcMain.handle(IPC.PLAYER_SEEK, async (_event, time: string) => {
    decoder.seek(time);
  });

  ipcMain.handle(IPC.PLAYER_CLOSE, async () => {
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
  switch (type) {
    case 'FFMPEG': return new FfmpegCore();
    case 'FFTOOL': return new FFToolCore();
    case 'BMF': return new BmfCore();
  }
}
