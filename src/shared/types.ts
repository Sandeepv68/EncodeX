/**
 * @fileoverview Type definitions and interfaces for the shared layer.
 * Defines all core data structures used throughout the EncodeX application, spanning
 * errors, codec/container compatibility, conversion options, probed media information,
 * image analysis results, queue jobs, player frames/audio, waveform and thumbnail data,
 * log entries, encoder capabilities, MCP App views, Copilot planning, video-filter
 * presets, remux/demux plans, audit records, and shared settings. These types are shared
 * by the main, preload, and renderer processes.
 */

import { QUEUE_STATUS, FALLBACK_VALUES } from './media-options';
import { ErrorCode } from './errors';
import { TRANSCODER_TYPES } from './transcoder-constants';
import { HWACCEL_MODES, ENCODER_TYPES } from './hwaccel-settings';
import { MCP_UI_VIEW_URIS } from './mcp-ui';
import type { AgentAction, AgentSkip, AIProviderId, WorkflowPlan } from './ai/types';

/**
 * Hardware acceleration mode type: how hardware acceleration is applied during encoding.
 * @typedef {string} HwAccelMode
 */
export type HwAccelMode = (typeof HWACCEL_MODES)[number];

/**
 * Encoder type selection: prefer hardware, prefer software, or auto-detect.
 * @typedef {string} EncoderType
 */
export type EncoderType = (typeof ENCODER_TYPES)[number];

/**
 * Supported transcoder backend types.
 * @typedef {string} TranscoderType
 */
export type TranscoderType = (typeof TRANSCODER_TYPES)[number];

/**
 * Application error codes for different failure scenarios.
 * @typedef {string} ErrorCodeType
 */
export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Application error type combining error code, message, and details.
 * @interface AppError
 * @property {ErrorCodeType} code - The categorized application error code.
 * @property {string} message - A human-readable error message.
 * @property {string} [detail] - Optional additional technical detail about the failure.
 * @property {number} timestamp - Epoch milliseconds at which the error was created.
 */
export interface AppError {
  code: ErrorCodeType;
  message: string;
  detail?: string;
  timestamp: number;
}

/**
 * Codec to container compatibility information.
 * @interface CodecContainerInfo
 * @property {string} extension - Preferred default output extension (no leading dot).
 * @property {string[]} containers - Container formats the codec can be muxed into.
 */
export interface CodecContainerInfo {
  extension: string;
  containers: string[];
}

/**
 * Options for media conversion and encoding operations.
 * @interface ConversionOptions
 * @property {string} [videoCodec] - Video encoder name (e.g. 'libx264').
 * @property {string} [audioCodec] - Audio encoder name (e.g. 'aac').
 * @property {string} [videoBitrate] - Target video bitrate (e.g. '2000k').
 * @property {string} [audioBitrate] - Target audio bitrate (e.g. '192k').
 * @property {number} [qscale] - Video quality scale (-qscale:v), 1 (best) to 31 (worst).
 * @property {string} [scale] - Output resolution as WIDTHxHEIGHT.
 * @property {boolean} [keepAspectRatio] - Whether to preserve the source aspect ratio when scaling.
 * @property {'90'|'180'|'270'} [rotate] - Output rotation: 90 = 90° clockwise,
 *   270 = 90° counter-clockwise, 180 = half turn. Applied as a pixel filter
 *   (transpose) during re-encoding, or as lossless rotation metadata in
 *   stream-copy mode for MP4/MOV/MKV outputs.
 * @property {boolean} [flipH] - Mirror the output horizontally (hflip; requires re-encoding).
 * @property {boolean} [flipV] - Mirror the output vertically (vflip; requires re-encoding).
 * @property {string[]} [videoFilters] - Ordered video-filter expressions
 *   (e.g. 'crop=in_w/2:in_h/2', 'fps=30', 'eq=brightness=0.1'). Merged AFTER
 *   scale and rotation/mirror into the single `-vf` chain. Only honored in
 *   re-encode mode; ignored with a warning under `copy:true`. See
 *   src/shared/video-filters.ts for validation.
 * @property {string} [pixelFormat] - Output pixel format (e.g. 'yuv420p').
 * @property {string} [startTime] - Trim start time (seconds or HH:MM:SS).
 * @property {string} [endTime] - Trim end time (seconds or HH:MM:SS).
 * @property {string} [duration] - Maximum output duration.
 * @property {boolean} [copy] - Whether to stream-copy the original streams instead of re-encoding.
 * @property {boolean} [audio] - Whether the output includes an audio stream.
 * @property {boolean} [video] - Whether the output includes a video stream.
 * @property {boolean} [hardwareAcceleration] - Whether hardware acceleration is enabled.
 * @property {HwAccelMode} [hwaccelMode] - Hardware acceleration mode to use.
 * @property {string[]} [extraArgs] - Extra FFmpeg output arguments appended to the command.
 * @property {string[]} [inputArgs] - Extra FFmpeg input arguments prepended to the command.
 * @property {string[]} [map] - FFmpeg `-map` stream-selection specs targeting the
 *   PRIMARY input (e.g. ['0:v:0', '0:a:1']). Each entry becomes a repeated
 *   `-map` flag. Used by remux (stream composition) and demux (single-stream
 *   extraction). Empty or absent = default stream selection.
 * @property {string} [subtitleCodec] - Subtitle encoder/format emitted as `-c:s`
 *   (e.g. 'srt', 'mov_text', 'ass', 'copy'). Used when embedding subtitle
 *   streams into containers that cannot hold the source subtitle codec.
 * @property {RemuxInput[]} [additionalInputs] - External files appended as extra
 *   `-i` inputs AFTER the primary input (index 0). Each entry may carry its own
 *   `-map` specs, per-stream `-c` overrides, a cover-art disposition, or a
 *   `-itsoffset` sync shift. See `RemuxInput`.
 * @property {string} [chaptersFile] - Absolute path to an FFMETADATA chapters
 *   file. Added as an extra `-i` input and selected with `-map_chapters <index>`,
 *   where `<index>` is the chapters input's position among all inputs (N+1 when
 *   no re-read entry is appended after it).
 * @property {boolean} [copyChapters] - Preserve the source's chapters with
 *   `-map_chapters 0`. Defaults to true for remux-style operations; explicit so
 *   callers can suppress chapter copying (`--no-chapters`), which emits
 *   `-map_chapters -1` (omitting the flag would keep the chapters). Trimmed
 *   copies always drop the source chapters so the output duration stays the
 *   length of the cut.
 * @property {number} [audioSyncSeconds] - Signed seconds to shift the PRIMARY
 *   file's audio streams relative to its video, via the lossless "re-read"
 *   trick (a second `-i` of the same file is mapped only to audio and shifted
 *   with `-itsoffset`). Positive = audio plays LATER. Absent = no adjustment.
 */
