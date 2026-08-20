/**
 * @fileoverview Type definitions for the renderer Zustand stores.
 * Declares the full state shapes (fields plus action signatures) consumed by
 * the settings, toast, queue, log, conversion, error, and audio-extraction
 * stores. The concrete store instances are created in the sibling store files
 * (settingsStore.ts, toastStore.ts, queueStore.ts, logStore.ts,
 * conversionStore.ts, errorStore.ts, audioExtractStore.ts) and are shared by
 * the React UI components in the renderer process.
 *
 * Exports:
 *  - HwAccelStored()      - persisted hardware acceleration snapshot
 *  - SettingsState()      - settings store state + actions
 *  - ToastType            - union of toast severities
 *  - Toast()              - a single toast notification
 *  - ToastState()         - toast store state + actions
 *  - DismissedAlertsState() - dismissed alert banner state + actions
 *  - QueueState()         - conversion queue store state + actions
 *  - LogState()           - log store state + actions
 *  - ProgressData()       - progress subset tracked during conversion
 *  - ConversionState()    - conversion form store state + actions
 *  - ErrorState()         - error store state + actions
 *  - TaskProgress         - progress subset surfaced for audio extraction
 *  - AudioExtractState()  - audio extraction store state + actions
 *  - VideoCutState()      - video cut form draft store state + actions
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
  ThumbnailStrip,
  WaveformData,
  WhenDoneConfig,
} from '../../shared/types';

/**
 * Persisted hardware acceleration settings.
 * Stored as JSON in localStorage under HWACCEL_STORAGE_KEY ('encodex-hwaccel')
 * and read back on startup by the settings store. Each field is validated
 * against the known option lists during reads; invalid values fall back to the
 * defaults from HWACCEL_DEFAULTS / ENCODER_TYPE_DEFAULT.
 * @interface HwAccelStored
 * @property {boolean} hardwareAcceleration - Whether hardware acceleration is enabled.
 * @property {HwAccelMode} hwaccelMode - Selected acceleration mode ('auto' or 'encode').
 * @property {EncoderType} encoderType - Encoder preference ('auto', 'hardware', or 'software').
 */
export interface HwAccelStored {
  hardwareAcceleration: boolean;
  hwaccelMode: HwAccelMode;
  encoderType: EncoderType;
}

/**
 * State of the settings store.
 * Holds the user-configurable application settings: the transcoder backend,
 * hardware acceleration preferences (persisted to localStorage), and the
 * always-on-top window flag (persisted to localStorage and forwarded to the
 * main process). Initialized from TRANSCODER_TYPES[0] ('FFMPEG') and the
 * persisted values read at module load time.
 * @interface SettingsState
 * @property {string} transcoder - Active transcoder backend identifier ('FFMPEG' | 'FFTOOL' | 'BMF').
 * @property {(t: string) => void} setTranscoder - Sets the active transcoder backend.
 * @property {boolean} hardwareAcceleration - Whether hardware acceleration is enabled.
 * @property {HwAccelMode} hwaccelMode - Hardware acceleration mode ('auto' or 'encode').
 * @property {EncoderType} encoderType - Encoder preference ('auto' | 'hardware' | 'software').
 * @property {(enabled: boolean) => void} setHardwareAcceleration - Enables/disables hardware acceleration and persists the change.
 * @property {(mode: HwAccelMode) => void} setHwaccelMode - Sets the acceleration mode and persists the change.
 * @property {(type: EncoderType) => void} setEncoderType - Sets the encoder preference and persists the change.
 * @property {boolean} alwaysOnTop - Whether the window should stay on top of other windows.
 * @property {(flag: boolean) => void} setAlwaysOnTop - Sets always-on-top and persists it via localStorage + electronAPI.
 * @property {boolean} launchAtLogin - Whether the app should launch at OS startup.
 * @property {(enabled: boolean) => void} setLaunchAtLogin - Sets launch-at-login, persists it, and forwards it to the main process.
 * @property {number} queueConcurrency - Number of batch jobs run in parallel (1-4).
 * @property {(concurrency: number) => void} setQueueConcurrency - Sets the batch concurrency, persists it, and forwards it to the main process.
 * @property {WhenDoneConfig} whenDone - When-done power action config for the batch queue (enabled, action, force).
 * @property {(config: WhenDoneConfig) => void} setWhenDone - Sets the when-done config, persists it, and forwards it to the main process.
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
  launchAtLogin: boolean;
  setLaunchAtLogin: (enabled: boolean) => void;
  queueConcurrency: number;
  setQueueConcurrency: (concurrency: number) => void;
  whenDone: WhenDoneConfig;
  setWhenDone: (config: WhenDoneConfig) => void;
}

/**
 * Toast notification type.
 * @typedef {string} ToastType
 * @property {'success'} success - Success notification.
 * @property {'error'} error - Error notification.
 * @property {'warning'} warning - Warning notification.
 * @property {'info'} info - Informational notification.
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * A toast notification message.
 * Created by the toast store with a monotonically increasing `toast-<n>` id.
 * @interface Toast
 * @property {string} id - Unique identifier (format 'toast-<counter>').
 * @property {ToastType} type - Severity/kind of the toast.
 * @property {string} message - Main toast text.
 * @property {string} [detail] - Optional secondary detail line.
 * @property {number} [duration] - Optional display duration in milliseconds; the UI falls back to a default when omitted.
 */
