/**
 * @fileoverview IPC handlers for video player operations.
 * Runs video and audio decoding in separate ffmpeg processes so backpressure
 * on one stream can never stall the other, then forwards decoded frames and
 * audio chunks to the renderer.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { FfmpegCore } from '../transcoders/ffmpeg-core';
import { FrameDecoder } from '../player/frame-decoder';
import type { DecodedFrame, AudioDecodeConfig } from '../player/types';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import { TRANSCODER_DEFAULTS } from '../../shared/transcoder-constants';
import {
  AUDIO_MIN_SAMPLE_RATE,
  AUDIO_DEFAULT_SAMPLE_RATE,
  AUDIO_MIN_CHANNELS,
  AUDIO_DEFAULT_CHANNELS,
  PLAYER_MIN_DIMENSION,
} from '../../shared/constants';
import type { IpcSender } from './types';
import {
  LOG_IPC_PLAYER_CLOSE,
  LOG_IPC_PLAYER_OPEN,
  LOG_IPC_PLAYER_OPEN_FAILED_FALLING_BACK_TO_DEFAULT_RESOLUTION,
  LOG_IPC_PLAYER_SEEK,
  LOG_PLAYER_DECODER_ERROR,
} from '../../shared/log-constants';

const log = new Logger('main/ipc/player');

function capResolution(width: number, height: number): { width: number; height: number } {
  const maxWidth = TRANSCODER_DEFAULTS.PLAYER_PREVIEW_MAX_WIDTH;
  const maxHeight = TRANSCODER_DEFAULTS.PLAYER_PREVIEW_MAX_HEIGHT;
  if (width <= maxWidth && height <= maxHeight) return { width, height };
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return {
    width: Math.max(PLAYER_MIN_DIMENSION, Math.round(width * scale) & ~1),
    height: Math.max(PLAYER_MIN_DIMENSION, Math.round(height * scale) & ~1),
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
    log.info(LOG_IPC_PLAYER_OPEN, filePath);
    try {
      audioDecoder.close();
      const info = await new FfmpegCore().getInfo(filePath);
      const videoStream = info.streams?.find((s) => s.type === 'video');
      const audioStream = info.streams?.find((s) => s.type === 'audio');
      audioConfig = audioStream
        ? {
            sampleRate: Math.max(AUDIO_MIN_SAMPLE_RATE, audioStream.sampleRate ?? AUDIO_DEFAULT_SAMPLE_RATE),
            channels: Math.max(AUDIO_MIN_CHANNELS, audioStream.channels ?? AUDIO_DEFAULT_CHANNELS),
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
      log.error(LOG_IPC_PLAYER_OPEN_FAILED_FALLING_BACK_TO_DEFAULT_RESOLUTION, err);
      audioConfig = null;
      audioDecoder.close();
      videoDecoder.open(filePath);
    }
    return ++generation;
  });

  ipcMain.handle(IPC.PLAYER_SEEK, async (_event, time: string) => {
    log.debug(LOG_IPC_PLAYER_SEEK, time);
    videoDecoder.seek(time);
    audioDecoder.seek(time);
    return ++generation;
  });

  ipcMain.handle(IPC.PLAYER_CLOSE, async () => {
    log.debug(LOG_IPC_PLAYER_CLOSE);
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
    log.error(LOG_PLAYER_DECODER_ERROR, err);
    send(IPC.PLAYER_ERROR, err.message);
  };
  videoDecoder.on('error', forwardError);
  audioDecoder.on('error', forwardError);
}