export interface ConversionOptions {
  videoCodec?: string;
  audioCodec?: string;
  videoBitrate?: string;
  audioBitrate?: string;
  qscale?: number;
  scale?: string;
  keepAspectRatio?: boolean;
  rotate?: '90' | '180' | '270';
  flipH?: boolean;
  flipV?: boolean;
  videoFilters?: string[];
  pixelFormat?: string;
  startTime?: string;
  endTime?: string;
  duration?: string;
  copy?: boolean;
  audio?: boolean;
  video?: boolean;
  hardwareAcceleration?: boolean;
  hwaccelMode?: HwAccelMode;
  extraArgs?: string[];
  inputArgs?: string[];
  map?: string[];
  subtitleCodec?: string;
  additionalInputs?: RemuxInput[];
  chaptersFile?: string;
  copyChapters?: boolean;
  audioSyncSeconds?: number;
}

/**
 * An external file embedded into a remux output (added subtitle track, added
 * audio track, cover art, or the primary file's "re-read" sync entry).
 *
 * Input-index contract: the PRIMARY input is always `0`; each `additionalInputs`
 * entry consumes the next input index (`1..N`) in array order; a `chaptersFile`,
 * when present, consumes index `N+1`. Consequently a re-read sync entry (whose
 * `path` equals the primary path and whose `map` selects only the shifted
 * streams) must be emitted AFTER any user-added inputs so its own input index
 * is deterministic.
 *
 * @interface RemuxInput
 * @property {string} path - Absolute path of the external file.
 * @property {string[]} map - `-map` specs targeting THIS input (e.g. ['1:0'] for
 *   the first additional input). Referenced by the entry's own input index.
 * @property {string} [codec] - Per-stream codec(s) applied as `-c:<kind or
 *   specifier>` AFTER the blanket `-c copy` (e.g. 'mov_text' for an MP4-bound
 *   subtitle, 'copy' keyed per-stream). Order follows `map` order.
 * @property {string} [disposition] - Stream disposition for a mapped stream,
 *   e.g. 'attached_pic' for MP4/MOV cover art (emitted via `-disposition:v:<n>`).
 * @property {boolean} [attachment] - MKV/WebM style: attach the file as a
 *   stream (`-attach`) instead of `-i` (cover art). Mutually exclusive with
 *   `map`/`disposition`.
 * @property {number} [syncOffsetSeconds] - Signed `-itsoffset` applied to THIS
 *   input BEFORE `-i` (positive = stream plays LATER). Used for added-track sync
 *   and for the primary "re-read" entry (path === primary path).
 */
export interface RemuxInput {
  path: string;
  map: string[];
  codec?: string;
  disposition?: string;
  attachment?: boolean;
  syncOffsetSeconds?: number;
}

/**
 * Top-level category for grouping conversion profiles in the UI.
 * Each category maps to a section in the profile selector.
 * @typedef {string} ProfileCategory
 */
export type ProfileCategory = 'web-social' | 'devices' | 'video' | 'professional' | 'streaming' | 'audio' | 'images' | 'advanced';

/**
 * A pre-configured conversion profile that maps a human-facing name to a
 * specific container, codecs, and encoding constraints. Profiles are the core
 * abstraction for the profile system: selecting one populates the conversion
 * form fields automatically.
 *
 * Built-in profiles are provided by the application catalogue and cannot be
 * edited or deleted. User-created profiles are persisted to localStorage.
 *
 * @interface ConversionProfile
 * @property {string} id - Unique identifier (builtin: 'yt-1080p', user: 'custom-<ts>').
 * @property {string} name - Human-readable display name (e.g. 'YouTube 1080p').
 * @property {ProfileCategory} category - UI grouping category.
 * @property {string} [icon] - FontAwesome icon key for the category header.
 * @property {string} container - Output container format (e.g. 'mp4', 'mkv', 'mov').
 * @property {string} videoCodec - FFmpeg video encoder name (e.g. 'libx264').
 * @property {string} audioCodec - FFmpeg audio encoder name (e.g. 'aac').
 * @property {string} [videoBitrate] - Target video bitrate (e.g. '8M').
 * @property {string} [audioBitrate] - Target audio bitrate (e.g. '192k').
 * @property {number} [crf] - Constant Rate Factor quality (0-51 for x264/x265).
 * @property {string} [preset] - Encoding speed preset (e.g. 'medium', 'slow').
 * @property {string} [scale] - Output resolution WIDTHxHEIGHT (e.g. '1920x1080').
 * @property {string} [pixelFormat] - Output pixel format (e.g. 'yuv420p').
 * @property {number} [fps] - Output frame rate (e.g. 30, 60).
 * @property {string[]} [extraArgs] - Extra raw FFmpeg output arguments.
 * @property {string} [extension] - Output file extension override (no leading dot).
 * @property {boolean} builtin - True for catalogue profiles, false for user-created.
 * @property {string} [compatibility] - Compatibility tier: 'Broad', 'Modern', or 'Professional'.
 * @property {string} [description] - Short description shown in the profile selector.
 */
export interface ConversionProfile {
  id: string;
  name: string;
  category: ProfileCategory;
  icon?: string;
  container: string;
  videoCodec: string;
  audioCodec: string;
  videoBitrate?: string;
  audioBitrate?: string;
  crf?: number;
  preset?: string;
  scale?: string;
  pixelFormat?: string;
  fps?: number;
  extraArgs?: string[];
  extension?: string;
  builtin: boolean;
  compatibility?: string;
  description?: string;
}

/**
 * Information about a media stream (audio, video, or subtitle).
 * @interface MediaStreamInfo
 * @property {number} index - Zero-based index of the stream within the file.
 * @property {'video' | 'audio' | 'subtitle'} type - The stream kind.
 * @property {string} codec - Short codec name (e.g. 'h264').
 * @property {string} [codecLong] - Long codec name.
 * @property {string} [codecTag] - FourCC/codec tag from the container.
 * @property {string} [profile] - Codec profile (e.g. 'High').
 * @property {number} [level] - Codec level.
 * @property {number} [width] - Video width in pixels.
 * @property {number} [height] - Video height in pixels.
 * @property {string} [displayAspectRatio] - Display aspect ratio string.
 * @property {string} [pixelFormat] - Video pixel format (e.g. 'yuv420p').
 * @property {string} [colorRange] - Color range ('tv'/'pc').
 * @property {string} [colorSpace] - Color space identifier.
 * @property {string} [colorTransfer] - Color transfer characteristic.
 * @property {string} [colorPrimaries] - Color primaries identifier.
 * @property {string} [fieldOrder] - Interlacing/field order.
 * @property {string} [frameRate] - Nominal frame rate (e.g. '30/1').
 * @property {string} [avgFrameRate] - Average frame rate.
 * @property {number} [bitDepth] - Bits per pixel component.
 * @property {string} [bitrate] - Stream bitrate (e.g. '2000k').
 * @property {number} [sampleRate] - Audio sample rate in Hz.
 * @property {string} [sampleFormat] - Audio sample format (e.g. 'fltp').
 * @property {number} [channels] - Audio channel count.
 * @property {string} [channelLayout] - Audio channel layout (e.g. 'stereo').
 * @property {number} [bitsPerSample] - Audio bits per sample.
 * @property {number} [duration] - Stream duration in seconds.
 * @property {number} [startTime] - Stream start time in seconds.
 * @property {number} [frameCount] - Estimated total number of frames.
 * @property {string} [language] - Stream language tag.
 * @property {string} [title] - Stream title.
 * @property {string[]} [disposition] - Stream disposition flags.
 * @property {Record<string, string>} [tags] - Arbitrary container/codec metadata tags.
 */
