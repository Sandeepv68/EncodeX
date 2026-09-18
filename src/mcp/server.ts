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
import { MCPJobManager } from './jobs/manager';
import { buildCompressPlan, buildExtractAudioPlan, buildCutPlan, buildBatchPlan } from './operations';
import type { MCPCompressFields, MCPExtractAudioFields, MCPCutFields } from './operations';

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
 * Builds a successful tool result carrying a single text payload.
 * @param {string} text - The JSON text result.
 * @returns {{content: Array<{type: 'text'; text: string}>}} MCP tool result.
 */
export function ok(text: string): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text }] };
}

/**
 * Builds a failed tool result from any thrown error. AppErrors keep their
 * categorized code; everything else is normalized through {@link formatError}.
 * @param {unknown} err - The thrown error.
 * @returns {{content: Array<{type: 'text'; text: string}>; isError: boolean}} Error result.
 */
export function fail(err: unknown): { content: Array<{ type: 'text'; text: string }>; isError: boolean } {
  const appErr = isAppError(err) ? err : formatError(err);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ ok: false, code: appErr.code, message: appErr.message, detail: appErr.detail }),
      },
    ],
    isError: true,
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
  outputDir: z.string().optional().describe('Directory to write all outputs into.'),
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
 * Serializes an enqueued job into the shared tool response shape.
 * @param {ReturnType<MCPJobManager['enqueue']>} job - The enqueued job.
 * @param {string} transcoder - The transcoder backend used.
 * @returns {Record<string, unknown>} The JSON-safe response object.
 */
