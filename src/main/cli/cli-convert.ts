/**
 * @fileoverview Implementation of the `convert` CLI subcommand.
 * Builds ConversionOptions from CLI flags, derives the output path when not
 * given, runs the conversion through an ITranscoder while rendering a progress
 * bar, and enforces a hard timeout.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createTranscoder } from '../transcoders/factory';
import type { ITranscoder } from '../transcoders/types';
import type { ConversionOptions, ConversionProgress, HwAccelMode } from '../../shared/types';
import { CLI_EXIT_TIMEOUT } from '../../shared/constants';
import { QSCALE_RANGE } from '../../shared/transcoder-constants';
import { isInRange } from '../../shared/validation';
import { suggestedExtensionForVideoCodec } from '../../shared/codec-containers';
import { createError, ErrorCode, ERROR_MESSAGES } from '../../shared/errors';
import { presetById, buildPresetFilter, normalizeFilterChain, validateVideoFilters } from '../../shared/video-filters';
import { createProgressBar, status, success, cliConfig } from './cli-ui';
import { deriveOutputPath, percentFromTimemark, getInputExtension } from './cli-util';
import { CliExitError, resolveTranscoderType, transcoderLabel } from './cli-options';
import { CLI_EXIT_USAGE } from '../../shared/constants';
import type { CliThemeId } from '../cli-logo';
import type { TranscoderType } from '../../shared/types';

/**
 * Conversion flags accepted by the `convert` subcommand.
 * @interface ConvertCliFlags
 * @property {string} [output] - Explicit output file (`-o, --output`).
 * @property {string} [videoCodec] - Video encoder name (`-v, --video-codec`).
 * @property {string} [audioCodec] - Audio encoder name (`-a, --audio-codec`).
 * @property {string} [bitrateVideo] - Video bitrate (`--bitrate-video`).
 * @property {string} [bitrateAudio] - Audio bitrate (`--bitrate-audio`).
 * @property {string} [qscale] - Video quality scale (`-q, --qscale`).
 * @property {string} [pixFmt] - Pixel format (`--pix-fmt`).
 * @property {string} [scale] - Output resolution (`-s, --scale`).
 * @property {string} [startTime] - Trim start time (`--start-time`).
 * @property {string} [endTime] - Trim end time (`--end-time`).
 * @property {string} [duration] - Max output duration (`--duration`).
 * @property {boolean} [copy] - Lossless stream copy (`--copy`).
 * @property {boolean} [audio] - Include audio (`--no-audio` sets false).
 * @property {boolean} [video] - Include video (`--no-video` sets false).
 * @property {boolean} [hwaccel] - Enable hardware acceleration (`--hwaccel`).
 * @property {string} [hwaccelMode] - Hardware acceleration mode (`--hwaccel-mode`).
 * @property {string} [filters] - Comma-joined video filter chain (`--filters`).
 * @property {string[]} [presets] - Curated filter preset ids (`--preset`,
 *   repeatable).
 */
export interface ConvertCliFlags {
  output?: string;
  videoCodec?: string;
  audioCodec?: string;
  bitrateVideo?: string;
  bitrateAudio?: string;
  qscale?: string;
  pixFmt?: string;
  scale?: string;
  startTime?: string;
  endTime?: string;
  duration?: string;
  copy?: boolean;
  audio?: boolean;
  video?: boolean;
  hwaccel?: boolean;
  hwaccelMode?: string;
  filters?: string;
  presets?: string[];
}

/**
 * Resolves the ordered video-filter entries from the `--preset` shorthand(s)
 * and the free-form `--filters` chain flag. Presets expand to their default
 * parameter expressions first, then the comma-joined custom chain is split and
 * appended (so `--preset grayscale --filters fps=30` yields
 * `['hue=s=0', 'fps=30']`). An unknown preset id is a usage error.
 * @param {Pick<ConvertCliFlags, 'filters' | 'presets'>} flags - Filter flags.
 * @returns {string[]} Ordered filter expressions (empty when none requested).
 * @throws {CliExitError} For an unknown `--preset` id (usage exit code).
 */
export function resolveCliVideoFilters(flags: Pick<ConvertCliFlags, 'filters' | 'presets'>): string[] {
  const presets = (flags.presets ?? []).map((id) => {
    const def = presetById(id);
    if (!def) throw new CliExitError(`Unknown video filter preset: ${id}.`, CLI_EXIT_USAGE);
    return buildPresetFilter(def);
  });
  return [...presets, ...(flags.filters ? normalizeFilterChain(flags.filters) : [])];
}

/**
 * Resolves the ordered video-filter entries from one or more repeatable chain
 * flags (the `remux --filters` / `demux --video-filters` form): every occurrence
 * is comma-split, the `preset.value` shorthand is expanded, and the merged list
 * is validated as a whole. An invalid entry is a usage error, so a bad chain
 * never reaches FFmpeg.
 * @param {string[]} [chains] - Comma-joined chain values, in command-line order.
 * @returns {string[]} Ordered filter expressions (empty when none requested).
 * @throws {CliExitError} When any entry fails validation (usage exit code).
 */
