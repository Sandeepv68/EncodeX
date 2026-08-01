import { existsSync } from 'fs';
import ffmpegStatic from 'ffmpeg-static';
import { Logger } from '../../shared/logger';
import { ConversionOptions } from '../../shared/types';
import { FFMPEG_FLAGS } from '../../shared/transcoder-constants';
import { getHwAccelArgs } from './hwaccel';

const log = new Logger('main/transcoders/ffmpeg-utils');

export function getFfmpegPath(): string {
  const staticPath = ffmpegStatic as unknown as string;
  if (existsSync(staticPath)) return staticPath;
  log.warn('ffmpeg-static not found, falling back to system ffmpeg');
  return 'ffmpeg';
}

export function getFfprobePath(): string {
  try {
    return require('ffprobe-static').path;
  } catch {
    log.warn('ffprobe-static not found, falling back to system ffprobe');
    return 'ffprobe';
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
      log.debug('Video codec:', options.videoCodec);
    }
    if (options.audioCodec) {
      args.push(FFMPEG_FLAGS.AUDIO_CODEC, options.audioCodec);
      log.debug('Audio codec:', options.audioCodec);
    }
    if (options.videoBitrate) {
      args.push(FFMPEG_FLAGS.VIDEO_BITRATE, options.videoBitrate);
      log.debug('Video bitrate:', options.videoBitrate);
    }
    if (options.audioBitrate) {
      args.push(FFMPEG_FLAGS.AUDIO_BITRATE, options.audioBitrate);
      log.debug('Audio bitrate:', options.audioBitrate);
    }
    if (options.qscale !== undefined) {
      args.push(FFMPEG_FLAGS.QSCALE, String(options.qscale));
      log.debug('Qscale:', options.qscale);
    }
    if (options.scale) {
      args.push(FFMPEG_FLAGS.VIDEO_FILTER, `${FFMPEG_FLAGS.SCALE}${options.scale}`);
      log.debug('Scale:', options.scale);
    }
    if (options.pixelFormat) {
      args.push(FFMPEG_FLAGS.PIX_FMT, options.pixelFormat);
      log.debug('Pixel format:', options.pixelFormat);
    }
  }

  if (options.startTime) {
    args.push(FFMPEG_FLAGS.START, options.startTime);
    log.debug('Start time:', options.startTime);
  }
  if (options.endTime) {
    args.push(FFMPEG_FLAGS.END, options.endTime);
    log.debug('End time:', options.endTime);
  }
  if (options.duration) {
    args.push(FFMPEG_FLAGS.DURATION, options.duration);
    log.debug('Duration:', options.duration);
  }

  args.push(FFMPEG_FLAGS.OVERWRITE, output);
  return args;
}
