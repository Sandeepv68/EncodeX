/**
 * @fileoverview Pure conversion-option builders for the MCP layer.
 * Replicates the CLI's `buildConversionOptions` and `resolveOutputPath`
 * behavior (see `src/main/cli/cli-convert.ts`) without importing that module,
 * which drags in the interactive CLI UI (chalk/ora). Importing only shared,
 * Electron-free helpers keeps the MCP server runnable under plain Node.
 */

import type { ConversionOptions, HwAccelMode } from '../shared/types';
import { QSCALE_RANGE } from '../shared/transcoder-constants';
import { isInRange } from '../shared/validation';
import { suggestedExtensionForVideoCodec } from '../shared/codec-containers';
import { deriveOutputPath, getInputExtension } from '../main/cli/cli-util';

/**
 * Conversion fields accepted by the `convert_media` MCP tool, mirroring the
 * CLI's `ConvertCliFlags` so behavior matches the headless interface exactly.
 * @interface MCPConversionFields
 * @property {string} [output] - Explicit output file path.
 * @property {string} [videoCodec] - Video encoder name (e.g. 'libx264', 'copy').
 * @property {string} [audioCodec] - Audio encoder name (e.g. 'aac', 'copy').
 * @property {string} [videoBitrate] - Video bitrate (e.g. '2000k').
 * @property {string} [audioBitrate] - Audio bitrate (e.g. '192k').
 * @property {number|string} [qscale] - Video quality scale (1-31).
 * @property {string} [pixelFormat] - Pixel format (e.g. 'yuv420p').
 * @property {string} [scale] - Output resolution (WxH or percent).
 * @property {boolean} [keepAspectRatio] - Preserve source aspect ratio when scaling.
 * @property {'90'|'180'|'270'} [rotate] - Output rotation angle.
 * @property {boolean} [flipH] - Mirror output horizontally.
 * @property {boolean} [flipV] - Mirror output vertically.
 * @property {string} [startTime] - Trim start (HH:MM:SS or seconds).
 * @property {string} [endTime] - Trim end (HH:MM:SS or seconds).
 * @property {string} [duration] - Max output duration.
 * @property {boolean} [copy] - Lossless stream copy.
 * @property {boolean} [audio] - Include audio streams (false excludes them).
 * @property {boolean} [video] - Include video streams (false excludes them).
 * @property {boolean} [hardwareAcceleration] - Enable hardware acceleration.
 * @property {string} [hwaccelMode] - Hardware acceleration mode.
 * @property {string[]} [extraArgs] - Extra FFmpeg output arguments.
 */
export interface MCPConversionFields {
  output?: string;
  videoCodec?: string;
  audioCodec?: string;
  videoBitrate?: string;
  audioBitrate?: string;
  qscale?: number | string;
  pixelFormat?: string;
  scale?: string;
  keepAspectRatio?: boolean;
  rotate?: '90' | '180' | '270';
  flipH?: boolean;
  flipV?: boolean;
  startTime?: string;
  endTime?: string;
  duration?: string;
  copy?: boolean;
  audio?: boolean;
  video?: boolean;
  hardwareAcceleration?: boolean;
  hwaccelMode?: string;
  extraArgs?: string[];
}

/**
 * Builds a {@link ConversionOptions} object from MCP tool fields, dropping
 * values that are absent or invalid (e.g. out-of-range qscale), identical to
 * the CLI's option builder.
 * @param {MCPConversionFields} fields - Tool-provided conversion fields.
 * @returns {ConversionOptions} Options object safe to pass to a transcoder.
 */
export function buildConversionOptions(fields: MCPConversionFields): ConversionOptions {
  const options: ConversionOptions = {};
  if (fields.copy) options.copy = true;
  if (fields.audio === false) options.audio = false;
  if (fields.video === false) options.video = false;
  if (fields.videoCodec) options.videoCodec = fields.videoCodec;
  if (fields.audioCodec) options.audioCodec = fields.audioCodec;
  if (fields.qscale !== undefined) {
    const qscale = Number(fields.qscale);
    if (isInRange(qscale, QSCALE_RANGE.MIN, QSCALE_RANGE.MAX)) options.qscale = qscale;
  }
  if (fields.videoBitrate) options.videoBitrate = fields.videoBitrate;
  if (fields.audioBitrate) options.audioBitrate = fields.audioBitrate;
  if (fields.pixelFormat) options.pixelFormat = fields.pixelFormat;
  if (fields.scale) options.scale = fields.scale;
  if (fields.keepAspectRatio !== undefined) options.keepAspectRatio = fields.keepAspectRatio;
  if (fields.rotate) options.rotate = fields.rotate;
  if (fields.flipH) options.flipH = true;
  if (fields.flipV) options.flipV = true;
  if (fields.startTime) options.startTime = fields.startTime;
  if (fields.endTime) options.endTime = fields.endTime;
  if (fields.duration) options.duration = fields.duration;
  if (fields.hardwareAcceleration) options.hardwareAcceleration = true;
  if (fields.hwaccelMode) options.hwaccelMode = fields.hwaccelMode as HwAccelMode;
  if (fields.extraArgs?.length) options.extraArgs = fields.extraArgs;
  return options;
}

/**
 * Derives the output path for a conversion when `output` was not given.
 *
 * Mirrors the GUI and CLI naming: the input stem is suffixed with `_converted`
 * and the extension follows the chosen video codec (or the input extension in
 * copy mode / when no codec was selected).
 * @param {string} input - Input file path.
 * @param {MCPConversionFields} fields - Conversion fields (for output flags).
 * @param {ConversionOptions} options - Built conversion options.
 * @returns {string} The derived output file path.
 */
export function resolveOutputPath(input: string, fields: MCPConversionFields, options: ConversionOptions): string {
  const copyMode = options.copy === true;
  const videoOff = options.video === false;
  const ext =
    copyMode || videoOff ? getInputExtension(input) : suggestedExtensionForVideoCodec(options.videoCodec) || getInputExtension(input);
  return deriveOutputPath(input, { suffix: '_converted', outputExt: ext });
}