export interface MediaStreamInfo {
  index: number;
  type: 'video' | 'audio' | 'subtitle';
  codec: string;
  codecLong?: string;
  codecTag?: string;
  profile?: string;
  level?: number;
  width?: number;
  height?: number;
  displayAspectRatio?: string;
  pixelFormat?: string;
  colorRange?: string;
  colorSpace?: string;
  colorTransfer?: string;
  colorPrimaries?: string;
  fieldOrder?: string;
  frameRate?: string;
  avgFrameRate?: string;
  bitDepth?: number;
  bitrate?: string;
  sampleRate?: number;
  sampleFormat?: string;
  channels?: number;
  channelLayout?: string;
  bitsPerSample?: number;
  duration?: number;
  startTime?: number;
  frameCount?: number;
  language?: string;
  title?: string;
  disposition?: string[];
  tags?: Record<string, string>;
}

/**
 * Complete media file information including format and stream details.
 * @interface MediaInfo
 * @property {string} file - Absolute path of the probed file.
 * @property {string} format - Container/format name (e.g. 'mov,mp4,m4a,3gp,3g2,mj2').
 * @property {string} [formatLong] - Long format name.
 * @property {number} size - File size in bytes.
 * @property {number} duration - Container duration in seconds.
 * @property {string} bitrate - Overall bitrate (e.g. '2000k').
 * @property {number} [startTime] - Container start time in seconds.
 * @property {number} [probeScore] - ffprobe confidence score for the format.
 * @property {MediaStreamInfo[]} streams - All probed streams (video, audio, subtitle).
 * @property {Record<string, string>} [tags] - Format-level metadata tags.
 */
export interface MediaInfo {
  file: string;
  format: string;
  formatLong?: string;
  size: number;
  duration: number;
  bitrate: string;
  startTime?: number;
  probeScore?: number;
  streams: MediaStreamInfo[];
  tags?: Record<string, string>;
}

/**
 * RGB and luminance histogram data for an image.
 * @interface ImageHistogram
 * @property {number[]} r - Histogram of the red channel.
 * @property {number[]} g - Histogram of the green channel.
 * @property {number[]} b - Histogram of the blue channel.
 * @property {number[]} luma - Histogram of the computed luma (brightness) channel.
 */
export interface ImageHistogram {
  r: number[];
  g: number[];
  b: number[];
  luma: number[];
}

/**
 * EXIF metadata and histogram data extracted from an image file.
 * @interface ImageExifData
 * @property {string} file - Absolute path of the image file.
 * @property {Record<string, string>} exif - EXIF metadata key/value pairs.
 * @property {ImageHistogram | null} histogram - RGB/luma histogram, or null if unavailable.
 */
export interface ImageExifData {
  file: string;
  exif: Record<string, string>;
  histogram: ImageHistogram | null;
}

/**
 * Basic information about an image file (dimensions and size).
 * @interface ImageFileInfo
 * @property {number | null} width - Image width in pixels, or null if unknown.
 * @property {number | null} height - Image height in pixels, or null if unknown.
 * @property {number} size - File size in bytes.
 */
export interface ImageFileInfo {
  width: number | null;
  height: number | null;
  size: number;
}

/**
 * A media conversion job in the conversion queue.
 * @interface QueueJob
 * @property {string} id - Unique job identifier.
 * @property {string} input - Absolute path of the input file.
 * @property {string} output - Absolute path of the output file.
 * @property {ConversionOptions} options - Conversion options for the job.
 * @property {TranscoderType} transcoder - Backend used to run the job.
 * @property {QUEUE_STATUS} status - Current job lifecycle status.
 * @property {number} progress - Progress percentage (0-100).
 * @property {string} [error] - Error message if the job failed.
 * @property {number} [priority] - Scheduling priority; higher starts first.
 *   Defaults to 0 when absent.
 * @property {boolean} [paused] - True while the queue (and this job's active
 *   conversion) is paused; only meaningful for RUNNING jobs.
 * @property {number} createdAt - Epoch milliseconds when the job was created.
 */
export interface QueueJob {
  id: string;
  input: string;
  output: string;
  options: ConversionOptions;
  transcoder: TranscoderType;
  status: (typeof QUEUE_STATUS)[keyof typeof QUEUE_STATUS];
  progress: number;
  error?: string;
  priority?: number;
  paused?: boolean;
  createdAt: number;
}

/**
 * Real-time progress information during media conversion.
 * @interface ConversionProgress
 * @property {number} percent - Progress percentage (0-100).
 * @property {string} time - Current output timestamp (HH:MM:SS).
 * @property {number} fps - Current encoding speed in frames per second.
 * @property {string} speed - Speed relative to realtime (e.g. '3.5x').
 * @property {string} eta - Estimated remaining time.
 * @property {string} bitrate - Current encoding bitrate (e.g. '1500k').
 */
export interface ConversionProgress {
  percent: number;
  time: string;
  fps: number;
  speed: string;
  eta: string;
  bitrate: string;
}

/**
 * A decoded video frame for playback with presentation timestamp.
 * @interface PlayerFrame
 * @property {ArrayBuffer} data - Raw frame pixel data.
 * @property {number} width - Frame width in pixels.
 * @property {number} height - Frame height in pixels.
 * @property {number} pts - Presentation timestamp in seconds.
 * @property {number} generation - Playback generation this frame belongs to
 * (used to discard stale frames after a seek).
 */
export interface PlayerFrame {
  data: ArrayBuffer;
  width: number;
  height: number;
  pts: number;
  generation: number;
}

/**
 * A decoded audio chunk for playback with sample rate and channel info.
 * @interface PlayerAudioChunk
 * @property {ArrayBuffer} data - Raw PCM audio data.
 * @property {number} sampleRate - Audio sample rate in Hz.
 * @property {number} channels - Number of audio channels.
 * @property {number} generation - Playback generation this chunk belongs to.
 */
export interface PlayerAudioChunk {
  data: ArrayBuffer;
  sampleRate: number;
  channels: number;
  generation: number;
}

/**
 * Waveform visualization data for audio or an audio track.
 * @interface WaveformData
 * @property {number} sampleRate - Sample rate in Hz of the source audio.
 * @property {number} samplesPerBucket - Number of source samples aggregated per bucket.
 * @property {Array<{min: number; max: number}>} buckets - Per-bucket min/max peak amplitudes.
 */
