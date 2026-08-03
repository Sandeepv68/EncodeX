import { ipcMain, BrowserWindow } from 'electron';
import { FfmpegCore } from '../transcoders/ffmpeg-core';
import { FrameDecoder, DecodedFrame, AudioDecodeConfig } from '../player/frame-decoder';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import { TRANSCODER_DEFAULTS } from '../../shared/transcoder-constants';
import { IpcSender } from './send';

const log = new Logger('main/ipc/player');

export function registerPlayerHandlers(_win: BrowserWindow, send: IpcSender): void {
  const decoder = new FrameDecoder();
  let decoderInput = '';
  let audioConfig: AudioDecodeConfig | null = null;

  ipcMain.handle(IPC.PLAYER_OPEN, async (_event, filePath: string) => {
    log.info('PLAYER_OPEN:', filePath);
    try {
      decoderInput = filePath;
      const info = await new FfmpegCore().getInfo(filePath);
      const videoStream = info.streams?.find((s) => s.type === 'video');
      const audioStream = info.streams?.find((s) => s.type === 'audio');
      audioConfig = audioStream ? { sampleRate: audioStream.sampleRate ?? 48000, channels: audioStream.channels ?? 2 } : null;
      if (videoStream?.width && videoStream?.height) {
        if (audioConfig) {
          decoder.open(filePath, videoStream.width, videoStream.height, audioConfig);
        } else {
          decoder.open(filePath, videoStream.width, videoStream.height);
        }
      } else {
        decoder.open(filePath);
      }
    } catch (err: unknown) {
      log.error('PLAYER_OPEN failed, falling back to default resolution:', err);
      audioConfig = null;
      decoder.open(filePath);
    }
    return decoder.getGeneration();
  });

  ipcMain.handle(IPC.PLAYER_SEEK, async (_event, time: string) => {
    log.debug('PLAYER_SEEK:', time);
    decoder.seek(time);
    return decoder.getGeneration();
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
      generation: frame.generation,
    });
  });

  decoder.on('audio', (chunk: { buffer: Buffer; sampleRate: number; channels: number; generation: number }) => {
    if (!audioConfig) return;
    send(IPC.PLAYER_AUDIO, {
      data: chunk.buffer.buffer,
      sampleRate: chunk.sampleRate,
      channels: chunk.channels,
      generation: chunk.generation,
    });
  });
}
