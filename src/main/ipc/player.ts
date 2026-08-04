import { ipcMain, BrowserWindow } from 'electron';
import { FfmpegCore } from '../transcoders/ffmpeg-core';
import { FrameDecoder, DecodedFrame, AudioDecodeConfig } from '../player/frame-decoder';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import { TRANSCODER_DEFAULTS } from '../../shared/transcoder-constants';
import { IpcSender } from './send';

const log = new Logger('main/ipc/player');

function capResolution(width: number, height: number): { width: number; height: number } {
  const maxWidth = TRANSCODER_DEFAULTS.PLAYER_PREVIEW_MAX_WIDTH;
  const maxHeight = TRANSCODER_DEFAULTS.PLAYER_PREVIEW_MAX_HEIGHT;
  if (width <= maxWidth && height <= maxHeight) return { width, height };
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return {
    width: Math.max(2, Math.round(width * scale) & ~1),
    height: Math.max(2, Math.round(height * scale) & ~1),
  };
}

export function registerPlayerHandlers(_win: BrowserWindow, send: IpcSender): void {
  const decoder = new FrameDecoder();
  const audioDecoder = new FrameDecoder();
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
        const { width, height } = capResolution(videoStream.width, videoStream.height);
        decoder.open(filePath, width, height);
        if (audioConfig) {
          audioDecoder.open(filePath, 0, 0, audioConfig, { realtime: false, audioOnly: true });
        } else {
          audioDecoder.close();
        }
      } else {
        decoder.open(filePath);
        audioDecoder.close();
      }
    } catch (err: unknown) {
      log.error('PLAYER_OPEN failed, falling back to default resolution:', err);
      audioConfig = null;
      decoder.open(filePath);
      audioDecoder.close();
    }
    return decoder.getGeneration();
  });

  ipcMain.handle(IPC.PLAYER_SEEK, async (_event, time: string) => {
    log.debug('PLAYER_SEEK:', time);
    decoder.seek(time);
    audioDecoder.seek(time);
    return decoder.getGeneration();
  });

  ipcMain.handle(IPC.PLAYER_CLOSE, async () => {
    log.debug('PLAYER_CLOSE');
    decoder.close();
    audioDecoder.close();
  });

  ipcMain.on(IPC.PLAYER_AUDIO_FLOW, (_event, paused: boolean) => {
    audioDecoder.setAudioPaused(!!paused);
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

  audioDecoder.on('audio', (chunk: { buffer: Buffer; sampleRate: number; channels: number; generation: number }) => {
    if (!audioConfig) return;
    send(IPC.PLAYER_AUDIO, {
      data: chunk.buffer.buffer,
      sampleRate: chunk.sampleRate,
      channels: chunk.channels,
      generation: decoder.getGeneration(),
    });
  });
}
