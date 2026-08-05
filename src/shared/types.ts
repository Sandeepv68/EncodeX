/**
 * @fileoverview Type definitions and interfaces for media conversion, playback, and queuing operations.
 * Defines all core data structures used throughout the EncodeX application.
 */

import { QUEUE_STATUS, FALLBACK_VALUES } from './media-options';
import { ErrorCode } from './errors';
import { TRANSCODER_TYPES } from './transcoder-constants';
import { HWACCEL_MODES, ENCODER_TYPES } from './hwaccel-settings';

/**
 * Hardware acceleration mode type.
 * @typedef {string} HwAccelMode
 */
export type HwAccelMode = (typeof HWACCEL_MODES)[number];

/**
 * Encoder type selection.
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
 */
export interface CodecContainerInfo {
  extension: string;
  containers: string[];
}

/**
 * Options for media conversion and encoding operations.
 * @interface ConversionOptions
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
  hardwareAcceleration?: boolean;
  hwaccelMode?: HwAccelMode;
}

/**
 * Information about a media stream (audio, video, or subtitle).
 * @interface MediaStreamInfo
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
 */
export interface ImageExifData {
  file: string;
  exif: Record<string, string>;
  histogram: ImageHistogram | null;
}

/**
 * Basic information about an image file (dimensions and size).
 * @interface ImageFileInfo
 */
export interface ImageFileInfo {
  width: number | null;
  height: number | null;
  size: number;
}

/**
 * A media conversion job in the conversion queue.
 * @interface QueueJob
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
  createdAt: number;
}

/**
 * Real-time progress information during media conversion.
 * @interface ConversionProgress
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
 */
export interface PlayerAudioChunk {
  data: ArrayBuffer;
  sampleRate: number;
  channels: number;
  generation: number;
}

/**
 * Waveform visualization data for audio or audio track.
 * @interface WaveformData
 */
export interface WaveformData {
  sampleRate: number;
  samplesPerBucket: number;
  buckets: Array<{ min: number; max: number }>;
}

/**
 * A grid of video thumbnail frames for timeline preview.
 * @interface ThumbnailStrip
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
 * @enum ConversionOperation
 */
export enum ConversionOperation {
  Transcode = 'transcode',
  ExtractAudio = 'extract_audio',
  CompressImage = 'compress_image',
  CreateGif = 'create_gif',
  CutVideo = 'cut_video',
}

export interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  text: string;
  source: 'main' | 'renderer';
}

export interface FileItem {
  path: string;
  name: string;
  size: number;
  operation: ConversionOperation;
}

export interface EncoderCapabilities {
  videoEncoders: string[];
  audioEncoders: string[];
  hwaccels: string[];
}