export interface WaveformData {
  sampleRate: number;
  samplesPerBucket: number;
  buckets: Array<{ min: number; max: number }>;
}

/**
 * A grid of video thumbnail frames for timeline preview.
 * @interface ThumbnailStrip
 * @property {string} dataUrl - Data URL of the assembled thumbnail grid image.
 * @property {number} cols - Number of thumbnail columns in the grid.
 * @property {number} rows - Number of thumbnail rows in the grid.
 * @property {number} thumbWidth - Width in pixels of each thumbnail cell.
 * @property {number} thumbHeight - Height in pixels of each thumbnail cell.
 * @property {number} interval - Time in seconds between sampled thumbnails.
 * @property {number} count - Total number of thumbnails in the strip.
 */
export interface ThumbnailStrip {
  dataUrl: string;
  cols: number;
  rows: number;
  thumbWidth: number;
  thumbHeight: number;
  interval: number;
  count: number;
}

/**
 * Types of media conversion operations supported by the application.
 * @enum {string} ConversionOperation
 */
export enum ConversionOperation {
  /** Full transcode of a media file. */
  Transcode = 'transcode',
  /** Extract the audio stream from a video. */
  ExtractAudio = 'extract_audio',
  /** Compress/re-encode an image file. */
  CompressImage = 'compress_image',
  /** Create an animated GIF from a video. */
  CreateGif = 'create_gif',
  /** Cut a segment out of a video. */
  CutVideo = 'cut_video',
  /** Remux streams losslessly (or converted) into a new container. */
  Remux = 'remux',
  /** Split a file's streams into separate output files. */
  Demux = 'demux',
}

/**
 * A single entry in the application log, as forwarded to the renderer log view.
 * @interface LogEntry
 * @property {string} timestamp - ISO-8601 UTC timestamp of the log message.
 * @property {'DEBUG' | 'INFO' | 'WARN' | 'ERROR'} level - Log severity level.
 * @property {string} text - The log message text.
 * @property {'main' | 'renderer'} source - Process that produced the entry.
 */
export interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  text: string;
  source: 'main' | 'renderer';
}

/**
 * A file entry in a batch processing session.
 * @interface FileItem
 * @property {string} path - Absolute path of the file.
 * @property {string} name - File name as displayed in the UI.
 * @property {number} size - File size in bytes.
 * @property {ConversionOperation} operation - Operation to perform on the file.
 */
export interface FileItem {
  path: string;
  name: string;
  size: number;
  operation: ConversionOperation;
}

/**
 * FFmpeg encoder and hardware acceleration capabilities detected on the system.
 * @interface EncoderCapabilities
 * @property {string[]} videoEncoders - Available video encoder names.
 * @property {string[]} audioEncoders - Available audio encoder names.
 * @property {string[]} hwaccels - Available hardware acceleration methods.
 */
export interface EncoderCapabilities {
  videoEncoders: string[];
  audioEncoders: string[];
  hwaccels: string[];
}

/**
 * Power action performed automatically when the batch queue finishes.
 * @typedef {string} WhenDoneAction
 * @property {'shutdown'} shutdown - Turn the computer off.
 * @property {'sleep'} sleep - Suspend the computer (sleep).
 * @property {'hibernate'} hibernate - Hibernate the computer.
 */
export type WhenDoneAction = 'shutdown' | 'sleep' | 'hibernate';

/**
 * Configuration for the batch queue "when done" power action.
 * Shared by the renderer settings store (persisted to localStorage) and the
 * main-process queue IPC layer, which performs the action once the queue
 * drains. `force` closes applications that would otherwise block the action
 * (only honored on platforms that support it, e.g. Windows `shutdown /f`).
 * @interface WhenDoneConfig
 * @property {boolean} enabled - Whether the power action is armed and should
 *   fire after the batch finishes.
 * @property {WhenDoneAction} action - The power action to perform.
 * @property {boolean} force - Whether open processes should be force-closed
 *   when performing the action.
 */
export interface WhenDoneConfig {
  enabled: boolean;
  action: WhenDoneAction;
  force: boolean;
}

/**
 * A GitHub Release asset matched to the current platform/architecture.
 * @interface UpdateAsset
 * @property {string} name - The asset filename (e.g. 'EncodeX-1.1.0-x64-setup.exe').
 * @property {string} url - The direct browser_download_url for the asset.
 * @property {number} size - File size in bytes. Zero when the release did not report a usable one.
 * @property {string} [digest] - GitHub-published digest, e.g. `sha256:ab12...`. Absent when the
 *   release did not publish one, in which case the download is not checksum-verified.
 */
export interface UpdateAsset {
  name: string;
  url: string;
  size: number;
  digest?: string;
}

/**
 * Information about an available update returned by the update check.
 * @interface UpdateInfo
 * @property {string} version - The latest release version (e.g. '1.1.0').
 * @property {string} releaseNotes - Markdown release notes body.
 * @property {string} releaseUrl - URL of the GitHub release page.
 * @property {UpdateAsset} asset - The matched platform-specific installer asset.
 */
export interface UpdateInfo {
  version: string;
  releaseNotes: string;
  releaseUrl: string;
  asset: UpdateAsset;
}

/**
 * Download progress reported during an in-app update download.
 * @interface UpdateProgress
 * @property {number} percent - Download progress percentage (0-100).
 * @property {number} transferred - Bytes downloaded so far.
 * @property {number} total - Total file size in bytes.
 */
export interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
}

/**
 * A persisted marker for an update the user chose to apply on the next app
 * restart. Stored as `userData/pending-install.json` by the main process and
 * consumed at startup so the installer can be launched before the window opens.
 * @interface PendingInstall
 * @property {string} installerPath - Absolute path of the downloaded installer.
 * @property {string} version - Update version the installer targets.
 */
export interface PendingInstall {
  installerPath: string;
  version: string;
}

/**
 * Availability of the BMF framework CLI tools on the system PATH.
 * @interface BmfStatus
 * @property {boolean} available - True when both bmf_ffmpeg and bmf_ffprobe resolve.
 * @property {string[]} missing - Names of the BMF executables that were not found.
 */
export interface BmfStatus {
  available: boolean;
  missing: string[];
}

/**
 * Identifier of a shipped view, derived from {@link MCP_UI_VIEW_URIS}.
 * @typedef {keyof typeof MCP_UI_VIEW_URIS} McpUiViewId
 */
export type McpUiViewId = keyof typeof MCP_UI_VIEW_URIS;

/**
 * One MCP App view attached to a Copilot message.
 *
 * The Copilot renders the same React components an external MCP Apps host
 * renders; the attachment carries the payload the view shows and the tool the
 * payload came from.
 * @interface McpViewAttachment
 * @property {McpUiViewId} viewId - The view to render.
 * @property {string} uri - The `ui://` resource URI of the view.
 * @property {string} toolName - The MCP tool that produced the payload.
 * @property {unknown} structuredContent - The payload the view renders.
 */
