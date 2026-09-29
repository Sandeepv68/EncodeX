/**
 * @fileoverview Pure operation builders for the MCP layer's remaining tools
 * (`compress_image`, `extract_audio`, `cut_video`, `batch_convert`,
 * `remux_media`, `demux_media`).
 *
 * Each builder mirrors the equivalent CLI subcommand behavior
 * (see `src/main/cli/cli-compress.ts`, `src/main/cli/cli-batch.ts`,
 * `src/main/cli/cli-remux.ts`, and `src/main/cli/cli-demux.ts`) without
 * importing the interactive CLI UI, keeping the MCP server runnable under plain
 * Node. Builders are pure and deterministic so tool handlers stay trivial and
 * the naming logic is directly unit-testable.
 *
 * The remux/demux builders delegate the real planning work to the shared
 * helpers ({@link buildAndValidateRemuxPlan}, {@link buildPrimaryStreamMaps},
 * {@link buildDemuxTargets}) so MCP, CLI, and GUI agree on stream selection,
 * output naming, and container compatibility.
 */

import * as path from 'path';
import { IMAGE_CODEC_MAP } from '../shared/media-options';
import { DEFAULT_SUFFIX } from '../shared/media-options';
import { ATTACHED_PIC_DISPOSITION, QSCALE_RANGE, SUBTITLE_CODEC_CONTAINERS } from '../shared/transcoder-constants';
import { isInRange } from '../shared/validation';
import {
  buildDemuxTargets,
  demuxWarnings,
  isContainerCompatibleWithChapters,
  isContainerCompatibleWithCover,
  suggestedExtensionForAudioCodec,
  suggestedExtensionForVideoCodec,
  type DemuxMediaPreferences,
  type DemuxTarget,
  type RemuxWarning,
} from '../shared/codec-containers';
import { buildAndValidateRemuxPlan, buildPrimaryStreamMaps } from '../shared/remux-utils';
import { AUDIO_EXTRACT_DEFAULT_CODEC } from '../shared/constants';
import { createError, ErrorCode, ERROR_MESSAGES } from '../shared/errors';
import { validateVideoFilters, expandFilterShorthand } from '../shared/video-filters';
import { deriveOutputPath, getInputExtension, expandInputs } from '../main/cli/cli-util';
import type { ConversionOptions, MediaStreamInfo, RemuxInput } from '../shared/types';
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

/**
 * One added subtitle track for the `remux_media` tool: an external subtitle
 * file, an optional per-file codec, and an optional sync offset.
 * @interface MCPRemuxSubtitle
 * @property {string} file - Subtitle file path.
 * @property {string} [codec] - Per-file codec, used when `subtitleCodec` is
 *   absent and the container has no default.
 * @property {number} [syncOffsetSeconds] - Signed `-itsoffset` applied to this
 *   input (positive = track plays LATER).
 */
export interface MCPRemuxSubtitle {
  file: string;
  codec?: string;
  syncOffsetSeconds?: number;
}

/**
 * One added audio track for the `remux_media` tool.
 * @interface MCPRemuxAudio
 * @property {string} file - Audio file path.
 * @property {number} [syncOffsetSeconds] - Signed `-itsoffset` applied to this
 *   input (positive = track plays LATER).
 */
export interface MCPRemuxAudio {
  file: string;
  syncOffsetSeconds?: number;
}

/**
 * Cover art for the `remux_media` tool. MKV/WebM attach the picture with
 * `-attach`; MP4/MOV map it as an extra video stream with the `attached_pic`
 * disposition.
 * @interface MCPRemuxThumbnail
 * @property {string} file - Cover-art image path.
 * @property {'attachment'|'disposition'} [type] - Cover-art mechanism; inferred
 *   from the target container when omitted.
 */
export interface MCPRemuxThumbnail {
  file: string;
  type?: 'attachment' | 'disposition';
}

/**
 * Chapters handling for the `remux_media` tool: `'source'` preserves the
 * source chapters (the default), an object imports an FFMETADATA file.
 * @typedef {'source'|{ file: string }} MCPChapters
 */

