import { QUEUE_STATUS, FALLBACK_VALUES } from './media-options';
import { TRANSCODER_TYPES, TranscoderType } from './transcoder-constants';
import { HwAccelMode } from './hwaccel-settings';

export type { TranscoderType };
export type { HwAccelMode };

export interface ConversionOptions {
  videoCodec?: string;
  audioCodec?: string;
  videoBitrate?: string;
  audioBitrate?: string;
  qscale?: number;
  scale?: string;
  pixelFormat?: string;
  startTime?: string;
  endTime?: string;
  duration?: string;
  copy?: boolean;
  hardwareAcceleration?: boolean;
  hwaccelMode?: HwAccelMode;
}

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

export interface ImageHistogram {
  r: number[];
  g: number[];
  b: number[];
  luma: number[];
}

export interface ImageExifData {
  file: string;
  exif: Record<string, string>;
  histogram: ImageHistogram | null;
}

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

export interface ConversionProgress {
  percent: number;
  time: string;
  fps: number;
  speed: string;
  eta: string;
  bitrate: string;
}

export interface PlayerFrame {
  data: ArrayBuffer;
  width: number;
  height: number;
  pts: number;
}

export interface PlayerAudioChunk {
  data: ArrayBuffer;
  sampleRate: number;
  channels: number;
}

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
