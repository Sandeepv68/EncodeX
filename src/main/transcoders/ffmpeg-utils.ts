/**
 * @fileoverview FFmpeg utility functions and CLI argument generation.
 * Re-exports the ffmpeg/ffprobe executable path resolvers (see
 * {@link ../media-binaries}) and builds the raw ffmpeg command-line argument
 * array from a ConversionOptions object. This shared builder is used by the
 * FFToolCore and BmfCore backends so all CLI-based transcoders produce
 * identical commands.
 */

import { Logger } from '../../shared/logger';
import { ConversionOptions } from '../../shared/types';
import { FFMPEG_FLAGS } from '../../shared/transcoder-constants';
import { getFfmpegPath, getFfprobePath } from '../media-binaries';
import { getHwAccelArgs } from './hwaccel';
import {
  LOG_AUDIO_BITRATE,
  LOG_AUDIO_CODEC,
  LOG_AUDIO_DISABLED_OUTPUT_WILL_HAVE_NO_AUDIO_STREAM,
  LOG_DURATION_CAPITALIZED,
  LOG_END_TIME,
  LOG_PIXEL_FORMAT,
  LOG_QSCALE,
  LOG_SCALE,
  LOG_START_TIME,
  LOG_VIDEO_BITRATE,
  LOG_VIDEO_CODEC,
  LOG_VIDEO_DISABLED_OUTPUT_WILL_HAVE_NO_VIDEO_STREAM,
} from '../../shared/log-constants';

/**
 * Logger instance scoped to the ffmpeg utilities module. Logs each flag emitted
 * while building ffmpeg arguments.
 * @const {Logger} log
 */
const log = new Logger('main/transcoders/ffmpeg-utils');

export { getFfmpegPath, getFfprobePath };

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