/**
 * Validates a video filter chain coming from an MCP tool field and returns it
 * with the `preset.value` shorthand expanded, so the shared remux/demux planners
 * receive the same validated list the CLI and GUI build.
 * @param {string[]} [filters] - Ordered filter expressions from the tool field.
 * @returns {string[] | undefined} The expanded chain, or undefined when none was given.
 * @throws {Error} `INVALID_VIDEO_FILTERS` When any entry fails validation.
 */
function validatedVideoFilters(filters?: string[]): string[] | undefined {
  if (!filters?.length) return undefined;
  const expanded = filters.map(expandFilterShorthand);
  const errors = validateVideoFilters(expanded);
  if (errors.length > 0) {
    throw createError(
      ErrorCode.INVALID_VIDEO_FILTERS,
      ERROR_MESSAGES[ErrorCode.INVALID_VIDEO_FILTERS],
      `Invalid video filter chain: ${errors.join(' ')}`,
    );
  }
  return expanded;
}

/**
 * Fields accepted by the `remux_media` MCP tool, mirroring `RemuxCliFlags` in
 * structured form.
 * @interface MCPRemuxFields
 * @property {string} [container] - Target container extension (e.g. 'mkv');
 *   defaults to the output extension, then the input extension.
 * @property {string} [output] - Explicit output file path.
 * @property {string[]} [map] - Explicit `-map` specs; defaults to every probed
 *   source stream.
 * @property {boolean} [subtitles] - Set false to drop source subtitle streams
 *   from the default selection.
 * @property {MCPRemuxSubtitle[]} [addSubtitle] - Added subtitle inputs.
 * @property {MCPRemuxAudio[]} [addAudio] - Added audio inputs (stream-copied).
 * @property {MCPRemuxThumbnail} [thumbnail] - Cover art.
 * @property {MCPChapters} [chapters] - `'source'` or an FFMETADATA file.
 * @property {string} [subtitleCodec] - Default codec for added subtitles;
 *   overrides each entry's own `codec`.
 * @property {number} [audioSyncSeconds] - Signed seconds shifting the primary
 *   input's audio (positive = audio plays LATER).
 * @property {string[]} [videoFilters] - Ordered FFmpeg video filter
 *   expressions. Filters require re-encoding, so their presence turns the
 *   stream copy into a re-encode (see the `filters_force_reencode` warning).
 */
export interface MCPRemuxFields {
  container?: string;
  output?: string;
  map?: string[];
  subtitles?: boolean;
  addSubtitle?: MCPRemuxSubtitle[];
  addAudio?: MCPRemuxAudio[];
  thumbnail?: MCPRemuxThumbnail;
  chapters?: 'source' | { file: string };
  subtitleCodec?: string;
  audioSyncSeconds?: number;
  videoFilters?: string[];
}

/**
 * The materialized remux plan: options, output path, resolved container, and
 * the non-blocking compatibility findings.
 * @interface MCPRemuxPlan
 * @property {ConversionOptions} options - Ready-to-run conversion options.
 * @property {string} output - Resolved absolute output path.
 * @property {string} container - Normalized target container extension.
 * @property {RemuxWarning[]} warnings - Non-blocking findings.
 */
export interface MCPRemuxPlan {
  options: ConversionOptions;
  output: string;
  container: string;
  warnings: RemuxWarning[];
}

/**
 * Resolves the target container: `container` wins, then the output extension,
 * then the input extension.
 * @param {string} input - Input file path.
 * @param {MCPRemuxFields} fields - Remux fields.
 * @returns {string} Normalized container extension (no dot, lower-case).
 * @throws {Error} `INVALID_FORMAT` When no container can be determined.
 */
function resolveMcpRemuxContainer(input: string, fields: MCPRemuxFields): string {
  const container = (fields.container ?? (fields.output ? getInputExtension(fields.output) : '') ?? '').trim() || getInputExtension(input);
  const normalized = container.toLowerCase().replace(/^\./, '');
  if (!normalized) {
    throw createError(
      ErrorCode.INVALID_FORMAT,
      'remux_media requires a target container (set "container", or pass a file with a known extension)',
    );
  }
  return normalized;
}

/**
 * The container's default subtitle codec (the first entry of
 * `SUBTITLE_CODEC_CONTAINERS`), mirroring the Remux GUI picker default and the
 * CLI's `defaultSubtitleCodec`.
 * @param {string} container - Normalized container extension.
 * @returns {string} The container's default subtitle codec, or 'subrip'.
 */
