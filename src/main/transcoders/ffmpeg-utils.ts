/**
 * @fileoverview FFmpeg utility functions and CLI argument generation.
 * Resolves the ffmpeg/ffprobe executable paths (preferring the statically
 * bundled binaries) and builds the raw ffmpeg command-line argument array from
 * a ConversionOptions object. This shared builder is used by the FFToolCore and
 * BmfCore backends so all CLI-based transcoders produce identical commands.
 */

import { existsSync } from 'fs';
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
  LOG_VIDEO_DISABLED_OUTPUT_WILL_HAVE_NO_VIDEO_STREAM,
} from '../../shared/log-constants';

/**
 * Logger instance scoped to the ffmpeg utilities module. Logs ffmpeg/ffprobe
 * path fallbacks and each flag emitted while building ffmpeg arguments.
 * @const {Logger} log
 */
const log = new Logger('main/transcoders/ffmpeg-utils');

/**
 * Resolves the ffmpeg executable path.
 *
 * Prefers the statically bundled ffmpeg binary from `ffmpeg-static`; if it is
 * missing on disk, logs a warning and falls back to the system `ffmpeg` command.
 * @returns {string} Absolute path to the bundled ffmpeg binary, or `'ffmpeg'`
 *   for the system-installed executable
 */
export function getFfmpegPath(): string {
  const staticPath = ffmpegStatic as unknown as string;
  if (existsSync(staticPath)) return staticPath;
  log.warn(LOG_FFMPEG_STATIC_NOT_FOUND_FALLING_BACK_TO_SYSTEM_FFMPEG);
  return TRANSCODER_COMMANDS.FFMPEG;
}

/**
 * Resolves the ffprobe executable path.
 *
 * Attempts to require the `ffprobe-static` package to get its bundled binary
 * path; on any failure (package missing or load error) it logs a warning and
 * falls back to the system `ffprobe` command.
 * @returns {string} Absolute path to the bundled ffprobe binary, or `'ffprobe'`
 *   for the system-installed executable
 */
export function getFfprobePath(): string {
  try {
    return require('ffprobe-static').path;
  } catch {
    log.warn(LOG_FFPROBE_STATIC_NOT_FOUND_FALLING_BACK_TO_SYSTEM_FFPROBE);
    return TRANSCODER_COMMANDS.FFPROBE;
  }
}

/**
 * Builds a complete ffmpeg CLI argument array from conversion options.
 *
 * Argument assembly order:
 * 1. Hardware acceleration input flags (from {@link getHwAccelArgs}), prepended
 *    only when not in stream-copy mode (hwaccel is incompatible with `-c copy`).
 * 2. `-i <input>` input file.
 * 3. Copy mode: `-c copy`. Otherwise, in order: video codec (`-vcodec`), audio
 *    codec (`-acodec`), video bitrate (`-b:v`), audio bitrate (`-b:a`), quality
 *    scale (`-qscale:v`), a `scale=<WxH>` video filter (`-vf scale=...`), and
 *    pixel format (`-pix_fmt`).
 * 4. Audio disable (`-an`) when `options.audio === false`.
 * 5. Trimming: start time (`-ss`), end time (`-to`), duration (`-t`).
 * 6. Overwrite flag (`-y`) and the output path last.
 *
 * Note the scale filter is passed through verbatim (`scale=WxH`); callers
 * wanting aspect-ratio preservation supply the `:-2` variant themselves.
 * @param {string} input - Absolute path of the input media file
 * @param {string} output - Absolute path of the output file
 * @param {ConversionOptions} options - Encoding options to translate into flags
 * @returns {string[]} Ordered array of ffmpeg arguments ready for spawn()
 */
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

  if (options.video === false) {
    args.push(FFMPEG_FLAGS.NO_VIDEO);
    log.debug(LOG_VIDEO_DISABLED_OUTPUT_WILL_HAVE_NO_VIDEO_STREAM);
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
