import { ipcMain, BrowserWindow } from 'electron';
import { FfmpegCore } from '../transcoders/ffmpeg-core';
import { FrameDecoder, DecodedFrame } from '../player/frame-decoder';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import { TRANSCODER_DEFAULTS } from '../../shared/transcoder-constants';
import { IpcSender } from './send';

const log = new Logger('main/ipc/player');

export function registerPlayerHandlers(_win: BrowserWindow, send: IpcSender): void {
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