export interface McpViewAttachment {
  viewId: McpUiViewId;
  uri: string;
  toolName: string;
  structuredContent: unknown;
}

/**
 * One entry of the job status returned to the queue/job views. Mirrors the
 * job manager's serialized shape without importing it, keeping this contract
 * usable from any process.
 * @interface McpUiJob
 * @property {string} id - Stable job id.
 * @property {string} input - Absolute input path.
 * @property {string} output - Absolute output path.
 * @property {string} status - Lifecycle status (queued, running, done, ...).
 * @property {number} progress - Completion percentage (0-100).
 * @property {string} [error] - Failure message, when the job failed.
 */
export interface McpUiJob {
  id: string;
  input: string;
  output: string;
  status: string;
  progress: number;
  error?: string;
}

/**
 * One label/value row of a confirmation rendered before an operation runs.
 * @interface McpUiConfirmationField
 * @property {string} label - Short field name (e.g. "Output").
 * @property {string} value - Human-readable value.
 */
export interface McpUiConfirmationField {
  label: string;
  value: string;
}

/**
 * A mutating operation awaiting explicit user approval.
 *
 * When the host supports MCP Apps, the server never runs a mutating tool from
 * a model call: it returns a confirmation instead, the app renders the details,
 * and only a user click replays {@link McpUiConfirmation.args} into the
 * app-only `commit_operation` tool. Hosts without the extension keep the old
 * headless behaviour and execute immediately (see `approval.ts`).
 * @interface McpUiConfirmation
 * @property {string} operation - Executor tool that the approval runs.
 * @property {string} title - Short imperative heading (e.g. "Cut video").
 * @property {string} summary - One-line summary of the effect.
 * @property {Record<string, unknown>} args - Raw arguments replayed verbatim.
 * @property {McpUiConfirmationField[]} [details] - Key/value rows to show.
 * @property {string[]} [warnings] - Warnings surfaced before running.
 */
export interface McpUiConfirmation {
  operation: string;
  title: string;
  summary: string;
  args: Record<string, unknown>;
  details?: McpUiConfirmationField[];
  warnings?: string[];
}

/**
 * A media stream as the media-info view renders it.
 *
 * The view only needs a handful of fields per stream, and the server sends
 * the full probe result, so every field is optional here.
 * @interface McpUiStream
 * @property {number} [index] - Stream index in the container.
 * @property {string} [type] - Stream kind (`video`, `audio`, `subtitle`).
 * @property {string} [codec] - Short codec name.
 * @property {number} [width] - Video width in pixels.
 * @property {number} [height] - Video height in pixels.
 * @property {string} [frameRate] - Frame rate string.
 * @property {string} [pixelFormat] - Pixel format.
 * @property {number} [channels] - Audio channel count.
 * @property {string} [channelLayout] - Audio channel layout.
 * @property {number} [sampleRate] - Audio sample rate in Hz.
 * @property {string} [title] - Stream title.
 * @property {string} [language] - Stream language tag.
 */
export interface McpUiStream {
  index?: number;
  type?: string;
  codec?: string;
  width?: number;
  height?: number;
  frameRate?: string;
  pixelFormat?: string;
  channels?: number;
  channelLayout?: string;
  sampleRate?: number;
  title?: string;
  language?: string;
}

/**
 * Container and per-stream metadata shown by the media-info view.
 * @interface McpUiMediaInfo
 * @property {string} [file] - Absolute path of the probed file.
 * @property {string} [format] - Container format name.
 * @property {string} [formatLong] - Long container description.
 * @property {number} [duration] - Duration in seconds.
 * @property {number} [size] - File size in bytes.
 * @property {string | number} [bitrate] - Overall bitrate.
 * @property {McpUiStream[]} [streams] - Streams of the container.
 */
export interface McpUiMediaInfo {
  file?: string;
  format?: string;
  formatLong?: string;
  duration?: number;
  size?: number;
  bitrate?: string | number;
  streams?: McpUiStream[];
}

/**
 * One finding of a media diagnosis.
 * @interface McpUiFinding
 * @property {string} [severity] - `info`, `warning` or `error`.
 * @property {string} [message] - Human-readable description.
 */
export interface McpUiFinding {
  severity?: 'info' | 'warning' | 'error' | string;
  message?: string;
}

/**
 * A plain-language media diagnosis shown by the inspector view.
 * @interface McpUiAnalysis
 * @property {string} [file] - Absolute path of the analysed file.
 * @property {string} [summary] - One-sentence summary.
 * @property {Record<string, unknown>} [facts] - Structured facts.
 * @property {McpUiFinding[]} [findings] - Findings ordered by severity.
 * @property {string[]} [recommendations] - Suggested next steps.
 */
export interface McpUiAnalysis {
  file?: string;
  summary?: string;
  facts?: Record<string, unknown>;
  findings?: McpUiFinding[];
  recommendations?: string[];
}

/**
 * A recommended conversion plan shown by the plan view.
 * @interface McpUiPlan
 * @property {string} [providerId] - Provider that produced the plan.
 * @property {string} [profileId] - Profile the plan maps to.
 * @property {number} [confidence] - Confidence between 0 and 1.
 * @property {string[]} [rationale] - Why the plan recommends these settings.
 * @property {Record<string, unknown>} [args] - The recommended settings.
 */
export interface McpUiPlan {
  providerId?: string;
  profileId?: string;
  confidence?: number;
  rationale?: string[];
  args?: Record<string, unknown>;
}

/**
 * An output-size estimate shown by the plan view.
 * @interface McpUiEstimate
 * @property {string} [method] - Estimation method.
 * @property {number} [estimatedSizeBytes] - Estimated output size.
 * @property {number} [estimatedDurationSeconds] - Estimated output duration.
 * @property {number} [videoBitrateKbps] - Estimated video bitrate.
 * @property {number} [audioBitrateKbps] - Estimated audio bitrate.
 * @property {boolean} [copy] - True when the streams are copied as-is.
 * @property {{available?: boolean; methods?: string[]}} [hardwareAcceleration] - Hardware acceleration support.
 * @property {string[]} [notes] - Assumptions behind the estimate.
 */
export interface McpUiEstimate {
  method?: string;
  estimatedSizeBytes?: number;
  estimatedDurationSeconds?: number;
  videoBitrateKbps?: number;
  audioBitrateKbps?: number;
  copy?: boolean;
  hardwareAcceleration?: { available?: boolean; methods?: string[] };
  notes?: string[];
}

/**
 * One measured attempt of the size-target compression loop.
 * @interface McpUiLabAttempt
 * @property {string} [candidate] - Candidate id.
 * @property {number} [videoBitrateKbps] - Requested video bitrate.
 * @property {number} [audioBitrateKbps] - Requested audio bitrate.
 * @property {number} [sizeBytes] - Measured output size.
 * @property {string} [output] - Output path.
 * @property {string} [status] - Attempt outcome.
 * @property {boolean} [fits] - True when the attempt met the size ceiling.
 */