export function resolveCliVideoFilterChain(chains?: string[]): string[] {
  const entries = (chains ?? []).flatMap((chain) => normalizeFilterChain(chain));
  if (entries.length === 0) return [];
  const errors = validateVideoFilters(entries);
  if (errors.length > 0) {
    throw new CliExitError(`Invalid video filter chain: ${errors.join(' ')}`, CLI_EXIT_USAGE);
  }
  return entries;
}

/**
 * Builds a ConversionOptions object from parsed CLI flags, dropping values that
 * are absent or invalid (e.g. out-of-range qscale). Video-filter chains are
 * validated up front: an invalid entry or a chain combined with lossless
 * `--copy` is a usage error (filters require re-encoding).
 * @param {ConvertCliFlags} flags - Parsed conversion flags.
 * @returns {ConversionOptions} Options object safe to pass to a transcoder.
 * @throws {CliExitError} When `--filters`/`--preset` are invalid or combined
 *   with `--copy` (usage exit code).
 */
export function buildConversionOptions(flags: ConvertCliFlags): ConversionOptions {
  const videoFilters = resolveCliVideoFilters(flags);
  const options: ConversionOptions = {};
  if (flags.copy) options.copy = true;
  if (flags.audio === false) options.audio = false;
  if (flags.video === false) options.video = false;
  if (flags.videoCodec) options.videoCodec = flags.videoCodec;
  if (flags.audioCodec) options.audioCodec = flags.audioCodec;
  if (flags.qscale !== undefined) {
    const qscale = Number(flags.qscale);
    if (isInRange(qscale, QSCALE_RANGE.MIN, QSCALE_RANGE.MAX)) options.qscale = qscale;
  }
  if (flags.bitrateVideo) options.videoBitrate = flags.bitrateVideo;
  if (flags.bitrateAudio) options.audioBitrate = flags.bitrateAudio;
  if (flags.pixFmt) options.pixelFormat = flags.pixFmt;
  if (flags.scale) options.scale = flags.scale;
  if (flags.startTime) options.startTime = flags.startTime;
  if (flags.endTime) options.endTime = flags.endTime;
  if (flags.duration) options.duration = flags.duration;
  if (flags.hwaccel) options.hardwareAcceleration = true;
  if (flags.hwaccelMode) options.hwaccelMode = flags.hwaccelMode as HwAccelMode;
  if (videoFilters.length > 0) {
    const errors = validateVideoFilters(videoFilters);
    if (errors.length > 0) {
      throw new CliExitError(`Invalid video filter chain: ${errors.join(' ')}`, CLI_EXIT_USAGE);
    }
    if (flags.copy) {
      throw new CliExitError(ERROR_MESSAGES[ErrorCode.FILTERS_REQUIRE_RE_ENCODE], CLI_EXIT_USAGE);
    }
    options.videoFilters = videoFilters;
  }
  return options;
}

/**
 * Derives the output path for a conversion when `-o/--output` was not given.
 *
 * Mirrors the GUI naming: the input stem is suffixed with `_converted` and the
 * extension follows the chosen video codec (or the input extension in copy
 * mode / when no codec was selected).
 *
 * @param {string} input - Input file path.
 * @param {ConvertCliFlags} flags - Parsed conversion flags.
 * @param {ConversionOptions} options - Built conversion options.
 * @returns {string} The derived output file path.
 */
export function resolveOutputPath(input: string, flags: ConvertCliFlags, options: ConversionOptions): string {
  const copyMode = options.copy === true;
  const videoOff = options.video === false;
  const ext =
    copyMode || videoOff ? getInputExtension(input) : suggestedExtensionForVideoCodec(options.videoCodec) || getInputExtension(input);
  return deriveOutputPath(input, { suffix: '_converted', outputExt: ext });
}

/**
 * Parameters for a single CLI conversion run.
 * @interface RunConvertParams
 * @property {string} input - Input file path.
 * @property {string} [output] - Output file path (derived when absent).
 * @property {ConvertCliFlags} flags - Parsed conversion flags.
 * @property {ITranscoder} transcoder - Transcoder backend to run the job.
 * @property {number} timeoutSeconds - Hard conversion timeout in seconds.
 * @property {CliThemeId} themeId - Theme used to color the progress bar.
 */
export interface RunConvertParams {
  input: string;
  output?: string;
  flags: ConvertCliFlags;
  transcoder: ITranscoder;
  timeoutSeconds: number;
  themeId: CliThemeId;
}

