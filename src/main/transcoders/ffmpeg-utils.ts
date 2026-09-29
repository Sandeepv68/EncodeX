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
import { buildFilterChain, buildRotationFilters as buildRotationFiltersShared, validateVideoFilters } from '../../shared/video-filters';
import { getFfmpegPath, getFfprobePath } from '../media-binaries';
import { getHwAccelArgs } from './hwaccel';
import { getExtension } from '../../shared/codec-containers';
import {
  LOG_ADDITIONAL_INPUT,
  LOG_ATTACH_COVER,
  LOG_ARROW,
  LOG_AUDIO_BITRATE,
  LOG_AUDIO_CODEC,
  LOG_AUDIO_DISABLED_OUTPUT_WILL_HAVE_NO_AUDIO_STREAM,
  LOG_CHAPTERS_FILE,
  LOG_COPY_CHAPTERS,
  LOG_DISPOSITION_KEYED,
  LOG_DURATION_CAPITALIZED,
  LOG_END_TIME,
  LOG_FILTER_INVALID,
  LOG_FILTERS_IGNORED_COPY,
  LOG_MAP,
  LOG_PIXEL_FORMAT,
  LOG_QSCALE,
  LOG_ROTATION,
  LOG_ROTATION_COPY_UNSUPPORTED,
  LOG_ROTATION_METADATA,
  LOG_SCALE,
  LOG_START_TIME,
  LOG_SUBTITLE_CODEC,
  LOG_SYNC_OFFSET,
  LOG_VIDEO_BITRATE,
  LOG_VIDEO_CODEC,
  LOG_VIDEO_FILTERS,
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
 * Maps rotate/flip conversion flags to their FFmpeg pixel-filter expressions.
 * Re-exported from the shared video-filters module so the CLI-based builders
 * (FFTool/Bmf) and the fluent-ffmpeg backend share one source of truth.
 * @param {ConversionOptions} options - Conversion options with rotation fields.
 * @returns {string[]} Ordered rotation filter strings (empty when none requested).
 */
export function buildRotationFilters(options: ConversionOptions): string[] {
  return buildRotationFromOptions({ rotate: options.rotate, flipH: options.flipH, flipV: options.flipV });
}

/**
 * Builds a complete video filter chain from conversion options: the `scale`
 * filter (when `options.scale` is set), rotation/mirror filters, and any user
 * `videoFilters` in array order.
 *
 * The result is a single comma-joined filter chain suitable for one `-vf`
 * argument (FFmpeg forbids emitting multiple `-vf` flags). Returns null when no
 * filters apply.
 * @param {ConversionOptions} options - Conversion options to translate.
 * @returns {string | null} The filter chain, or null when no filter is needed.
 */
export function buildVideoFilterChain(options: ConversionOptions): string | null {
  return buildFilterChain({
    scale: options.scale,
    rotate: options.rotate,
    flipH: options.flipH,
    flipV: options.flipV,
    videoFilters: options.videoFilters,
  });
}

/**
 * Delegates into the shared rotation-filter helper (which accepts a
 * RotationOptions-shaped object rather than a full ConversionOptions).
 * @private
 * @param {{rotate?: string; flipH?: boolean; flipV?: boolean}} options -
 *   Rotation/mirror flags.
 * @returns {string[]} Ordered rotation filter strings.
 */
function buildRotationFromOptions(options: { rotate?: string; flipH?: boolean; flipV?: boolean }): string[] {
  return buildRotationFiltersShared(options);
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
 * 2. `-i <input>` primary input, then every non-attachment `additionalInputs`
 *    entry as `-i <path>` (each optionally preceded by `-itsoffset <s>` for
 *    added-track / re-read sync), then the `chaptersFile` as the final `-i`.
 *    Input indices: primary = 0, additional inputs = 1..N in array order,
 *    chapters file = N+1.
 * 3. `-map <spec>` for every entry of `options.map` and every additional-input
 *    map spec (stream selection, applies to copy and re-encode alike).
 * 4. Copy mode: `-c copy`, plus `-metadata:s:v rotate=<deg>` when a rotation is
 *    requested and the output container stores rotation metadata (lossless). A
 *    rotation/flip that cannot be expressed in copy mode is skipped with a
 *    warning. Per-stream overrides follow the blanket `-c copy`: `-c:s
 *    <subtitleCodec>` when set, `-c:<kind> <codec>` per additional input with a
 *    non-copy codec, `-attach <path>` + `-metadata:s:t mimetype=image/jpeg` for
 *    MKV/WebM cover entries, `-disposition:v:<n> <value>` for `-i`-mapped cover
 *    streams, and `-map_chapters <index>` for chapter copy/import. Otherwise, in
 *    order: video codec (`-vcodec`), audio codec (`-acodec`), video bitrate
 *    (`-b:v`), audio bitrate (`-b:a`), quality scale (`-qscale:v`), a single
 *    video filter chain (`-vf scale=...,transpose=...,hflip,vflip`), and pixel
 *    format (`-pix_fmt`).
 * 5. Audio disable (`-an`) when `options.audio === false`.
 * 6. Trimming: start time (`-ss`), end time (`-to`), duration (`-t`).
 * 7. Overwrite flag (`-y`) and the output path last.
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

  const addedInputs = (options.additionalInputs ?? []).filter((entry) => !entry.attachment);
  for (const entry of addedInputs) {
    if (entry.syncOffsetSeconds) {
      args.push(FFMPEG_FLAGS.ITSOFFSET, String(entry.syncOffsetSeconds));
      log.debug(LOG_SYNC_OFFSET, entry.syncOffsetSeconds, LOG_ARROW, entry.path);
    }
    args.push(FFMPEG_FLAGS.INPUT, entry.path);
    log.debug(LOG_ADDITIONAL_INPUT, entry.path);
  }
  let chaptersInputIndex: string | null = null;
  if (options.chaptersFile) {
    chaptersInputIndex = String(1 + addedInputs.length);
    args.push(FFMPEG_FLAGS.INPUT, options.chaptersFile);
    log.debug(LOG_CHAPTERS_FILE, options.chaptersFile);
  }

  for (const spec of options.map ?? []) {
    args.push(FFMPEG_FLAGS.MAP, spec);
    log.debug(LOG_MAP, spec);
  }
  for (const entry of options.additionalInputs ?? []) {
    if (entry.attachment) continue;
    for (const spec of entry.map) {
      args.push(FFMPEG_FLAGS.MAP, spec);
      log.debug(LOG_MAP, spec);
    }
  }

  if (options.copy) {
    args.push(FFMPEG_FLAGS.COPY, FFMPEG_FLAGS.COPY_VALUE);
    if (options.videoFilters?.length) {
      log.warn(LOG_FILTERS_IGNORED_COPY);
    }
    const rotation = metadataRotationValue(options, output);
    if (rotation) {
      args.push(FFMPEG_FLAGS.METADATA_ROTATE, `rotate=${rotation}`);
      log.debug(LOG_ROTATION_METADATA, rotation);
    } else if (options.rotate || options.flipH || options.flipV) {
      log.warn(LOG_ROTATION_COPY_UNSUPPORTED);
    }
    for (const entry of options.additionalInputs ?? []) {
      if (entry.codec && entry.codec !== FFMPEG_FLAGS.COPY_VALUE) {
        args.push(`-c:${streamKindFromMap(entry.map)}`, entry.codec);
        log.debug(LOG_ADDITIONAL_INPUT, entry.path, LOG_ARROW, `-c:${streamKindFromMap(entry.map)} ${entry.codec}`);
      }
    }
    for (const entry of options.additionalInputs ?? []) {
      if (entry.attachment) {
        args.push(FFMPEG_FLAGS.ATTACH, entry.path, FFMPEG_FLAGS.METADATA_STREAM_TYPE, 'mimetype=image/jpeg');
        log.debug(LOG_ATTACH_COVER, entry.path);
      } else if (entry.disposition) {
        const videoIndex = outputVideoIndexForInput(options, entry);
        args.push(`${FFMPEG_FLAGS.DISPOSITION}:v:${videoIndex}`, entry.disposition);
        log.debug(LOG_DISPOSITION_KEYED, `v${videoIndex} ${entry.disposition}`);
      }
    }
    if (chaptersInputIndex) {
      args.push(FFMPEG_FLAGS.MAP_CHAPTERS, chaptersInputIndex);
    } else if (options.copyChapters !== false) {
      args.push(FFMPEG_FLAGS.MAP_CHAPTERS, '0');
      log.debug(LOG_COPY_CHAPTERS);
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
    const invalidErrors = validateVideoFilters(options.videoFilters ?? []);
    if (invalidErrors.length > 0) {
      log.warn(LOG_FILTER_INVALID, invalidErrors.join(' | '));
    }
    const safeVideoFilters = (options.videoFilters ?? []).filter((entry) => validateVideoFilters([entry]).length === 0);
    const chainOptions = options.videoFilters?.length ? { ...options, videoFilters: safeVideoFilters } : options;
    const filterChain = buildVideoFilterChain(chainOptions);
    if (filterChain) {
      if (safeVideoFilters.length > 0) {
        log.debug(LOG_VIDEO_FILTERS, filterChain);
      }
      args.push(FFMPEG_FLAGS.VIDEO_FILTER, filterChain);
      if (options.scale) log.debug(LOG_SCALE, options.scale);
      if (options.rotate) log.debug(LOG_ROTATION, options.rotate);
    }
    if (options.pixelFormat) {
      args.push(FFMPEG_FLAGS.PIX_FMT, options.pixelFormat);
      log.debug(LOG_PIXEL_FORMAT, options.pixelFormat);
    }
  }

  if (options.subtitleCodec) {
    args.push(FFMPEG_FLAGS.SUBTITLE_CODEC, options.subtitleCodec);
    log.debug(LOG_SUBTITLE_CODEC, options.subtitleCodec);
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

/**
 * Infers the stream-kind token for a per-input `-c:<kind>` override from the
 * input's first `-map` spec. A typed spec (`0:a:0`, `0:s:0`, `0:v:0`) yields
 * 'a'/'s'/'v'; an untyped spec (`0:0`) defaults to 's' (the primary per-input
 * codec use case is an added subtitle track needing e.g. `mov_text`). Due to
 * the blanket `-c copy` already covering stream copies, 'copy' codec values
 * never reach this helper.
 * @param {string[]} mapSpecs - The input's `-map` specs.
 * @returns {'v'|'a'|'s'} The stream-kind token ('s' when undeterminable).
 */
export function streamKindFromMap(mapSpecs: string[]): 'v' | 'a' | 's' {
  for (const spec of mapSpecs ?? []) {
    const type = /^\d+:(v|a|s|d|t):/.exec(spec)?.[1];
    if (type) return type as 'v' | 'a' | 's';
  }
  return 's';
}

/**
 * Computes the OUTPUT video-stream index for a disposition-carrying
 * `-i`-mapped cover input. The index is the count of video-typed (`:v`) `-map`
 * specs emitted BEFORE this input's own spec (typed video specs in
 * `options.map`, then typed video specs of earlier non-attachment inputs).
 * Untyped specs (e.g. added audio/subtitle `N:0`) are not counted, so a cover
 * appended after a kept primary video stream lands at index 1
 * (`-disposition:v:1 attached_pic`).
 * @param {ConversionOptions} options - The conversion options.
 * @param {ConversionOptions['additionalInputs'][number]} target - The cover input.
 * @returns {number} The output video-stream index for the disposition flag.
 */
export function outputVideoIndexForInput(
  options: ConversionOptions,
  target: NonNullable<ConversionOptions['additionalInputs']>[number],
): number {
  let count = 0;
  const priorSpecs: { spec: string; index: number }[] = [];
  (options.map ?? []).forEach((spec) => priorSpecs.push({ spec, index: 0 }));
  let runningInputIndex = 0;
  for (const entry of options.additionalInputs ?? []) {
    if (entry.attachment) continue;
    runningInputIndex += 1;
    if (entry === target) {
      for (const { spec, index } of priorSpecs) {
        if (index === 0) {
          if (/:\s*v\s*:/.test(spec)) count += 1;
        } else if (index < runningInputIndex && /:\s*v\s*:/.test(spec)) {
          count += 1;
        }
      }
      return count;
    }
    entry.map.forEach((spec) => priorSpecs.push({ spec, index: runningInputIndex }));
  }
  return 0;
}