export interface McpUiLabAttempt {
  candidate?: string;
  videoBitrateKbps?: number;
  audioBitrateKbps?: number;
  sizeBytes?: number;
  output?: string;
  status?: string;
  fits?: boolean;
}

/**
 * The measured size-target compression result shown by the lab view.
 * @interface McpUiLab
 * @property {string} [input] - Source path.
 * @property {number} [maxBytes] - Requested size ceiling.
 * @property {string} [videoCodec] - Video codec used.
 * @property {string} [audioCodec] - Audio codec used.
 * @property {boolean} [converged] - True when a candidate met the ceiling.
 * @property {McpUiLabAttempt} [chosen] - The winning attempt.
 * @property {McpUiLabAttempt[]} [attempts] - Every attempt, in order.
 * @property {{baselineVideoKbps?: number; audioBitrateKbps?: number; candidates?: Array<{videoBitrateKbps?: number; percentOfBaseline?: number; rationale?: string}>; notes?: string[]}} [plan] - The candidate ladder.
 */
export interface McpUiLab {
  input?: string;
  maxBytes?: number;
  videoCodec?: string;
  audioCodec?: string;
  converged?: boolean;
  chosen?: McpUiLabAttempt;
  attempts?: McpUiLabAttempt[];
  plan?: {
    baselineVideoKbps?: number;
    audioBitrateKbps?: number;
    candidates?: Array<{ videoBitrateKbps?: number; percentOfBaseline?: number; rationale?: string }>;
    notes?: string[];
  };
}

/**
 * A fix the error view can apply on the user's behalf.
 * @interface McpUiErrorFix
 * @property {string} label - Short fix name.
 * @property {string} [description] - What the fix does.
 * @property {string} [kind] - `retry` for a retry, anything else for a fix.
 * @property {string} [tool] - Tool to call when the fix is applied.
 * @property {Record<string, unknown>} [args] - Arguments for that tool.
 */
export interface McpUiErrorFix {
  label?: string;
  description?: string;
  kind?: string;
  tool?: string;
  args?: Record<string, unknown>;
}

/**
 * A plain-language error explanation shown by the error view.
 * @interface McpUiErrorExplanation
 * @property {string} [code] - Stable error code.
 * @property {string} [title] - Short heading.
 * @property {string} [explanation] - What went wrong.
 * @property {string} [detail] - Raw detail.
 * @property {string[]} [causes] - Likely causes.
 * @property {McpUiErrorFix[]} [fixes] - Suggested fixes.
 */
export interface McpUiErrorExplanation {
  code?: string;
  title?: string;
  explanation?: string;
  detail?: string;
  causes?: string[];
  fixes?: McpUiErrorFix[];
}

/**
 * One step of a workflow plan.
 * @interface McpUiWorkflowStep
 * @property {string} id - Step id.
 * @property {string} tool - Tool the step calls.
 * @property {number} [order] - Execution order.
 * @property {string[]} [dependsOn] - Ids of the steps this one depends on.
 */
export interface McpUiWorkflowStep {
  id?: string;
  tool?: string;
  order?: number;
  dependsOn?: string[];
}

/**
 * A workflow dry-run shown by the workflow view.
 * @interface McpUiWorkflowPlan
 * @property {string} [summary] - One-line description of the plan.
 * @property {boolean} [valid] - True when the plan can run.
 * @property {McpUiWorkflowStep[]} [steps] - Ordered steps.
 * @property {Array<{message?: string}>} [issues] - Why the plan is invalid.
 */
export interface McpUiWorkflowPlan {
  summary?: string;
  valid?: boolean;
  steps?: McpUiWorkflowStep[];
  issues?: Array<{ message?: string }>;
}

/**
 * The result of a workflow run shown by the workflow view.
 * @interface McpUiWorkflowResult
 * @property {number} [completed] - Number of completed steps.
 * @property {number} [failed] - Number of failed steps.
 * @property {Array<{id?: string; tool?: string; jobId?: string; output?: string; status?: string}>} [steps] - Per-step outcome.
 */
export interface McpUiWorkflowResult {
  completed?: number;
  failed?: number;
  steps?: Array<{ id?: string; tool?: string; jobId?: string; output?: string; status?: string }>;
}

/**
 * One entry of the batch dashboard.
 * @interface McpUiBatchEntry
 * @property {string} [id] - Job id.
 * @property {string} [jobId] - Job id (alias used by the batch tool).
 * @property {string} [input] - Source path.
 * @property {string} [output] - Destination path.
 * @property {string} [file] - Source path (alias used by the batch tool).
 * @property {string} [status] - Lifecycle status.
 * @property {number} [progress] - Completion percentage.
 */
export interface McpUiBatchEntry {
  id?: string;
  jobId?: string;
  input?: string;
  output?: string;
  file?: string;
  status?: string;
  progress?: number;
}

/**
 * A built-in conversion profile shown by the profiles view.
 * @interface McpUiProfile
 * @property {string} id - Profile id.
 * @property {string} name - Display name.
 * @property {string} [category] - Profile category.
 * @property {string} [container] - Output container.
 * @property {string} [videoCodec] - Video codec.
 * @property {string} [audioCodec] - Audio codec.
 * @property {string} [preset] - Encoder preset.
 */
export interface McpUiProfile {
  id?: string;
  name?: string;
  category?: string;
  container?: string;
  videoCodec?: string;
  audioCodec?: string;
  preset?: string;
}

/**
 * The encoder capabilities shown by the capabilities view.
 * @interface McpUiCapabilities
 * @property {string[]} [videoEncoders] - Available video encoders.
 * @property {string[]} [audioEncoders] - Available audio encoders.
 * @property {string[]} [hwaccels] - Available hardware accelerations.
 */
export interface McpUiCapabilities {
  videoEncoders?: string[];
  audioEncoders?: string[];
  hwaccels?: string[];
}

/**
 * Structured content delivered to the confirm view for a pending operation.
 * @interface McpUiConfirmationPayload
 * @property {McpUiConfirmation} confirmation - The pending confirmation.
 */
export interface McpUiConfirmationPayload {
  confirmation: McpUiConfirmation;
}

/**
 * Client capability payload advertised by MCP Apps hosts under
 * {@link MCP_UI_EXTENSION_ID}; presence of the MIME type signals support.
 * @interface McpUiClientCapabilities
 * @property {string[]} [mimeTypes] - Supported UI resource MIME types.
 */
export interface McpUiClientCapabilities {
  mimeTypes?: string[];
}

/**
 * The operation a Copilot plan performs. `convert` and the queue-backed
 * operations produce Batch Queue jobs; `analyze` and the media-intelligence
 * operations (`transcribe`, `summarize`, `chapters`, `search_transcript`,
 * `translate`, `find_similar`) are read-only and produce results instead.
 *
 * The queue-backed set mirrors `BATCH_OPERATIONS` plus the audio-extract and
 * cut operations the individual pages expose.
 * @typedef {('convert'|'remux'|'demux'|'extract_audio'|'compress_image'|'cut'|'analyze'|'transcribe'|'summarize'|'chapters'|'search_transcript'|'translate'|'find_similar')} CopilotOperation
 */
