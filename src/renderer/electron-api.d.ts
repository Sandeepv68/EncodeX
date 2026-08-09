/**
 * @fileoverview Ambient type declarations for the `window.electronAPI` bridge.
 *
 * Declares the ElectronAPI interface, a typed description of the API surface
 * exposed to the renderer by the preload script (src/preload/index.ts) via
 * contextBridge.exposeInMainWorld('electronAPI', api). The global Window
 * declaration at the bottom makes `window.electronAPI` statically typed across
 * the renderer codebase, so callers get autocomplete and type-checking for
 * every IPC method. The runtime implementation lives in the preload script.
 */

import {
  ConversionOptions,
  ConversionProgress,
  MediaInfo,
  QueueJob,
  PlayerFrame,
  PlayerAudioChunk,
  LogEntry,
  EncoderCapabilities,
  WaveformData,
  ThumbnailStrip,
  ImageExifData,
  ImageFileInfo,
} from '../shared/types';

/**
 * The bridge API exposed to the renderer as `window.electronAPI`.
 * Mirrors the `api` object in src/preload/index.ts. Request/response methods
 * use ipcRenderer.invoke and reject with a formatted AppError message on
 * failure; window controls are fire-and-forget ipcRenderer.send; the on* event
 * subscriptions each return an unsubscribe function.
 */
