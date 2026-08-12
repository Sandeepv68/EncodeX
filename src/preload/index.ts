/**
 * @fileoverview Preload script for the EncodeX application that acts as the secure,
 * sandboxed bridge between the renderer process and the main process.
 *
 * The script runs in an isolated preload context (Electron `contextIsolation` is
 * enabled) before any renderer page scripts execute. It exposes a curated, whitelisted
 * API surface to the renderer via `contextBridge.exposeInMainWorld('electronAPI', api)`;
 * the renderer never receives raw Electron primitives such as `ipcRenderer`,
 * `NodeIntegration`, or the `remote` module.
 *
 * Security model:
 * - Renderer-to-main communication flows only through `ipcRenderer.invoke` /
 *   `ipcRenderer.send` using the fixed channel constants in `IPC`
 *   (src/shared/ipc-channels.ts). The renderer never supplies channel names itself,
 *   so no arbitrary channels can be reached from page context.
 * - Main-to-renderer push events flow only through `ipcRenderer.on` subscriptions.
 *   Every subscription method returns an unsubscribe function so the renderer can
 *   remove the listener and prevent leaks.
 * - `webUtils.getPathForFile` is the only Electron web API surfaced to the renderer;
 *   it lets the renderer resolve the native path of a user-picked `File` object
 *   without granting filesystem access.
 *
 * Error handling:
 * - Main-process IPC handlers wrap failures with `formatError` (src/shared/errors.ts)
 *   and throw the resulting error. Electron serializes errors across IPC by
 *   transferring only the `message` property, so the `ipcRenderer.invoke` promise
 *   returned to the renderer rejects with a plain `Error` whose `message` holds the
 *   formatted AppError text (including error code and detail, when present).
 * - Fire-and-forget `ipcRenderer.send` calls (window controls) are unidirectional:
 *   the renderer cannot observe their outcome and no error can be returned.
 *
 * Exposed API (`window.electronAPI`):
 * - File system & dialogs: `getPathForFile`, `selectFile`, `selectFiles`, `selectOutput`.
 * - Media/image metadata & previews: `getMediaInfo`, `getImageInfo`, `getImagePreview`,
 *   `getImageFileInfo`, `getVideoPreview`, `getCapabilities`.
 * - Single-file conversion: `convertFile`, `pauseConversion`, `resumeConversion`,
 *   `cancelConversion`.
 * - Batch queue: `queueAdd`, `queueRemove`, `queueList`, `queueGetState`, `queueCancelAll`, `queueClearCompleted`, `queueSetConcurrency`, `queueSetWhenDone`, `queueMoveTo`, `queuePause`, `queueResume`, `queueExport`, `queueImport`.
 * - Media player: `playerOpen`, `playerSeek`, `playerClose`, `playerGetFrame`.
 * - Timeline tools: `extractWaveform`, `extractThumbnails`.
 * - Window controls: `windowMinimize`, `windowMaximizeToggle`, `windowClose`,
 *   `windowSetAlwaysOnTop`, `setLaunchAtLogin`.
 * - Event subscriptions (each returns an unsubscribe function): `onWindowMaximizedChange`,
 *   `onConversionProgress`, `onQueueAdded`, `onQueueRemoved`, `onQueueStatusChange`,
 *   `onQueueProgress`, `onQueueCancelled`, `onQueueMoved`, `onPlayerFrame`, `onPlayerAudio`,
 *   `onPlayerError`, `onLogMessage`.
 */

import { contextBridge, ipcRenderer, IpcRendererEvent, webUtils } from 'electron';
import { Logger } from '../shared/logger';
import { IPC } from '../shared/ipc-channels';
import {
  ConversionOptions,
  ConversionProgress,
  QueueJob,
  PlayerFrame,
  PlayerAudioChunk,
  MediaInfo,
  ImageExifData,
  ImageFileInfo,
  LogEntry,
  EncoderCapabilities,
  WaveformData,
  ThumbnailStrip,
  WhenDoneConfig,
} from '../shared/types';
import {
  LOG_ARROW,
  LOG_CANCEL_CONVERSION_CALLED,
  LOG_CONVERT_FILE,
  LOG_DURATION,
  LOG_EXTRACT_THUMBNAILS,
  LOG_EXTRACT_WAVEFORM,
  LOG_GET_CAPABILITIES_CALLED,
  LOG_GET_IMAGE_FILE_INFO,
  LOG_GET_IMAGE_INFO,
  LOG_GET_IMAGE_PREVIEW,
  LOG_GET_MEDIA_INFO,
  LOG_GET_VIDEO_PREVIEW,
  LOG_ON_CONVERSION_PROGRESS,
  LOG_ON_QUEUE_ADDED,
  LOG_ON_QUEUE_CANCELLED,
  LOG_ON_QUEUE_MOVED,
  LOG_ON_QUEUE_REMOVED,
  LOG_ON_QUEUE_STATUS_CHANGE,
  LOG_ON_WINDOW_MAXIMIZED_CHANGE,
  LOG_PAUSE_CONVERSION_CALLED,
  LOG_PLAYER_CLOSE_CALLED,
  LOG_PLAYER_OPEN,
  LOG_PLAYER_SEEK,
  LOG_QUEUE_ADD,
  LOG_QUEUE_CANCEL_ALL_CALLED,
  LOG_QUEUE_CLEAR_COMPLETED,
  LOG_QUEUE_EXPORT,
  LOG_QUEUE_IMPORT,
  LOG_QUEUE_LIST_CALLED,
  LOG_QUEUE_GET_STATE_CALLED,
  LOG_QUEUE_MOVE_TO,
  LOG_QUEUE_PAUSE_CALLED,
  LOG_QUEUE_REMOVE,
  LOG_QUEUE_RESUME_CALLED,
  LOG_QUEUE_SET_CONCURRENCY,
  LOG_QUEUE_SET_WHEN_DONE,
  LOG_RESUME_CONVERSION_CALLED,
  LOG_REVEAL_FILE,
  LOG_SELECT_DIRECTORY_CALLED,
  LOG_SELECT_FILES_CALLED,
  LOG_SELECT_FILE_CALLED,
  LOG_SELECT_OUTPUT_CALLED,
  LOG_TRANSCODER,
  LOG_WINDOW_CLOSE_CALLED,
  LOG_WINDOW_CONFIRM_CLOSE_CALLED,
  LOG_ON_WINDOW_CLOSE_REQUESTED,
  LOG_WINDOW_MAXIMIZE_TOGGLE_CALLED,
  LOG_WINDOW_MINIMIZE_CALLED,
  LOG_WINDOW_SET_ALWAYS_ON_TOP_CALLED,
  LOG_SET_LAUNCH_AT_LOGIN_CALLED,
} from '../shared/log-constants';