function defaultMcpSubtitleCodec(container: string): string {
  return SUBTITLE_CODEC_CONTAINERS[container]?.[0] ?? 'subrip';
}

/**
 * Builds the cover-art extra input. MKV/WebM attach the picture with `-attach`
 * (no `-i`, so it consumes no input index); MP4/MOV map it as an extra video
 * stream carrying the `attached_pic` disposition.
 * @param {MCPRemuxThumbnail} thumbnail - Cover-art field.
 * @param {string} container - Normalized container extension.
 * @param {number} inputIndex - Next free input index.
 * @returns {RemuxInput} The thumbnail entry.
 * @throws {Error} `INCOMPATIBLE_CONTAINER` When the container cannot store
 *   cover art in the requested mode.
 */
function buildMcpThumbnailInput(thumbnail: MCPRemuxThumbnail, container: string, inputIndex: number): RemuxInput {
  const type = thumbnail.type ?? (container === 'mkv' || container === 'webm' ? 'attachment' : 'disposition');
  if (type === 'attachment') {
    if (container !== 'mkv' && container !== 'webm') {
      throw createError(ErrorCode.INCOMPATIBLE_CONTAINER, `Container ${container} cannot store attached cover art (use mkv or webm)`);
    }
    return { path: thumbnail.file, map: [], attachment: true };
  }
  if (!isContainerCompatibleWithCover(container)) {
    throw createError(ErrorCode.INCOMPATIBLE_CONTAINER, `Container ${container} cannot store cover art (use mkv, webm, mp4, or mov)`);
  }
  return { path: thumbnail.file, map: [`${inputIndex}:0`], disposition: ATTACHED_PIC_DISPOSITION };
}

/**
 * Builds the ordered extra-input list from the added tracks, mirroring the CLI's
 * `--add-subtitle`/`--add-audio` accounting: subtitles first (each taking the
 * next input index, with `subtitleCodec` overriding the per-file codec), then
 * audio, then the cover art. Added inputs are stream-copied except subtitles,
 * which need an explicit codec for the target container.
 * @param {MCPRemuxFields} fields - Remux fields.
 * @param {string} container - Normalized container extension.
 * @returns {RemuxInput[]} Extra inputs in tool-argument order.
 * @throws {Error} `INCOMPATIBLE_CONTAINER` When the cover art cannot be stored.
 */
function buildMcpAddedInputs(fields: MCPRemuxFields, container: string): RemuxInput[] {
  const entries: RemuxInput[] = [];
  let nextInputIndex = 1;

  for (const subtitle of fields.addSubtitle ?? []) {
    const entry: RemuxInput = {
      path: subtitle.file,
      map: [`${nextInputIndex}:0`],
      codec: fields.subtitleCodec ?? subtitle.codec ?? defaultMcpSubtitleCodec(container),
    };
    if (subtitle.syncOffsetSeconds !== undefined) entry.syncOffsetSeconds = subtitle.syncOffsetSeconds;
    entries.push(entry);
    nextInputIndex += 1;
  }

  for (const audio of fields.addAudio ?? []) {
    const entry: RemuxInput = { path: audio.file, map: [`${nextInputIndex}:0`], codec: 'copy' };
    if (audio.syncOffsetSeconds !== undefined) entry.syncOffsetSeconds = audio.syncOffsetSeconds;
    entries.push(entry);
    nextInputIndex += 1;
  }

  if (fields.thumbnail) {
    entries.push(buildMcpThumbnailInput(fields.thumbnail, container, nextInputIndex));
  }

  return entries;
}

/**
 * Builds the remux plan for the `remux_media` tool.
 *
 * Delegates to the shared {@link buildAndValidateRemuxPlan} so MCP stream-copy
 * selection, added-input indices, the audio re-read trick, and container
 * compatibility behave exactly as the CLI and GUI. When probed `streams` are
 * supplied, the default `-map` selection is derived from them; without them the
 * builder stays pure but leaves the selection to FFmpeg's defaults.
 *
 * @param {string} input - Input media path.
 * @param {MCPRemuxFields} fields - Remux fields.
 * @param {MediaStreamInfo[]} [streams] - Probed source streams.
 * @returns {MCPRemuxPlan} The resolved options, output, container, and warnings.
 * @throws {Error} `INVALID_FORMAT` When no container can be determined, or the
 *   container drops an imported chapters file.
 * @throws {Error} `INCOMPATIBLE_CONTAINER` When a selected stream or the cover
 *   art cannot be stored in the target container.
 */
