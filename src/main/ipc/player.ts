/**
 * @fileoverview IPC handlers for video player operations.
 * Runs video and audio decoding in separate ffmpeg processes so backpressure
 * on one stream can never stall the other, then forwards decoded frames and
 * audio chunks to the renderer. Registers the PLAYER_OPEN, PLAYER_SEEK,
 * PLAYER_CLOSE and PLAYER_GET_FRAME channels and pushes decoded data on the
 * PLAYER_FRAME / PLAYER_AUDIO channels plus fatal decoder errors on
 * PLAYER_ERROR. A shared generation counter is bumped on every open and seek
 * so the renderer can discard stale frames or audio chunks belonging to a
 * previous playback position. Two FrameDecoder instances (see
 * src/main/player/frame-decoder.ts) are owned per registration call; opening
 * a new file closes the previous audio/video decoding processes.
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

/**
 * Caps a video resolution to the player preview limits while preserving the
 * source aspect ratio and even pixel dimensions.
 *
 * @param {number} width - Source width in pixels.
 * @param {number} height - Source height in pixels.
 * @returns {{width: number, height: number}} The capped (width, height). If
 *   the input already fits within TRANSCODER_DEFAULTS.PLAYER_PREVIEW_MAX_WIDTH
 *   (640) and PLAYER_PREVIEW_MAX_HEIGHT (360) it is returned unchanged;
 *   otherwise it is scaled down uniformly, rounded to an even number of
 *   pixels (bitwise `& ~1`), and clamped to at least PLAYER_MIN_DIMENSION (2)
 *   on each side.
 */
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

/**
 * Registers all video player IPC handlers for the given window.
 *
 * Instantiates one FrameDecoder for video and one for audio so the two
 * streams decode concurrently in isolated ffmpeg processes. The renderer
 * requests frames on demand via PLAYER_GET_FRAME; decoded frames and audio
 * chunks are pushed asynchronously on PLAYER_FRAME / PLAYER_AUDIO. Decoder
 * errors are logged and forwarded to the renderer on PLAYER_ERROR.
 *
 * @param {BrowserWindow} _win - The BrowserWindow associated with the
 *   renderer. Unused directly; retained for API symmetry with the other
 *   registration modules.
 * @param {IpcSender} send - Main→renderer sender used to push decoded frames,
 *   audio chunks and player errors.
 * @returns {void} Nothing is returned.
 */
