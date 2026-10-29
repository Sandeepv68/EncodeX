/**
 * @fileoverview Type definitions for the MCP layer.
 * Collects the shapes spoken by the MCP surface: the conversion/tool field
 * contracts, the materialized operation plans, the safety tiers and batch
 * envelope, and the server/HTTP configuration objects. Every implementation
 * file in `src/mcp` imports its shapes from here so the tool contract can be
 * read in one place.
 */

import type { ConversionOptions, MediaStreamInfo, TranscoderType } from '../shared/types';
import type { ITranscoder } from '../main/transcoders/types';
import type { AuditEntry } from '../shared/audit';
import type { FrameSampler, LocalModelClient, SttEngine, TranslationProvider } from '../shared/ai';
import type { DemuxTarget, RemuxWarning } from '../shared/codec-containers';
import type { MCPJobManager } from './jobs/manager';
import type { McpServer } from '@modelcontextprotocol/server';
import type { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { SAFETY_TIERS } from './safety';

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
 * @property {string[]} [videoFilters] - Ordered FFmpeg video filter expressions
 *   (one per entry) to append after the built-in scale/rotation filters.
 * @property {string} [filters] - Comma-joined video filter chain (a compact
 *   shorthand for {@link MCPConversionFields.videoFilters}).
 * @property {string[]} [presets] - Curated filter preset ids, expanded to their
 *   default parameter expressions before {@link MCPConversionFields.filters} /
 *   {@link MCPConversionFields.videoFilters}.
 * @property {string[]} [extraArgs] - Extra FFmpeg output arguments. Independent
 *   of the filter fields: `extraArgs` append raw output args while
 *   `videoFilters`/`filters`/`presets` build the single `-vf` chain.
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
  videoFilters?: string[];
  filters?: string;
  presets?: string[];
  extraArgs?: string[];
}

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
 * A safety tier value.
 * @typedef {(0 | 1 | 2 | 3)} SafetyTier
 */
export type SafetyTier = (typeof SAFETY_TIERS)[keyof typeof SAFETY_TIERS];

/**
 * The size envelope of a batch plan: how many files and how many total bytes.
 * @interface BatchEnvelope
 * @property {number} fileCount - Number of matched files.
 * @property {number} totalBytes - Total input size in bytes.
 */
export interface BatchEnvelope {
  fileCount: number;
  totalBytes: number;
}

/**
 * Configuration for the MCP HTTP listener.
 * @interface McpHttpServerOptions
 * @property {string} [name] - Server name advertised in the MCP handshake.
 * @property {string} [version] - Server version advertised in the handshake.
 * @property {function(TranscoderType): ITranscoder} [transcoderFactory] - Test seam; defaults to the shared factory.
 * @property {MCPJobManager} [jobManager] - Shared job manager used by every session (test seam).
 * @property {string} [basePath] - URL path the listener is mounted at (default {@link MCP_HTTP_DEFAULT_PATH}).
 * @property {string} [host] - Bind host; anything outside {@link MCP_HTTP_LOOPBACK_HOSTNAMES} is refused.
 * @property {number} [port] - Port for `runMcpHttpServer`; 0 picks an ephemeral port.
 * @property {string} [bearerToken] - When set, every request must authenticate with it.
 * @property {number} [maxBodyBytes] - Request body cap (default 10 MB).
 * @property {number} [maxSessions] - Session table cap (default 64).
 */
export interface McpHttpServerOptions {
  name?: string;
  version?: string;
  transcoderFactory?: (type: TranscoderType) => ITranscoder;
  jobManager?: MCPJobManager;
  basePath?: string;
  host?: string;
  port?: number;
  bearerToken?: string;
  maxBodyBytes?: number;
  maxSessions?: number;
}

/** One open MCP session: its transport plus the McpServer bound to it. */
export interface SessionRecord {
  transport: NodeStreamableHTTPServerTransport;
  server: McpServer;
}

/**
 * Options for {@link createHttpLocalModelClient}.
 * @interface HttpLocalModelClientOptions
 * @property {string} [baseUrl] - Runtime base URL (defaults to `ENCODEX_LOCAL_MODEL_URL`).
 * @property {string} [model] - Model name (defaults to `ENCODEX_LOCAL_MODEL_MODEL`).
 * @property {number} [timeoutMs] - Request timeout (default 120000).
 * @property {typeof fetch} [fetchImpl] - Fetch implementation (test seam).
 */
export interface HttpLocalModelClientOptions {
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

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
 * @property {FrameSampler} [frameSampler] - Samples a frame hash for
 *   `find_similar_media`; defaults to the FFmpeg-backed sampler.
 * @property {SttEngine} [sttEngine] - Speech-to-text engine for the transcript
 *   tools; defaults to the whisper.cpp CLI adapter.
 * @property {TranslationProvider} [translator] - Subtitle translation backend;
 *   defaults to the local-model provider built from {@link localModelClient}.
 * @property {LocalModelClient} [localModelClient] - Local model transport used
 *   by translation (and available to the AI provider layer). Defaults to the
 *   HTTP adapter when `ENCODEX_LOCAL_MODEL_URL` is set.
 */
export interface CreateMcpServerOptions {
  name?: string;
  version?: string;
  transcoderFactory?: (type: TranscoderType) => ITranscoder;
  jobManager?: MCPJobManager;
  onAudit?: (entry: AuditEntry) => void;
  frameSampler?: FrameSampler;
  sttEngine?: SttEngine;
  translator?: TranslationProvider;
  localModelClient?: LocalModelClient;
  /**
   * The MCP App view bundle to serve. When omitted, the built bundle is read
   * from disk on the first `resources/read`; the test suite passes a fixture so
   * the unit tier never depends on a build artefact.
   */
  viewBundle?: string;
}