export function buildRemuxPlan(input: string, fields: MCPRemuxFields, streams: MediaStreamInfo[] = []): MCPRemuxPlan {
  const container = resolveMcpRemuxContainer(input, fields);

  const explicitMaps = (fields.map ?? []).map((spec) => spec.trim()).filter(Boolean);
  const maps =
    explicitMaps.length > 0 ? explicitMaps : streams.length > 0 ? buildPrimaryStreamMaps(streams, fields.subtitles !== false) : [];

  const additionalInputs = buildMcpAddedInputs(fields, container);

  const chaptersFile = typeof fields.chapters === 'object' ? fields.chapters.file : undefined;
  if (chaptersFile && !isContainerCompatibleWithChapters(container)) {
    throw createError(ErrorCode.INCOMPATIBLE_CONTAINER, `Container ${container} does not store chapters (use mp4, mov, or mkv)`);
  }

  const plan = buildAndValidateRemuxPlan(
    {
      input,
      container,
      maps,
      additionalInputs,
      chaptersFile,
      copyChapters: true,
      audioSyncSeconds: fields.audioSyncSeconds,
      videoFilters: validatedVideoFilters(fields.videoFilters),
    },
    streams,
  );

  const hard = plan.warnings.find((finding) => finding.icon === 'error');
  if (hard) {
    throw createError(ErrorCode.INCOMPATIBLE_CONTAINER, hard.message, hard.code);
  }

  return { options: plan.options, output: fields.output ?? plan.output, container, warnings: plan.warnings };
}

/**
 * Fields accepted by the `demux_media` MCP tool, mirroring `DemuxCliFlags`.
 * @interface MCPDemuxFields
 * @property {string} [outputDir] - Directory to write the extracted streams
 *   into; defaults to the input's directory.
 * @property {boolean} [video] - Extract video streams.
 * @property {boolean} [audio] - Extract audio streams.
 * @property {boolean} [subtitles] - Extract subtitle streams.
 * @property {boolean} [all] - Extract every kind (the default).
 * @property {string} [videoContainer] - Re-encode video into this container.
 * @property {string} [audioCodec] - Re-encode audio with this encoder.
 * @property {string} [subtitleCodec] - Convert text subtitles to this format
 *   (`srt`, `ass`); `copy` keeps them as-is.
 * @property {string[]} [videoFilters] - Ordered FFmpeg video filter
 *   expressions, applied to video targets that re-encode; a stream-copied video
 *   target ignores them (reported as a `filtersIgnoredCopy` warning).
 */
export interface MCPDemuxFields {
  outputDir?: string;
  video?: boolean;
  audio?: boolean;
  subtitles?: boolean;
  all?: boolean;
  videoContainer?: string;
  audioCodec?: string;
  subtitleCodec?: string;
  videoFilters?: string[];
}

/**
 * The materialized demux plan: one extraction target per selected stream, the
 * non-blocking findings, and the streams the targets were built from.
 * @interface MCPDemuxPlan
 * @property {DemuxTarget[]} targets - Extraction targets with absolute outputs.
 * @property {RemuxWarning[]} warnings - Non-blocking findings.
 * @property {MediaStreamInfo[]} streams - The selected source streams.
 */
export interface MCPDemuxPlan {
  targets: DemuxTarget[];
  warnings: RemuxWarning[];
  streams: MediaStreamInfo[];
}

/**
 * Resolves the requested stream kinds: `all` (or no kind flag at all) selects
 * every kind, otherwise the kinds named by `video`/`audio`/`subtitles`.
 * @param {MCPDemuxFields} fields - Demux fields.
 * @returns {Array<'video'|'audio'|'subtitle'>} Ordered kinds to extract.
 */
