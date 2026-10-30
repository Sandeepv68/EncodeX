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
import { createError, ErrorCode, ERROR_MESSAGES } from '../shared/errors';
import { presetById, buildPresetFilter, normalizeFilterChain, validateVideoFilters } from '../shared/video-filters';
import { assertSafeExtraArgs } from './safety';
import type { MCPConversionFields } from './types';

export type { MCPConversionFields } from './types';

/**
 * Resolves the ordered video-filter expressions from the `presets` shorthand,
 * the comma-joined `filters` chain, and the explicit `videoFilters` array.
 * Presets expand to their default parameter expressions first (mirroring the
 * CLI's `--preset`), then the custom chain and array entries are appended in
 * order. An unknown preset id is an invalid-filter error.
 * @param {Pick<MCPConversionFields, 'presets' | 'filters' | 'videoFilters'>} fields -
 *   Filter fields.
 * @returns {string[]} Ordered filter expressions (empty when none requested).
 * @throws {AppError} When an unknown preset id is used (INVALID_VIDEO_FILTERS).
 */
export function resolveVideoFilterExpressions(fields: Pick<MCPConversionFields, 'presets' | 'filters' | 'videoFilters'>): string[] {
  const presets = (fields.presets ?? []).map((id) => {
    const def = presetById(id);
    if (!def) {
      throw createError(
        ErrorCode.INVALID_VIDEO_FILTERS,
        ERROR_MESSAGES[ErrorCode.INVALID_VIDEO_FILTERS],
        `Unknown video filter preset: ${id}.`,
      );
    }
    return buildPresetFilter(def);
  });
  return [...presets, ...(fields.filters ? normalizeFilterChain(fields.filters) : []), ...(fields.videoFilters ?? [])];
}

/**
 * Builds a {@link ConversionOptions} object from MCP tool fields, dropping
 * values that are absent or invalid (e.g. out-of-range qscale), identical to
 * the CLI's option builder. Video-filter expressions are validated up front:
 * an invalid chain or preset combined with lossless copy mode is rejected
 * (filters require re-encoding), categorized under INVALID_VIDEO_FILTERS /
 * FILTERS_REQUIRE_RE_ENCODE.
 * @param {MCPConversionFields} fields - Tool-provided conversion fields.
 * @returns {ConversionOptions} Options object safe to pass to a transcoder.
 * @throws {AppError} When the filter chain/preset is invalid or combined with
 *   `copy`.
 */
export function buildConversionOptions(fields: MCPConversionFields): ConversionOptions {
  const videoFilters = resolveVideoFilterExpressions(fields);
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
  if (videoFilters.length > 0) {
    const validationErrors = validateVideoFilters(videoFilters);
    if (validationErrors.length > 0) {
      throw createError(
        ErrorCode.INVALID_VIDEO_FILTERS,
        ERROR_MESSAGES[ErrorCode.INVALID_VIDEO_FILTERS],
        `Invalid video filter chain: ${validationErrors.join(' ')}`,
      );
    }
    if (fields.copy) {
      throw createError(ErrorCode.FILTERS_REQUIRE_RE_ENCODE, ERROR_MESSAGES[ErrorCode.FILTERS_REQUIRE_RE_ENCODE]);
    }
    options.videoFilters = videoFilters;
  }
  if (fields.extraArgs?.length) {
    assertSafeExtraArgs(fields.extraArgs);
    options.extraArgs = fields.extraArgs;
  }
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
