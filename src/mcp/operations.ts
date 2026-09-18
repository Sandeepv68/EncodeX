/**
 * @fileoverview Pure operation builders for the MCP layer's remaining tools
 * (`compress_image`, `extract_audio`, `cut_video`, `batch_convert`).
 *
 * Each builder mirrors the equivalent CLI subcommand behavior
 * (see `src/main/cli/cli-compress.ts` and `src/main/cli/cli-batch.ts`) without
 * importing the interactive CLI UI, keeping the MCP server runnable under plain
 * Node. Builders are pure and deterministic so tool handlers stay trivial and
 * the naming logic is directly unit-testable.
 */

import { IMAGE_CODEC_MAP } from '../shared/media-options';
import { DEFAULT_SUFFIX } from '../shared/media-options';
import { QSCALE_RANGE } from '../shared/transcoder-constants';
import { isInRange } from '../shared/validation';
import { suggestedExtensionForAudioCodec, suggestedExtensionForVideoCodec } from '../shared/codec-containers';
import { AUDIO_EXTRACT_DEFAULT_CODEC } from '../shared/constants';
import { deriveOutputPath, getInputExtension, expandInputs } from '../main/cli/cli-util';
import type { ConversionOptions } from '../shared/types';
import { buildConversionOptions } from './conversion-options';
import type { MCPConversionFields } from './conversion-options';

/**
 * Fields accepted by the `compress_image` MCP tool, mirroring
 * `CompressCliFlags`.
 * @interface MCPCompressFields
 * @property {string} [output] - Explicit output file path.
 * @property {string} [format] - Output image format (defaults to the source format).
 * @property {number|string} [quality] - Quality scale (1 best - 31 worst; default 23).
 * @property {string} [scale] - Output resolution (WxH or percent).
 */
export interface MCPCompressFields {
  output?: string;
  format?: string;
  quality?: number | string;
  scale?: string;
}

/**
 * The materialized plan for an image compression: the conversion options, the
 * resolved output path, and the effective output format.
 * @interface CompressPlan
 * @property {ConversionOptions} options - Options passed to the transcoder.
 * @property {string} output - Resolved absolute output path.
 * @property {string} format - Effective output format (lower-cased).
 */
export interface CompressPlan {
  options: ConversionOptions;
  output: string;
  format: string;
}

/**
 * Builds the conversion plan for an image compression, mirroring
 * {@link runCompress}. The format defaults to the source extension, the image
 * encoder maps through {@link IMAGE_CODEC_MAP}, and an out-of-range quality is
 * dropped (the transcoder's own default applies).
 * @param {string} input - Input image path.
 * @param {MCPCompressFields} fields - Compress fields.
 * @returns {CompressPlan} The resolved options/output/format.
 */
export function buildCompressPlan(input: string, fields: MCPCompressFields): CompressPlan {
  const sourceExt = getInputExtension(input);
  const format = (fields.format ?? sourceExt).toLowerCase();
  const codec = IMAGE_CODEC_MAP[format] ?? IMAGE_CODEC_MAP.jpg;
  const options: ConversionOptions = { videoCodec: codec };
  if (fields.scale) options.scale = fields.scale;
  const qscale = fields.quality === undefined ? 23 : Number(fields.quality);
  if (isInRange(qscale, QSCALE_RANGE.MIN, QSCALE_RANGE.MAX)) options.qscale = qscale;
  const output = fields.output ?? deriveOutputPath(input, { suffix: '_compressed', outputExt: format });
  return { options, output, format };
}

/**
 * Fields accepted by the `extract_audio` MCP tool, mirroring
 * `ExtractAudioCliFlags`.
 * @interface MCPExtractAudioFields
 * @property {string} [output] - Explicit output file path.
 * @property {string} [audioCodec] - Audio encoder (defaults to
 *   {@link AUDIO_EXTRACT_DEFAULT_CODEC}, i.e. mp3).
 * @property {string} [bitrate] - Audio bitrate (default '192k').
 */
export interface MCPExtractAudioFields {
  output?: string;
  audioCodec?: string;
  bitrate?: string;
}

/**
 * The materialized plan for an audio extraction: options, output path,
 * effective audio codec, and output extension.
 * @interface ExtractAudioPlan
 * @property {ConversionOptions} options - Options passed to the transcoder.
 * @property {string} output - Resolved absolute output path.
 * @property {string} ext - Effective output extension (without dot).
 * @property {string} audioCodec - Effective audio encoder.
 */
export interface ExtractAudioPlan {
  options: ConversionOptions;
  output: string;
  ext: string;
  audioCodec: string;
}

/**
 * Builds the plan for audio extraction, mirroring {@link runExtractAudio}: the
 * video stream is dropped (`video: false`), the extension follows the audio
 * codec (defaulting to mp3), and the output keeps the input stem with no suffix.
 * @param {string} input - Input media path.
 * @param {MCPExtractAudioFields} fields - Extract fields.
 * @returns {ExtractAudioPlan} The resolved options/output/codec/extension.
 */
