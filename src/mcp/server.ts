/**
 * @fileoverview MCP server factory for EncodeX.
 * Builds an {@link McpServer} instance exposing EncodeX's media engine
 * (conversion, media info, capabilities, profiles, and later compression,
 * audio extraction, and batch processing) as MCP tools, resources, and prompts.
 *
 * The factory is the single shared entry point used by both launch paths:
 *
 *  - Standalone stdio server (`node dist/mcp/index.js`) — "Phase 1".
 *  - Embedded Streamable-HTTP server in the Electron main process — "Phase 2",
 *    which reuses this factory and adds GUI-parity tools on top.
 *
 * The underlying engine is Electron-free: tools drive the {@link ITranscoder}
 * abstraction and shared helpers directly, so the same code runs under plain
 * Node and inside Electron.
 */

import * as fs from 'fs';
import * as path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';
import { APP_NAME } from '../shared/app-constants';
import { createTranscoder } from '../main/transcoders/factory';
import type { ITranscoder } from '../main/transcoders/types';
import { createError, formatError, isAppError, ErrorCode } from '../shared/errors';
import type { EncoderCapabilities, MediaInfo, TranscoderType } from '../shared/types';
import { MAX_QUEUE_CONCURRENCY } from '../shared/constants';
import { getEncoderCapabilities } from '../main/capabilities';
import { BUILTIN_PROFILES } from '../shared/profiles/builtin';
import type { ConversionProfile } from '../shared/types';
import {
  adviseEncoding,
  analyzeMedia,
  compareQuality,
  estimateConversion,
  explainError,
  extractMediaFacts,
  libraryRow,
  parseIntent,
  parseBitrateKbps,
  planTargetSizeCandidates,
  recommendSettings,
  summarizeLibrary,
  validateOutput,
} from '../shared/ai';
import { createAuditEntry } from '../shared/audit';
import type { AuditEntry } from '../shared/audit';
import { batchEnvelopeExceeds, tierForTool } from './safety';
import type { BatchEnvelope } from './safety';
import type { LibraryRow, PlanRequest } from '../shared/ai';
import { VIDEO_CODECS, AUDIO_CODECS } from '../shared/media-options';
import { suggestedExtensionForVideoCodec } from '../shared/codec-containers';
import { expandInputs, getInputExtension } from '../main/cli/cli-util';
import { buildConversionOptions, resolveOutputPath, MCPConversionFields } from './conversion-options';
import { MCP_UI_EXTENSION_ID, MCP_UI_RESOURCE_MIME_TYPE, MCP_UI_VIEW_URIS } from '../shared/mcp-ui';
import type { McpUiConfirmationField, McpUiJob } from '../shared/mcp-ui';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { registerUiResources } from './ui/resources';
import {
  hostSupportsMcpApps,
  confirmationResult,
  confirmationField,
  confirmationViewUri,
  COMMIT_OPERATION_TOOL,
  CONFIRMABLE_OPERATIONS,
} from './ui/approval';
import { MCPJobManager } from './jobs/manager';
import type { MCPJob } from './jobs/manager';
import {
  buildCompressPlan,
  buildExtractAudioPlan,
  buildCutPlan,
  buildBatchPlan,
  buildRemuxPlan,
  buildDemuxPlan,
  buildDemuxJobOptions,
} from './operations';
import type { MCPCompressFields, MCPExtractAudioFields, MCPCutFields, MCPRemuxFields, MCPDemuxFields } from './operations';

/**
 * Configuration accepted by {@link createMcpServer}.
 * @interface CreateMcpServerOptions
 * @property {string} [name] - Server name advertised in the MCP handshake.
 *   Defaults to {@link APP_NAME}.
 * @property {string} [version] - Server version advertised in the handshake.
 *   Defaults to the app version from package.json.
 * @property {function(TranscoderType): ITranscoder} [transcoderFactory] -
 *   Overrides transcoder creation (test seam; defaults to the shared factory).
 * @property {MCPJobManager} [jobManager] - Job manager backing the conversion
 *   tools. Shared across tool calls so agents can poll/queue/cancel; a fresh
 *   manager is created when omitted.
 * @property {function(AuditEntry): void} [onAudit] - Optional sink invoked once
 *   for every committed (or headlessly executed) mutating operation, so the
 *   Electron main process can surface an audit trail in the renderer. Errors
 *   thrown by the sink are swallowed.
 */
export interface CreateMcpServerOptions {
  name?: string;
  version?: string;
  transcoderFactory?: (type: TranscoderType) => ITranscoder;
  jobManager?: MCPJobManager;
  onAudit?: (entry: AuditEntry) => void;
}

/**
 * Reads the application version from the repo's package.json, tolerating a
 * missing file (e.g. unusual packaged layouts). Falls back to '0.0.0'.
 * @returns {string} The resolved version string.
 */
function resolveAppVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('../../package.json') as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Builds a successful tool result carrying a single text payload and, when
 * provided, the machine-readable `structuredContent` an MCP App view renders.
 *
 * Every EncodeX tool returns `structuredContent` (SEP-1865 / R0.2) so hosts can
 * read typed data instead of re-parsing prose; the text block remains the
 * mandatory fallback for hosts that do not render views (SEP-2133). Passing no
 * payload keeps the historic text-only shape used by simple acknowledgement
 * results.
 * @param {string} text - The JSON text result.
 * @param {Record<string, unknown>} [structuredContent] - Typed data for the view.
 * @returns {{content: Array<{type: 'text'; text: string}>; structuredContent?: Record<string, unknown>}} MCP tool result.
 */
export function ok(
  text: string,
  structuredContent?: Record<string, unknown>,
): { content: Array<{ type: 'text'; text: string }>; structuredContent?: Record<string, unknown> } {
  const base: { content: Array<{ type: 'text'; text: string }>; structuredContent?: Record<string, unknown> } = {
    content: [{ type: 'text', text }],
  };
  if (structuredContent !== undefined) {
    base.structuredContent = structuredContent;
  }
  return base;
}

/**
 * Builds a successful tool result that carries both the text fallback and
 * machine-readable `structuredContent` for an MCP App view. Non-UI hosts ignore
 * `structuredContent` and render the text exactly as they do today. Thin wrapper
 * over {@link ok} that makes the structured payload required at the call site.
 * @param {string} text - The text fallback (typically `JSON.stringify(data)`).
 * @param {Record<string, unknown>} structuredContent - Data for the view to render.
 * @returns {{content: Array<{type: 'text'; text: string}>; structuredContent: Record<string, unknown>}} MCP tool result.
 */
export function okUi(
  text: string,
  structuredContent: Record<string, unknown>,
): { content: Array<{ type: 'text'; text: string }>; structuredContent: Record<string, unknown> } {
  return { content: [{ type: 'text', text }], structuredContent };
}

/**
 * Builds a failed tool result from any thrown error. AppErrors keep their
 * categorized code; everything else is normalized through {@link formatError}.
 * The machine-readable `structuredContent` mirrors the JSON text (`ok:false` +
 * stable code) so a model or view can branch on the error code, while `isError`
 * preserves the MCP error contract.
 * @param {unknown} err - The thrown error.
 * @returns {{content: Array<{type: 'text'; text: string}>; isError: boolean; structuredContent: Record<string, unknown>}} Error result.
 */
export function fail(err: unknown): {
  content: Array<{ type: 'text'; text: string }>;
  isError: boolean;
  structuredContent: Record<string, unknown>;
} {
  const appErr = isAppError(err) ? err : formatError(err);
  const structuredContent: Record<string, unknown> = {
    ok: false,
    code: appErr.code,
    message: appErr.message,
    detail: appErr.detail,
  };
  return {
    content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
    isError: true,
    structuredContent,
  };
}

/**
 * Serializes a conversion profile with its full field set for tool responses.
 * @param {ConversionProfile} profile - The profile to serialize.
 * @returns {Record<string, unknown>} Plain JSON-safe profile object.
 */
function profileToJson(profile: ConversionProfile): Record<string, unknown> {
  return {
    id: profile.id,
    name: profile.name,
    category: profile.category,
    container: profile.container,
    videoCodec: profile.videoCodec,
    audioCodec: profile.audioCodec,
    videoBitrate: profile.videoBitrate,
    audioBitrate: profile.audioBitrate,
    crf: profile.crf,
    preset: profile.preset,
    scale: profile.scale,
    pixelFormat: profile.pixelFormat,
    fps: profile.fps,
    extension: profile.extension ?? profile.container,
    compatibility: profile.compatibility,
    description: profile.description,
    builtin: profile.builtin,
  };
}

/**
 * The schema of arguments accepted by the `convert_media` tool.
 */