export type CopilotOperation =
  | 'convert'
  | 'remux'
  | 'demux'
  | 'extract_audio'
  | 'compress_image'
  | 'cut'
  | 'analyze'
  | 'transcribe'
  | 'summarize'
  | 'chapters'
  | 'search_transcript'
  | 'translate'
  | 'find_similar';

/**
 * The operation selector value: a concrete operation, or `auto` to let the goal
 * text (and any configured AI provider) choose.
 * @typedef {('auto'|CopilotOperation)} CopilotOperationChoice
 */
export type CopilotOperationChoice = 'auto' | CopilotOperation;

/**
 * A Copilot planning request issued by the renderer.
 * @interface CopilotPlanRequest
 * @property {string} goal - The natural-language goal shared by every file.
 * @property {string[]} inputs - Files and/or folders to plan against.
 * @property {CopilotOperationChoice} [operation] - Force an operation, or `auto`.
 * @property {boolean} [recursive] - Descend into subfolders (default false).
 * @property {number} [maxFiles] - Upper bound on planned actions (default 50).
 * @property {number} [minSavings] - Minimum estimated size reduction to keep.
 * @property {string} [query] - Passage to find for `search_transcript`.
 * @property {string} [targetLanguage] - Target language for `translate`.
 */
export interface CopilotPlanRequest {
  goal: string;
  inputs: string[];
  operation?: CopilotOperationChoice;
  recursive?: boolean;
  maxFiles?: number;
  minSavings?: number;
  query?: string;
  targetLanguage?: string;
}

/**
 * A planned conversion action, carrying the ready-to-enqueue options.
 * @interface CopilotAction
 * @augments AgentAction
 * @property {CopilotOperation} operation - The operation this action performs.
 * @property {ConversionOptions} options - Options for the Batch Queue.
 */
export interface CopilotAction extends AgentAction {
  operation: CopilotOperation;
  options: ConversionOptions;
}

/**
 * A read-only finding produced by an `analyze`-style operation. It is rendered
 * for review and is never enqueued.
 * @interface CopilotResult
 * @property {CopilotOperation} operation - The operation that produced it.
 * @property {string} input - Source file the result describes.
 * @property {string} [title] - Short heading for the result.
 * @property {string} [summary] - One-line human summary.
 * @property {unknown} [content] - Structured payload (analysis, facts, ...).
 */
export interface CopilotResult {
  operation: CopilotOperation;
  input: string;
  title?: string;
  summary?: string;
  content?: unknown;
}

/**
 * The plan the Copilot panel renders: the agent's actions, skips and rationale,
 * plus the dry-run of the workflow the actions form.
 * @interface CopilotPlan
 * @property {string} goal - The goal the plan was built for.
 * @property {CopilotOperation | null} operation - The routed operation, if any.
 * @property {CopilotAction[]} actions - Planned conversions, in file order.
 * @property {CopilotResult[]} results - Read-only findings (analyze operations).
 * @property {AgentSkip[]} skips - Files left out, with reasons.
 * @property {string[]} rationale - Plan-level reasons, one per line.
 * @property {string[]} notes - Caveats for the caller.
 * @property {string} [routingWarning] - Set when a configured AI provider could
 *   not choose the operation and the offline rules engine was used instead.
 * @property {WorkflowPlan} plan - The dry-run validation of the workflow.
 * @property {AIProviderId} providerId - The provider that chose the operation.
 * @property {true} isEstimated - The plan is a proposal, not a measurement.
 * @property {McpViewAttachment[]} [views] - MCP App views the transcript renders
 *   inline (the same components an external MCP Apps host renders).
 */
export interface CopilotPlan {
  goal: string;
  operation: CopilotOperation | null;
  actions: CopilotAction[];
  results: CopilotResult[];
  skips: AgentSkip[];
  rationale: string[];
  notes: string[];
  routingWarning?: string;
  plan: WorkflowPlan;
  providerId: AIProviderId;
  isEstimated: true;
  views?: McpViewAttachment[];
}

/**
 * Severity of a remux compatibility warning, mirroring toast/preload icon tiers.
 * @typedef {'info'|'warning'|'error'} RemuxWarningIcon
 */
export type RemuxWarningIcon = 'info' | 'warning' | 'error';

/**
 * A non-blocking compatibility finding surfaced by {@link remuxWarnings} for the
 * GUI, CLI, and MCP. Hard incompatibilities are reported with icon 'error';
 * conversions/workarounds with 'warning'; informational notes with 'info'.
 * `stream` is null for asset-level (cover/chapters/added subtitle) findings.
 * @interface RemuxWarning
 * @property {RemuxWarningIcon} icon - Severity tier.
 * @property {string} message - Human-readable finding (English; UI localizes via `code`).
 * @property {MediaStreamInfo|null} stream - The affected source stream, if any.
 * @property {string} [code] - Stable finding key for localization.
 */
export interface RemuxWarning {
  icon: RemuxWarningIcon;
  message: string;
  stream: MediaStreamInfo | null;
  code?: string;
}

/**
 * Optional per-kind conversion targets for demux. Any kind left unset is
 * extracted losslessly (stream copy) into the extension suggested by
 * {@link suggestedExtensionForStream}. Values are FFmpeg-native: a container
 * extension for video (`videoContainer`, e.g. 'mp4'), an encoder name for audio
 * (`audioCodec`, e.g. 'mp3'/'aac'/'flac'), and an encoder/format name for
 * subtitles (`subtitleCodec`, e.g. 'srt'/'ass').
 * @interface DemuxMediaPreferences
 * @property {string} [videoContainer] - Re-encode video into this container
 *   (extension) when it differs from the stream's native format; forces copy:false.
 * @property {string} [audioCodec] - Audio encoder to convert to (e.g. 'mp3').
 * @property {string} [subtitleCodec] - Subtitle format to convert to (e.g. 'srt').
 * @property {string[]} [videoFilters] - Ordered FFmpeg video filter expressions.
 *   Only meaningful for a video target that re-encodes (`videoContainer` set and
 *   differing from the stream's native format); a stream-copied video target
 *   ignores them and {@link demuxWarnings} reports `filtersIgnoredCopy`.
 */
export interface DemuxMediaPreferences {
  videoContainer?: string;
  audioCodec?: string;
  subtitleCodec?: string;
  videoFilters?: string[];
}

/**
 * A single demux extraction unit: which source stream, how it is mapped, whether
 * it is stream-copied or re-encoded, and where the output goes.
 * @interface DemuxTarget
 * @property {number} index - Source stream index (ffprobe global index, input 0).
 * @property {'video'|'audio'|'subtitle'} kind - Stream kind.
 * @property {string} map - Single `-map` spec targeting this stream (e.g. '0:v:1').
 * @property {boolean} copy - True = `-c copy`; false = re-encode with `codec`.
 * @property {string} [codec] - Re-encode target encoder when `copy` is false.
 * @property {string} [container] - Output container extension for re-encoded video.
 * @property {string[]} [videoFilters] - Video filter chain carried onto this
 *   target; set only for a re-encoded video target (absent for stream copies).
 * @property {string} output - Absolute output path (baseName + kind_index + ext).
 */