export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  detail?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

/**
 * State of the toast store.
 * Maintains the list of active toasts and the actions used to add (including
 * the convenience wrappers success/error/warning/info) and remove them.
 * @interface ToastState
 * @property {Toast[]} toasts - Active toasts in the order they were added.
 * @property {(type: ToastType, message: string, detail?: string, duration?: number) => void} addToast - Appends a new toast with an auto-generated id.
 * @property {(id: string) => void} removeToast - Removes the toast with the given id.
 * @property {(message: string, detail?: string, duration?: number) => void} success - Adds a 'success' toast.
 * @property {(message: string, detail?: string, duration?: number) => void} error - Adds an 'error' toast.
 * @property {(message: string, detail?: string, duration?: number) => void} warning - Adds a 'warning' toast.
 * @property {(message: string, detail?: string, duration?: number) => void} info - Adds an 'info' toast.
 */
export interface ToastState {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, detail?: string, duration?: number, action?: { label: string; onClick: () => void }) => void;
  removeToast: (id: string) => void;
  success: (message: string, detail?: string, duration?: number, action?: { label: string; onClick: () => void }) => void;
  error: (message: string, detail?: string, duration?: number, action?: { label: string; onClick: () => void }) => void;
  warning: (message: string, detail?: string, duration?: number, action?: { label: string; onClick: () => void }) => void;
  info: (message: string, detail?: string, duration?: number, action?: { label: string; onClick: () => void }) => void;
}

/**
 * State of the dismissed-alerts store.
 * Remembers which inline alert banners the user has dismissed so they do not
 * reappear on page navigation. Held in memory only (not persisted to
 * localStorage), so dismissals survive navigating between pages but are reset
 * when the app closes.
 * @interface DismissedAlertsState
 * @property {string[]} dismissed - Alert keys the user has dismissed this session.
 * @property {(key: string) => boolean} isDismissed - Whether the alert with the given key has been dismissed.
 * @property {(key: string) => void} dismiss - Marks the alert with the given key as dismissed.
 */
export interface DismissedAlertsState {
  dismissed: string[];
  isDismissed: (key: string) => boolean;
  dismiss: (key: string) => void;
}

/**
 * State of the conversion queue store.
 * Holds the ordered list of pending/completed conversion jobs (QueueJob) and
 * the actions for bulk-setting, adding, removing, updating, and clearing them.
 * Live per-job progress snapshots (ConversionProgress) are kept separately so
 * the queue list can render fps/speed/ETA without replacing job records.
 * @interface QueueState
 * @property {QueueJob[]} jobs - The list of conversion jobs in the queue.
 * @property {Record<string, ConversionProgress>} progress - Live progress
 *   snapshots keyed by job id (percent, time, fps, speed, eta, bitrate).
 * @property {(jobs: QueueJob[]) => void} setJobs - Replaces the entire job list.
 * @property {(job: QueueJob) => void} addJob - Appends a job to the end of the queue.
 * @property {(id: string) => void} removeJob - Removes the job with the given id.
 * @property {(job: QueueJob) => void} updateJob - Replaces the job matching job.id (no-op if not found).
 * @property {(id: string, data: ConversionProgress) => void} updateProgress -
 *   Stores the latest progress snapshot for the job with the given id.
 * @property {() => void} clearJobs - Removes all jobs from the queue.
 */
