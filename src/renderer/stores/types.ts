/**
 * @fileoverview Type definitions for Zustand stores.
 * Defines the state shapes for all renderer stores.
 */

import type {
  AppError,
  ConversionProgress,
  EncoderType,
  ErrorCodeType,
  HwAccelMode,
  LogEntry,
  MediaStreamInfo,
  QueueJob,
} from '../../shared/types';

/**
 * Persisted hardware acceleration settings.
 * @interface HwAccelStored
 */
export interface HwAccelStored {
  hardwareAcceleration: boolean;
  hwaccelMode: HwAccelMode;
  encoderType: EncoderType;
}

/**
 * State of the settings store.
 * @interface SettingsState
 */
export interface SettingsState {
  transcoder: string;
  setTranscoder: (t: string) => void;
  hardwareAcceleration: boolean;
  hwaccelMode: HwAccelMode;
  encoderType: EncoderType;
  setHardwareAcceleration: (enabled: boolean) => void;
  setHwaccelMode: (mode: HwAccelMode) => void;
  setEncoderType: (type: EncoderType) => void;
  alwaysOnTop: boolean;
  setAlwaysOnTop: (flag: boolean) => void;
}

/**
 * Toast notification type.
 * @typedef {string} ToastType
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * A toast notification message.
 * @interface Toast
 */
export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  detail?: string;
  duration?: number;
}

/**
 * State of the toast store.
 * @interface ToastState
 */
export interface ToastState {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, detail?: string, duration?: number) => void;
  removeToast: (id: string) => void;
  success: (message: string, detail?: string, duration?: number) => void;
  error: (message: string, detail?: string, duration?: number) => void;
  warning: (message: string, detail?: string, duration?: number) => void;
  info: (message: string, detail?: string, duration?: number) => void;
}

/**
 * State of the conversion queue store.
 * @interface QueueState
 */
export interface QueueState {
  jobs: QueueJob[];
  setJobs: (jobs: QueueJob[]) => void;
  addJob: (job: QueueJob) => void;
  removeJob: (id: string) => void;
  updateJob: (job: QueueJob) => void;
  clearJobs: () => void;
}

/**
 * State of the application log store.
 * @interface LogState
 */
export interface LogState {
  entries: LogEntry[];
  addEntry: (entry: LogEntry) => void;
  clear: () => void;
}

/**
 * Conversion progress subset tracked by the conversion store.
 * @interface ProgressData
 */
export interface ProgressData {
  percent: number;
  time: string;
  speed: string;
  eta: string;
}

/**
 * State of the conversion form store.
 * @interface ConversionState
 */
export interface ConversionState {
  inputFile: string | null;
  outputFile: string | null;
  outputUserSet: boolean;
  videoCodec: string;
  audioCodec: string;
  videoBitrate: string;
  audioBitrate: string;
  qscale: number;
  scale: string;
  pixelFormat: string;
  copyMode: boolean;
  transcoder: string;
  encoderType: EncoderType;
  isConverting: boolean;
  isPaused: boolean;
  isDirty: boolean;
  progress: ProgressData | null;
  setInputFile: (file: string | null) => void;
  setOutputFile: (file: string | null) => void;
  setOutputAuto: (file: string | null) => void;
  setVideoCodec: (codec: string) => void;
  setAudioCodec: (codec: string) => void;
  setVideoBitrate: (bitrate: string) => void;
  setAudioBitrate: (bitrate: string) => void;
  setQscale: (q: number) => void;
  setScale: (s: string) => void;
  setPixelFormat: (f: string) => void;
  setCopyMode: (c: boolean) => void;
  setTranscoder: (t: string) => void;
  setEncoderType: (type: EncoderType) => void;
  setIsConverting: (v: boolean) => void;
  setIsPaused: (v: boolean) => void;
  setProgress: (p: ProgressData | null) => void;
  resetForm: () => void;
}

/**
 * State of the application error store.
 * @interface ErrorState
 */
export interface ErrorState {
  currentError: AppError | null;
  errorHistory: AppError[];
  showError: (err: unknown) => void;
  showErrorMessage: (code: ErrorCodeType, detail?: string) => void;
  clearError: () => void;
  clearHistory: () => void;
}

/**
 * Subset of conversion progress surfaced to audio extraction tasks.
 * @typedef {Pick<ConversionProgress, 'percent'|'time'|'speed'|'eta'>} TaskProgress
 */
export type TaskProgress = Pick<ConversionProgress, 'percent' | 'time' | 'speed' | 'eta'>;

/**
 * State of the audio extraction store.
 * @interface AudioExtractState
 */
export interface AudioExtractState {
  input: string;
  preview: string | null;
  audioStreams: MediaStreamInfo[];
  output: string;
  audioCodec: string;
  audioBitrate: string;
  isConverting: boolean;
  isPaused: boolean;
  progress: TaskProgress | null;
  setInput: (file: string) => void;
  setPreview: (preview: string | null) => void;
  setAudioStreams: (streams: MediaStreamInfo[]) => void;
  setOutput: (output: string) => void;
  setAudioCodec: (codec: string) => void;
  setAudioBitrate: (bitrate: string) => void;
  setIsPaused: (v: boolean) => void;
  setProgress: (p: TaskProgress | null) => void;
  clearSelection: () => void;
  startExtract: () => Promise<void>;
  pauseExtract: () => Promise<void>;
  resumeExtract: () => Promise<void>;
  cancelExtract: () => Promise<void>;
}