function enqueueResponse(job: ReturnType<MCPJobManager['enqueue']>, transcoder: string): Record<string, unknown> {
  return { jobId: job.id, input: job.input, output: job.output, status: job.status, transcoder };
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
  const server = new McpServer({
    name: options.name ?? APP_NAME,
    version: options.version ?? resolveAppVersion(),
  });

  const transcoderFactory = options.transcoderFactory ?? createTranscoder;
  const jobManager = options.jobManager ?? new MCPJobManager({ transcoderFactory });

  server.registerTool(
    'ping',
    {
      title: 'Ping',
      description: 'Checks that the EncodeX MCP server is responsive and returns "pong".',
      inputSchema: z.object({}),
    },
    async () => ok(JSON.stringify({ pong: true })),
  );

  server.registerTool(
    'convert_media',
    {
      title: 'Convert Media',
      description:
        'Start an asynchronous media conversion (re-encode, stream-copy, trim, scale, rotate). ' +
        'Returns a job id immediately; poll with get_job / list_jobs and cancel with cancel_job.',
      inputSchema: conversionSchema,
    },
    async (args: z.infer<typeof conversionSchema>) => {
      try {
        if (!fs.existsSync(args.input)) {
          throw createError(ErrorCode.FILE_NOT_FOUND, `Input file not found: ${args.input}`);
        }
        const fields: MCPConversionFields = { ...args };
        const options = buildConversionOptions(fields);
        const output = args.output ?? resolveOutputPath(args.input, fields, options);
        if (args.concurrency !== undefined) {
          jobManager.setConcurrency(args.concurrency);
        }
        const job = jobManager.enqueue(args.input, output, options, (args.transcoder as TranscoderType | undefined) ?? 'FFMPEG');
        return ok(
          JSON.stringify({
            jobId: job.id,
            input: job.input,
            output: job.output,
            status: job.status,
            transcoder: args.transcoder ?? 'FFMPEG',
          }),
        );
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'get_job',
    {
      title: 'Get Job',
      description: 'Returns the current status and progress of a queued conversion job by id.',
      inputSchema: z.object({ jobId: z.string().min(1).describe('The job id returned by convert_media.') }),
    },
    async ({ jobId }: { jobId: string }) => {
      const job = jobManager.getJob(jobId);
      if (!job) {
        return fail(createError(ErrorCode.UNKNOWN, `Job not found: ${jobId}`));
      }
      return ok(JSON.stringify(job));
    },
  );

  server.registerTool(
    'list_jobs',
    {
      title: 'List Jobs',
      description: 'Lists all known conversion jobs with their current status and progress.',
      inputSchema: z.object({}),
    },
    async () => ok(JSON.stringify(jobManager.listJobs())),
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
      return ok(JSON.stringify({ jobId, cancelled: true }));
    },
  );

  server.registerTool(
    'get_media_info',
    {
      title: 'Get Media Info',
      description: 'Probes a media file and returns container and stream metadata (codecs, resolution, duration, bitrate).',
      inputSchema: z.object({ input: z.string().min(1).describe('Absolute path of the media file to inspect.') }),
    },
    async ({ input }: { input: string }) => {
      try {
        if (!fs.existsSync(input)) {
          throw createError(ErrorCode.FILE_NOT_FOUND, `Input file not found: ${input}`);
        }
        const transcoder = transcoderFactory('FFMPEG');
        const info = await transcoder.getInfo(input);
        return ok(JSON.stringify(info));
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
      return ok(JSON.stringify(caps));
    },
  );

  server.registerTool(
    'list_profiles',
    {
      title: 'List Profiles',
      description: 'Lists the built-in conversion profiles (id, name, category, container, codecs, presets).',
      inputSchema: z.object({}),
    },
    async () => ok(JSON.stringify(BUILTIN_PROFILES.map((p) => profileToJson(p)))),
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
      return ok(JSON.stringify(profileToJson(profile)));
    },
  );

  server.registerTool(
    'compress_image',
    {
      title: 'Compress Image',
      description:
        'Lossily compress an image (re-encode to jpg/png/webp/gif/bmp/tiff). ' +
        'Returns a job id immediately; poll with get_job / list_jobs.',
      inputSchema: compressSchema,
    },
    async (args: z.infer<typeof compressSchema>) => {
      try {
        if (!fs.existsSync(args.input)) {
          throw createError(ErrorCode.FILE_NOT_FOUND, `Input file not found: ${args.input}`);
        }
        const fields: MCPCompressFields = { ...args };
        const plan = buildCompressPlan(args.input, fields);
        const transcoder = (args.transcoder as TranscoderType | undefined) ?? 'FFMPEG';
        const job = jobManager.enqueue(args.input, plan.output, plan.options, transcoder);
        return ok(JSON.stringify({ ...enqueueResponse(job, transcoder), format: plan.format }));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'extract_audio',
    {
      title: 'Extract Audio',
      description:
        'Extract the audio track from a media file, dropping the video stream. ' +
        'Returns a job id immediately; poll with get_job / list_jobs.',
      inputSchema: extractSchema,
    },
    async (args: z.infer<typeof extractSchema>) => {
      try {
        if (!fs.existsSync(args.input)) {
          throw createError(ErrorCode.FILE_NOT_FOUND, `Input file not found: ${args.input}`);
        }
        const fields: MCPExtractAudioFields = { ...args };
        const plan = buildExtractAudioPlan(args.input, fields);
        const transcoder = (args.transcoder as TranscoderType | undefined) ?? 'FFMPEG';
        const job = jobManager.enqueue(args.input, plan.output, plan.options, transcoder);
        return ok(JSON.stringify({ ...enqueueResponse(job, transcoder), audioCodec: plan.audioCodec, extension: plan.ext }));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'cut_video',
    {
      title: 'Cut Video',
      description:
        'Cut (trim) a video by start/end time or duration. Defaults to lossless stream copy. ' +
        'Returns a job id immediately; poll with get_job / list_jobs.',
      inputSchema: cutSchema,
    },
    async (args: z.infer<typeof cutSchema>) => {
      try {
        if (!fs.existsSync(args.input)) {
          throw createError(ErrorCode.FILE_NOT_FOUND, `Input file not found: ${args.input}`);
        }
        const fields: MCPCutFields = { ...args };
        const plan = buildCutPlan(args.input, fields);
        const transcoder = (args.transcoder as TranscoderType | undefined) ?? 'FFMPEG';
        const job = jobManager.enqueue(args.input, plan.output, plan.options, transcoder);
        return ok(JSON.stringify(enqueueResponse(job, transcoder)));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'batch_convert',
    {
      title: 'Batch Convert',
      description:
        'Queue conversions for multiple files (paths, directories, or glob patterns) sharing the same options. ' +
        'Returns a job id per input immediately; poll with get_job / list_jobs and cancel with cancel_job.',
      inputSchema: batchSchema,
    },
    async (args: z.infer<typeof batchSchema>) => {
      try {
        const fields: MCPConversionFields = { ...args };
        const { jobs } = buildBatchPlan(args.inputs, fields, args.outputDir, args.suffix);
        if (jobs.length === 0) {
          throw createError(ErrorCode.FILE_NOT_FOUND, `No input files matched: ${args.inputs.join(', ')}`);
        }
        if (args.concurrency !== undefined) {
          jobManager.setConcurrency(args.concurrency);
        }
        const transcoder = (args.transcoder as TranscoderType | undefined) ?? 'FFMPEG';
        const queued = jobs.map((job) => {
          const running = jobManager.enqueue(job.input, job.output, job.options, transcoder);
          return { file: job.input, output: job.output, jobId: running.id, status: running.status };
        });
        return ok(JSON.stringify({ total: queued.length, jobs: queued }));
      } catch (err) {
        return fail(err);
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

  return server;
}