/**
 * Logger instance scoped to the 'preload' context. Every IPC interaction initiated
 * by the renderer is logged through this instance so the bridge activity is visible
 * in the main process log output. Severity filtering is controlled by the `LOG_LEVEL`
 * environment variable (see src/shared/logger.ts).
 * @const {Logger} log
 */
const log = new Logger('preload');

/**
 * The full API surface exposed to the renderer as `window.electronAPI` via
 * `contextBridge.exposeInMainWorld`. Grouped by concern:
 *
 * - File system & dialogs: `getPathForFile`, `selectFile`, `selectFiles`, `selectOutput`.
 * - Media/image metadata & previews: `getMediaInfo`, `getImageInfo`, `getImagePreview`,
 *   `getImageFileInfo`, `getVideoPreview`, `getCapabilities`.
 * - Single-file conversion: `convertFile`, `pauseConversion`, `resumeConversion`,
 *   `cancelConversion`.
 * - Batch queue: `queueAdd`, `queueRemove`, `queueList`, `queueGetState`, `queueCancelAll`, `queueClearCompleted`, `queueSetConcurrency`, `queueSetWhenDone`, `queueMoveTo`, `queuePause`, `queueResume`, `queueExport`, `queueImport`.
 * - Media player: `playerOpen`, `playerSeek`, `playerClose`, `playerGetFrame`.
 * - Timeline tools: `extractWaveform`, `extractThumbnails`.
 * - Window controls: `windowMinimize`, `windowMaximizeToggle`, `windowClose`,
 *   `windowSetAlwaysOnTop`, `setLaunchAtLogin`.
 * - Event subscriptions (each returns an unsubscribe function): `onWindowMaximizedChange`,
 *   `onConversionProgress`, `onQueueAdded`, `onQueueRemoved`, `onQueueStatusChange`,
 *   `onQueueProgress`, `onQueueCancelled`, `onQueueMoved`, `onPlayerFrame`, `onPlayerAudio`,
 *   `onPlayerError`, `onLogMessage`.
 *
 * Request/response methods use `ipcRenderer.invoke` and reject with the error the main
 * process throws (see the file-level note on error forwarding). Fire-and-forget window
 * controls use `ipcRenderer.send`. Every channel is a constant from `IPC`
 * (src/shared/ipc-channels.ts); the renderer never supplies channel names itself.
 * @const {object} api
 */