export function buildExtractAudioPlan(input: string, fields: MCPExtractAudioFields): ExtractAudioPlan {
  const audioCodec = fields.audioCodec ?? AUDIO_EXTRACT_DEFAULT_CODEC;
  const ext = suggestedExtensionForAudioCodec(audioCodec) || 'mp3';
  const options: ConversionOptions = {
    audioCodec,
    audioBitrate: fields.bitrate ?? '192k',
    video: false,
  };
  const output = fields.output ?? deriveOutputPath(input, { suffix: '', outputExt: ext, keepExt: false });
  return { options, output, ext, audioCodec };
}

/**
 * Fields accepted by the `cut_video` MCP tool.
 * @interface MCPCutFields
 * @property {string} [output] - Explicit output file path.
 * @property {string} [startTime] - Trim start (HH:MM:SS or seconds).
 * @property {string} [endTime] - Trim end (HH:MM:SS or seconds).
 * @property {string} [duration] - Maximum output duration.
 * @property {boolean} [copy] - Lossless stream copy (default true).
 * @property {boolean} [audio] - Include audio streams (default true).
 * @property {string[]} [extraArgs] - Extra FFmpeg output arguments.
 */
export interface MCPCutFields {
  output?: string;
  startTime?: string;
  endTime?: string;
  duration?: string;
  copy?: boolean;
  audio?: boolean;
  extraArgs?: string[];
}

/**
 * The materialized plan for a video cut.
 * @interface CutPlan
 * @property {ConversionOptions} options - Options passed to the transcoder.
 * @property {string} output - Resolved absolute output path.
 */
export interface CutPlan {
  options: ConversionOptions;
  output: string;
}

/**
 * Builds the plan for a video cut. Defaults to lossless stream copy (the GUI's
 * default and fastest option); the output keeps the input extension and gains a
 * `_cut` suffix.
 * @param {string} input - Input media path.
 * @param {MCPCutFields} fields - Cut fields.
 * @returns {CutPlan} The resolved options and output path.
 */
export function buildCutPlan(input: string, fields: MCPCutFields): CutPlan {
  const options: ConversionOptions = {
    copy: fields.copy !== false,
  };
  if (fields.startTime) options.startTime = fields.startTime;
  if (fields.endTime) options.endTime = fields.endTime;
  if (fields.duration) options.duration = fields.duration;
  if (fields.audio === false) options.audio = false;
  if (fields.extraArgs?.length) options.extraArgs = fields.extraArgs;
  const output = fields.output ?? deriveOutputPath(input, { suffix: '_cut', outputExt: getInputExtension(input) });
  return { options, output };
}

/**
 * One job in a batch conversion: input, resolved output, and per-file options.
 * @interface BatchJobPlan
 * @property {string} input - Input file path.
 * @property {string} output - Resolved output file path.
 * @property {ConversionOptions} options - Shared conversion options.
 */
export interface BatchJobPlan {
  input: string;
  output: string;
  options: ConversionOptions;
}

/**
 * The materialized plan for a batch conversion.
 * @interface BatchPlan
 * @property {BatchJobPlan[]} jobs - One planned job per matched input.
 * @property {string} suffix - Effective output suffix.
 */
export interface BatchPlan {
  jobs: BatchJobPlan[];
  suffix: string;
}

/**
 * Derives the output extension for a batch job, mirroring the CLI's
 * `batchOutputExtension`: copy mode and audio-only jobs keep the source
 * extension, otherwise the codec's suggested container extension is used with
 * the source extension as a fallback.
 * @param {string} file - Input file path.
 * @param {ConversionOptions} options - Built conversion options.
 * @returns {string} The output extension (without dot).
 */
function batchOutputExtension(file: string, options: ConversionOptions): string {
  if (options.copy === true || options.video === false) return getInputExtension(file);
  return suggestedExtensionForVideoCodec(options.videoCodec) || getInputExtension(file);
}

/**
 * Builds the plan for a batch conversion, mirroring {@link runBatch}. Inputs may
 * be plain paths, directories, or globs (see {@link expandInputs}); each matched
 * file is planned with the same options and an individually derived output.
 * @param {string[]} inputs - Input paths or glob patterns.
 * @param {MCPConversionFields} fields - Conversion fields shared by every job.
 * @param {string} [outputDir] - Directory to write outputs into.
 * @param {string} [suffix] - Output suffix (default {@link DEFAULT_SUFFIX}).
 * @returns {BatchPlan} One planned job per matched input.
 */
export function buildBatchPlan(inputs: string[], fields: MCPConversionFields, outputDir?: string, suffix?: string): BatchPlan {
  const files = expandInputs(inputs);
  const options = buildConversionOptions(fields);
  const effectiveSuffix = suffix ?? DEFAULT_SUFFIX;
  const jobs = files.map((file) => {
    const outputExt = batchOutputExtension(file, options);
    const output = outputDir
      ? deriveOutputPath(file, { outputDir, suffix: effectiveSuffix, outputExt })
      : deriveOutputPath(file, { suffix: effectiveSuffix, outputExt });
    return { input: file, output, options: { ...options } };
  });
  return { jobs, suffix: effectiveSuffix };
}
