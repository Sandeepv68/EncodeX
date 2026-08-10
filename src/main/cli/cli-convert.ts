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
import { createError, ErrorCode } from '../../shared/errors';
import { createProgressBar, status, success, cliConfig } from './cli-ui';
import { deriveOutputPath, percentFromTimemark, getInputExtension } from './cli-util';
import { CliExitError, resolveTranscoderType, transcoderLabel } from './cli-options';
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
}

/**
 * Builds a ConversionOptions object from parsed CLI flags, dropping values that
 * are absent or invalid (e.g. out-of-range qscale).
 * @param {ConvertCliFlags} flags - Parsed conversion flags.
 * @returns {ConversionOptions} Options object safe to pass to a transcoder.
 */
export function buildConversionOptions(flags: ConvertCliFlags): ConversionOptions {
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
 * Runs a single conversion to completion, rendering a progress bar on
 * interactive terminals and enforcing a hard timeout.
 *
 * For non-FFMPEG backends (whose percent stays at 0) the source duration is
 * probed up front and the percent is derived from the output timemark.
 *
 * @param {RunConvertParams} params - Conversion parameters.
 * @returns {Promise<void>} Resolves when the conversion finishes; rejects on
 *   failure, cancellation, or timeout.
 * @throws {CliExitError} When the conversion exceeds `timeoutSeconds`.
 * @throws {AppError} When the input file does not exist.
 */
export async function runConvert(params: RunConvertParams): Promise<void> {
  const { input, transcoder, flags, themeId } = params;
  const timeoutSeconds = params.timeoutSeconds;

  if (!fs.existsSync(input)) {
    throw createError(ErrorCode.FILE_NOT_FOUND, `Input file not found: ${input}`);
  }

  const options = buildConversionOptions(flags);
  const output = params.output ?? resolveOutputPath(input, flags, options);

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
      success(`Converted ${path.basename(input)} → ${output}`);
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
 * Convenience factory used by the CLI entry to create a transcoder from a raw
 * `--transcoder` value.
 * @param {string} [type] - Raw transcoder backend value.
 * @returns {ITranscoder} A configured transcoder instance.
 */
export function createCliTranscoder(type?: string): ITranscoder {
  return createTranscoder(resolveTranscoderType(type));
}