const api = {
  /**
   * Resolves the absolute file system path for a File object picked in the renderer.
   * Uses the Electron WebUtils API (the successor to the removed `File.path` property)
   * so the renderer can obtain native paths without being granted raw filesystem access.
   *
   * @param {File} file - The DOM File object selected by the user.
   * @returns {string} The absolute path of the file on disk.
   * @throws {Error} Throws if the File object did not originate from the operating
   *   system (for example a programmatically constructed or synthetic file), in which
   *   case no path exists.
   */
  getPathForFile: (file: File) => {
    return webUtils.getPathForFile(file);
  },
  /**
   * Opens a native open-file dialog with single selection in the main process.
   * Logs the call at debug level, then invokes the main process over the
   * `IPC.SELECT_FILE` ('select-file') channel.
   *
   * @param {Electron.FileFilter[]} [filters] - Optional file-type filters restricting
   *   which extensions are selectable in the dialog.
   * @returns {Promise<string|null>} Resolves with the absolute path of the chosen file,
   *   or null if the user cancelled the dialog.
   * @throws {Error} Rejects if the dialog could not be opened in the main process.
   */
  selectFile: (filters?: Electron.FileFilter[]) => {
    log.debug(LOG_SELECT_FILE_CALLED);
    return ipcRenderer.invoke(IPC.SELECT_FILE, filters) as Promise<string | null>;
  },
  /**
   * Opens a native open-file dialog with multi-selection enabled in the main process.
   * Logs the call at debug level, then invokes the main process over the
   * `IPC.SELECT_FILES` ('select-files') channel.
   *
   * @param {Electron.FileFilter[]} [filters] - Optional file-type filters restricting
   *   which extensions are selectable in the dialog.
   * @returns {Promise<string[]>} Resolves with the absolute paths of all chosen files
   *   (an empty array if the user cancelled the dialog).
   * @throws {Error} Rejects if the dialog could not be opened in the main process.
   */
  selectFiles: (filters?: Electron.FileFilter[]) => {
    log.debug(LOG_SELECT_FILES_CALLED);
    return ipcRenderer.invoke(IPC.SELECT_FILES, filters) as Promise<string[]>;
  },
  /**
   * Opens a native save-file dialog in the main process to choose an output
   * destination. Logs the call at debug level, then invokes the main process over
   * the `IPC.SELECT_OUTPUT` ('select-output') channel.
   *
   * @returns {Promise<string|null>} Resolves with the absolute path of the chosen
   *   output file, or null if the user cancelled the dialog.
   * @throws {Error} Rejects if the dialog could not be opened in the main process.
   */
  selectOutput: () => {
    log.debug(LOG_SELECT_OUTPUT_CALLED);
    return ipcRenderer.invoke(IPC.SELECT_OUTPUT) as Promise<string | null>;
  },
  /**
   * Opens a native folder-selection dialog in the main process to choose an
   * output directory for batch conversions. Logs the call at debug level, then
   * invokes the main process over the `IPC.SELECT_DIRECTORY`
   * ('select-directory') channel.
   *
   * @returns {Promise<string|null>} Resolves with the absolute path of the
   *   chosen directory, or null if the user cancelled the dialog.
   * @throws {Error} Rejects if the dialog could not be opened in the main process.
   */
  selectDirectory: () => {
    log.debug(LOG_SELECT_DIRECTORY_CALLED);
    return ipcRenderer.invoke(IPC.SELECT_DIRECTORY) as Promise<string | null>;
  },
  /**
   * Reads detailed technical metadata (container format, streams, duration, bitrate)
   * from a media file using the requested transcoder backend. Logs the request at
   * info level, then invokes the main process over the `IPC.GET_MEDIA_INFO`
   * ('get-media-info') channel.
   *
   * @param {string} filePath - Absolute path to the media file to probe.
   * @param {string} transcoderType - Transcoder backend used for probing (one of
   *   TRANSCODER_TYPES in src/shared/transcoder-constants.ts).
   * @returns {Promise<MediaInfo>} Resolves with the probed media information.
   * @throws {Error} Rejects with a formatted AppError (src/shared/errors.ts) if the
   *   file cannot be found, read, or probed successfully.
   */
  getMediaInfo: (filePath: string, transcoderType: string) => {
    log.info(LOG_GET_MEDIA_INFO, filePath, LOG_TRANSCODER, transcoderType);
    return ipcRenderer.invoke(IPC.GET_MEDIA_INFO, filePath, transcoderType) as Promise<MediaInfo>;
  },
  /**
   * Extracts EXIF metadata and an RGB/luminance histogram from an image file. Logs
   * the request at info level, then invokes the main process over the
   * `IPC.GET_IMAGE_INFO` ('get-image-info') channel.
   *
   * @param {string} filePath - Absolute path to the image file to analyze.
   * @returns {Promise<ImageExifData|null>} Resolves with the extracted EXIF data and
   *   histogram, or null when the image carries no EXIF metadata to report.
   * @throws {Error} Rejects with a formatted AppError if the image cannot be read.
   */
  getImageInfo: (filePath: string) => {
    log.info(LOG_GET_IMAGE_INFO, filePath);
    return ipcRenderer.invoke(IPC.GET_IMAGE_INFO, filePath) as Promise<ImageExifData | null>;
  },
  /**
   * Generates a data-URL preview of an image file for direct display in the renderer.
   * Logs the request at info level, then invokes the main process over the
   * `IPC.GET_IMAGE_PREVIEW` ('get-image-preview') channel.
   *
   * @param {string} filePath - Absolute path to the image file.
   * @returns {Promise<string|null>} Resolves with a data URL of the preview
   *   (e.g. `data:image/png;base64,...`), or null if a preview could not be generated.
   * @throws {Error} Rejects with a formatted AppError if the image cannot be read.
   */
  getImagePreview: (filePath: string) => {
    log.info(LOG_GET_IMAGE_PREVIEW, filePath);
    return ipcRenderer.invoke(IPC.GET_IMAGE_PREVIEW, filePath) as Promise<string | null>;
  },
  /**
   * Reads basic information (dimensions and byte size) about an image file. Logs the
   * request at info level, then invokes the main process over the
   * `IPC.GET_IMAGE_FILE_INFO` ('get-image-file-info') channel.
   *
   * @param {string} filePath - Absolute path to the image file.
   * @returns {Promise<ImageFileInfo|null>} Resolves with the image width, height, and
   *   size, or null if the file could not be inspected.
   * @throws {Error} Rejects with a formatted AppError if the image cannot be read.
   */
  getImageFileInfo: (filePath: string) => {
    log.info(LOG_GET_IMAGE_FILE_INFO, filePath);
    return ipcRenderer.invoke(IPC.GET_IMAGE_FILE_INFO, filePath) as Promise<ImageFileInfo | null>;
  },
  /**
   * Extracts a preview frame from a video file and returns it as a data URL. Logs the
   * request at info level, then invokes the main process over the
   * `IPC.GET_VIDEO_PREVIEW` ('get-video-preview') channel.
   *
   * @param {string} filePath - Absolute path to the video file.
   * @returns {Promise<string|null>} Resolves with a data URL of the preview frame, or
   *   null if no preview could be generated.
   * @throws {Error} Rejects with a formatted AppError if the video cannot be decoded.
   */
  getVideoPreview: (filePath: string) => {
    log.info(LOG_GET_VIDEO_PREVIEW, filePath);
    return ipcRenderer.invoke(IPC.GET_VIDEO_PREVIEW, filePath) as Promise<string | null>;
  },
  /**
   * Queries the transcoder backends for their supported encoders and hardware
   * acceleration features. Logs the call at debug level, then invokes the main
   * process over the `IPC.GET_CAPABILITIES` ('get-capabilities') channel.
   *
   * @returns {Promise<EncoderCapabilities|null>} Resolves with the available video
   *   encoders, audio encoders, and hwaccels, or null if the capability probe failed.
   * @throws {Error} Rejects if the backend capability probe errors.
   */
  getCapabilities: () => {
    log.debug(LOG_GET_CAPABILITIES_CALLED);
    return ipcRenderer.invoke(IPC.GET_CAPABILITIES) as Promise<EncoderCapabilities | null>;
  },
  /**
   * Starts a single-file media conversion. Progress is reported asynchronously through
   * the `onConversionProgress` subscription; the returned promise settles only when the
   * conversion finishes or fails. Logs the request at info level, then invokes the main
   * process over the `IPC.CONVERT_FILE` ('convert-file') channel.
   *
   * @param {string} input - Absolute path of the source file.
   * @param {string} output - Absolute path of the destination file.
   * @param {ConversionOptions} options - Encoding options (codecs, bitrate, scaling,
   *   trimming, hardware acceleration, etc.).
   * @param {string} transcoderType - Transcoder backend to use (one of TRANSCODER_TYPES).
   * @returns {Promise<void>} Resolves when the conversion completes successfully.
   * @throws {Error} Rejects with a formatted AppError if conversion fails; the main
   *   process also removes any partially written output file.
   */
  convertFile: (input: string, output: string, options: ConversionOptions, transcoderType: string) => {
    log.info(LOG_CONVERT_FILE, input, LOG_ARROW, output, LOG_TRANSCODER, transcoderType);
    return ipcRenderer.invoke(IPC.CONVERT_FILE, input, output, options, transcoderType) as Promise<void>;
  },
  /**
   * Pauses the currently running single-file conversion. Logs the call at info level,
   * then invokes the main process over the `IPC.PAUSE_CONVERSION` ('pause-conversion')
   * channel. Safe to call even when no conversion is active; the main process no-ops.
   *
   * @returns {Promise<void>} Resolves once the pause request has been handled.
   */
  pauseConversion: () => {
    log.info(LOG_PAUSE_CONVERSION_CALLED);
    return ipcRenderer.invoke(IPC.PAUSE_CONVERSION) as Promise<void>;
  },
  /**
   * Resumes a previously paused single-file conversion. Logs the call at info level,
   * then invokes the main process over the `IPC.RESUME_CONVERSION` ('resume-conversion')
   * channel. Safe to call when no conversion is paused; the main process no-ops.
   *
   * @returns {Promise<void>} Resolves once the resume request has been handled.
   */
  resumeConversion: () => {
    log.info(LOG_RESUME_CONVERSION_CALLED);
    return ipcRenderer.invoke(IPC.RESUME_CONVERSION) as Promise<void>;
  },
  /**
   * Cancels the currently running single-file conversion. Logs the call at info level,
   * then invokes the main process over the `IPC.CANCEL_CONVERSION` ('cancel-conversion')
   * channel. The main process stops the transcoder and clears its reference.
   *
   * @returns {Promise<void>} Resolves once the cancel request has been handled.
   */
  cancelConversion: () => {
    log.info(LOG_CANCEL_CONVERSION_CALLED);
    return ipcRenderer.invoke(IPC.CANCEL_CONVERSION) as Promise<void>;
  },
  /**
   * Adds a conversion job to the batch queue managed in the main process. Jobs are
   * processed independently of this call; progress arrives via the `onQueueProgress`
   * and `onQueueStatusChange` subscriptions. Logs the request at info level, then
   * invokes the main process over the `IPC.QUEUE_ADD` ('queue-add') channel.
   *
   * @param {string} input - Absolute path of the source file.
   * @param {string} output - Absolute path of the destination file.
   * @param {ConversionOptions} options - Encoding options for the job.
   * @param {string} transcoder - Transcoder backend to use (one of TRANSCODER_TYPES).
   * @param {boolean} [overwrite] - When true, an existing output file is
   *   replaced; otherwise the main process rejects the job when the output
   *   already exists.
   * @returns {Promise<string>} Resolves with the unique id assigned to the queued job.
   * @throws {Error} Rejects with a formatted AppError if the job could not be added.
   */
  queueAdd: (input: string, output: string, options: ConversionOptions, transcoder: string, overwrite?: boolean) => {
    log.info(LOG_QUEUE_ADD, input, LOG_ARROW, output, 'overwrite:', overwrite === true);
    return ipcRenderer.invoke(IPC.QUEUE_ADD, input, output, options, transcoder, overwrite) as Promise<string>;
  },
  /**
   * Removes a job from the conversion queue by id. If the job is currently processing
   * it is cancelled; otherwise it is dropped from the queue. Logs the request at info
   * level, then invokes the main process over the `IPC.QUEUE_REMOVE` ('queue-remove')
   * channel.
   *
   * @param {string} id - Id of the job to remove (as returned by `queueAdd`).
   * @returns {Promise<void>} Resolves once the removal request has been handled.
   */
  queueRemove: (id: string) => {
    log.info(LOG_QUEUE_REMOVE, id);
    return ipcRenderer.invoke(IPC.QUEUE_REMOVE, id) as Promise<void>;
  },
  /**
   * Returns the current list of jobs in the conversion queue. Logs the call at debug
   * level, then invokes the main process over the `IPC.QUEUE_LIST` ('queue-list')
   * channel.
   *
   * @returns {Promise<QueueJob[]>} Resolves with the full array of queued jobs.
   */
  queueList: () => {
    log.debug(LOG_QUEUE_LIST_CALLED);
    return ipcRenderer.invoke(IPC.QUEUE_LIST) as Promise<QueueJob[]>;
  },
  /**
   * Reads the queue's runtime state (paused flag and concurrency cap). Logs the
   * call at debug level, then invokes the main process over the
   * `IPC.QUEUE_GET_STATE` ('queue-get-state') channel.
   *
   * @returns {Promise<{paused: boolean, concurrency: number}>} Resolves with
   *   whether the queue is paused and the parallel-job cap.
   */
  queueGetState: () => {
    log.debug(LOG_QUEUE_GET_STATE_CALLED);
    return ipcRenderer.invoke(IPC.QUEUE_GET_STATE) as Promise<{ paused: boolean; concurrency: number }>;
  },
  /**
   * Cancels every job in the conversion queue. Logs the call at info level, then
   * invokes the main process over the `IPC.QUEUE_CANCEL_ALL` ('queue-cancel-all')
   * channel.
   *
   * @returns {Promise<void>} Resolves once all jobs have been cancelled.
   */
  queueCancelAll: () => {
    log.info(LOG_QUEUE_CANCEL_ALL_CALLED);
    return ipcRenderer.invoke(IPC.QUEUE_CANCEL_ALL) as Promise<void>;
  },
  /**
   * Removes every completed (DONE) and failed (ERROR) job from the queue. Logs the
   * call at info level, then invokes the main process over the
   * `IPC.QUEUE_CLEAR_COMPLETED` ('queue-clear-completed') channel.
   *
   * @returns {Promise<number>} Resolves with the number of jobs removed.
   */
  queueClearCompleted: () => {
    log.info(LOG_QUEUE_CLEAR_COMPLETED);
    return ipcRenderer.invoke(IPC.QUEUE_CLEAR_COMPLETED) as Promise<number>;
  },
  /**
   * Sets how many batch conversions run in parallel (1-4). Logs the call at info
   * level, then invokes the main process over the `IPC.QUEUE_SET_CONCURRENCY`
   * ('queue-set-concurrency') channel.
   *
   * @param {number} concurrency - The concurrency cap (1-4).
   * @returns {Promise<void>} Resolves once the cap has been applied.
   */
  queueSetConcurrency: (concurrency: number) => {
    log.info(LOG_QUEUE_SET_CONCURRENCY, concurrency);
    return ipcRenderer.invoke(IPC.QUEUE_SET_CONCURRENCY, concurrency) as Promise<void>;
  },
  /**
   * Sets the when-done power action config for the batch queue. Logs the call
   * at info level, then invokes the main process over the
   * `IPC.QUEUE_SET_WHEN_DONE` ('queue-set-when-done') channel. The main
   * process records the config and runs the power action when the queue
   * drains while it is enabled.
   *
   * @param {WhenDoneConfig} config - Whether to act when the queue drains,
   *   which power action to run, and whether open processes should be
   *   force-closed.
   * @returns {Promise<void>} Resolves once the config has been recorded.
   */
  queueSetWhenDone: (config: WhenDoneConfig) => {
    log.info(LOG_QUEUE_SET_WHEN_DONE, JSON.stringify(config));
    return ipcRenderer.invoke(IPC.QUEUE_SET_WHEN_DONE, config) as Promise<void>;
  },
  /**
   * Reorders a QUEUED batch job to a target position within the QUEUED
   * subsequence. Logs the call at info level, then invokes the main process
   * over the `IPC.QUEUE_MOVE_TO` ('queue-move-to') channel.
   *
   * @param {string} id - Id of the QUEUED job to move.
   * @param {number} toPosition - Target index within the QUEUED subsequence.
   * @returns {Promise<boolean>} Resolves true when the job was moved, false
   *   when it is missing, not queued, or already at the target position.
   */
  queueMoveTo: (id: string, toPosition: number) => {
    log.info(LOG_QUEUE_MOVE_TO, id, toPosition);
    return ipcRenderer.invoke(IPC.QUEUE_MOVE_TO, id, toPosition) as Promise<boolean>;
  },
  /**
   * Pauses the batch queue: the main process suspends every active conversion
   * and blocks queued jobs from starting until `queueResume` is called. Logs
   * the call at info level, then invokes the main process over the
   * `IPC.QUEUE_PAUSE` ('queue-pause') channel.
   *
   * @returns {Promise<void>} Resolves once the queue is paused.
   */
  queuePause: () => {
    log.info(LOG_QUEUE_PAUSE_CALLED);
    return ipcRenderer.invoke(IPC.QUEUE_PAUSE) as Promise<void>;
  },
  /**
   * Resumes a paused batch queue: the main process resumes every suspended
   * conversion and starts queued jobs the concurrency cap allows. Logs the
   * call at info level, then invokes the main process over the
   * `IPC.QUEUE_RESUME` ('queue-resume') channel.
   *
   * @returns {Promise<void>} Resolves once the queue is resumed.
   */
  queueResume: () => {
    log.info(LOG_QUEUE_RESUME_CALLED);
    return ipcRenderer.invoke(IPC.QUEUE_RESUME) as Promise<void>;
  },
  /**
   * Exports the current batch queue to a JSON file chosen with a native save
   * dialog. Logs the call at info level, then invokes the main process over
   * the `IPC.QUEUE_EXPORT` ('queue-export') channel.
   *
   * @returns {Promise<number>} Resolves with the number of jobs exported, or
   *   0 when the dialog was cancelled.
   * @throws {Error} Rejects if the file could not be written.
   */
  queueExport: () => {
    log.info(LOG_QUEUE_EXPORT);
    return ipcRenderer.invoke(IPC.QUEUE_EXPORT) as Promise<number>;
  },
  /**
   * Imports jobs from a JSON queue file chosen with a native open dialog.
   * Logs the call at info level, then invokes the main process over the
   * `IPC.QUEUE_IMPORT` ('queue-import') channel.
   *
   * @returns {Promise<number>} Resolves with the number of jobs imported, or
   *   0 when the dialog was cancelled.
   * @throws {Error} Rejects with a formatted AppError if the file is
   *   unreadable or does not match the expected queue format.
   */
  queueImport: () => {
    log.info(LOG_QUEUE_IMPORT);
    return ipcRenderer.invoke(IPC.QUEUE_IMPORT) as Promise<number>;
  },
  /**
   * Reveals a file (or folder) in the operating system's file manager. Logs the
   * call at debug level, then invokes the main process over the
   * `IPC.REVEAL_FILE` ('queue-reveal') channel.
   *
   * @param {string} filePath - Absolute path of the file or folder to reveal.
   * @returns {Promise<void>} Resolves once the reveal request has been handled.
   */
  revealFile: (filePath: string) => {
    log.debug(LOG_REVEAL_FILE, filePath);
    return ipcRenderer.invoke(IPC.REVEAL_FILE, filePath) as Promise<void>;
  },
  /**
   * Opens a media file in the native player and starts decoding both video and audio
   * streams. Logs the request at info level, then invokes the main process over the
   * `IPC.PLAYER_OPEN` ('player-open') channel.
   *
   * @param {string} filePath - Absolute path of the media file to play.
   * @returns {Promise<number>} Resolves with the new player generation counter. Frames
   *   and audio chunks emitted after this call carry this generation tag; the renderer
   *   should discard anything tagged with an older generation.
   * @throws {Error} Rejects with a formatted AppError if the file cannot be opened or
   *   decoded.
   */
  playerOpen: (filePath: string) => {
    log.info(LOG_PLAYER_OPEN, filePath);
    return ipcRenderer.invoke(IPC.PLAYER_OPEN, filePath) as Promise<number>;
  },
  /**
   * Seeks the open player to a specific position. Logs the request at debug level, then
   * invokes the main process over the `IPC.PLAYER_SEEK` ('player-seek') channel.
   *
   * @param {string} time - Target position in the media, typically formatted as
   *   `HH:MM:SS`.
   * @returns {Promise<number>} Resolves with the new player generation counter. After a
   *   seek, frames and audio chunks tagged with older generations are stale and should
   *   be discarded by the renderer.
   */
  playerSeek: (time: string) => {
    log.debug(LOG_PLAYER_SEEK, time);
    return ipcRenderer.invoke(IPC.PLAYER_SEEK, time) as Promise<number>;
  },
  /**
   * Closes the open player and releases its decoder resources. Logs the call at debug
   * level, then invokes the main process over the `IPC.PLAYER_CLOSE` ('player-close')
   * channel.
   *
   * @returns {Promise<void>} Resolves once the player has been closed.
   */
  playerClose: () => {
    log.debug(LOG_PLAYER_CLOSE_CALLED);
    return ipcRenderer.invoke(IPC.PLAYER_CLOSE) as Promise<void>;
  },
  /**
   * Retrieves the next decoded video frame from the open player. Invokes the main
   * process over the `IPC.PLAYER_GET_FRAME` ('player-get-frame') channel. The raw frame
   * pixels are transferred as an ArrayBuffer; the caller must draw them (e.g. into a
   * canvas) and respect the generation id.
   *
   * @returns {Promise<PlayerFrame|null>} Resolves with the next decoded frame (pixel
   *   data, dimensions, presentation timestamp, and generation), or null if no frame
   *   arrived before the frame timeout.
   */
  playerGetFrame: () => {
    return ipcRenderer.invoke(IPC.PLAYER_GET_FRAME) as Promise<PlayerFrame | null>;
  },
  /**
   * Analyzes the audio of a media file and produces a downsampled waveform for the
   * timeline visualizer. Logs the request at info level, then invokes the main process
   * over the `IPC.EXTRACT_WAVEFORM` ('extract-waveform') channel.
   *
   * @param {string} filePath - Absolute path of the media file.
   * @param {number} duration - Media duration in seconds; used to size the waveform
   *   buckets.
   * @returns {Promise<WaveformData|null>} Resolves with the waveform sample rate,
   *   samples-per-bucket, and min/max buckets, or null if the waveform could not be
   *   extracted.
   * @throws {Error} Rejects with a formatted AppError if the media cannot be decoded.
   */
  extractWaveform: (filePath: string, duration: number) => {
    log.info(LOG_EXTRACT_WAVEFORM, filePath, LOG_DURATION, duration);
    return ipcRenderer.invoke(IPC.EXTRACT_WAVEFORM, filePath, duration) as Promise<WaveformData | null>;
  },
  /**
   * Extracts a grid of evenly spaced thumbnail frames from a video for the timeline
   * preview. Logs the request at info level, then invokes the main process over the
   * `IPC.EXTRACT_THUMBNAILS` ('extract-thumbnails') channel.
   *
   * @param {string} filePath - Absolute path of the video file.
   * @param {number} duration - Video duration in seconds; used to space the thumbnails
   *   evenly across the timeline.
   * @returns {Promise<ThumbnailStrip|null>} Resolves with a thumbnail strip (a single
   *   data-URL image containing `cols` x `rows` tiles), or null on failure.
   * @throws {Error} Rejects with a formatted AppError if the video cannot be decoded.
   */
  extractThumbnails: (filePath: string, duration: number) => {
    log.info(LOG_EXTRACT_THUMBNAILS, filePath, LOG_DURATION, duration);
    return ipcRenderer.invoke(IPC.EXTRACT_THUMBNAILS, filePath, duration) as Promise<ThumbnailStrip | null>;
  },

  /**
   * Minimizes the application window. Fire-and-forget: logs the call at debug level and
   * sends `IPC.WINDOW_MINIMIZE` ('window-minimize') via `ipcRenderer.send`. No response
   * is awaited, so the renderer cannot observe the outcome.
   *
   * @returns {void}
   */
  windowMinimize: () => {
    log.debug(LOG_WINDOW_MINIMIZE_CALLED);
    ipcRenderer.send(IPC.WINDOW_MINIMIZE);
  },
  /**
   * Toggles the application window between maximized and normal state. Fire-and-forget:
   * logs the call at debug level and sends `IPC.WINDOW_MAXIMIZE_TOGGLE`
   * ('window-maximize-toggle') via `ipcRenderer.send`.
   *
   * @returns {void}
   */
  windowMaximizeToggle: () => {
    log.debug(LOG_WINDOW_MAXIMIZE_TOGGLE_CALLED);
    ipcRenderer.send(IPC.WINDOW_MAXIMIZE_TOGGLE);
  },
  /**
   * Closes the application window. Fire-and-forget: logs the call at debug level and
   * sends `IPC.WINDOW_CLOSE` ('window-close') via `ipcRenderer.send`.
   *
   * @returns {void}
   */
  windowClose: () => {
    log.debug(LOG_WINDOW_CLOSE_CALLED);
    ipcRenderer.send(IPC.WINDOW_CLOSE);
  },
  /**
   * Confirms that the window may close after the renderer verified no jobs are
   * in progress (or the user chose to close anyway). Fire-and-forget: logs the
   * call at debug level and sends `IPC.WINDOW_CONFIRM_CLOSE`
   * ('window-confirm-close') via `ipcRenderer.send`. The main process marks the
   * close as confirmed and re-invokes the window close.
   *
   * @returns {void}
   */
  windowCloseConfirmed: () => {
    log.debug(LOG_WINDOW_CONFIRM_CLOSE_CALLED);
    ipcRenderer.send(IPC.WINDOW_CONFIRM_CLOSE);
  },
  /**
   * Subscribes to window close requests pushed by the main process over
   * `IPC.WINDOW_CLOSE_REQUESTED` ('window-close-requested'). The main process
   * sends this whenever a close is attempted, asking the renderer to verify
   * whether any jobs are still in progress. The renderer should either close
   * immediately (via `windowCloseConfirmed`) or ask the user for confirmation.
   * Logs each request at info level.
   *
   * @param {() => void} cb - Callback invoked when a close request arrives.
   * @returns {() => void} An unsubscribe function that removes the listener.
   */
  onWindowCloseRequested: (cb: () => void) => {
    const handler = (_event: IpcRendererEvent) => {
      log.info(LOG_ON_WINDOW_CLOSE_REQUESTED);
      cb();
    };
    ipcRenderer.on(IPC.WINDOW_CLOSE_REQUESTED, handler);
    return () => ipcRenderer.removeListener(IPC.WINDOW_CLOSE_REQUESTED, handler);
  },
  /**
   * Sets whether the application window should stay on top of other windows.
   * Fire-and-forget: logs the call at debug level and sends
   * `IPC.WINDOW_SET_ALWAYS_ON_TOP` ('window-set-always-on-top') with the flag via
   * `ipcRenderer.send`.
   *
   * @param {boolean} flag - true to keep the window always-on-top, false to disable it.
   * @returns {void}
   */
  windowSetAlwaysOnTop: (flag: boolean) => {
    log.debug(LOG_WINDOW_SET_ALWAYS_ON_TOP_CALLED, { flag });
    ipcRenderer.send(IPC.WINDOW_SET_ALWAYS_ON_TOP, flag);
  },
  /**
   * Adds or removes the app from the operating system's login items (launch at
   * startup). Fire-and-forget: logs the call at debug level and sends
   * `IPC.SET_LAUNCH_AT_LOGIN` ('set-launch-at-login') with the flag via
   * `ipcRenderer.send`.
   *
   * @param {boolean} enabled - true to start the app at login, false to remove it.
   * @returns {void}
   */
  setLaunchAtLogin: (enabled: boolean) => {
    log.debug(LOG_SET_LAUNCH_AT_LOGIN_CALLED, { enabled });
    ipcRenderer.send(IPC.SET_LAUNCH_AT_LOGIN, enabled);
  },

  /**
   * Subscribes to window maximized / un-maximized state changes pushed by the main
   * process over `IPC.WINDOW_MAXIMIZED_CHANGED` ('window-maximized-changed'). Logs each
   * event at debug level.
   *
   * @param {(maximized: boolean) => void} cb - Callback invoked with the new maximized
   *   state whenever it changes.
   * @returns {() => void} An unsubscribe function that removes the listener; call it
   *   during cleanup to prevent leaks.
   */
  onWindowMaximizedChange: (cb: (maximized: boolean) => void) => {
    const handler = (_event: IpcRendererEvent, maximized: boolean) => {
      log.debug(LOG_ON_WINDOW_MAXIMIZED_CHANGE, maximized);
      cb(maximized);
    };
    ipcRenderer.on(IPC.WINDOW_MAXIMIZED_CHANGED, handler);
    return () => ipcRenderer.removeListener(IPC.WINDOW_MAXIMIZED_CHANGED, handler);
  },

  /**
   * Subscribes to real-time progress events for the active single-file conversion,
   * pushed over `IPC.CONVERSION_PROGRESS` ('conversion-progress'). Logs the progress
   * percentage (one decimal place) at debug level.
   *
   * @param {(data: { input: string; output: string; progress: ConversionProgress }) => void} cb -
   *   Callback receiving the source path, destination path, and the progress snapshot
   *   (percent, elapsed time, fps, speed, ETA, bitrate).
   * @returns {() => void} An unsubscribe function that removes the listener.
   */
  onConversionProgress: (cb: (data: { input: string; output: string; progress: ConversionProgress }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { input: string; output: string; progress: ConversionProgress }) => {
      log.debug(LOG_ON_CONVERSION_PROGRESS, data.input, data.progress.percent.toFixed(1) + '%');
      cb(data);
    };
    ipcRenderer.on(IPC.CONVERSION_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC.CONVERSION_PROGRESS, handler);
  },
  /**
   * Subscribes to job-added events from the conversion queue, pushed over
   * `IPC.QUEUE_ADDED` ('queue-added'). Logs the job id and input path at info level.
   *
   * @param {(job: QueueJob) => void} cb - Callback invoked with the newly added job.
   * @returns {() => void} An unsubscribe function that removes the listener.
   */
  onQueueAdded: (cb: (job: QueueJob) => void) => {
    const handler = (_event: IpcRendererEvent, job: QueueJob) => {
      log.info(LOG_ON_QUEUE_ADDED, job.id, job.input);
      cb(job);
    };
    ipcRenderer.on(IPC.QUEUE_ADDED, handler);
    return () => ipcRenderer.removeListener(IPC.QUEUE_ADDED, handler);
  },
  /**
   * Subscribes to job-removed events from the conversion queue, pushed over
   * `IPC.QUEUE_REMOVED` ('queue-removed'). Logs the removed job id at info level.
   *
   * @param {(id: string) => void} cb - Callback invoked with the id of the removed job.
   * @returns {() => void} An unsubscribe function that removes the listener.
   */
  onQueueRemoved: (cb: (id: string) => void) => {
    const handler = (_event: IpcRendererEvent, id: string) => {
      log.info(LOG_ON_QUEUE_REMOVED, id);
      cb(id);
    };
    ipcRenderer.on(IPC.QUEUE_REMOVED, handler);
    return () => ipcRenderer.removeListener(IPC.QUEUE_REMOVED, handler);
  },
  /**
   * Subscribes to queue job status transitions (queued, running, finished, failed),
   * pushed over `IPC.QUEUE_STATUS_CHANGE` ('queue-status-change'). Logs the job id and
   * new status at debug level.
   *
   * @param {(job: QueueJob) => void} cb - Callback invoked with the job in its new status.
   * @returns {() => void} An unsubscribe function that removes the listener.
   */
  onQueueStatusChange: (cb: (job: QueueJob) => void) => {
    const handler = (_event: IpcRendererEvent, job: QueueJob) => {
      log.debug(LOG_ON_QUEUE_STATUS_CHANGE, job.id, job.status);
      cb(job);
    };
    ipcRenderer.on(IPC.QUEUE_STATUS_CHANGE, handler);
    return () => ipcRenderer.removeListener(IPC.QUEUE_STATUS_CHANGE, handler);
  },
  /**
   * Subscribes to per-job progress events from the conversion queue, pushed over
   * `IPC.QUEUE_PROGRESS` ('queue-progress'). Unlike `onConversionProgress`, which covers
   * only the standalone conversion, this covers jobs managed by the queue manager.
   *
   * @param {(data: { job: QueueJob; progress: ConversionProgress }) => void} cb - Callback
   *   receiving the queued job and its progress snapshot.
   * @returns {() => void} An unsubscribe function that removes the listener.
   */
  onQueueProgress: (cb: (data: { job: QueueJob; progress: ConversionProgress }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { job: QueueJob; progress: ConversionProgress }) => {
      cb(data);
    };
    ipcRenderer.on(IPC.QUEUE_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC.QUEUE_PROGRESS, handler);
  },
  /**
   * Subscribes to the notification that the whole queue has been cancelled, pushed over
   * `IPC.QUEUE_CANCELLED` ('queue-cancelled'). Logs the event at info level.
   *
   * @param {() => void} cb - Callback invoked once when the queue is cancelled.
   * @returns {() => void} An unsubscribe function that removes the listener.
   */
  onQueueCancelled: (cb: () => void) => {
    const handler = (_event: IpcRendererEvent) => {
      log.info(LOG_ON_QUEUE_CANCELLED);
      cb();
    };
    ipcRenderer.on(IPC.QUEUE_CANCELLED, handler);
    return () => ipcRenderer.removeListener(IPC.QUEUE_CANCELLED, handler);
  },
  /**
   * Subscribes to the notification that a QUEUED job was reordered, pushed over
   * `IPC.QUEUE_MOVED` ('queue-moved').
   *
   * @param {(data: { id: string; toPosition: number }) => void} cb - Callback
   *   receiving the moved job id and its new index within the QUEUED
   *   subsequence.
   * @returns {() => void} An unsubscribe function that removes the listener.
   */
  onQueueMoved: (cb: (data: { id: string; toPosition: number }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { id: string; toPosition: number }) => {
      log.debug(LOG_ON_QUEUE_MOVED, data.id, data.toPosition);
      cb(data);
    };
    ipcRenderer.on(IPC.QUEUE_MOVED, handler);
    return () => ipcRenderer.removeListener(IPC.QUEUE_MOVED, handler);
  },
  /**
   * Subscribes to decoded video frames emitted by the native player, pushed over
   * `IPC.PLAYER_FRAME` ('player-frame'). Frames carry raw pixel data as an ArrayBuffer
   * and must be drawn by the renderer (e.g. into a canvas); frames tagged with a stale
   * generation should be discarded after a seek or reopen.
   *
   * @param {(frame: PlayerFrame) => void} cb - Callback invoked for each decoded frame.
   * @returns {() => void} An unsubscribe function that removes the listener.
   */
  onPlayerFrame: (cb: (frame: PlayerFrame) => void) => {
    const handler = (_event: IpcRendererEvent, frame: PlayerFrame) => {
      cb(frame);
    };
    ipcRenderer.on(IPC.PLAYER_FRAME, handler);
    return () => ipcRenderer.removeListener(IPC.PLAYER_FRAME, handler);
  },
  /**
   * Subscribes to decoded audio chunks emitted by the native player, pushed over
   * `IPC.PLAYER_AUDIO` ('player-audio'). Chunks carry raw PCM data as an ArrayBuffer
   * that the renderer feeds to the Web Audio API; chunks tagged with a stale generation
   * should be discarded after a seek or reopen.
   *
   * @param {(chunk: PlayerAudioChunk) => void} cb - Callback invoked for each audio chunk.
   * @returns {() => void} An unsubscribe function that removes the listener.
   */
  onPlayerAudio: (cb: (chunk: PlayerAudioChunk) => void) => {
    const handler = (_event: IpcRendererEvent, chunk: PlayerAudioChunk) => {
      cb(chunk);
    };
    ipcRenderer.on(IPC.PLAYER_AUDIO, handler);
    return () => ipcRenderer.removeListener(IPC.PLAYER_AUDIO, handler);
  },
  /**
   * Subscribes to player error notifications, pushed over `IPC.PLAYER_ERROR`
   * ('player-error'). The main process forwards the decoder's error message text.
   *
   * @param {(message: string) => void} cb - Callback invoked with the human-readable
   *   error message.
   * @returns {() => void} An unsubscribe function that removes the listener.
   */
  onPlayerError: (cb: (message: string) => void) => {
    const handler = (_event: IpcRendererEvent, message: string) => {
      cb(message);
    };
    ipcRenderer.on(IPC.PLAYER_ERROR, handler);
    return () => ipcRenderer.removeListener(IPC.PLAYER_ERROR, handler);
  },
  /**
   * Subscribes to the main process log stream, pushed over `IPC.LOG_MESSAGE`
   * ('log-message'). Each entry includes a timestamp, severity level, text, and source
   * (always 'main'; see `LogEntry` in src/shared/types.ts), enabling the renderer to
   * render a live log panel.
   *
   * @param {(entry: LogEntry) => void} cb - Callback invoked for each forwarded log entry.
   * @returns {() => void} An unsubscribe function that removes the listener.
   */
  onLogMessage: (cb: (entry: LogEntry) => void) => {
    const handler = (_event: IpcRendererEvent, entry: LogEntry) => {
      cb(entry);
    };
    ipcRenderer.on(IPC.LOG_MESSAGE, handler);
    return () => ipcRenderer.removeListener(IPC.LOG_MESSAGE, handler);
  },
};

/**
 * Exposes the secure `api` surface to the renderer process as `window.electronAPI`.
 * `contextBridge` guarantees that the object crossing the context-isolation boundary
 * is a frozen, structured-cloneable snapshot of the API: functions and values are
 * copied, and the renderer cannot reach past them into the preload context or the
 * main process.
 */
contextBridge.exposeInMainWorld('electronAPI', api);