/**
 * Parameters for running an already-built `ConversionOptions` through a
 * transcoder with progress rendering and a hard timeout.
 * @interface RunPreparedParams
 * @property {string} input - Input file path.
 * @property {string} output - Output file path.
 * @property {ConversionOptions} options - Prebuilt conversion options.
 * @property {ITranscoder} transcoder - Transcoder backend to run the job.
 * @property {number} timeoutSeconds - Hard conversion timeout in seconds.
 * @property {CliThemeId} themeId - Theme used to color the progress bar.
 * @property {string} [successText] - Line printed on success (defaults to
 *   `Converted <input> → <output>`).
 */
export interface RunPreparedParams {
  input: string;
  output: string;
  options: ConversionOptions;
  transcoder: ITranscoder;
  timeoutSeconds: number;
  themeId: CliThemeId;
  successText?: string;
}

/**
 * Runs an already-built `ConversionOptions` to completion, rendering a
 * progress bar on interactive terminals and enforcing a hard timeout. Shared by
 * `convert` and the plan-driven subcommands (`remux`, `demux`) so every CLI
 * conversion reports progress identically.
 *
 * For non-FFMPEG backends (whose percent stays at 0) the source duration is
 * probed up front and the percent is derived from the output timemark.
 *
 * @param {RunPreparedParams} params - Prepared conversion parameters.
 * @returns {Promise<void>} Resolves when the conversion finishes; rejects on
 *   failure, cancellation, or timeout.
 * @throws {CliExitError} When the conversion exceeds `timeoutSeconds`.
 * @throws {AppError} When the input file does not exist.
 */
export async function runPreparedConversion(params: RunPreparedParams): Promise<void> {
  const { input, output, options, transcoder, timeoutSeconds, themeId } = params;

  if (!fs.existsSync(input)) {
    throw createError(ErrorCode.FILE_NOT_FOUND, `Input file not found: ${input}`);
  }

  if (cliConfig.verbose && options.videoFilters?.length) {
    status(`Video filters: ${options.videoFilters.join(', ')}`);
  }

  const isFfmpeg = transcoder.getType() === 'FFMPEG';
  let sourceDuration: number | undefined;
  if (!isFfmpeg) {
    try {
      const info = await transcoder.getInfo(input);
      sourceDuration = info.duration;
    } catch {
      sourceDuration = undefined;
    }
  }

  if (!cliConfig.quiet) {
    status(`${path.basename(input)} ${'→'} ${path.basename(output)}`);
    status(`Transcoder: ${transcoderLabel(transcoder.getType() as TranscoderType)}`);
  }

  const bar = createProgressBar(themeId);

  await new Promise<void>((resolve, reject) => {
    const emitter = transcoder.convert(input, output, options);
    const timeout = setTimeout(() => {
      transcoder.cancel();
      reject(new CliExitError('Conversion timed out', CLI_EXIT_TIMEOUT));
    }, timeoutSeconds * 1000);

    emitter.on('progress', (progress: ConversionProgress) => {
      let percent = progress.percent;
      if (percent <= 0 && sourceDuration !== undefined && progress.time) {
        percent = percentFromTimemark(progress.time, sourceDuration);
      }
      bar?.update(percent, {
        time: progress.time,
        speed: progress.speed,
        fps: progress.fps,
        eta: progress.eta,
        bitrate: progress.bitrate,
      });
    });

    emitter.on('end', () => {
      clearTimeout(timeout);
      bar?.update(100);
      bar?.stop();
      success(params.successText ?? `Converted ${path.basename(input)} → ${output}`);
      resolve();
    });

    emitter.on('error', (err: Error) => {
      clearTimeout(timeout);
      bar?.stop();
      reject(err);
    });
  });
}

/**
 * Runs a single conversion to completion, rendering a progress bar on
 * interactive terminals and enforcing a hard timeout.
 *
 * @param {RunConvertParams} params - Conversion parameters.
 * @returns {Promise<void>} Resolves when the conversion finishes; rejects on
 *   failure, cancellation, or timeout.
 * @throws {CliExitError} When the conversion exceeds `timeoutSeconds`.
 * @throws {AppError} When the input file does not exist.
 */
export async function runConvert(params: RunConvertParams): Promise<void> {
  const { input, transcoder, flags, themeId } = params;

  if (!fs.existsSync(input)) {
    throw createError(ErrorCode.FILE_NOT_FOUND, `Input file not found: ${input}`);
  }

  const options = buildConversionOptions(flags);
  const output = params.output ?? resolveOutputPath(input, flags, options);

  await runPreparedConversion({
    input,
    output,
    options,
    transcoder,
    timeoutSeconds: params.timeoutSeconds,
    themeId,
  });
}

/**
 * Convenience factory used by the CLI entry to create a transcoder from a raw
 * `--transcoder` value.
 * @param {string} [type] - Raw transcoder backend value.
 * @returns {ITranscoder} A configured transcoder instance.
 */
export function createCliTranscoder(type?: string): ITranscoder {
  return createTranscoder(resolveTranscoderType(type));
}
