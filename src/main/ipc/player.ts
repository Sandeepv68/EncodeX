/**
 * @fileoverview IPC handlers for video player operations.
 * Runs video and audio decoding in separate ffmpeg processes so backpressure
 * on one stream can never stall the other, then forwards decoded frames and
 * audio chunks to the renderer.
 */

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
  const videoDecoder = new FrameDecoder();
  const audioDecoder = new FrameDecoder();
  let audioConfig: AudioDecodeConfig | null = null;
  // Single generation counter shared by both decoders so the renderer can
  // discard stale frames/chunks from either stream after a seek or reopen.
  let generation = 0;

  const VIDEO_OPTIONS = { realtime: true, audioOnly: false, fpsCap: TRANSCODER_DEFAULTS.PLAYER_FPS_CAP } as const;
  const AUDIO_OPTIONS = { realtime: true, audioOnly: true, fpsCap: 0 } as const;

  ipcMain.handle(IPC.PLAYER_OPEN, async (_event, filePath: string) => {
    log.info('PLAYER_OPEN:', filePath);
    try {
      audioDecoder.close();
      const info = await new FfmpegCore().getInfo(filePath);
      const videoStream = info.streams?.find((s) => s.type === 'video');
      const audioStream = info.streams?.find((s) => s.type === 'audio');
      audioConfig = audioStream
        ? {
            sampleRate: Math.max(8000, audioStream.sampleRate ?? 48000),
            channels: Math.max(1, audioStream.channels ?? 2),
          }
        : null;
      if (videoStream?.width && videoStream?.height) {
        const { width, height } = capResolution(videoStream.width, videoStream.height);
        videoDecoder.open(filePath, width, height, undefined, VIDEO_OPTIONS);
      } else {
        // No usable video stream, decode at the default resolution.
        videoDecoder.open(filePath);
      }
      if (audioConfig) {
        audioDecoder.open(filePath, undefined, undefined, audioConfig, AUDIO_OPTIONS);
      }
    } catch (err: unknown) {
      log.error('PLAYER_OPEN failed, falling back to default resolution:', err);
      audioConfig = null;
      audioDecoder.close();
      videoDecoder.open(filePath);
    }
    return ++generation;
  });

  ipcMain.handle(IPC.PLAYER_SEEK, async (_event, time: string) => {
    log.debug('PLAYER_SEEK:', time);
    videoDecoder.seek(time);
    audioDecoder.seek(time);
    return ++generation;
  });

  ipcMain.handle(IPC.PLAYER_CLOSE, async () => {
    log.debug('PLAYER_CLOSE');
    videoDecoder.close();
    audioDecoder.close();
  });

  ipcMain.handle(IPC.PLAYER_GET_FRAME, async () => {
    return new Promise<DecodedFrame | null>((resolve) => {
      const onFrame = (frame: DecodedFrame) => {
        videoDecoder.removeListener('frame', onFrame);
        resolve(frame);
      };
      videoDecoder.on('frame', onFrame);
      setTimeout(() => {
        videoDecoder.removeListener('frame', onFrame);
        resolve(null);
      }, TRANSCODER_DEFAULTS.PLAYER_FRAME_TIMEOUT_MS);
    });
  });

  videoDecoder.on('frame', (frame: DecodedFrame) => {
    send(IPC.PLAYER_FRAME, {
      data: frame.buffer.buffer,
      width: frame.width,
      height: frame.height,
      pts: frame.pts,
      generation,
    });
  });

  audioDecoder.on('audio', (chunk: { buffer: Buffer; sampleRate: number; channels: number }) => {
    if (!audioConfig) return;
    send(IPC.PLAYER_AUDIO, {
      data: chunk.buffer.buffer,
      sampleRate: chunk.sampleRate,
      channels: chunk.channels,
      generation,
    });
  });

  const forwardError = (err: Error) => {
    log.error('Player decoder error:', err);
    send(IPC.PLAYER_ERROR, err.message);
  };
  videoDecoder.on('error', forwardError);
  audioDecoder.on('error', forwardError);
}