const conversionSchema = z.object({
  input: z.string().min(1).describe('Absolute path of the input media file.'),
  output: z.string().optional().describe('Absolute output file path. Derived when omitted (input name + `_converted`).'),
  videoCodec: z.string().optional().describe('Video encoder (e.g. libx264, copy).'),
  audioCodec: z.string().optional().describe('Audio encoder (e.g. aac, copy).'),
  videoBitrate: z.string().optional().describe('Video bitrate (e.g. 2000k).'),
  audioBitrate: z.string().optional().describe('Audio bitrate (e.g. 192k).'),
  qscale: z.number().int().optional().describe('Video quality scale (1 best - 31 worst). Out-of-range values are clamed.'),
  scale: z.string().optional().describe('Output resolution (WxH or percent).'),
  keepAspectRatio: z.boolean().optional().describe('Preserve the source aspect ratio when scaling.'),
  rotate: z.enum(['90', '180', '270']).optional().describe('Output rotation in degrees.'),
  flipH: z.boolean().optional().describe('Mirror the output horizontally.'),
  flipV: z.boolean().optional().describe('Mirror the output vertically.'),
  pixelFormat: z.string().optional().describe('Output pixel format (e.g. yuv420p).'),
  startTime: z.string().optional().describe('Trim start time (HH:MM:SS or seconds).'),
  endTime: z.string().optional().describe('Trim end time (HH:MM:SS or seconds).'),
  duration: z.string().optional().describe('Maximum output duration.'),
  copy: z.boolean().optional().describe('Lossless stream copy (no re-encode).'),
  audio: z.boolean().optional().describe('Include audio streams (default true; set false to exclude).'),
  video: z.boolean().optional().describe('Include video streams (default true; set false to exclude).'),
  hardwareAcceleration: z.boolean().optional().describe('Enable hardware acceleration.'),
  hwaccelMode: z.enum(['auto', 'encode']).optional().describe('Hardware acceleration mode.'),
  videoFilters: z
    .array(z.string().min(1))
    .max(8)
    .optional()
    .describe('Ordered FFmpeg video filter expressions appended after scale/rotation (requires re-encoding).'),
  filters: z.string().optional().describe('Comma-joined video filter chain (compact shorthand for videoFilters).'),
  presets: z
    .array(z.string().min(1))
    .max(8)
    .optional()
    .describe('Curated filter preset ids (e.g. grayscale, crop, framerate) expanded before the custom chain.'),
  extraArgs: z.array(z.string()).optional().describe('Extra FFmpeg output arguments appended to the command.'),
  transcoder: z.enum(['FFMPEG', 'FFTOOL', 'BMF']).optional().describe('Transcoder backend (default FFMPEG).'),
  concurrency: z
    .number()
    .int()
    .min(1)
    .max(MAX_QUEUE_CONCURRENCY)
    .optional()
    .describe(`Max parallel conversions (1-${MAX_QUEUE_CONCURRENCY}); adjusts the shared queue cap.`),
});

/**
 * Schema for the `compress_image` tool.
 */
const compressSchema = z.object({
  input: z.string().min(1).describe('Absolute path of the input image.'),
  output: z.string().optional().describe('Absolute output path. Derived as `<name>_compressed.<format>` when omitted.'),
  format: z.string().optional().describe('Output image format (jpg, png, webp, gif, bmp, tiff). Defaults to the source format.'),
  quality: z.number().int().optional().describe('Quality scale (1 best - 31 worst; default 23). Out-of-range values are dropped.'),
  scale: z.string().optional().describe('Output resolution (WxH or percent).'),
  transcoder: z.enum(['FFMPEG', 'FFTOOL', 'BMF']).optional().describe('Transcoder backend (default FFMPEG).'),
});

/**
 * Schema for the `extract_audio` tool.
 */
const extractSchema = z.object({
  input: z.string().min(1).describe('Absolute path of the input media file.'),
  output: z.string().optional().describe('Absolute output path. Derived as `<name>.<ext>` when omitted (extension follows the codec).'),
  audioCodec: z.string().optional().describe('Audio encoder (default mp3/libmp3lame).'),
  bitrate: z.string().optional().describe('Audio bitrate (default 192k).'),
  transcoder: z.enum(['FFMPEG', 'FFTOOL', 'BMF']).optional().describe('Transcoder backend (default FFMPEG).'),
});

/**
 * Schema for the `cut_video` tool.
 */
const cutSchema = z.object({
  input: z.string().min(1).describe('Absolute path of the input media file.'),
  output: z.string().optional().describe('Absolute output path. Derived as `<name>_cut.<input-ext>` when omitted.'),
  startTime: z.string().optional().describe('Trim start time (HH:MM:SS or seconds).'),
  endTime: z.string().optional().describe('Trim end time (HH:MM:SS or seconds).'),
  duration: z.string().optional().describe('Maximum output duration.'),
  copy: z.boolean().optional().describe('Lossless stream copy (default true; set false to re-encode).'),
  audio: z.boolean().optional().describe('Include audio streams (default true; set false to drop).'),
  extraArgs: z.array(z.string()).optional().describe('Extra FFmpeg output arguments.'),
  transcoder: z.enum(['FFMPEG', 'FFTOOL', 'BMF']).optional().describe('Transcoder backend (default FFMPEG).'),
});

/**
 * The schema of arguments accepted by the `batch_convert` tool: the conversion
 * fields shared by every job (from {@link conversionSchema}), without the
 * per-job `input`/`output`, plus batch-level `inputs`/`outputDir`/`suffix`.
 */
const batchSchema = conversionSchema.omit({ input: true, output: true, concurrency: true, transcoder: true }).extend({
  inputs: z.array(z.string().min(1)).min(1).describe('Input paths, directories, or glob patterns; one job per matched file.'),
  outputDir: z.string().optional().describe('Directory to write all outputs into (created when missing).'),
  suffix: z.string().optional().describe('Output file suffix (default `_encodex_converted`).'),
  concurrency: z
    .number()
    .int()
    .min(1)
    .max(MAX_QUEUE_CONCURRENCY)
    .optional()
    .describe(`Max parallel conversions (1-${MAX_QUEUE_CONCURRENCY}); adjusts the shared queue cap.`),
  transcoder: z.enum(['FFMPEG', 'FFTOOL', 'BMF']).optional().describe('Transcoder backend (default FFMPEG).'),
});

/**
 * The schema of arguments accepted by the `remux_media` tool. Every field maps
 * to the shared remux planner, so a remux here selects the same streams, added
 * inputs, and chapters handling as the `remux` CLI subcommand and the Remux page.
 */
const remuxSchema = z.object({
  input: z.string().min(1).describe('Absolute path of the input media file.'),
  container: z.string().optional().describe('Target container (mkv, mp4, mov, webm, ...). Defaults to the output, then input extension.'),
  output: z.string().optional().describe('Absolute output path. Derived as `<name>.<container>` next to the input when omitted.'),
  map: z.array(z.string().min(1)).optional().describe('Explicit -map specs (e.g. ["0:v:0", "0:a:0"]). Defaults to every probed stream.'),
  subtitles: z.boolean().optional().describe('Keep source subtitle streams in the default selection (default true).'),
  addSubtitle: z
    .array(
      z.object({
        file: z.string().min(1).describe('Subtitle file to add.'),
        codec: z.string().optional().describe('Per-file subtitle codec (e.g. srt, ass, mov_text).'),
        syncOffsetSeconds: z.number().optional().describe('Signed -itsoffset for this track (positive = plays later).'),
      }),
    )
    .optional()
    .describe('External subtitle tracks to mux into the output.'),
  addAudio: z
    .array(
      z.object({
        file: z.string().min(1).describe('Audio file to add.'),
        syncOffsetSeconds: z.number().optional().describe('Signed -itsoffset for this track (positive = plays later).'),
      }),
    )
    .optional()
    .describe('External audio tracks to mux into the output (stream-copied).'),
  thumbnail: z
    .object({
      file: z.string().min(1).describe('Cover-art image path.'),
      type: z
        .enum(['attachment', 'disposition'])
        .optional()
        .describe('Cover-art mechanism; inferred from the container when omitted (mkv/webm attach, mp4/mov attached_pic).'),
    })
    .optional()
    .describe('Cover art to embed in the output.'),
  chapters: z
    .union([z.literal('source'), z.object({ file: z.string().min(1).describe('FFMETADATA chapters file to import.') })])
    .optional()
    .describe('Chapters handling: "source" keeps the source chapters (default); an object imports a chapters file.'),
  subtitleCodec: z.string().optional().describe('Default codec for added subtitles; overrides each addSubtitle.codec.'),
  audioSyncSeconds: z.number().optional().describe("Signed seconds to shift the input's own audio (positive = audio plays later)."),
  videoFilters: z
    .array(z.string().min(1))
    .max(8)
    .optional()
    .describe(
      'Ordered FFmpeg video filter expressions (e.g. ["fps=30", "crop=640:480:0:0"]). Filters require re-encoding, ' +
        'so their presence turns the stream copy into a re-encode of the selected streams.',
    ),
  transcoder: z.enum(['FFMPEG', 'FFTOOL', 'BMF']).optional().describe('Transcoder backend (default FFMPEG).'),
});

/**
 * The schema of arguments accepted by the `demux_media` tool: one job per
 * selected stream, named by the shared demux planner.
 */
const demuxSchema = z.object({
  input: z.string().min(1).describe('Absolute path of the input media file.'),
  outputDir: z
    .string()
    .optional()
    .describe('Directory to write the extracted streams into (created when missing). Defaults to the input directory.'),
  video: z.boolean().optional().describe('Extract video streams.'),
  audio: z.boolean().optional().describe('Extract audio streams.'),
  subtitles: z.boolean().optional().describe('Extract subtitle streams.'),
  all: z.boolean().optional().describe('Extract every kind (the default).'),
  videoContainer: z.string().optional().describe('Re-encode video into this container when it differs from the stream format.'),
  audioCodec: z.string().optional().describe('Re-encode audio with this encoder (e.g. mp3, flac).'),
  subtitleCodec: z.string().optional().describe('Convert text subtitles to this format (e.g. srt, ass); copy keeps them as-is.'),
  videoFilters: z
    .array(z.string().min(1))
    .max(8)
    .optional()
    .describe(
      'Ordered FFmpeg video filter expressions applied to video streams that are re-encoded (set videoContainer to a ' +
        'different container). Stream-copied video targets ignore them and report a filtersIgnoredCopy warning.',
    ),
  transcoder: z.enum(['FFMPEG', 'FFTOOL', 'BMF']).optional().describe('Transcoder backend (default FFMPEG).'),
});

/**
 * Schema for the `analyze_media` tool: a probe reduced to a plain-language
 * diagnosis, optionally focused on compatibility, quality, or size.
 */
const analyzeSchema = z.object({
  input: z.string().min(1).describe('Absolute path of the media file to diagnose.'),
  focus: z.enum(['compat', 'quality', 'size']).optional().describe("Framing of the diagnosis (default 'compat')."),
});

/**
 * Hard constraints accepted by `recommend_settings`.
 */
