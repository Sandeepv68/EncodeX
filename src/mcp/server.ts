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
import type { TranscoderType } from '../shared/types';
import { MAX_QUEUE_CONCURRENCY } from '../shared/constants';
import { getEncoderCapabilities } from '../main/capabilities';
import { BUILTIN_PROFILES } from '../shared/profiles/builtin';
import type { ConversionProfile } from '../shared/types';
import { VIDEO_CODECS, AUDIO_CODECS } from '../shared/media-options';
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
 */
export interface CreateMcpServerOptions {
  name?: string;
  version?: string;
  transcoderFactory?: (type: TranscoderType) => ITranscoder;
  jobManager?: MCPJobManager;
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
      return okUi(JSON.stringify({ jobId: job.id, input: job.input, output: job.output, status: job.status, transcoder }), {
        job: viewJob(job),
        transcoder,
      });
    } catch (err) {
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
      return okUi(JSON.stringify({ ...enqueueResponse(job, transcoder), format: plan.format }), {
        job: viewJob(job),
        transcoder,
        format: plan.format,
      });
    } catch (err) {
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
      return okUi(JSON.stringify({ ...enqueueResponse(job, transcoder), audioCodec: plan.audioCodec, extension: plan.ext }), {
        job: viewJob(job),
        transcoder,
        audioCodec: plan.audioCodec,
        extension: plan.ext,
      });
    } catch (err) {
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
      return okUi(JSON.stringify(enqueueResponse(job, transcoder)), { job: viewJob(job), transcoder });
    } catch (err) {
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
      const args = batchSchema.parse(raw);
      const fields: MCPConversionFields = { ...args };
      const { jobs } = buildBatchPlan(args.inputs, fields, args.outputDir, args.suffix);
      if (jobs.length === 0) {
        throw createError(ErrorCode.FILE_NOT_FOUND, `No input files matched: ${args.inputs.join(', ')}`);
      }
      if (confirm) {
        return confirmationResult({
          operation: 'batch_convert',
          title: 'Batch convert',
          summary: `Convert ${jobs.length} file${jobs.length === 1 ? '' : 's'}`,
          args: args as unknown as Record<string, unknown>,
          details: confirmationRows([
            confirmationField('Files', jobs.length),
            confirmationField('Output directory', args.outputDir),
            confirmationField('Suffix', args.suffix),
          ]),
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