export interface ElectronAPI {
  /**
   * Resolves the absolute file system path for a File object picked in the
   * renderer, using the Electron WebUtils API.
   * @param {File} file - The DOM File object selected by the user.
   * @returns {string} The absolute path of the file on disk.
   * @throws {Error} Throws if the File did not originate from the operating
   *   system (e.g. a programmatically constructed file).
   */
  getPathForFile(file: File): string;
  /**
   * Opens a native single-selection open-file dialog in the main process over
   * the `IPC.SELECT_FILE` ('select-file') channel.
   * @param {Electron.FileFilter[]} [filters] - Optional file-type filters
   *   restricting which extensions are selectable.
   * @returns {Promise<string|null>} The chosen file path, or null if the user
   *   cancelled the dialog.
   */
  selectFile(filters?: Electron.FileFilter[]): Promise<string | null>;
  /**
   * Opens a native multi-selection open-file dialog in the main process over
   * the `IPC.SELECT_FILES` ('select-files') channel.
   * @param {Electron.FileFilter[]} [filters] - Optional file-type filters
   *   restricting which extensions are selectable.
   * @returns {Promise<string[]>} The chosen file paths (an empty array if the
   *   user cancelled the dialog).
   */
  selectFiles(filters?: Electron.FileFilter[]): Promise<string[]>;
  /**
   * Opens a native save-file dialog in the main process to choose an output
   * destination over the `IPC.SELECT_OUTPUT` ('select-output') channel.
   * @returns {Promise<string|null>} The chosen output path, or null if the user
   *   cancelled the dialog.
   */
  selectOutput(): Promise<string | null>;
  /**
   * Opens a native folder-selection dialog in the main process to choose an
   * output directory over the `IPC.SELECT_DIRECTORY` ('select-directory')
   * channel.
   * @returns {Promise<string|null>} The chosen directory path, or null if the
   *   user cancelled the dialog.
   */
  selectDirectory(): Promise<string | null>;
  /**
   * Probes technical metadata (container format, streams, duration, bitrate)
   * for a media file using the requested transcoder over the
   * `IPC.GET_MEDIA_INFO` ('get-media-info') channel.
   * @param {string} filePath - Absolute path to the media file to probe.
   * @param {string} transcoderType - Transcoder backend used for probing (one
   *   of TRANSCODER_TYPES).
   * @returns {Promise<MediaInfo>} The probed media information.
   */
  getMediaInfo(filePath: string, transcoderType: string): Promise<MediaInfo>;
  /**
   * Extracts EXIF metadata and an RGB/luminance histogram from an image over
   * the `IPC.GET_IMAGE_INFO` ('get-image-info') channel.
   * @param {string} filePath - Absolute path to the image file.
   * @returns {Promise<ImageExifData|null>} The extracted EXIF data and
   *   histogram, or null when the image carries no EXIF metadata.
   */
  getImageInfo(filePath: string): Promise<ImageExifData | null>;
  /**
   * Generates a data-URL preview of an image for direct display over the
   * `IPC.GET_IMAGE_PREVIEW` ('get-image-preview') channel.
   * @param {string} filePath - Absolute path to the image file.
   * @returns {Promise<string|null>} A data URL of the preview, or null if a
   *   preview could not be generated.
   */
  getImagePreview(filePath: string): Promise<string | null>;
  /**
   * Reads basic dimensions and byte size of an image over the
   * `IPC.GET_IMAGE_FILE_INFO` ('get-image-file-info') channel.
   * @param {string} filePath - Absolute path to the image file.
   * @returns {Promise<ImageFileInfo|null>} The image width, height, and size,
   *   or null if the file could not be inspected.
   */
  getImageFileInfo(filePath: string): Promise<ImageFileInfo | null>;
  /**
   * Extracts a preview frame from a video and returns it as a data URL over
   * the `IPC.GET_VIDEO_PREVIEW` ('get-video-preview') channel.
   * @param {string} filePath - Absolute path to the video file.
   * @returns {Promise<string|null>} A data URL of the preview frame, or null
   *   if no preview could be generated.
   */
  getVideoPreview(filePath: string): Promise<string | null>;
  /**
   * Queries the transcoder backends for their supported encoders and hardware
   * acceleration features over the `IPC.GET_CAPABILITIES`
   * ('get-capabilities') channel.
   * @returns {Promise<EncoderCapabilities|null>} The available video encoders,
   *   audio encoders, and hwaccels, or null if the capability probe failed.
   */
  getCapabilities(): Promise<EncoderCapabilities | null>;
  /**
   * Starts a single-file media conversion over the `IPC.CONVERT_FILE`
   * ('convert-file') channel. Progress is reported asynchronously through the
   * `onConversionProgress` subscription; the returned promise settles only when
   * the conversion finishes or fails.
   * @param {string} input - Absolute path of the source file.
   * @param {string} output - Absolute path of the destination file.
   * @param {ConversionOptions} options - Encoding options (codecs, bitrates,
   *   scaling, trimming, hardware acceleration, etc.).
   * @param {string} transcoderType - Transcoder backend to use (one of
   *   TRANSCODER_TYPES).
   * @returns {Promise<void>} Resolves when the conversion completes.
   */
  convertFile(input: string, output: string, options: ConversionOptions, transcoderType: string): Promise<void>;
  /**
   * Pauses the currently running single-file conversion over the
   * `IPC.PAUSE_CONVERSION` ('pause-conversion') channel. Safe to call when no
   * conversion is active; the main process no-ops.
   * @returns {Promise<void>} Resolves once the pause request is handled.
   */
  pauseConversion(): Promise<void>;
  /**
   * Resumes a previously paused single-file conversion over the
   * `IPC.RESUME_CONVERSION` ('resume-conversion') channel. Safe to call when no
   * conversion is paused; the main process no-ops.
   * @returns {Promise<void>} Resolves once the resume request is handled.
   */
  resumeConversion(): Promise<void>;
  /**
   * Cancels the currently running single-file conversion over the
   * `IPC.CANCEL_CONVERSION` ('cancel-conversion') channel.
   * @returns {Promise<void>} Resolves once the cancel request is handled.
   */
  cancelConversion(): Promise<void>;
  /**
   * Adds a conversion job to the batch queue managed in the main process over
   * the `IPC.QUEUE_ADD` ('queue-add') channel. Progress arrives via the
   * `onQueueProgress` and `onQueueStatusChange` subscriptions.
   * @param {string} input - Absolute path of the source file.
   * @param {string} output - Absolute path of the destination file.
   * @param {ConversionOptions} options - Encoding options for the job.
   * @param {string} transcoder - Transcoder backend to use (one of
   *   TRANSCODER_TYPES).
   * @param {boolean} [overwrite] - When true, an existing output file is
   *   replaced; otherwise the main process rejects the job when the output
   *   already exists.
   * @returns {Promise<string>} The unique id assigned to the queued job.
   */
  queueAdd(input: string, output: string, options: ConversionOptions, transcoder: string, overwrite?: boolean): Promise<string>;
  /**
   * Removes a job from the conversion queue by id over the `IPC.QUEUE_REMOVE`
   * ('queue-remove') channel. A currently-processing job is cancelled.
   * @param {string} id - Id of the job to remove (as returned by `queueAdd`).
   * @returns {Promise<void>} Resolves once the removal request is handled.
   */
  queueRemove(id: string): Promise<void>;
  /**
   * Returns the current list of jobs in the conversion queue over the
   * `IPC.QUEUE_LIST` ('queue-list') channel.
   * @returns {Promise<QueueJob[]>} The full array of queued jobs.
   */
  queueList(): Promise<QueueJob[]>;
  /**
   * Reads the queue's runtime state over the `IPC.QUEUE_GET_STATE`
   * ('queue-get-state') channel.
   * @returns {Promise<{paused: boolean, concurrency: number}>} Whether the
   *   queue is paused and the parallel-job cap.
   */
  queueGetState(): Promise<{ paused: boolean; concurrency: number }>;
  /**
   * Cancels every job in the conversion queue over the `IPC.QUEUE_CANCEL_ALL`
   * ('queue-cancel-all') channel.
   * @returns {Promise<void>} Resolves once all jobs have been cancelled.
   */
  queueCancelAll(): Promise<void>;
  /**
   * Removes every completed (DONE) and failed (ERROR) job from the queue over
   * the `IPC.QUEUE_CLEAR_COMPLETED` ('queue-clear-completed') channel.
   * @returns {Promise<number>} The number of jobs removed.
   */
  queueClearCompleted(): Promise<number>;
  /**
   * Sets how many batch conversions run in parallel (1-4) over the
   * `IPC.QUEUE_SET_CONCURRENCY` ('queue-set-concurrency') channel.
   * @param {number} concurrency - The concurrency cap (1-4).
   * @returns {Promise<void>} Resolves once the cap has been applied.
   */
  queueSetConcurrency(concurrency: number): Promise<void>;
  /**
   * Reorders a QUEUED batch job to a target position within the QUEUED
   * subsequence over the `IPC.QUEUE_MOVE_TO` ('queue-move-to') channel.
   * @param {string} id - Id of the QUEUED job to move.
   * @param {number} toPosition - Target index within the QUEUED subsequence.
   * @returns {Promise<boolean>} Resolves true when moved, false when missing,
   *   not queued, or already at the target position.
   */
  queueMoveTo(id: string, toPosition: number): Promise<boolean>;
  /**
   * Pauses the batch queue over the `IPC.QUEUE_PAUSE` ('queue-pause') channel:
   * the main process suspends every active conversion and blocks queued jobs
   * from starting until `queueResume` is called.
   * @returns {Promise<void>} Resolves once the queue is paused.
   */
  queuePause(): Promise<void>;
  /**
   * Resumes a paused batch queue over the `IPC.QUEUE_RESUME` ('queue-resume')
   * channel: the main process resumes every suspended conversion and starts
   * queued jobs the concurrency cap allows.
   * @returns {Promise<void>} Resolves once the queue is resumed.
   */
  queueResume(): Promise<void>;
  /**
   * Exports the current batch queue to a JSON file over the
   * `IPC.QUEUE_EXPORT` ('queue-export') channel, using a native save dialog.
   * @returns {Promise<number>} The number of jobs exported, or 0 if the user
   *   cancelled the dialog.
   */
  queueExport(): Promise<number>;
  /**
   * Imports jobs from a JSON queue file over the `IPC.QUEUE_IMPORT`
   * ('queue-import') channel, using a native open dialog.
   * @returns {Promise<number>} The number of jobs imported, or 0 if the user
   *   cancelled the dialog.
   * @throws {Error} Rejects with a formatted AppError if the file is
   *   unreadable or does not match the expected queue format.
   */
  queueImport(): Promise<number>;
  /**
   * Reveals a file (or folder) in the operating system's file manager over the
   * `IPC.REVEAL_FILE` ('queue-reveal') channel.
   * @param {string} filePath - Absolute path of the file or folder to reveal.
   * @returns {Promise<void>} Resolves once the reveal request is handled.
   */
  revealFile(filePath: string): Promise<void>;
  /**
   * Opens a media file in the native player and starts decoding both video and
   * audio streams over the `IPC.PLAYER_OPEN` ('player-open') channel.
   * @param {string} filePath - Absolute path of the media file to play.
   * @returns {Promise<number>} The new player generation counter; frames and
   *   audio chunks tagged with older generations should be discarded.
   */
  playerOpen(filePath: string): Promise<number>;
  /**
   * Seeks the open player to a specific position over the `IPC.PLAYER_SEEK`
   * ('player-seek') channel.
   * @param {string} time - Target position in the media (typically formatted
   *   as 'HH:MM:SS').
   * @returns {Promise<number>} The new player generation counter.
   */
  playerSeek(time: string): Promise<number>;
  /**
   * Closes the open player and releases its decoder resources over the
   * `IPC.PLAYER_CLOSE` ('player-close') channel.
   * @returns {Promise<void>} Resolves once the player has been closed.
   */
  playerClose(): Promise<void>;
  /**
   * Retrieves the next decoded video frame from the open player over the
   * `IPC.PLAYER_GET_FRAME` ('player-get-frame') channel.
   * @returns {Promise<PlayerFrame|null>} The next decoded frame (raw pixel
   *   data, dimensions, pts, generation), or null if no frame arrived before
   *   the frame timeout.
   */
  playerGetFrame(): Promise<PlayerFrame | null>;
  /**
   * Subscribes to player error notifications pushed from the main process over
   * `IPC.PLAYER_ERROR` ('player-error').
   * @param {(message: string) => void} cb - Callback invoked with the
   *   human-readable error message.
   * @returns {() => void} An unsubscribe function that removes the listener.
   */
  onPlayerError(cb: (message: string) => void): () => void;
  /**
   * Analyzes the audio of a media file and produces a downsampled waveform for
   * the timeline visualizer over the `IPC.EXTRACT_WAVEFORM`
   * ('extract-waveform') channel.
   * @param {string} filePath - Absolute path of the media file.
   * @param {number} duration - Media duration in seconds; used to size the
   *   waveform buckets.
   * @returns {Promise<WaveformData|null>} The waveform data, or null if the
   *   waveform could not be extracted.
   */
  extractWaveform(filePath: string, duration: number): Promise<WaveformData | null>;
  /**
   * Extracts a grid of evenly spaced thumbnail frames from a video for the
   * timeline preview over the `IPC.EXTRACT_THUMBNAILS` ('extract-thumbnails')
   * channel.
   * @param {string} filePath - Absolute path of the video file.
   * @param {number} duration - Video duration in seconds; used to space the
   *   thumbnails evenly.
   * @returns {Promise<ThumbnailStrip|null>} A thumbnail strip (a single
   *   data-URL image containing cols x rows tiles), or null on failure.
   */
  extractThumbnails(filePath: string, duration: number): Promise<ThumbnailStrip | null>;
  /**
   * Minimizes the application window. Fire-and-forget over the
   * `IPC.WINDOW_MINIMIZE` ('window-minimize') channel; no response is returned.
   * @returns {void}
   */
  windowMinimize(): void;
  /**
   * Toggles the application window between maximized and normal state.
   * Fire-and-forget over the `IPC.WINDOW_MAXIMIZE_TOGGLE`
   * ('window-maximize-toggle') channel.
   * @returns {void}
   */
  windowMaximizeToggle(): void;
  /**
   * Closes the application window. Fire-and-forget over the `IPC.WINDOW_CLOSE`
   * ('window-close') channel.
   * @returns {void}
   */
  windowClose(): void;
  /**
   * Sets whether the application window should stay on top of other windows.
   * Fire-and-forget over the `IPC.WINDOW_SET_ALWAYS_ON_TOP`
   * ('window-set-always-on-top') channel.
   * @param {boolean} flag - true to keep the window always-on-top, false to
   *   disable it.
   * @returns {void}
   */
  windowSetAlwaysOnTop(flag: boolean): void;
  /**
   * Adds or removes the app from the operating system's login items (launch at
   * startup). Fire-and-forget over the `IPC.SET_LAUNCH_AT_LOGIN`
   * ('set-launch-at-login') channel.
   * @param {boolean} enabled - true to start the app at login, false to remove it.
   * @returns {void}
   */
  setLaunchAtLogin(enabled: boolean): void;
  /**
   * Subscribes to window maximized / un-maximized state changes pushed from the
   * main process over `IPC.WINDOW_MAXIMIZED_CHANGED`
   * ('window-maximized-changed').
   * @param {(maximized: boolean) => void} cb - Callback invoked with the new
   *   maximized state whenever it changes.
   * @returns {() => void} An unsubscribe function that removes the listener.
   */
  onWindowMaximizedChange(cb: (maximized: boolean) => void): () => void;
  /**
   * Subscribes to real-time progress events for the active single-file
   * conversion, pushed from the main process over `IPC.CONVERSION_PROGRESS`
   * ('conversion-progress').
   * @param {(data: { input: string; output: string; progress: ConversionProgress }) => void} cb -
   *   Callback receiving the source path, destination path, and the progress
   *   snapshot (percent, elapsed time, fps, speed, ETA, bitrate).
   * @returns {() => void} An unsubscribe function that removes the listener.
   */
  onConversionProgress(cb: (data: { input: string; output: string; progress: ConversionProgress }) => void): () => void;
  /**
   * Subscribes to job-added events from the conversion queue, pushed from the
   * main process over `IPC.QUEUE_ADDED` ('queue-added').
   * @param {(job: QueueJob) => void} cb - Callback invoked with the newly added
   *   job.
   * @returns {() => void} An unsubscribe function that removes the listener.
   */
  onQueueAdded(cb: (job: QueueJob) => void): () => void;
  /**
   * Subscribes to job-removed events from the conversion queue, pushed from the
   * main process over `IPC.QUEUE_REMOVED` ('queue-removed').
   * @param {(id: string) => void} cb - Callback invoked with the id of the
   *   removed job.
   * @returns {() => void} An unsubscribe function that removes the listener.
   */
  onQueueRemoved(cb: (id: string) => void): () => void;
  /**
   * Subscribes to queue job status transitions (queued, running, finished,
   * failed), pushed from the main process over `IPC.QUEUE_STATUS_CHANGE`
   * ('queue-status-change').
   * @param {(job: QueueJob) => void} cb - Callback invoked with the job in its
   *   new status.
   * @returns {() => void} An unsubscribe function that removes the listener.
   */
  onQueueStatusChange(cb: (job: QueueJob) => void): () => void;
  /**
   * Subscribes to per-job progress events from the conversion queue, pushed
   * from the main process over `IPC.QUEUE_PROGRESS` ('queue-progress'). Unlike
   * `onConversionProgress`, which covers only the standalone conversion, this
   * covers jobs managed by the queue manager.
   * @param {(data: { job: QueueJob; progress: ConversionProgress }) => void} cb -
   *   Callback receiving the queued job and its progress snapshot.
   * @returns {() => void} An unsubscribe function that removes the listener.
   */
  onQueueProgress(cb: (data: { job: QueueJob; progress: ConversionProgress }) => void): () => void;
  /**
   * Subscribes to the notification that the whole queue has been cancelled,
   * pushed from the main process over `IPC.QUEUE_CANCELLED` ('queue-cancelled').
   * @param {() => void} cb - Callback invoked once when the queue is cancelled.
   * @returns {() => void} An unsubscribe function that removes the listener.
   */
  onQueueCancelled(cb: () => void): () => void;
  /**
   * Subscribes to the notification that a QUEUED job was reordered, pushed from
   * the main process over `IPC.QUEUE_MOVED` ('queue-moved').
   * @param {(data: { id: string; toPosition: number }) => void} cb - Callback
   *   receiving the moved job id and its new index within the QUEUED subsequence.
   * @returns {() => void} An unsubscribe function that removes the listener.
   */
  onQueueMoved(cb: (data: { id: string; toPosition: number }) => void): () => void;
  /**
   * Subscribes to decoded video frames emitted by the native player, pushed
   * from the main process over `IPC.PLAYER_FRAME` ('player-frame'). Frames
   * tagged with a stale generation should be discarded after a seek or reopen.
   * @param {(frame: PlayerFrame) => void} cb - Callback invoked for each
   *   decoded frame.
   * @returns {() => void} An unsubscribe function that removes the listener.
   */
  onPlayerFrame(cb: (frame: PlayerFrame) => void): () => void;
  /**
   * Subscribes to decoded audio chunks emitted by the native player, pushed
   * from the main process over `IPC.PLAYER_AUDIO` ('player-audio'). Chunks
   * tagged with a stale generation should be discarded after a seek or reopen.
   * @param {(chunk: PlayerAudioChunk) => void} cb - Callback invoked for each
   *   audio chunk.
   * @returns {() => void} An unsubscribe function that removes the listener.
   */
  onPlayerAudio(cb: (chunk: PlayerAudioChunk) => void): () => void;
  /**
   * Subscribes to the main process log stream, pushed from the main process
   * over `IPC.LOG_MESSAGE` ('log-message'). Each entry carries a timestamp,
   * severity, text, and source, enabling the renderer to render a live log
   * panel.
   * @param {(entry: LogEntry) => void} cb - Callback invoked for each forwarded
   *   log entry.
   * @returns {() => void} An unsubscribe function that removes the listener.
   */
  onLogMessage(cb: (entry: LogEntry) => void): () => void;
}

/**
 * Augments the DOM Window interface so `window.electronAPI` is statically
 * typed throughout the renderer. The value is provided at runtime by the
 * preload script's contextBridge.exposeInMainWorld('electronAPI', api) call.
 */
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