const constraintsSchema = z.object({
  maxBytes: z.number().int().positive().optional().describe('Hard output size ceiling in bytes.'),
  targetDevice: z.string().optional().describe("Target device/ecosystem (e.g. 'iphone', 'android', 'appletv')."),
  platform: z.string().optional().describe("Target platform (e.g. 'youtube', 'web')."),
  maxWidth: z.number().int().positive().optional().describe('Maximum output width in pixels.'),
  maxHeight: z.number().int().positive().optional().describe('Maximum output height in pixels.'),
});

/**
 * Schema for the `recommend_settings` tool: intent plus facts -> a typed plan.
 */
const recommendSchema = z.object({
  input: z.string().min(1).describe('Absolute path of the input media file.'),
  intent: z.string().min(1).describe("The user's natural-language goal (e.g. 'make this work on my iPhone')."),
  constraints: constraintsSchema.optional().describe('Optional hard constraints steering the plan.'),
});

/**
 * Schema for the `estimate_conversion` tool. `args` mirrors the size-affecting
 * fields of `convert_media` so a plan can be estimated before it runs.
 */
const estimateSchema = z.object({
  input: z.string().min(1).describe('Absolute path of the input media file.'),
  args: z
    .object({
      videoCodec: z.string().optional().describe('Video encoder (e.g. libx264, copy).'),
      audioCodec: z.string().optional().describe('Audio encoder (e.g. aac, copy).'),
      videoBitrate: z.string().optional().describe('Target video bitrate (e.g. 2000k).'),
      audioBitrate: z.string().optional().describe('Target audio bitrate (e.g. 192k).'),
      scale: z.string().optional().describe('Output resolution (WxH or percent).'),
      startTime: z.string().optional().describe('Trim start time (HH:MM:SS or seconds).'),
      endTime: z.string().optional().describe('Trim end time (HH:MM:SS or seconds).'),
      duration: z.string().optional().describe('Maximum output duration.'),
      copy: z.boolean().optional().describe('Lossless stream copy (size is preserved).'),
      audio: z.boolean().optional().describe('Include audio streams (default true).'),
      video: z.boolean().optional().describe('Include video streams (default true).'),
    })
    .optional()
    .describe('The conversion arguments to estimate (the size-affecting subset of convert_media).'),
});

/**
 * Expected properties checked by `validate_output`.
 */
const validationExpectSchema = z.object({
  maxBytes: z.number().int().positive().optional().describe('Maximum allowed output size in bytes.'),
  minResolution: z.string().optional().describe("Minimum video resolution ('WxH')."),
  codec: z.string().optional().describe("Required video codec (e.g. 'h264')."),
  container: z.string().optional().describe('Required container/format substring (e.g. mp4).'),
  hasAudio: z.boolean().optional().describe('Require an audio stream.'),
  hasVideo: z.boolean().optional().describe('Require a video stream.'),
  minDurationSeconds: z.number().optional().describe('Minimum duration in seconds.'),
  maxDurationSeconds: z.number().optional().describe('Maximum duration in seconds.'),
});

/**
 * Schema for the `validate_output` tool: re-probe the output and check it.
 */
const validateSchema = z.object({
  output: z.string().min(1).describe('Absolute path of the produced output file to verify.'),
  expect: validationExpectSchema.optional().describe('Constraints the output must satisfy.'),
});

/**
 * Schema for the `compress_to_target` tool: encode until the measured output
 * fits a hard byte ceiling, keeping the best quality that does.
 */
const compressToTargetSchema = z.object({
  input: z.string().min(1).describe('Absolute path of the input media file.'),
  maxBytes: z.number().int().positive().describe('Hard output size ceiling in bytes.'),
  intent: z.string().optional().describe("Quality intent, e.g. 'keep the best quality' or 'smallest possible'."),
  videoCodec: z.string().optional().describe('Video encoder (default libx264).'),
  audioCodec: z.string().optional().describe('Audio encoder (default aac).'),
  audioBitrate: z.string().optional().describe('Audio bitrate (default derives from the target size).'),
  maxCandidates: z.number().int().min(1).max(5).optional().describe('How many bitrate candidates to try (1-5, default 3).'),
  output: z.string().optional().describe('Base output path; each candidate is suffixed with its bitrate.'),
  transcoder: z.enum(['FFMPEG', 'FFTOOL', 'BMF']).optional().describe('Transcoder backend (default FFMPEG).'),
});

/**
 * Schema for the `analyze_folder` tool: project the space a re-encode would save.
 */
const analyzeFolderSchema = z.object({
  path: z.string().min(1).describe('Directory (or glob) containing media to analyze.'),
  intent: z.string().optional().describe("Planning intent, e.g. 'compress to save space' or 'keep quality'."),
  recursive: z.boolean().optional().describe('Recurse into subdirectories (default false).'),
  maxFiles: z.number().int().min(1).max(500).optional().describe('Maximum files to probe (default 200).'),
  transcoder: z.enum(['FFMPEG', 'FFTOOL', 'BMF']).optional().describe('Transcoder backend (default FFMPEG).'),
});

/**
 * Schema for the `explain_error` tool: a raw failure (or a failed job id) mapped
 * to a plain-language explanation with likely causes and one-click fixes.
 */
const explainErrorSchema = z.object({
  code: z.string().optional().describe('The EncodeX error code (e.g. CONVERSION_FAILED).'),
  message: z.string().optional().describe('The raw error message; used to infer the code when code is omitted.'),
  detail: z.string().optional().describe('The optional error detail line.'),
  jobId: z.string().optional().describe('A failed job id to explain (its error is folded into the explanation).'),
  input: z.string().optional().describe('The input file the operation ran on, when known.'),
  tool: z.string().optional().describe('The tool that produced the error, when known.'),
  args: z.record(z.string(), z.unknown()).optional().describe('The arguments the tool was called with, when known.'),
});

/**
 * Schema for the `advise_encoding` tool: pick an encoder + hardware usage from
 * the real machine capabilities.
 */
const adviseEncodingSchema = z.object({
  input: z.string().min(1).describe('Absolute path of the input media file to advise on.'),
});

/**
 * Schema for the `quality_report` tool: compare a produced output to its source.
 */
const qualityReportSchema = z.object({
  source: z.string().min(1).describe('Absolute path of the source media file.'),
  output: z.string().min(1).describe('Absolute path of the produced output file to compare.'),
  expect: validationExpectSchema.optional().describe('Optional explicit expectations for the output.'),
});

/**
 * Media file extensions the folder analysis projects. Non-media files found in
 * a directory are skipped so the report only covers things that can be encoded.
 * @const {Set<string>}
 */
const MEDIA_EXTENSIONS = new Set([
  'mp4',
  'm4v',
  'mkv',
  'mov',
  'avi',
  'webm',
  'flv',
  'wmv',
  'mpg',
  'mpeg',
  'ts',
  'm2ts',
  'mp3',
  'aac',
  'm4a',
  'flac',
  'wav',
  'ogg',
  'opus',
  'wma',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'bmp',
  'tiff',
  'tif',
  'avif',
  'heic',
]);

/**
 * Tests whether a path looks like a media file by extension.
 * @param {string} file - The candidate file path.
 * @returns {boolean} True when the extension is in {@link MEDIA_EXTENSIONS}.
 */
function isMediaPath(file: string): boolean {
  return MEDIA_EXTENSIONS.has(path.extname(file).slice(1).toLowerCase());
}

/**
 * Extracts a human-readable message from an unknown thrown value.
 * @param {unknown} err - The thrown value.
 * @returns {string} The error message.
 */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Serializes an enqueued job into the shared tool response shape.
 * @param {ReturnType<MCPJobManager['enqueue']>} job - The enqueued job.
 * @param {string} transcoder - The transcoder backend used.
 * @returns {Record<string, unknown>} The JSON-safe response object.
 */
function enqueueResponse(job: ReturnType<MCPJobManager['enqueue']>, transcoder: string): Record<string, unknown> {
  return { jobId: job.id, input: job.input, output: job.output, status: job.status, transcoder };
}

/**
 * Verifies that every auxiliary file a remux will read exists, so a missing
 * subtitle, audio, cover, or chapters file fails before the job is queued.
 * @param {string[]} files - Absolute paths of the added assets.
 * @throws {Error} `AUXILIARY_INPUT_NOT_FOUND` When one of them is missing.
 */
function assertMcpAuxiliaryInputsExist(files: string[]): void {
  for (const file of files) {
    if (!fs.existsSync(file)) {
      throw createError(ErrorCode.AUXILIARY_INPUT_NOT_FOUND, `Auxiliary input file not found: ${file}`);
    }
  }
}

/**
 * Creates an McpServer instance for EncodeX with all core tools, resources,
 * and prompts registered.
 *
 * Phase 2 (Electron main) callers may pass overrides for the handshake name
 * and version; the tool/resource/prompt surface is identical across phases.
 *
 * @param {CreateMcpServerOptions} [options] - Optional handshake/engine overrides.
 * @returns {McpServer} A configured, unconnected McpServer ready for a
 *   transport (stdio or Streamable HTTP).
 */
