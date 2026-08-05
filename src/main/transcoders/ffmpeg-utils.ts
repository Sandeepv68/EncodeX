import { existsSync } from 'fs';
/**
 * @fileoverview FFmpeg utility functions and path resolution.
 * Handles FFmpeg executable detection and path management.
 */

import ffmpegStatic from 'ffmpeg-static';
import { Logger } from '../../shared/logger';
import { ConversionOptions } from '../../shared/types';
import { FFMPEG_FLAGS, TRANSCODER_COMMANDS } from '../../shared/transcoder-constants';
import { getHwAccelArgs } from './hwaccel';
import {
  LOG_AUDIO_BITRATE,
  LOG_AUDIO_CODEC,
  LOG_AUDIO_DISABLED_OUTPUT_WILL_HAVE_NO_AUDIO_STREAM,
  LOG_DURATION_CAPITALIZED,
  LOG_END_TIME,
  LOG_FFMPEG_STATIC_NOT_FOUND_FALLING_BACK_TO_SYSTEM_FFMPEG,
  LOG_FFPROBE_STATIC_NOT_FOUND_FALLING_BACK_TO_SYSTEM_FFPROBE,
  LOG_PIXEL_FORMAT,
  LOG_QSCALE,
  LOG_SCALE,
  LOG_START_TIME,
  LOG_VIDEO_BITRATE,
  LOG_VIDEO_CODEC,
} from '../../shared/log-constants';

const log = new Logger('main/transcoders/ffmpeg-utils');

export function getFfmpegPath(): string {
  const staticPath = ffmpegStatic as unknown as string;
  if (existsSync(staticPath)) return staticPath;
  log.warn(LOG_FFMPEG_STATIC_NOT_FOUND_FALLING_BACK_TO_SYSTEM_FFMPEG);
  return TRANSCODER_COMMANDS.FFMPEG;
}

export function getFfprobePath(): string {
  try {
    return require('ffprobe-static').path;
  } catch {
    log.warn(LOG_FFPROBE_STATIC_NOT_FOUND_FALLING_BACK_TO_SYSTEM_FFPROBE);
    return TRANSCODER_COMMANDS.FFPROBE;
  }
}

export function buildFfmpegArgs(input: string, output: string, options: ConversionOptions): string[] {
  const args: string[] = [];
  if (!options.copy) {
    args.push(...getHwAccelArgs(options.videoCodec, options.hardwareAcceleration, options.hwaccelMode));
  }
  args.push(FFMPEG_FLAGS.INPUT, input);

  if (options.copy) {
    args.push(FFMPEG_FLAGS.COPY, FFMPEG_FLAGS.COPY_VALUE);
  } else {
    if (options.videoCodec) {
      args.push(FFMPEG_FLAGS.VIDEO_CODEC, options.videoCodec);
      log.debug(LOG_VIDEO_CODEC, options.videoCodec);
    }
    if (options.audioCodec) {
      args.push(FFMPEG_FLAGS.AUDIO_CODEC, options.audioCodec);
      log.debug(LOG_AUDIO_CODEC, options.audioCodec);
    }
    if (options.videoBitrate) {
      args.push(FFMPEG_FLAGS.VIDEO_BITRATE, options.videoBitrate);
      log.debug(LOG_VIDEO_BITRATE, options.videoBitrate);
    }
    if (options.audioBitrate) {
      args.push(FFMPEG_FLAGS.AUDIO_BITRATE, options.audioBitrate);
      log.debug(LOG_AUDIO_BITRATE, options.audioBitrate);
    }
    if (options.qscale !== undefined) {
      args.push(FFMPEG_FLAGS.QSCALE, String(options.qscale));
      log.debug(LOG_QSCALE, options.qscale);
    }
    if (options.scale) {
      args.push(FFMPEG_FLAGS.VIDEO_FILTER, `${FFMPEG_FLAGS.SCALE}${options.scale}`);
      log.debug(LOG_SCALE, options.scale);
    }
    if (options.pixelFormat) {
      args.push(FFMPEG_FLAGS.PIX_FMT, options.pixelFormat);
      log.debug(LOG_PIXEL_FORMAT, options.pixelFormat);
    }
  }

  if (options.audio === false) {
    args.push(FFMPEG_FLAGS.NO_AUDIO);
    log.debug(LOG_AUDIO_DISABLED_OUTPUT_WILL_HAVE_NO_AUDIO_STREAM);
  }

  if (options.startTime) {
    args.push(FFMPEG_FLAGS.START, options.startTime);
    log.debug(LOG_START_TIME, options.startTime);
  }
  if (options.endTime) {
    args.push(FFMPEG_FLAGS.END, options.endTime);
    log.debug(LOG_END_TIME, options.endTime);
  }
  if (options.duration) {
    args.push(FFMPEG_FLAGS.DURATION, options.duration);
    log.debug(LOG_DURATION_CAPITALIZED, options.duration);
  }

  args.push(FFMPEG_FLAGS.OVERWRITE, output);
  return args;
}