export interface QueueState {
  jobs: QueueJob[];
  progress: Record<string, ConversionProgress>;
  setJobs: (jobs: QueueJob[]) => void;
  addJob: (job: QueueJob) => void;
  removeJob: (id: string) => void;
  updateJob: (job: QueueJob) => void;
  updateProgress: (id: string, data: ConversionProgress) => void;
  clearJobs: () => void;
}

/**
 * State of the application log store.
 * Holds the in-memory ring of log entries shown in the log viewer. Entries are
 * capped at LOG_MAX_ENTRIES (2000); older entries are dropped when new ones are
 * appended.
 * @interface LogState
 * @property {LogEntry[]} entries - Log entries in chronological order.
 * @property {(entry: LogEntry) => void} addEntry - Appends an entry, trimming the oldest entry when at capacity.
 * @property {() => void} clear - Empties the log.
 */
export interface LogState {
  entries: LogEntry[];
  addEntry: (entry: LogEntry) => void;
  clear: () => void;
}

/**
 * Conversion progress subset tracked by the conversion store.
 * A trimmed-down view of ConversionProgress (fps and bitrate are dropped) that
 * is also the shape used by the audio extraction task progress.
 * @interface ProgressData
 * @property {number} percent - Progress percentage (0-100).
 * @property {string} time - Current output timestamp (HH:MM:SS).
 * @property {string} speed - Speed relative to realtime (e.g. '3.5x').
 * @property {string} eta - Estimated remaining time.
 */
export interface ProgressData {
  percent: number;
  time: string;
  speed: string;
  eta: string;
}

/**
 * State of the conversion form store.
 * Holds every user-editable field of the main conversion form plus the live
 * progress of the current conversion. All setter actions mark the form as
 * dirty (isDirty = true) so the UI can warn about unsaved changes. Defaults are
 * taken from CONVERSION_DEFAULTS, TRANSCODER_TYPES[0] ('FFMPEG') and
 * ENCODER_TYPE_DEFAULT ('auto').
 * @interface ConversionState
 * @property {string | null} inputFile - Absolute path of the input file, or null.
 * @property {string | null} outputFile - Absolute path of the output file, or null.
 * @property {boolean} outputUserSet - Whether the user chose the output manually (vs. auto-suggested).
 * @property {string} videoCodec - Selected video encoder (default 'libx264').
 * @property {string} audioCodec - Selected audio encoder (default 'aac').
 * @property {string} videoBitrate - Target video bitrate (default '2000k').
 * @property {string} audioBitrate - Target audio bitrate (default '192k').
 * @property {number} qscale - Video quality scale, 1 (best) to 31 (worst); default 23.
 * @property {string} scale - Output resolution WIDTHxHEIGHT (default '1920x1080').
 * @property {string} pixelFormat - Output pixel format (default 'yuv420p').
 * @property {boolean} copyMode - Whether to stream-copy streams instead of re-encoding.
 * @property {string} transcoder - Active transcoder backend ('FFMPEG' | 'FFTOOL' | 'BMF').
 * @property {EncoderType} encoderType - Encoder preference ('auto' | 'hardware' | 'software').
 * @property {boolean} isConverting - Whether a conversion is currently running.
 * @property {boolean} isPaused - Whether the current conversion is paused.
 * @property {boolean} isDirty - Whether the form differs from the initial state (unsaved edits).
 * @property {ProgressData | null} progress - Live progress of the current conversion, or null.
 * @property {(file: string | null) => void} setInputFile - Sets the input file and marks the form dirty.
 * @property {(file: string | null) => void} setOutputFile - Sets a user-chosen output file, marks outputUserSet, and marks the form dirty.
 * @property {(file: string | null) => void} setOutputAuto - Sets an auto-suggested output file and marks the form dirty (does not set outputUserSet).
 * @property {(codec: string) => void} setVideoCodec - Sets the video codec and marks the form dirty.
 * @property {(codec: string) => void} setAudioCodec - Sets the audio codec and marks the form dirty.
 * @property {(bitrate: string) => void} setVideoBitrate - Sets the video bitrate and marks the form dirty.
 * @property {(bitrate: string) => void} setAudioBitrate - Sets the audio bitrate and marks the form dirty.
 * @property {(q: number) => void} setQscale - Sets the qscale and marks the form dirty.
 * @property {(s: string) => void} setScale - Sets the output scale and marks the form dirty.
 * @property {(f: string) => void} setPixelFormat - Sets the pixel format and marks the form dirty.
 * @property {(c: boolean) => void} setCopyMode - Sets copy mode and marks the form dirty.
 * @property {(t: string) => void} setTranscoder - Sets the transcoder and marks the form dirty.
 * @property {(type: EncoderType) => void} setEncoderType - Sets the encoder type and marks the form dirty.
 * @property {(v: boolean) => void} setIsConverting - Sets the converting flag; clearing it also resets isPaused to false.
 * @property {(v: boolean) => void} setIsPaused - Sets the paused flag.
 * @property {(p: ProgressData | null) => void} setProgress - Sets the live conversion progress (or null to clear).
 * @property {() => void} resetForm - Restores all form fields and progress to their initial values.
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
 * Holds the currently displayed error and a bounded history of recent errors
 * (capped at ERROR_HISTORY_MAX, i.e. 50 entries). Errors are normalized into
 * AppError instances via formatError / createError before being stored.
 * @interface ErrorState
 * @property {AppError | null} currentError - The error currently displayed, or null when none.
 * @property {AppError[]} errorHistory - Recent errors in chronological order, oldest first, capped at ERROR_HISTORY_MAX.
 * @property {(err: unknown) => void} showError - Normalizes an unknown thrown value and sets it as currentError, pushing it onto the history.
 * @property {(code: ErrorCodeType, detail?: string) => void} showErrorMessage - Builds an AppError from a code (with canonical message) and sets it as currentError, pushing it onto the history.
 * @property {() => void} clearError - Clears the current error.
 * @property {() => void} clearHistory - Clears the entire error history.
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
 * Picks the percent/time/speed/eta fields from ConversionProgress, matching
 * ProgressData (the two shapes are structurally identical).
 * @typedef {Pick<ConversionProgress, 'percent'|'time'|'speed'|'eta'>} TaskProgress
 */