function resolveMcpDemuxKinds(fields: MCPDemuxFields): Array<'video' | 'audio' | 'subtitle'> {
  const kinds: Array<'video' | 'audio' | 'subtitle'> = [];
  if (fields.video) kinds.push('video');
  if (fields.audio) kinds.push('audio');
  if (fields.subtitles) kinds.push('subtitle');
  if (kinds.length > 0 && !fields.all) return kinds;
  return ['video', 'audio', 'subtitle'];
}

/**
 * Converts the demux fields into {@link DemuxMediaPreferences}. `copy` (and an
 * empty value) means "keep the stream as-is", so it is dropped instead of being
 * forwarded as an encoder name.
 * @param {MCPDemuxFields} fields - Demux fields.
 * @returns {DemuxMediaPreferences} Per-kind conversion preferences.
 */
function buildMcpDemuxPreferences(fields: MCPDemuxFields): DemuxMediaPreferences {
  const media: DemuxMediaPreferences = {};
  const container = (fields.videoContainer ?? '').trim().replace(/^\./, '').toLowerCase();
  if (container && container !== 'copy') media.videoContainer = container;
  const audioCodec = (fields.audioCodec ?? '').trim().toLowerCase();
  if (audioCodec && audioCodec !== 'copy') media.audioCodec = audioCodec;
  const subtitleFormat = (fields.subtitleCodec ?? '').trim().toLowerCase();
  if (subtitleFormat && subtitleFormat !== 'copy') media.subtitleCodec = subtitleFormat;
  const videoFilters = validatedVideoFilters(fields.videoFilters);
  if (videoFilters) media.videoFilters = videoFilters;
  return media;
}

/**
 * Builds the per-stream extraction targets for the `demux_media` tool, resolving
 * each output into `outputDir` when given and next to the input otherwise.
 * Target naming and per-kind conversions come from the shared
 * {@link buildDemuxTargets}, so MCP, CLI, and GUI produce identical outputs.
 * @param {string} input - Input media path.
 * @param {MCPDemuxFields} fields - Demux fields.
 * @param {MediaStreamInfo[]} [streams] - Probed source streams.
 * @returns {MCPDemuxPlan} Targets, warnings, and the selected streams.
 * @throws {Error} `STREAM_NOT_FOUND` When the source has no stream of the
 *   requested kinds.
 */
export function buildDemuxPlan(input: string, fields: MCPDemuxFields, streams: MediaStreamInfo[] = []): MCPDemuxPlan {
  const kinds = resolveMcpDemuxKinds(fields);
  const wanted = new Set(kinds);
  const selected = streams.filter((stream) => wanted.has(stream.type) && !stream.disposition?.includes(ATTACHED_PIC_DISPOSITION));
  if (selected.length === 0) {
    throw createError(ErrorCode.STREAM_NOT_FOUND, `No ${kinds.join('/')} streams found in ${path.basename(input)}`);
  }

  const media = buildMcpDemuxPreferences(fields);
  const outputDir = fields.outputDir ?? path.dirname(input);
  const targets = buildDemuxTargets(input, path.basename(input, path.extname(input)), selected, media).map((target) => ({
    ...target,
    output: path.join(outputDir, target.output),
  }));

  return { targets, warnings: demuxWarnings(selected, media), streams: selected };
}

/**
 * Composes the `ConversionOptions` for one demux target: the single `-map` spec,
 * `-vn`/`-an` guards so only the mapped kind is written, and the per-kind
 * encoder as a raw `-c:<kind> <codec>` override when the target re-encodes.
 * @param {DemuxTarget} target - The extraction target.
 * @returns {ConversionOptions} Ready-to-run conversion options.
 */
export function buildDemuxJobOptions(target: DemuxTarget): ConversionOptions {
  const options: ConversionOptions = { copy: target.copy, map: [target.map] };
  if (target.kind === 'video') {
    options.video = true;
    options.audio = false;
    if (target.videoFilters?.length) options.videoFilters = target.videoFilters;
  } else if (target.kind === 'audio') {
    options.video = false;
    options.audio = true;
  } else {
    options.video = false;
    options.audio = false;
  }
  if (!target.copy && target.codec) {
    options.extraArgs = [`-c:${target.kind[0]}`, target.codec];
  }
  return options;
}
