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
import { FFMPEG_FLAGS, ROTATE_DEGREES, isMetadataRotationContainer } from '../../shared/transcoder-constants';
import { getFfmpegPath, getFfprobePath } from '../media-binaries';
import { getHwAccelArgs } from './hwaccel';
import { getExtension } from '../../shared/codec-containers';
import {
  LOG_AUDIO_BITRATE,
  LOG_AUDIO_CODEC,
  LOG_AUDIO_DISABLED_OUTPUT_WILL_HAVE_NO_AUDIO_STREAM,
  LOG_DURATION_CAPITALIZED,
  LOG_END_TIME,
  LOG_PIXEL_FORMAT,
  LOG_QSCALE,
  LOG_ROTATION,
  LOG_ROTATION_COPY_UNSUPPORTED,
  LOG_ROTATION_METADATA,
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
 * Builds the rotation/mirror video filters for the given options.
 *
 * 90° clockwise maps to `transpose=1`, 90° counter-clockwise to `transpose=2`,
 * and 180° to a double transpose (interpolation-free). Horizontal and vertical
 * mirroring append `hflip`/`vflip`. Filters are ordered rotation-before-mirror.
 * @param {ConversionOptions} options - Conversion options with rotation fields.
 * @returns {string[]} Ordered rotation filter strings (empty when none requested).
 */
export function buildRotationFilters(options: ConversionOptions): string[] {
  const filters: string[] = [];
  if (options.rotate === '90') {
    filters.push('transpose=1');
  } else if (options.rotate === '180') {
    filters.push('transpose=2', 'transpose=2');
  } else if (options.rotate === '270') {
    filters.push('transpose=2');
  }
  if (options.flipH) {
    filters.push('hflip');
  }
  if (options.flipV) {
    filters.push('vflip');
  }
  return filters;
}

/**
 * Builds a complete video filter chain from the conversion options: the scale
 * filter (when `options.scale` is set) followed by any rotation/mirror filters.
 *
 * The result is a single comma-joined filter chain suitable for one `-vf`
 * argument (FFmpeg forbids emitting multiple `-vf` flags). Returns null when no
 * filters apply.
 * @param {ConversionOptions} options - Conversion options to translate.
 * @returns {string | null} The filter chain, or null when no filter is needed.
 */
export function buildVideoFilterChain(options: ConversionOptions): string | null {
  const filters: string[] = [];
  if (options.scale) {
    filters.push(`${FFMPEG_FLAGS.SCALE}${options.scale}`);
  }
  filters.push(...buildRotationFilters(options));
  return filters.length > 0 ? filters.join(',') : null;
}

/**
 * Computes the `rotate=<degrees>` metadata value for lossless rotation in
 * stream-copy mode. Rotation can be written as container metadata (no re-encode)
 * only when copy mode is active, a rotation is requested, no mirroring is
 * requested (mirrors always need pixels), and the output container writes
 * rotate metadata (MP4/MOV/MKV).
 * @param {ConversionOptions} options - Conversion options to translate.
 * @param {string} output - Output file path (its extension is checked).
 * @returns {string | null} The `rotate=` metadata value, or null when lossless
 *   metadata rotation does not apply.
 */
export function metadataRotationValue(options: ConversionOptions, output: string): string | null {
  if (!options.copy || !options.rotate || options.flipH || options.flipV) {
    return null;
  }
  if (!isMetadataRotationContainer(getExtension(output))) {
    return null;
  }
  return ROTATE_DEGREES[options.rotate];
}

/**
 * Builds a complete ffmpeg CLI argument array from conversion options.
 *
 * Argument assembly order:
 * 1. Hardware acceleration input flags (from {@link getHwAccelArgs}), prepended
 *    only when not in stream-copy mode (hwaccel is incompatible with `-c copy`).
 * 2. `-i <input>` input file.
 * 3. Copy mode: `-c copy`, plus `-metadata:s:v rotate=<deg>` when a rotation is
 *    requested and the output container stores rotation metadata (lossless). A
 *    rotation/flip that cannot be expressed in copy mode is skipped with a
 *    warning. Otherwise, in order: video codec (`-vcodec`), audio codec
 *    (`-acodec`), video bitrate (`-b:v`), audio bitrate (`-b:a`), quality scale
 *    (`-qscale:v`), a single video filter chain (`-vf scale=...,transpose=...,
 *    hflip,vflip`), and pixel format (`-pix_fmt`).
 * 4. Audio disable (`-an`) when `options.audio === false`.
 * 5. Trimming: start time (`-ss`), end time (`-to`), duration (`-t`).
 * 6. Overwrite flag (`-y`) and the output path last.
 *
 * Note the scale filter is passed through verbatim (`scale=WxH`); callers
 * wanting aspect-ratio preservation supply the `:-2` variant themselves.
 * Rotation/mirror filters from {@link buildRotationFilters} are appended after
 * scale inside the same `-vf` chain.
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
  if (options.inputArgs?.length) {
    args.push(...options.inputArgs);
  }
  args.push(FFMPEG_FLAGS.INPUT, input);

  if (options.copy) {
    args.push(FFMPEG_FLAGS.COPY, FFMPEG_FLAGS.COPY_VALUE);
    const rotation = metadataRotationValue(options, output);
    if (rotation) {
      args.push(FFMPEG_FLAGS.METADATA_ROTATE, `rotate=${rotation}`);
      log.debug(LOG_ROTATION_METADATA, rotation);
    } else if (options.rotate || options.flipH || options.flipV) {
      log.warn(LOG_ROTATION_COPY_UNSUPPORTED);
    }
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
    const filterChain = buildVideoFilterChain(options);
    if (filterChain) {
      args.push(FFMPEG_FLAGS.VIDEO_FILTER, filterChain);
      if (options.scale) log.debug(LOG_SCALE, options.scale);
      if (options.rotate) log.debug(LOG_ROTATION, options.rotate);
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

  if (options.extraArgs?.length) {
    args.push(...options.extraArgs);
  }

  args.push(FFMPEG_FLAGS.OVERWRITE, output);
  return args;
}