export type TaskProgress = Pick<ConversionProgress, 'percent' | 'time' | 'speed' | 'eta'>;

/**
 * State of the audio extraction store.
 * Holds the audio extraction form (input file, preview, audio streams, output)
 * and settings (codec/bitrate), plus the live state and progress of the running
 * extraction. The extraction itself is delegated to
 * window.electronAPI.convertFile with transcoder TRANSCODER_TYPES[0] ('FFMPEG').
 * @interface AudioExtractState
 * @property {string} input - Absolute path of the input media file.
 * @property {string | null} preview - Data URL of a preview frame/image, or null.
 * @property {MediaStreamInfo[]} audioStreams - Audio streams detected in the input file.
 * @property {string} output - Absolute path of the output audio file.
 * @property {string} audioCodec - Audio encoder used for extraction (default AUDIO_EXTRACT_DEFAULT_CODEC, 'libmp3lame').
 * @property {string} audioBitrate - Target audio bitrate (default BITRATE_OPTIONS[1], '192k').
 * @property {boolean} isDirty - Whether the form has been configured/edited by the user (unsaved work).
 * @property {boolean} isConverting - Whether an extraction is currently running.
 * @property {boolean} isPaused - Whether the running extraction is paused.
 * @property {TaskProgress | null} progress - Live extraction progress, or null.
 * @property {(file: string) => void} setInput - Sets the input file path.
 * @property {(preview: string | null) => void} setPreview - Sets the preview data URL (or null to clear).
 * @property {(streams: MediaStreamInfo[]) => void} setAudioStreams - Sets the detected audio streams.
 * @property {(output: string) => void} setOutput - Sets the output file path.
 * @property {(codec: string) => void} setAudioCodec - Sets the audio codec.
 * @property {(bitrate: string) => void} setAudioBitrate - Sets the audio bitrate.
 * @property {(v: boolean) => void} setIsPaused - Sets the paused flag.
 * @property {(p: TaskProgress | null) => void} setProgress - Sets the live extraction progress (or null to clear).
 * @property {() => void} clearSelection - Resets input, preview, audio streams, and output.
 * @property {() => Promise<void>} startExtract - Validates input/output, shows errors if missing, and starts the extraction via electronAPI.convertFile.
 * @property {() => Promise<void>} pauseExtract - Pauses the running extraction via electronAPI.pauseConversion.
 * @property {() => Promise<void>} resumeExtract - Resumes the extraction via electronAPI.resumeConversion.
 * @property {() => Promise<void>} cancelExtract - Cancels the extraction via electronAPI.cancelConversion and resets conversion flags.
 */
