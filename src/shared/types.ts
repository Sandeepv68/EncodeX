/**
 * @fileoverview Type definitions and interfaces for media conversion, playback, and queuing operations.
 * Defines all core data structures used throughout the EncodeX application, spanning
 * errors, codec/container compatibility, conversion options, probed media information,
 * image analysis results, queue jobs, player frames/audio, waveform and thumbnail data,
 * log entries, and encoder capabilities. These types are shared by the main, preload,
 * and renderer processes.
 */

import { QUEUE_STATUS, FALLBACK_VALUES } from './media-options';
import { ErrorCode } from './errors';
import { TRANSCODER_TYPES } from './transcoder-constants';
import { HWACCEL_MODES, ENCODER_TYPES } from './hwaccel-settings';

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
 * @property {string} [pixelFormat] - Output pixel format (e.g. 'yuv420p').
 * @property {string} [startTime] - Trim start time (seconds or HH:MM:SS).
 * @property {string} [endTime] - Trim end time (seconds or HH:MM:SS).
 * @property {string} [duration] - Maximum output duration.
 * @property {boolean} [copy] - Whether to stream-copy the original streams instead of re-encoding.
 * @property {boolean} [audio] - Whether the output includes an audio stream.
 * @property {boolean} [video] - Whether the output includes a video stream.
 * @property {boolean} [hardwareAcceleration] - Whether hardware acceleration is enabled.
 * @property {HwAccelMode} [hwaccelMode] - Hardware acceleration mode to use.
 */
export interface ConversionOptions {
  videoCodec?: string;
  audioCodec?: string;
  videoBitrate?: string;
  audioBitrate?: string;
  qscale?: number;
  scale?: string;
  keepAspectRatio?: boolean;
  pixelFormat?: string;
  startTime?: string;
  endTime?: string;
  duration?: string;
  copy?: boolean;
  audio?: boolean;
  video?: boolean;
  hardwareAcceleration?: boolean;
  hwaccelMode?: HwAccelMode;
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