export function registerPlayerHandlers(_win: BrowserWindow, send: IpcSender): void {
  /** Decoder for the video stream (emits 'frame' events). */
  const videoDecoder = new FrameDecoder();
  /** Decoder for the audio stream (emits 'audio' events). */
  const audioDecoder = new FrameDecoder();
  /**
   * Audio decoding configuration (sample rate + channels) derived from the
   * opened file's audio stream, or null when no audio stream exists. Used to
   * decide whether the audio decoder should be opened and to guard the audio
   * chunk forwarding listener.
   * @type {AudioDecodeConfig | null}
   */
  let audioConfig: AudioDecodeConfig | null = null;
  /**
   * Generation counter shared by both decoders. Incremented on every open and
   * seek; the renderer uses it to discard stale frames/chunks from either
   * stream that arrive after a seek or reopen.
   * @type {number}
   */
  let generation = 0;

  /** Video decoding options: realtime pacing, audio disabled, fps capped to the configured player cap (30). */
  const VIDEO_OPTIONS = { realtime: true, audioOnly: false, fpsCap: TRANSCODER_DEFAULTS.PLAYER_FPS_CAP } as const;
  /** Audio-only decoding options: realtime pacing, no fps cap. */
  const AUDIO_OPTIONS = { realtime: true, audioOnly: true, fpsCap: 0 } as const;

  /**
   * Handles the IPC.PLAYER_OPEN channel (player-open).
   * Probes the file, then opens both decoders: video at the capped resolution
   * (or the default resolution when the file has no usable video stream) and
   * audio at a sample rate/channel count clamped to the player minimums. On
   * any failure it falls back to decoding video at the default resolution with
   * audio disabled, so playback still starts.
   *
   * @param {string} filePath - Absolute path of the media file to play.
   * @returns {Promise<number>} The new generation value; the renderer should
   *   associate subsequently pushed PLAYER_FRAME / PLAYER_AUDIO messages that
   *   carry this generation with the freshly opened file.
   */
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
        /** No usable video stream; decode at the default resolution. */
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

  /**
   * Handles the IPC.PLAYER_SEEK channel (player-seek).
   * Seeks both decoders to the given timestamp and invalidates previously
   * pushed data by bumping the generation counter.
   *
   * @param {string} time - Target timestamp in FFmpeg-accepted format (e.g.
   *   '12.5' or '00:00:12.500').
   * @returns {Promise<number>} The new generation value; frames/chunks
   *   carrying an older generation should be discarded by the renderer.
   */
  ipcMain.handle(IPC.PLAYER_SEEK, async (_event, time: string) => {
    log.debug(LOG_IPC_PLAYER_SEEK, time);
    videoDecoder.seek(time);
    audioDecoder.seek(time);
    return ++generation;
  });

  /**
   * Handles the IPC.PLAYER_CLOSE channel (player-close).
   * Closes both decoders, killing their ffmpeg processes and discarding any
   * pending frame/audio data.
   *
   * @returns {Promise<void>} Resolves once both decoders are closed.
   */
  ipcMain.handle(IPC.PLAYER_CLOSE, async () => {
    log.debug(LOG_IPC_PLAYER_CLOSE);
    videoDecoder.close();
    audioDecoder.close();
  });

  /**
   * Handles the IPC.PLAYER_GET_FRAME channel (player-get-frame).
   * Resolves with the next decoded video frame from the video decoder, or
   * null if no frame arrives within
   * TRANSCODER_DEFAULTS.PLAYER_FRAME_TIMEOUT_MS (5s). The listener is
   * one-shot: it is removed after the first frame or on timeout, so each call
   * requests exactly one frame.
   *
   * @returns {Promise<DecodedFrame | null>} A decoded frame (raw RGB24
   *   buffer, width, height, pts), or null on timeout.
   */
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

  /**
   * Forwards decoded video frames to the renderer on IPC.PLAYER_FRAME as
   * { data, width, height, pts, generation }. The frame's Buffer is sent as
   * its underlying ArrayBuffer (`frame.buffer.buffer`) so the pixel data
   * transfers zero-copy to the renderer.
   *
   * @param {DecodedFrame} frame - The decoded frame to forward.
   * @returns {void} Nothing is returned.
   */
  videoDecoder.on('frame', (frame: DecodedFrame) => {
    send(IPC.PLAYER_FRAME, {
      data: frame.buffer.buffer,
      width: frame.width,
      height: frame.height,
      pts: frame.pts,
      generation,
    });
  });

  /**
   * Forwards decoded audio chunks to the renderer on IPC.PLAYER_AUDIO as
   * { data, sampleRate, channels, generation }, transferring the underlying
   * ArrayBuffer of the chunk. Skipped when no audio config has been
   * established for the currently open file.
   *
   * @param {{buffer: Buffer, sampleRate: number, channels: number}} chunk -
   *   The decoded PCM audio chunk to forward.
   * @returns {void} Nothing is returned.
   */
  audioDecoder.on('audio', (chunk: { buffer: Buffer; sampleRate: number; channels: number }) => {
    if (!audioConfig) return;
    send(IPC.PLAYER_AUDIO, {
      data: chunk.buffer.buffer,
      sampleRate: chunk.sampleRate,
      channels: chunk.channels,
      generation,
    });
  });

  /**
   * Logs a decoder error and pushes its message to the renderer on
   * IPC.PLAYER_ERROR so the player UI can surface a failure.
   *
   * @param {Error} err - The error emitted by a decoder process.
   * @returns {void} Nothing is returned.
   */
  const forwardError = (err: Error) => {
    log.error(LOG_PLAYER_DECODER_ERROR, err);
    send(IPC.PLAYER_ERROR, err.message);
  };
  videoDecoder.on('error', forwardError);
  audioDecoder.on('error', forwardError);
}