export interface AudioExtractState {
  input: string;
  preview: string | null;
  audioStreams: MediaStreamInfo[];
  output: string;
  audioCodec: string;
  audioBitrate: string;
  isDirty: boolean;
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

/**
 * State of the video cut form draft store.
 * Holds the user-editable cut form fields (source/output paths, cut window,
 * audio toggle) persisted to localStorage under VIDEO_CUT_DRAFT_STORAGE_KEY so
 * the draft survives navigating away and back. Media-derived state (playhead,
 * waveform, thumbnails) is NOT part of this store - it is re-derived on
 * remount. The only run state tracked here is `isCutting`, a boolean mirror of
 * the live cut job that drives the navigation drawer's activity blip.
 * @interface VideoCutState
 * @property {string} input - Absolute path of the selected source video, or '' when none.
 * @property {string} output - Absolute path of the output file, or '' when none.
 * @property {string} startTime - Cut start time as an `HH:MM:SS[.mmm]` string.
 * @property {string} endTime - Cut end time, or '' when using the duration mode.
 * @property {string} duration - Cut duration (used when `useDuration` is on).
 * @property {boolean} useDuration - Whether the cut window uses start + duration instead of start/end.
 * @property {boolean} includeAudio - Whether the audio stream is kept in the output.
 * @property {boolean} isCutting - Whether a cut job is currently running (mirrors the live cut task; drives the nav blip).
 * @property {TaskProgress | null} progress - Live cut progress, or null when idle.
 * @property {WaveformData | null} waveform - Cached timeline waveform, or null until extracted. Kept in memory only.
 * @property {string | null} waveformKey - Cache key (`input::duration`) the waveform belongs to, or null.
 * @property {ThumbnailStrip | null} thumbnails - Cached timeline thumbnail strip, or null until extracted. Kept in memory only.
 * @property {string | null} thumbnailsKey - Cache key (`input::duration`) the thumbnails belong to, or null.
 * @property {number | null} zoom - Cached timeline zoom level (pixels per second), or null. Kept in memory only.
 * @property {string | null} zoomKey - Cache key (`input::duration`) the zoom belongs to, or null.
 * @property {(file: string) => void} setInput - Sets the source video path and persists the draft.
 * @property {(file: string) => void} setOutput - Sets the output path and persists the draft.
 * @property {(time: string) => void} setStartTime - Sets the start time and persists the draft.
 * @property {(time: string) => void} setEndTime - Sets the end time and persists the draft.
 * @property {(duration: string) => void} setDuration - Sets the duration and persists the draft.
 * @property {(use: boolean) => void} setUseDuration - Sets the use-duration flag and persists the draft.
 * @property {(include: boolean) => void} setIncludeAudio - Sets the audio toggle and persists the draft.
 * @property {(data: WaveformData | null, key?: string | null) => void} cacheWaveform - Caches the waveform (and its key), or clears it.
 * @property {(data: ThumbnailStrip | null, key?: string | null) => void} cacheThumbnails - Caches the thumbnails (and their key), or clears them.
 * @property {(zoom: number | null, key?: string | null) => void} cacheZoom - Caches the timeline zoom (and its key), or clears it.
 * @property {(v: boolean) => void} setIsCutting - Sets the running-cut flag.
 * @property {(p: TaskProgress | null) => void} setProgress - Sets the live cut progress (or null to clear).
 * @property {() => void} resetForm - Clears every draft field, the media cache, and the persisted snapshot.
 */
export interface VideoCutState {
  input: string;
  output: string;
  startTime: string;
  endTime: string;
  duration: string;
  useDuration: boolean;
  includeAudio: boolean;
  isCutting: boolean;
  progress: TaskProgress | null;
  waveform: WaveformData | null;
  waveformKey: string | null;
  thumbnails: ThumbnailStrip | null;
  thumbnailsKey: string | null;
  zoom: number | null;
  zoomKey: string | null;
  setInput: (file: string) => void;
  setOutput: (file: string) => void;
  setStartTime: (time: string) => void;
  setEndTime: (time: string) => void;
  setDuration: (duration: string) => void;
  setUseDuration: (use: boolean) => void;
  setIncludeAudio: (include: boolean) => void;
  cacheWaveform: (data: WaveformData | null, key?: string | null) => void;
  cacheThumbnails: (data: ThumbnailStrip | null, key?: string | null) => void;
  cacheZoom: (zoom: number | null, key?: string | null) => void;
  setIsCutting: (v: boolean) => void;
  setProgress: (p: TaskProgress | null) => void;
  resetForm: () => void;
}