export interface DemuxTarget {
  index: number;
  kind: 'video' | 'audio' | 'subtitle';
  map: string;
  copy: boolean;
  codec?: string;
  container?: string;
  videoFilters?: string[];
  output: string;
}

/**
 * Parameter descriptor for a curated filter preset.
 * @interface VideoFilterParam
 * @property {string} key - Stable key used in FilterParamValues.
 * @property {string} labelKey - i18n key for the field label.
 * @property {'number'|'text'|'select'} type - Input kind rendered by the GUI.
 * @property {number|string} [default] - Value used when the caller omits the key.
 * @property {number} [min] - Minimum value for `number` inputs.
 * @property {number} [max] - Maximum value for `number` inputs.
 * @property {number} [step] - Step for `number` inputs (defaults to 0.01).
 * @property {{value: string; labelKey: string}[]} [options] - Choices for `select` inputs.
 * @property {boolean} [optional] - Omitted from the emitted filter when unset.
 */
export interface VideoFilterParam {
  key: string;
  labelKey: string;
  type: 'number' | 'text' | 'select';
  default?: number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; labelKey: string }[];
  optional?: boolean;
}

/**
 * Values supplied by a caller for a preset's parameters.
 * @typedef {Record<string, number | string | undefined>} FilterParamValues
 */
export type FilterParamValues = Record<string, number | string | undefined>;

/**
 * A curated filter preset.
 * @interface VideoFilterDef
 * @property {string} id - Stable id used by the GUI/CLI/MCP (e.g. 'crop').
 * @property {string} ffmpegName - Base FFmpeg filter name (e.g. 'crop').
 * @property {VideoFilterParam[]} params - Ordered parameters with defaults.
 * @property {(values: FilterParamValues) => string} build - Produces the full
 *   filter expression (e.g. 'crop=in_w/2:in_h/2').
 * @property {string} labelKey - i18n key for the preset display name.
 * @property {string} hintKey - i18n key for the preset tooltip/description.
 */
export interface VideoFilterDef {
  id: string;
  ffmpegName: string;
  params: VideoFilterParam[];
  build: (values: FilterParamValues) => string;
  labelKey: string;
  hintKey: string;
}

/**
 * Subset of conversion progress surfaced to task-oriented UI (audio
 * extraction, media-task hooks). Shares a name with the structurally-identical
 * `TaskProgress` type in the stores/state layer; keep both in sync.
 * @typedef {Pick<ConversionProgress, 'percent'|'time'|'speed'|'eta'>} TaskProgress
 */
export type TaskProgress = Pick<ConversionProgress, 'percent' | 'time' | 'speed' | 'eta'>;

/**
 * One audit record for a mutating operation.
 * @interface AuditEntry
 * @property {string} id - Stable unique id (timestamp + digest).
 * @property {string} timestamp - ISO-8601 UTC timestamp.
 * @property {string} tool - The mutating tool that ran.
 * @property {number} tier - Safety tier (2 = write, 3 = destructive).
 * @property {string} argsDigest - Short stable digest of the arguments.
 * @property {'ok' | 'error'} result - Whether the operation was accepted.
 * @property {string} [detail] - Error summary when `result` is 'error'.
 */
export interface AuditEntry {
  id: string;
  timestamp: string;
  tool: string;
  tier: number;
  argsDigest: string;
  result: 'ok' | 'error';
  detail?: string;
}

/**
 * Input the user composes for a remux: container + `-map` stream selection +
 * added assets. Maps and assets reference input indices exactly as documented
 * on `ConversionOptions` (primary = 0, additionalInputs = 1..N, chapters = N+1).
 *
 * @interface RemuxPlanInput
 * @property {string} input - Absolute path of the source file.
 * @property {string} container - Target container extension (e.g. 'mkv').
 * @property {string[]} [maps] - `-map` specs selecting streams for the output.
 * @property {RemuxInput[]} [additionalInputs] - Added subtitles/audio/cover
 *   entries as extra inputs.
 * @property {string} [chaptersFile] - FFMETADATA chapters file to import.
 * @property {boolean} [copyChapters] - Preserve source chapters via
 *   `-map_chapters 0`. Defaults to true.
 * @property {number} [audioSyncSeconds] - Signed seconds to shift the primary's
 *   audio relative to video via the "re-read" trick (positive = audio plays
 *   LATER). Absent = no adjustment.
 * @property {string[]} [videoFilters] - Ordered FFmpeg video filter
 *   expressions. Filters require re-encoding, so a non-empty chain flips
 *   `copy` to false and the whole plan runs as a re-encode.
 */
export interface RemuxPlanInput {
  input: string;
  container: string;
  maps?: string[];
  additionalInputs?: RemuxInput[];
  chaptersFile?: string;
  copyChapters?: boolean;
  audioSyncSeconds?: number;
  videoFilters?: string[];
}

/**
 * Result of {@link buildRemuxPlanOptions}.
 * @interface RemuxPlan
 * @property {ConversionOptions} options - Ready-to-run conversion options.
 * @property {string} output - Derived output path (same dir as input).
 */
export interface RemuxPlan {
  options: ConversionOptions;
  output: string;
}

/**
 * Renderer-visible MCP server settings.
 * @interface McpSettings
 * @property {boolean} enabled - True starts the loopback server at startup.
 * @property {number} port - TCP port to bind on 127.0.0.1.
 * @property {string} token - Optional bearer token clients must send.
 */
export interface McpSettings {
  enabled: boolean;
  port: number;
  token: string;
}

/**
 * A single terms section: a heading plus the paragraphs rendered beneath it.
 * @interface TermsSection
 * @property {string} title - Section heading.
 * @property {string[]} body - Paragraphs in this section.
 */
export interface TermsSection {
  title: string;
  body: string[];
}

/**
 * Severity label of a log record handed to the registered sink. Mirrors the
 * {@link LogLevel} enum as serializable strings suitable for process
 * boundaries and backend severity scales.
 * @typedef {('debug' | 'info' | 'warn' | 'error')} LoggerLogLevel
 */
export type LoggerLogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Consumer of log records for external reporting. Installed by the monitoring
 * facade at module load; the Logger itself stays dependency-free. Receives
 * every record regardless of the configured minimum console level so telemetry
 * verbosity stays independent of console verbosity.
 * @param {LoggerLogLevel} level - Severity label of the record.
 * @param {string} context - The logging subsystem label ('main/index', ...).
 * @param {unknown[]} args - Raw arguments passed to the Logger method.
 */
export type LoggerRecordSink = (level: LoggerLogLevel, context: string, args: unknown[]) => void;