export function createMcpServer(options: CreateMcpServerOptions = {}): McpServer {
  const server = new McpServer(
    {
      name: options.name ?? APP_NAME,
      version: options.version ?? resolveAppVersion(),
    },
    {
      capabilities: {
        extensions: {
          [MCP_UI_EXTENSION_ID]: { mimeTypes: [MCP_UI_RESOURCE_MIME_TYPE] },
        },
      },
    },
  );

  const transcoderFactory = options.transcoderFactory ?? createTranscoder;
  const jobManager = options.jobManager ?? new MCPJobManager({ transcoderFactory });
  const onAudit = options.onAudit;

  /**
   * Reports a committed (or headlessly executed) mutating operation to the
   * audit sink. Never throws: an audit failure must not break a tool call.
   * @param {string} tool - The mutating tool that ran.
   * @param {unknown} args - The arguments it ran with.
   * @param {boolean} success - Whether it was accepted.
   * @param {string} [detail] - Error summary when it failed.
   * @returns {void}
   */
  function emitAudit(tool: string, args: unknown, success: boolean, detail?: string): void {
    if (!onAudit) return;
    try {
      const fields: { tool: string; tier: number; args: unknown; result: 'ok' | 'error'; detail?: string } = {
        tool,
        tier: tierForTool(tool),
        args,
        result: success ? 'ok' : 'error',
      };
      if (detail) fields.detail = detail;
      onAudit(createAuditEntry(fields));
    } catch {
      /* swallow: auditing is best-effort */
    }
  }

  /**
   * Reads the approved size envelope a confirmation round-tripped back in the
   * batch arguments. Unknown to the schema (which strips it), so it only ever
   * reaches the commit path.
   * @param {unknown} raw - The raw tool arguments.
   * @returns {BatchEnvelope | undefined} The approved envelope, when present.
   */
  function batchApprovedEnvelope(raw: unknown): BatchEnvelope | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const envelope = (raw as Record<string, unknown>).__envelope;
    if (!envelope || typeof envelope !== 'object') return undefined;
    const record = envelope as Record<string, unknown>;
    if (typeof record.fileCount === 'number' && typeof record.totalBytes === 'number') {
      return { fileCount: record.fileCount, totalBytes: record.totalBytes };
    }
    return undefined;
  }

  /**
   * Sums the input sizes of a batch plan, tolerating files that vanish between
   * planning and stat'ing (they simply contribute zero bytes).
   * @param {Array<{ input: string }>} jobs - The planned jobs.
   * @returns {number} The total input size in bytes.
   */
  function batchPlanBytes(jobs: Array<{ input: string }>): number {
    let total = 0;
    for (const job of jobs) {
      try {
        total += fs.statSync(job.input).size;
      } catch {
        /* ignore */
      }
    }
    return total;
  }

  /**
   * Drops the confirmation rows a tool left unset, keeping views tidy.
   * @param {Array<McpUiConfirmationField | undefined>} rows - Candidate rows.
   * @returns {McpUiConfirmationField[]} The non-empty rows.
   */
  function confirmationRows(rows: Array<McpUiConfirmationField | undefined>): McpUiConfirmationField[] {
    return rows.filter((row): row is McpUiConfirmationField => row !== undefined);
  }

  /**
   * Serializes an enqueued job into the shape the job/queue/confirm views read.
   * @param {ReturnType<MCPJobManager['enqueue']>} job - The enqueued job.
   * @returns {McpUiJob} The view-shaped job.
   */
  function viewJob(job: ReturnType<MCPJobManager['enqueue']>): McpUiJob {
    return { id: job.id, input: job.input, output: job.output, status: job.status, progress: job.progress };
  }

  /**
   * Returns the detected encoder capabilities, degrading to an empty set when
   * the capability probe is unavailable (offline/headless), so AI tools still
   * plan instead of failing.
   * @returns {EncoderCapabilities} Capabilities, never null.
   */
  function capabilitiesOrEmpty(): EncoderCapabilities {
    return getEncoderCapabilities() ?? { videoEncoders: [], audioEncoders: [], hwaccels: [] };
  }

  /**
   * Probes a file for the AI tools and the resources they read, failing clearly
   * when the path does not exist.
   * @param {string} input - Absolute path of the file to probe.
   * @returns {Promise<MediaInfo>} The probed media info.
   * @throws {AppError} `FILE_NOT_FOUND` when the path does not exist.
   */
  async function probeMedia(input: string): Promise<MediaInfo> {
    if (!fs.existsSync(input)) {
      throw createError(ErrorCode.FILE_NOT_FOUND, `Input file not found: ${input}`);
    }
    return transcoderFactory('FFMPEG').getInfo(input);
  }

  /**
   * Maps a natural-language intent onto a target-size candidate-ladder bias.
   * @param {string} [intent] - The optional intent text.
   * @returns {'quality'|'balanced'|'size'} The ladder to walk.
   */
  function targetBias(intent?: string): 'quality' | 'balanced' | 'size' {
    const signals = parseIntent(intent ?? '');
    if (signals.wantsSmall) return 'size';
    if (signals.wantsQuality) return 'quality';
    return 'balanced';
  }

  /**
   * The fraction of a source's size a folder projection tries to reach.
   * @param {string} [intent] - The optional intent text.
   * @returns {number} A ratio in (0, 1].
   */
  function projectionRatio(intent?: string): number {
    const signals = parseIntent(intent ?? '');
    if (signals.wantsQuality) return 0.85;
    if (signals.wantsSmall) return 0.5;
    return 0.7;
  }

  /**
   * Polls a job until it reaches a terminal state or the timeout elapses.
   * @param {string} jobId - The job to watch.
   * @param {number} [timeoutMs=30000] - Per-candidate timeout.
   * @param {number} [intervalMs=50] - Poll interval.
   * @returns {Promise<MCPJob>} The terminal job.
   * @throws {AppError} When the job vanishes or the timeout elapses.
   */
  async function waitForJob(jobId: string, timeoutMs = 30000, intervalMs = 50): Promise<MCPJob> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const job = jobManager.getJob(jobId);
      if (!job) throw createError(ErrorCode.UNKNOWN, `Job not found while waiting: ${jobId}`);
      if (job.status === 'done' || job.status === 'error') return job;
      if (Date.now() >= deadline) throw createError(ErrorCode.UNKNOWN, `Timed out waiting for job ${jobId}`);
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  /**
   * Builds a candidate output path by inserting a suffix before the extension.
   * @param {string} base - Base output (or input) path.
   * @param {string} suffix - Suffix to insert before the extension.
   * @param {string} ext - Output extension without the leading dot.
   * @returns {string} The suffixed output path.
   */
  function suffixedOutput(base: string, suffix: string, ext: string): string {
    const parsed = path.parse(base);
    return path.join(parsed.dir, `${parsed.name}${suffix}.${ext}`);
  }

  /**
   * Encodes an input through a ladder of size-target candidates, measuring each
   * produced output and stopping at the first one that fits the ceiling. This is
   * the F3 measured loop; the winning quality is decided by bytes on disk, not by
   * the estimate (roadmap §7.3, D4).
   * @param {unknown} raw - Untrusted tool arguments.
   * @returns {Promise<object>} The MCP tool result (lab view data).
   */
  async function runCompressToTarget(raw: unknown) {
    try {
      const args = compressToTargetSchema.parse(raw);
      if (!fs.existsSync(args.input)) {
        throw createError(ErrorCode.FILE_NOT_FOUND, `Input file not found: ${args.input}`);
      }
      const info = await probeMedia(args.input);
      const facts = extractMediaFacts(info);
      const plan = planTargetSizeCandidates(facts, args.maxBytes, {
        maxCandidates: args.maxCandidates,
        bias: targetBias(args.intent),
        audioBitrateKbps: parseBitrateKbps(args.audioBitrate),
      });
      if (plan.candidates.length === 0) {
        throw createError(ErrorCode.UNKNOWN, plan.notes.join(' ') || 'No size-target candidates could be planned.');
      }

      const videoCodec = args.videoCodec ?? 'libx264';
      const audioCodec = args.audioCodec ?? 'aac';
      const transcoder = args.transcoder ?? 'FFMPEG';
      const ext = suggestedExtensionForVideoCodec(videoCodec) || getInputExtension(args.input);
      const base = args.output ?? args.input;
      const attempts: Array<Record<string, unknown>> = [];
      let chosen: Record<string, unknown> | undefined;

      for (const candidate of plan.candidates) {
        const output = suffixedOutput(base, `_target_${candidate.videoBitrateKbps}k`, ext);
        const fields: MCPConversionFields = { videoCodec, videoBitrate: `${candidate.videoBitrateKbps}k` };
        if (facts.hasAudio) {
          fields.audioCodec = audioCodec;
          fields.audioBitrate = args.audioBitrate ?? `${candidate.audioBitrateKbps}k`;
        }
        const options = buildConversionOptions(fields);

        let job: MCPJob;
        try {
          job = jobManager.enqueue(args.input, output, options, transcoder);
        } catch (err) {
          attempts.push({
            candidate: candidate.id,
            videoBitrateKbps: candidate.videoBitrateKbps,
            output,
            status: 'error',
            error: errorMessage(err),
          });
          continue;
        }

        let terminal: MCPJob;
        try {
          terminal = await waitForJob(job.id);
        } catch (err) {
          attempts.push({
            candidate: candidate.id,
            videoBitrateKbps: candidate.videoBitrateKbps,
            jobId: job.id,
            output,
            status: 'timeout',
            error: errorMessage(err),
          });
          continue;
        }
        if (terminal.status === 'error') {
          attempts.push({
            candidate: candidate.id,
            videoBitrateKbps: candidate.videoBitrateKbps,
            jobId: job.id,
            output,
            status: 'error',
            error: terminal.error,
          });
          continue;
        }

        let sizeBytes: number;
        let validation;
        try {
          const outputInfo = await transcoderFactory(transcoder).getInfo(output);
          sizeBytes = extractMediaFacts(outputInfo).sizeBytes;
          validation = validateOutput(outputInfo, { maxBytes: args.maxBytes });
        } catch (err) {
          attempts.push({
            candidate: candidate.id,
            videoBitrateKbps: candidate.videoBitrateKbps,
            jobId: job.id,
            output,
            status: 'unreadable',
            error: errorMessage(err),
          });
          continue;
        }

        const attempt: Record<string, unknown> = {
          candidate: candidate.id,
          videoBitrateKbps: candidate.videoBitrateKbps,
          audioBitrateKbps: candidate.audioBitrateKbps,
          jobId: job.id,
          output,
          status: 'done',
          sizeBytes,
          fits: validation.passed,
          checks: validation.checks,
        };
        attempts.push(attempt);
        if (validation.passed) {
          chosen = attempt;
          break;
        }
      }

      const result: Record<string, unknown> = {
        input: args.input,
        maxBytes: args.maxBytes,
        videoCodec,
        audioCodec,
        plan,
        attempts,
        converged: chosen !== undefined,
      };
      if (chosen) result.chosen = chosen;
      emitAudit('compress_to_target', raw, true);
      return okUi(JSON.stringify(result), { lab: result });
    } catch (err) {
      emitAudit('compress_to_target', raw, false, errorMessage(err));
      return fail(err);
    }
  }

  /**
   * Projects the space a batch re-encode would save across a folder: probes each
   * media file, plans a size target for it and sums the projections. Headless
   * (no MCP App view) — the report is text plus structured JSON.
   * @param {unknown} raw - Untrusted tool arguments.
   * @returns {Promise<object>} The MCP tool result (library summary).
   */
  async function runAnalyzeFolder(raw: unknown) {
    try {
      const args = analyzeFolderSchema.parse(raw);
      const root = args.path.replace(/[\\/]+$/, '');
      if (!fs.existsSync(root) && !/[?*[\]]/.test(args.path)) {
        throw createError(ErrorCode.FILE_NOT_FOUND, `Folder not found: ${args.path}`);
      }
      const patterns = args.recursive ? [`${root}/**/*`] : [args.path];
      const all = expandInputs(patterns).filter((file) => isMediaPath(file));
      const maxFiles = args.maxFiles ?? 200;
      const files = all.slice(0, maxFiles);
      const intent = args.intent ?? 'compress to save space';
      const ratio = projectionRatio(args.intent);
      const capabilities = capabilitiesOrEmpty();

      const rows: LibraryRow[] = [];
      for (const file of files) {
        try {
          const info = await probeMedia(file);
          const facts = extractMediaFacts(info);
          const targetBytes = Math.round(facts.sizeBytes * ratio);
          const projected = planTargetSizeCandidates(facts, targetBytes);
          const baseline = projected.candidates.find((c) => c.videoBitrateKbps === projected.baselineVideoKbps) ?? projected.candidates[0];
          if (!baseline) {
            rows.push({ ...libraryRow(file, facts.sizeBytes, facts.sizeBytes, { targetBytes }), error: 'No video stream to size-target.' });
            continue;
          }
          const estimate = estimateConversion(
            { videoBitrate: `${baseline.videoBitrateKbps}k`, audioBitrate: facts.hasAudio ? `${baseline.audioBitrateKbps}k` : undefined },
            facts,
            capabilities,
          );
          rows.push(libraryRow(file, facts.sizeBytes, estimate.estimatedSizeBytes, { targetBytes }));
        } catch (err) {
          rows.push({ ...libraryRow(file, 0, 0), error: errorMessage(err) });
        }
      }

      const summary = summarizeLibrary(rows);
      const result = {
        path: args.path,
        intent,
        scanned: all.length,
        analyzed: files.length,
        truncated: all.length > files.length,
        ...summary,
      };
      return ok(JSON.stringify(result), { library: result });
    } catch (err) {
      return fail(err);
    }
  }

  /**
   * Runs (or proposes) a conversion. When `confirm` is true the call returns a
   * confirmation and enqueues nothing; otherwise it behaves exactly as the
   * headless tool always has.
   * @param {unknown} raw - Untrusted tool arguments.
   * @param {boolean} confirm - Whether to gate on user approval.
   * @returns {Promise<object>} The MCP tool result.
   */
  async function runConvert(raw: unknown, confirm: boolean) {
    try {
      const args = conversionSchema.parse(raw);
      if (!fs.existsSync(args.input)) {
        throw createError(ErrorCode.FILE_NOT_FOUND, `Input file not found: ${args.input}`);
      }
      const fields: MCPConversionFields = { ...args };
      const options = buildConversionOptions(fields);
      const output = args.output ?? resolveOutputPath(args.input, fields, options);
      if (confirm) {
        return confirmationResult({
          operation: 'convert_media',
          title: 'Convert video',
          summary: `${path.basename(args.input)} -> ${path.basename(output)}`,
          args: args as unknown as Record<string, unknown>,
          details: confirmationRows([
            confirmationField('Output', output),
            confirmationField('Video codec', args.videoCodec),
            confirmationField('Audio codec', args.audioCodec),
            confirmationField('Video bitrate', args.videoBitrate),
            confirmationField('Audio bitrate', args.audioBitrate),
            confirmationField('Scale', args.scale),
            confirmationField('Quality', args.qscale),
            args.copy ? { label: 'Mode', value: 'Lossless stream copy' } : undefined,
          ]),
        });
      }
      if (args.concurrency !== undefined) {
        jobManager.setConcurrency(args.concurrency);
      }
      const job = jobManager.enqueue(args.input, output, options, (args.transcoder as TranscoderType | undefined) ?? 'FFMPEG');
      const transcoder = args.transcoder ?? 'FFMPEG';
      emitAudit('convert_media', raw, true);
      return okUi(JSON.stringify({ jobId: job.id, input: job.input, output: job.output, status: job.status, transcoder }), {
        job: viewJob(job),
        transcoder,
      });
    } catch (err) {
      emitAudit('convert_media', raw, false, errorMessage(err));
      return fail(err);
    }
  }

  /**
   * Runs (or proposes) an image compression.
   * @param {unknown} raw - Untrusted tool arguments.
   * @param {boolean} confirm - Whether to gate on user approval.
   * @returns {Promise<object>} The MCP tool result.
   */
  async function runCompress(raw: unknown, confirm: boolean) {
    try {
      const args = compressSchema.parse(raw);
      if (!fs.existsSync(args.input)) {
        throw createError(ErrorCode.FILE_NOT_FOUND, `Input file not found: ${args.input}`);
      }
      const fields: MCPCompressFields = { ...args };
      const plan = buildCompressPlan(args.input, fields);
      const transcoder = (args.transcoder as TranscoderType | undefined) ?? 'FFMPEG';
      if (confirm) {
        return confirmationResult({
          operation: 'compress_image',
          title: 'Compress image',
          summary: `${path.basename(args.input)} -> ${path.basename(plan.output)}`,
          args: args as unknown as Record<string, unknown>,
          details: confirmationRows([
            confirmationField('Output', plan.output),
            confirmationField('Format', plan.format),
            confirmationField('Quality', args.quality),
            confirmationField('Scale', args.scale),
          ]),
        });
      }
      const job = jobManager.enqueue(args.input, plan.output, plan.options, transcoder);
      emitAudit('compress_image', raw, true);
      return okUi(JSON.stringify({ ...enqueueResponse(job, transcoder), format: plan.format }), {
        job: viewJob(job),
        transcoder,
        format: plan.format,
      });
    } catch (err) {
      emitAudit('compress_image', raw, false, errorMessage(err));
      return fail(err);
    }
  }

  /**
   * Runs (or proposes) an audio extraction.
   * @param {unknown} raw - Untrusted tool arguments.
   * @param {boolean} confirm - Whether to gate on user approval.
   * @returns {Promise<object>} The MCP tool result.
   */
  async function runExtract(raw: unknown, confirm: boolean) {
    try {
      const args = extractSchema.parse(raw);
      if (!fs.existsSync(args.input)) {
        throw createError(ErrorCode.FILE_NOT_FOUND, `Input file not found: ${args.input}`);
      }
      const fields: MCPExtractAudioFields = { ...args };
      const plan = buildExtractAudioPlan(args.input, fields);
      const transcoder = (args.transcoder as TranscoderType | undefined) ?? 'FFMPEG';
      if (confirm) {
        return confirmationResult({
          operation: 'extract_audio',
          title: 'Extract audio',
          summary: `${path.basename(args.input)} -> ${path.basename(plan.output)}`,
          args: args as unknown as Record<string, unknown>,
          details: confirmationRows([
            confirmationField('Output', plan.output),
            confirmationField('Audio codec', plan.audioCodec),
            confirmationField('Bitrate', args.bitrate),
          ]),
        });
      }
      const job = jobManager.enqueue(args.input, plan.output, plan.options, transcoder);
      emitAudit('extract_audio', raw, true);
      return okUi(JSON.stringify({ ...enqueueResponse(job, transcoder), audioCodec: plan.audioCodec, extension: plan.ext }), {
        job: viewJob(job),
        transcoder,
        audioCodec: plan.audioCodec,
        extension: plan.ext,
      });
    } catch (err) {
      emitAudit('extract_audio', raw, false, errorMessage(err));
      return fail(err);
    }
  }

  /**
   * Runs (or proposes) a cut/trim.
   * @param {unknown} raw - Untrusted tool arguments.
   * @param {boolean} confirm - Whether to gate on user approval.
   * @returns {Promise<object>} The MCP tool result.
   */
  async function runCut(raw: unknown, confirm: boolean) {
    try {
      const args = cutSchema.parse(raw);
      if (!fs.existsSync(args.input)) {
        throw createError(ErrorCode.FILE_NOT_FOUND, `Input file not found: ${args.input}`);
      }
      const fields: MCPCutFields = { ...args };
      const plan = buildCutPlan(args.input, fields);
      const transcoder = (args.transcoder as TranscoderType | undefined) ?? 'FFMPEG';
      if (confirm) {
        return confirmationResult({
          operation: 'cut_video',
          title: 'Cut video',
          summary: `${path.basename(args.input)} -> ${path.basename(plan.output)}`,
          args: args as unknown as Record<string, unknown>,
          details: confirmationRows([
            confirmationField('Output', plan.output),
            confirmationField('Start', args.startTime),
            confirmationField('End', args.endTime),
            confirmationField('Duration', args.duration),
            args.copy === false ? { label: 'Mode', value: 'Re-encode' } : { label: 'Mode', value: 'Lossless stream copy' },
          ]),
        });
      }
      const job = jobManager.enqueue(args.input, plan.output, plan.options, transcoder);
      emitAudit('cut_video', raw, true);
      return okUi(JSON.stringify(enqueueResponse(job, transcoder)), { job: viewJob(job), transcoder });
    } catch (err) {
      emitAudit('cut_video', raw, false, errorMessage(err));
      return fail(err);
    }
  }

  /**
   * Runs (or proposes) a batch conversion.
   * @param {unknown} raw - Untrusted tool arguments.
   * @param {boolean} confirm - Whether to gate on user approval.
   * @returns {Promise<object>} The MCP tool result.
   */
  async function runBatch(raw: unknown, confirm: boolean) {
    try {
      const approved = batchApprovedEnvelope(raw);
      const args = batchSchema.parse(raw);
      const fields: MCPConversionFields = { ...args };
      const { jobs } = buildBatchPlan(args.inputs, fields, args.outputDir, args.suffix);
      if (jobs.length === 0) {
        throw createError(ErrorCode.FILE_NOT_FOUND, `No input files matched: ${args.inputs.join(', ')}`);
      }
      const envelope: BatchEnvelope = { fileCount: jobs.length, totalBytes: batchPlanBytes(jobs) };
      const batchDetails = confirmationRows([
        confirmationField('Files', jobs.length),
        confirmationField('Output directory', args.outputDir),
        confirmationField('Suffix', args.suffix),
      ]);
      if (confirm) {
        return confirmationResult({
          operation: 'batch_convert',
          title: 'Batch convert',
          summary: `Convert ${jobs.length} file${jobs.length === 1 ? '' : 's'}`,
          args: { ...(args as Record<string, unknown>), __envelope: envelope },
          details: batchDetails,
        });
      }
      if (approved && batchEnvelopeExceeds(approved, envelope)) {
        return confirmationResult({
          operation: 'batch_convert',
          title: 'Batch grew - confirm again',
          summary: `The inputs now match ${jobs.length} file${jobs.length === 1 ? '' : 's'}; re-approve to continue.`,
          args: { ...(args as Record<string, unknown>), __envelope: envelope },
          details: batchDetails,
          warnings: [`The matched set grew from ${approved.fileCount} to ${jobs.length} file${jobs.length === 1 ? '' : 's'} since you approved it.`],
        });
      }
      if (args.outputDir) {
        fs.mkdirSync(args.outputDir, { recursive: true });
      }
      if (args.concurrency !== undefined) {
        jobManager.setConcurrency(args.concurrency);
      }
      const transcoder = (args.transcoder as TranscoderType | undefined) ?? 'FFMPEG';
      const queued = jobs.map((job) => {
        const running = jobManager.enqueue(job.input, job.output, job.options, transcoder);
        return { file: job.input, output: job.output, jobId: running.id, status: running.status, progress: running.progress };
      });
      emitAudit('batch_convert', raw, true);
      return okUi(JSON.stringify({ total: queued.length, jobs: queued }), {
        total: queued.length,
        jobs: queued.map((entry) => ({
          id: entry.jobId,
          input: entry.file,
          output: entry.output,
          status: entry.status,
          progress: entry.progress,
        })),
      });
    } catch (err) {
      emitAudit('batch_convert', raw, false, errorMessage(err));
      return fail(err);
    }
  }

  /**
   * Runs (or proposes) a remux. The source is always probed first so an
   * incompatible target or missing auxiliary file fails before confirmation.
   * @param {unknown} raw - Untrusted tool arguments.
   * @param {boolean} confirm - Whether to gate on user approval.
   * @returns {Promise<object>} The MCP tool result.
   */
  async function runRemux(raw: unknown, confirm: boolean) {
    try {
      const args = remuxSchema.parse(raw);
      if (!fs.existsSync(args.input)) {
        throw createError(ErrorCode.FILE_NOT_FOUND, `Input file not found: ${args.input}`);
      }
      const chaptersFile = args.chapters && typeof args.chapters === 'object' ? args.chapters.file : undefined;
      assertMcpAuxiliaryInputsExist([
        ...(args.addSubtitle ?? []).map((entry) => entry.file),
        ...(args.addAudio ?? []).map((entry) => entry.file),
        ...(args.thumbnail ? [args.thumbnail.file] : []),
        ...(chaptersFile ? [chaptersFile] : []),
      ]);
      const transcoder = (args.transcoder as TranscoderType | undefined) ?? 'FFMPEG';
      const fields: MCPRemuxFields = { ...args };
      const info = await transcoderFactory(transcoder).getInfo(args.input);
      const plan = buildRemuxPlan(args.input, fields, info.streams ?? []);
      const warnings = plan.warnings.map((finding) => finding.code ?? finding.message);
      if (confirm) {
        return confirmationResult({
          operation: 'remux_media',
          title: 'Remux media',
          summary: `${path.basename(args.input)} -> ${path.basename(plan.output)}`,
          args: args as unknown as Record<string, unknown>,
          details: confirmationRows([
            confirmationField('Output', plan.output),
            confirmationField('Container', plan.container),
            confirmationField('Streams', (plan.options.map ?? []).join(', ')),
          ]),
          warnings,
        });
      }
      const job = jobManager.enqueue(args.input, plan.output, plan.options, transcoder);
      emitAudit('remux_media', raw, true);
      return okUi(
        JSON.stringify({
          ...enqueueResponse(job, transcoder),
          container: plan.container,
          map: plan.options.map ?? [],
          warnings,
        }),
        { job: viewJob(job), transcoder, container: plan.container, map: plan.options.map ?? [], warnings },
      );
    } catch (err) {
      emitAudit('remux_media', raw, false, errorMessage(err));
      return fail(err);
    }
  }

  /**
   * Runs (or proposes) a demux.
   * @param {unknown} raw - Untrusted tool arguments.
   * @param {boolean} confirm - Whether to gate on user approval.
   * @returns {Promise<object>} The MCP tool result.
   */
  async function runDemux(raw: unknown, confirm: boolean) {
    try {
      const args = demuxSchema.parse(raw);
      if (!fs.existsSync(args.input)) {
        throw createError(ErrorCode.FILE_NOT_FOUND, `Input file not found: ${args.input}`);
      }
      const transcoder = (args.transcoder as TranscoderType | undefined) ?? 'FFMPEG';
      const fields: MCPDemuxFields = { ...args };
      const info = await transcoderFactory(transcoder).getInfo(args.input);
      const plan = buildDemuxPlan(args.input, fields, info.streams ?? []);
      const warnings = plan.warnings.map((finding) => finding.code ?? finding.message);
      if (confirm) {
        return confirmationResult({
          operation: 'demux_media',
          title: 'Demux media',
          summary: `Extract ${plan.targets.length} stream${plan.targets.length === 1 ? '' : 's'} from ${path.basename(args.input)}`,
          args: args as unknown as Record<string, unknown>,
          details: confirmationRows([
            confirmationField('Streams', plan.targets.length),
            confirmationField('Output directory', args.outputDir),
          ]),
          warnings,
        });
      }
      if (args.outputDir) {
        fs.mkdirSync(args.outputDir, { recursive: true });
      }
      const queued = plan.targets.map((target) => {
        const job = jobManager.enqueue(args.input, target.output, buildDemuxJobOptions(target), transcoder);
        return {
          kind: target.kind,
          streamIndex: target.index,
          copy: target.copy,
          codec: target.codec,
          output: job.output,
          jobId: job.id,
          status: job.status,
          progress: job.progress,
        };
      });
      emitAudit('demux_media', raw, true);
      return okUi(JSON.stringify({ total: queued.length, transcoder, jobs: queued, warnings }), {
        total: queued.length,
        jobs: queued.map((entry) => ({
          id: entry.jobId,
          input: args.input,
          output: entry.output,
          status: entry.status,
          progress: entry.progress,
        })),
        warnings,
      });
    } catch (err) {
      emitAudit('demux_media', raw, false, errorMessage(err));
      return fail(err);
    }
  }

  /**
   * Whether the current call should be gated on user approval. Re-evaluated
   * per call so it reflects the live client capabilities from `initialize`.
   * @returns {boolean} True when the host renders MCP Apps.
   */
  function shouldConfirm(): boolean {
    return hostSupportsMcpApps(server);
  }

  server.registerTool(
    'ping',
    {
      title: 'Ping',
      description: 'Checks that the EncodeX MCP server is responsive and returns "pong".',
      inputSchema: z.object({}),
    },
    async () => ok(JSON.stringify({ pong: true }), { pong: true }),
  );

  registerAppTool(
    server,
    'convert_media',
    {
      title: 'Convert Media',
      description:
        'Start an asynchronous media conversion (re-encode, stream-copy, trim, scale, rotate, video filters). ' +
        'Video filters are given via filters (comma-joined chain), videoFilters (expression array), or presets ' +
        '(curated ids); they require re-encoding and cannot be combined with copy. ' +
        'When the client renders MCP Apps the conversion is proposed in the app and only starts once the user ' +
        'confirms it; in other clients it starts immediately. ' +
        'Returns a job id; poll with get_job / list_jobs and cancel with cancel_job.',
      inputSchema: conversionSchema,
      _meta: { ui: { resourceUri: confirmationViewUri('convert_media') } },
    },
    async (args: z.infer<typeof conversionSchema>) => runConvert(args, shouldConfirm()),
  );

  registerAppTool(
    server,
    'get_job',
    {
      title: 'Get Job',
      description: 'Returns the current status and progress of a queued conversion job by id.',
      inputSchema: z.object({ jobId: z.string().min(1).describe('The job id returned by convert_media.') }),
      _meta: { ui: { resourceUri: MCP_UI_VIEW_URIS.job } },
    },
    async ({ jobId }: { jobId: string }) => {
      const job = jobManager.getJob(jobId);
      if (!job) {
        return fail(createError(ErrorCode.UNKNOWN, `Job not found: ${jobId}`));
      }
      return okUi(JSON.stringify(job), { job });
    },
  );

  registerAppTool(
    server,
    'list_jobs',
    {
      title: 'List Jobs',
      description: 'Lists all known conversion jobs with their current status and progress.',
      inputSchema: z.object({}),
      _meta: { ui: { resourceUri: MCP_UI_VIEW_URIS.queue } },
    },
    async () => {
      const jobs = jobManager.listJobs();
      return okUi(JSON.stringify(jobs), { jobs, count: jobs.length, generatedAt: Date.now() });
    },
  );

  server.registerTool(
    'cancel_job',
    {
      title: 'Cancel Job',
      description: 'Cancels a queued or running conversion job. The job is removed from the job list.',
      inputSchema: z.object({ jobId: z.string().min(1).describe('The job id to cancel.') }),
    },
    async ({ jobId }: { jobId: string }) => {
      const cancelled = jobManager.cancelJob(jobId);
      if (!cancelled) {
        return fail(createError(ErrorCode.UNKNOWN, `Job not found: ${jobId}`));
      }
      return ok(JSON.stringify({ jobId, cancelled: true }), { jobId, cancelled: true });
    },
  );

  registerAppTool(
    server,
    'get_media_info',
    {
      title: 'Get Media Info',
      description: 'Probes a media file and returns container and stream metadata (codecs, resolution, duration, bitrate).',
      inputSchema: z.object({ input: z.string().min(1).describe('Absolute path of the media file to inspect.') }),
      _meta: { ui: { resourceUri: MCP_UI_VIEW_URIS.mediaInfo } },
    },
    async ({ input }: { input: string }) => {
      try {
        if (!fs.existsSync(input)) {
          throw createError(ErrorCode.FILE_NOT_FOUND, `Input file not found: ${input}`);
        }
        const transcoder = transcoderFactory('FFMPEG');
        const info = await transcoder.getInfo(input);
        return okUi(JSON.stringify(info), { media: info });
      } catch (err) {
        return fail(err);
      }
    },
  );

  registerAppTool(
    server,
    'analyze_media',
    {
      title: 'Analyze Media',
      description:
        'Diagnoses a media file in plain language: streams, HDR, interlacing, uncommon codecs, multichannel audio, ' +
        'resolution and size, each with a severity and suggested next steps. Deterministic — no model call.',
      inputSchema: analyzeSchema,
      _meta: { ui: { resourceUri: MCP_UI_VIEW_URIS.inspector } },
    },
    async ({ input, focus }: z.infer<typeof analyzeSchema>) => {
      try {
        const info = await probeMedia(input);
        const analysis = analyzeMedia(info, focus);
        return okUi(JSON.stringify(analysis), { analysis });
      } catch (err) {
        return fail(err);
      }
    },
  );

  registerAppTool(
    server,
    'recommend_settings',
    {
      title: 'Recommend Settings',
      description:
        'Maps a natural-language intent plus the probed media facts onto a concrete, reviewable conversion plan ' +
        '(convert_media arguments + profile id + rationale + confidence). Deterministic rules-based provider — the ' +
        'settings are selected from the built-in profiles, never invented.',
      inputSchema: recommendSchema,
      _meta: { ui: { resourceUri: MCP_UI_VIEW_URIS.plan } },
    },
    async ({ input, intent, constraints }: z.infer<typeof recommendSchema>) => {
      try {
        const info = await probeMedia(input);
        const request: PlanRequest = {
          input,
          intent,
          facts: extractMediaFacts(info),
          profiles: BUILTIN_PROFILES,
          capabilities: capabilitiesOrEmpty(),
          constraints,
        };
        const plan = recommendSettings(request);
        return okUi(JSON.stringify(plan), { plan });
      } catch (err) {
        return fail(err);
      }
    },
  );

  registerAppTool(
    server,
    'estimate_conversion',
    {
      title: 'Estimate Conversion',
      description:
        'Estimates the output size and duration of a conversion from the probed duration and the target bitrates, ' +
        'plus hardware-encoder availability. The result is always an estimate (isEstimated: true), never a measurement.',
      inputSchema: estimateSchema,
      _meta: { ui: { resourceUri: MCP_UI_VIEW_URIS.plan } },
    },
    async ({ input, args }: z.infer<typeof estimateSchema>) => {
      try {
        const info = await probeMedia(input);
        const estimate = estimateConversion(args ?? {}, extractMediaFacts(info), capabilitiesOrEmpty());
        return okUi(JSON.stringify(estimate), { estimate });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'validate_output',
    {
      title: 'Validate Output',
      description:
        'Re-probes a produced output and checks it against the expectations (size ceiling, resolution, codec, ' +
        'container, audio/video presence, duration), returning pass/fail per constraint. Use it before claiming a ' +
        'conversion succeeded.',
      inputSchema: validateSchema,
    },
    async ({ output, expect }: z.infer<typeof validateSchema>) => {
      try {
        const info = await probeMedia(output);
        const validation = validateOutput(info, expect);
        return ok(JSON.stringify(validation), { validation });
      } catch (err) {
        return fail(err);
      }
    },
  );

  registerAppTool(
    server,
    'compress_to_target',
    {
      title: 'Compress To Target',
      description:
        'Encodes a file through an ordered ladder of size-target candidates and stops at the first measured output that ' +
        'fits a hard byte ceiling, returning the winning candidate, every attempt, and the estimates. This is a measured ' +
        'loop: the result is only claimed once the produced output is re-probed and validated.',
      inputSchema: compressToTargetSchema,
      _meta: { ui: { resourceUri: MCP_UI_VIEW_URIS.lab } },
    },
    async (raw: z.infer<typeof compressToTargetSchema>) => runCompressToTarget(raw),
  );

  server.registerTool(
    'analyze_folder',
    {
      title: 'Analyze Folder',
      description:
        'Projects how much disk space a batch re-encode would reclaim across a folder of media, returning a per-file ' +
        'breakdown and a folder total (the "Media Librarian" savings report). Projections are estimates, not measurements.',
      inputSchema: analyzeFolderSchema,
    },
    async (raw: z.infer<typeof analyzeFolderSchema>) => runAnalyzeFolder(raw),
  );

  registerAppTool(
    server,
    'explain_error',
    {
      title: 'Explain Error',
      description:
        'Turns an EncodeX error code (or a raw error message / failed job id) into a plain-language explanation ' +
        'with likely causes and suggested fixes. Deterministic — no model call. Pass jobId to explain a failed job.',
      inputSchema: explainErrorSchema,
      _meta: { ui: { resourceUri: MCP_UI_VIEW_URIS.error } },
    },
    async ({ code, message, detail, jobId, input, tool, args }: z.infer<typeof explainErrorSchema>) => {
      try {
        let resolvedMessage = message;
        let resolvedDetail = detail;
        if (jobId) {
          const job = jobManager.getJob(jobId);
          if (job) {
            resolvedMessage = resolvedMessage ?? job.error ?? `Job ${jobId} failed.`;
            resolvedDetail = resolvedDetail ?? job.error;
          }
        }
        const explanation = explainError({ code, message: resolvedMessage, detail: resolvedDetail, input, tool, args });
        return okUi(JSON.stringify(explanation), { error: explanation });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'advise_encoding',
    {
      title: 'Advise Encoding',
      description:
        'Recommends a target video encoder and whether to use the GPU, based on the probed source and the real ' +
        'encoder/hwaccel capabilities of this machine, with the trade-offs. Deterministic — no model call.',
      inputSchema: adviseEncodingSchema,
    },
    async ({ input }: z.infer<typeof adviseEncodingSchema>) => {
      try {
        const info = await probeMedia(input);
        const advice = adviseEncoding(extractMediaFacts(info), capabilitiesOrEmpty());
        return ok(JSON.stringify(advice), { advice });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'quality_report',
    {
      title: 'Quality Report',
      description:
        'Re-probes a produced output and compares it to its source (resolution, audio, codec, duration), returning ' +
        'pass/fail checks and plain-language findings. Use it to verify a conversion before claiming success.',
      inputSchema: qualityReportSchema,
    },
    async ({ source, output, expect }: z.infer<typeof qualityReportSchema>) => {
      try {
        const sourceInfo = await probeMedia(source);
        const outputInfo = await probeMedia(output);
        const report = compareQuality(sourceInfo, outputInfo, expect);
        return ok(JSON.stringify(report), { report });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'list_capabilities',
    {
      title: 'List Capabilities',
      description: 'Returns the FFmpeg encoders and hardware acceleration methods available on this system.',
      inputSchema: z.object({}),
    },
    async () => {
      const caps = getEncoderCapabilities();
      return ok(JSON.stringify(caps), { capabilities: caps });
    },
  );

  server.registerTool(
    'list_profiles',
    {
      title: 'List Profiles',
      description: 'Lists the built-in conversion profiles (id, name, category, container, codecs, presets).',
      inputSchema: z.object({}),
    },
    async () => {
      const profiles = BUILTIN_PROFILES.map((p) => profileToJson(p));
      return ok(JSON.stringify(profiles), { profiles });
    },
  );

  server.registerTool(
    'get_profile',
    {
      title: 'Get Profile',
      description: 'Returns a single built-in conversion profile by id (full configuration).',
      inputSchema: z.object({ profileId: z.string().min(1).describe('Profile id (see list_profiles).') }),
    },
    async ({ profileId }: { profileId: string }) => {
      const profile = BUILTIN_PROFILES.find((p) => p.id === profileId);
      if (!profile) {
        return fail(createError(ErrorCode.UNKNOWN, `Profile not found: ${profileId}`));
      }
      const json = profileToJson(profile);
      return ok(JSON.stringify(json), { profile: json });
    },
  );

  registerAppTool(
    server,
    'compress_image',
    {
      title: 'Compress Image',
      description:
        'Lossily compress an image (re-encode to jpg/png/webp/gif/bmp/tiff). ' +
        'When the client renders MCP Apps the compression is proposed in the app and only starts once the user ' +
        'confirms it; in other clients it starts immediately. ' +
        'Returns a job id; poll with get_job / list_jobs.',
      inputSchema: compressSchema,
      _meta: { ui: { resourceUri: confirmationViewUri('compress_image') } },
    },
    async (args: z.infer<typeof compressSchema>) => runCompress(args, shouldConfirm()),
  );

  registerAppTool(
    server,
    'extract_audio',
    {
      title: 'Extract Audio',
      description:
        'Extract the audio track from a media file, dropping the video stream. ' +
        'When the client renders MCP Apps the extraction is proposed in the app and only starts once the user ' +
        'confirms it; in other clients it starts immediately. ' +
        'Returns a job id; poll with get_job / list_jobs.',
      inputSchema: extractSchema,
      _meta: { ui: { resourceUri: confirmationViewUri('extract_audio') } },
    },
    async (args: z.infer<typeof extractSchema>) => runExtract(args, shouldConfirm()),
  );

  registerAppTool(
    server,
    'cut_video',
    {
      title: 'Cut Video',
      description:
        'Cut (trim) a video by start/end time or duration. Defaults to lossless stream copy. ' +
        'When the client renders MCP Apps the cut is proposed in the app and only starts once the user confirms it; ' +
        'in other clients it starts immediately. ' +
        'Returns a job id; poll with get_job / list_jobs.',
      inputSchema: cutSchema,
      _meta: { ui: { resourceUri: confirmationViewUri('cut_video') } },
    },
    async (args: z.infer<typeof cutSchema>) => runCut(args, shouldConfirm()),
  );

  registerAppTool(
    server,
    'batch_convert',
    {
      title: 'Batch Convert',
      description:
        'Queue conversions for multiple files (paths, directories, or glob patterns) sharing the same options. ' +
        'When the client renders MCP Apps the batch is proposed in the app and only starts once the user confirms it; ' +
        'in other clients it starts immediately. ' +
        'Returns a job id per input; poll with get_job / list_jobs and cancel with cancel_job.',
      inputSchema: batchSchema,
      _meta: { ui: { resourceUri: confirmationViewUri('batch_convert') } },
    },
    async (args: z.infer<typeof batchSchema>) => runBatch(args, shouldConfirm()),
  );

  registerAppTool(
    server,
    'remux_media',
    {
      title: 'Remux Media',
      description:
        'Stream-copy a media file into another container, changing the stream selection, adding subtitle/audio tracks, ' +
        'cover art, or chapters without re-encoding. The source is probed first so the default selection is every ' +
        'stream, and a stream the target container cannot store is rejected up front. Passing videoFilters is the one ' +
        'exception to the lossless copy: the video is then re-encoded with the filter chain. ' +
        'When the client renders MCP Apps the remux is proposed in the app and only starts once the user confirms it; ' +
        'in other clients it starts immediately. ' +
        'Returns a job id; poll with get_job / list_jobs.',
      inputSchema: remuxSchema,
      _meta: { ui: { resourceUri: confirmationViewUri('remux_media') } },
    },
    async (args: z.infer<typeof remuxSchema>) => runRemux(args, shouldConfirm()),
  );

  registerAppTool(
    server,
    'demux_media',
    {
      title: 'Demux Media',
      description:
        'Split a media file into per-stream outputs (video, audio, subtitles), optionally re-encoding each kind ' +
        '(videoContainer / audioCodec / subtitleCodec, plus videoFilters on a re-encoded video stream). The source is ' +
        'probed first; cover-art video streams are skipped. ' +
        'When the client renders MCP Apps the demux is proposed in the app and only starts once the user confirms it; ' +
        'in other clients it starts immediately. ' +
        'Returns one job id per extracted stream; poll with get_job / list_jobs.',
      inputSchema: demuxSchema,
      _meta: { ui: { resourceUri: confirmationViewUri('demux_media') } },
    },
    async (args: z.infer<typeof demuxSchema>) => runDemux(args, shouldConfirm()),
  );

  registerAppTool(
    server,
    COMMIT_OPERATION_TOOL,
    {
      title: 'Commit Operation',
      description:
        'App-only. Runs a mutating EncodeX operation after the user confirmed it in the app UI. ' +
        'The model cannot call this tool; only the confirmation view can.',
      inputSchema: z.object({
        tool: z.enum(CONFIRMABLE_OPERATIONS).describe('The mutating operation the user confirmed.'),
        args: z.record(z.string(), z.unknown()).describe('The exact arguments from the confirmed proposal.'),
      }),
      _meta: { ui: { visibility: ['app'] } },
    },
    async ({ tool, args }) => {
      switch (tool) {
        case 'convert_media':
          return runConvert(args, false);
        case 'compress_image':
          return runCompress(args, false);
        case 'extract_audio':
          return runExtract(args, false);
        case 'cut_video':
          return runCut(args, false);
        case 'batch_convert':
          return runBatch(args, false);
        case 'remux_media':
          return runRemux(args, false);
        case 'demux_media':
          return runDemux(args, false);
        default:
          return fail(createError(ErrorCode.UNKNOWN, `Unknown operation: ${String(tool)}`));
      }
    },
  );

  server.registerResource(
    'profiles',
    'encodex://profiles',
    {
      title: 'EncodeX profiles',
      description: 'All built-in conversion profiles as a JSON array (see list_profiles).',
      mimeType: 'application/json',
    },
    async (uri: URL) => ({
      contents: [
        {
          uri: uri.toString(),
          mimeType: 'application/json',
          text: JSON.stringify(BUILTIN_PROFILES.map((p) => profileToJson(p))),
        },
      ],
    }),
  );

  server.registerResource(
    'capabilities',
    'encodex://capabilities',
    {
      title: 'EncodeX capabilities',
      description: 'FFmpeg encoder and hardware acceleration capabilities detected on this system.',
      mimeType: 'application/json',
    },
    async (uri: URL) => ({
      contents: [
        {
          uri: uri.toString(),
          mimeType: 'application/json',
          text: JSON.stringify(getEncoderCapabilities()),
        },
      ],
    }),
  );

  server.registerResource(
    'codecs',
    'encodex://codecs',
    {
      title: 'EncodeX codecs',
      description: 'The video and audio codecs supported by EncodeX (UI-ordered, with labels and groups).',
      mimeType: 'application/json',
    },
    async (uri: URL) => ({
      contents: [
        {
          uri: uri.toString(),
          mimeType: 'application/json',
          text: JSON.stringify({ videoCodecs: VIDEO_CODECS, audioCodecs: AUDIO_CODECS }),
        },
      ],
    }),
  );

  server.registerPrompt(
    'convert-video',
    {
      title: 'Convert a video',
      description:
        'Instructions for converting or re-encoding a media file with EncodeX. ' +
        'Run convert_media (poll get_job until done), or use list_profiles for a preset.',
      argsSchema: {
        input: z.string().describe('Absolute path of the input media file.'),
        output: z.string().optional().describe('Absolute output path (defaults to the derived `_converted` name).'),
        videoCodec: z.string().optional().describe('Video encoder (e.g. libx264, libvpx-vp9, copy).'),
        audioCodec: z.string().optional().describe('Audio encoder (e.g. aac, libmp3lame).'),
        quality: z.number().optional().describe('Video quality scale (1 best - 31 worst).'),
      },
    },
    async (args) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              `Convert the media file at "${args.input}".`,
              args.videoCodec
                ? `Use the "${args.videoCodec}" video encoder.`
                : 'Choose an appropriate video encoder (see list_capabilities or list_profiles).',
              args.audioCodec ? `Use the "${args.audioCodec}" audio encoder.` : 'Keep audio at a sensible default.',
              args.quality !== undefined ? `Target quality scale ${args.quality} (1 best - 31 worst).` : 'Use a good default quality.',
              args.output ? `Write the result to "${args.output}".` : 'Use the derived output path.',
              'Call convert_media, then poll get_job until the job status is "done" and report the output path.',
            ].join(' '),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'extract-audio',
    {
      title: 'Extract audio from a video',
      description: 'Instructions for extracting the audio track from a media file. Calls extract_audio and waits for completion.',
      argsSchema: {
        input: z.string().describe('Absolute path of the input media file.'),
        audioCodec: z.string().optional().describe('Audio encoder (default mp3).'),
        bitrate: z.string().optional().describe('Audio bitrate (default 192k).'),
      },
    },
    async (args) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Extract the audio track from "${args.input}"${
              args.audioCodec ? ` using the "${args.audioCodec}" codec` : ''
            }${args.bitrate ? ` at ${args.bitrate}` : ''}. Call extract_audio, poll get_job until done, and report the output file.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'compress-image',
    {
      title: 'Compress an image',
      description: 'Instructions for lossily compressing an image. Calls compress_image and waits for completion.',
      argsSchema: {
        input: z.string().describe('Absolute path of the input image.'),
        format: z.string().optional().describe('Output format (jpg, png, webp, gif, bmp, tiff; default source format).'),
        quality: z.number().optional().describe('Quality scale (1 best - 31 worst; default 23).'),
        scale: z.string().optional().describe('Output resolution (WxH or percent).'),
      },
    },
    async (args) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Compress the image at "${args.input}"${
              args.format ? ` to ${args.format}` : ''
            }${args.scale ? ` scaled to ${args.scale}` : ''}${
              args.quality !== undefined ? ` at quality ${args.quality}` : ''
            }. Call compress_image, poll get_job until done, and report the output file.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'batch-convert',
    {
      title: 'Batch-convert media files',
      description: 'Instructions for converting multiple media files with the same options. Calls batch_convert and waits for all jobs.',
      argsSchema: {
        inputs: z.string().describe('Input paths, directories, or glob patterns, comma-separated.'),
        outputDir: z.string().optional().describe('Directory to write all outputs into.'),
        videoCodec: z.string().optional().describe('Video encoder shared by all jobs.'),
        audioCodec: z.string().optional().describe('Audio encoder shared by all jobs.'),
        quality: z.number().optional().describe('Video quality scale (1 best - 31 worst).'),
      },
    },
    async (args) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              `Batch-convert these inputs: ${args.inputs}.`,
              args.videoCodec ? `Use the "${args.videoCodec}" video encoder.` : 'Choose an appropriate video encoder.',
              args.audioCodec ? `Use the "${args.audioCodec}" audio encoder.` : 'Keep audio at a sensible default.',
              args.quality !== undefined ? `Target quality scale ${args.quality}.` : 'Use a good default quality.',
              args.outputDir ? `Write outputs into "${args.outputDir}".` : 'Write outputs next to each input.',
              'Call batch_convert, then poll list_jobs until every job is "done", and summarize the outputs.',
            ].join(' '),
          },
        },
      ],
    }),
  );

  registerUiResources(server);

  return server;
}
