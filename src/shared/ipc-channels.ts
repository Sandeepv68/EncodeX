/**
 * @fileoverview IPC channel names used for inter-process communication.
 * Defines the canonical channel identifiers shared by the main process (ipcMain
 * handlers) and the renderer/preload layer (ipcRenderer invocations and event
 * subscriptions). Keeping them in one place prevents drift across the IPC boundary.
 */

/**
 * Inter-process communication channel names.
 * @const {Object} IPC
 * @property {string} SELECT_FILE - Open a single-file selection dialog.
 * @property {string} SELECT_FILES - Open a multi-file selection dialog.
 * @property {string} SELECT_OUTPUT - Choose an output file location.
 * @property {string} GET_MEDIA_INFO - Probe a media file for format and stream info.
 * @property {string} GET_IMAGE_INFO - Read image dimensions and format info.
 * @property {string} GET_IMAGE_PREVIEW - Generate a preview of an image.
 * @property {string} GET_IMAGE_FILE_INFO - Read image file size and dimensions.
 * @property {string} GET_VIDEO_PREVIEW - Extract a preview frame from a video.
 * @property {string} GET_CAPABILITIES - Enumerate encoder and hwaccel capabilities.
 * @property {string} CONVERT_FILE - Start a conversion job.
 * @property {string} CANCEL_CONVERSION - Cancel the active conversion.
 * @property {string} PAUSE_CONVERSION - Pause the active conversion.
 * @property {string} RESUME_CONVERSION - Resume a paused conversion.
 * @property {string} QUEUE_ADD - Add a job to the batch queue.
 * @property {string} QUEUE_REMOVE - Remove a job from the batch queue.
 * @property {string} QUEUE_LIST - List all batch queue jobs.
 * @property {string} QUEUE_CANCEL_ALL - Cancel every queued and running job.
 * @property {string} PLAYER_OPEN - Open a video in the player.
 * @property {string} PLAYER_SEEK - Seek the player to a timestamp.
 * @property {string} PLAYER_CLOSE - Close the player.
 * @property {string} PLAYER_GET_FRAME - Request a single decoded frame.
 * @property {string} PLAYER_AUDIO - Push decoded audio to the player.
 * @property {string} PLAYER_ERROR - Report a player error to the renderer.
 * @property {string} EXTRACT_WAVEFORM - Extract waveform data for a file.
 * @property {string} EXTRACT_THUMBNAILS - Extract a thumbnail strip for a file.
 * @property {string} WINDOW_MINIMIZE - Minimize the main window.
 * @property {string} WINDOW_MAXIMIZE_TOGGLE - Toggle the window maximize state.
 * @property {string} WINDOW_CLOSE - Close the main window.
 * @property {string} WINDOW_SET_ALWAYS_ON_TOP - Set the always-on-top window flag.
 * @property {string} WINDOW_MAXIMIZED_CHANGED - Notify that the maximize state changed.
 * @property {string} CONVERSION_PROGRESS - Push conversion progress updates.
 * @property {string} QUEUE_ADDED - Notify that a job was added to the queue.
 * @property {string} QUEUE_REMOVED - Notify that a job was removed from the queue.
 * @property {string} QUEUE_STATUS_CHANGE - Notify of a queue job status change.
 * @property {string} QUEUE_PROGRESS - Push per-job progress updates.
 * @property {string} QUEUE_CANCELLED - Notify that the queue was cancelled.
 * @property {string} PLAYER_FRAME - Push a decoded frame to the renderer player.
 * @property {string} LOG_MESSAGE - Forward a log entry to the renderer.
 */
export const IPC = {
  SELECT_FILE: 'select-file',
  SELECT_FILES: 'select-files',
  SELECT_OUTPUT: 'select-output',
  GET_MEDIA_INFO: 'get-media-info',
  GET_IMAGE_INFO: 'get-image-info',
  GET_IMAGE_PREVIEW: 'get-image-preview',
  GET_IMAGE_FILE_INFO: 'get-image-file-info',
  GET_VIDEO_PREVIEW: 'get-video-preview',
  GET_CAPABILITIES: 'get-capabilities',
  CONVERT_FILE: 'convert-file',
  CANCEL_CONVERSION: 'cancel-conversion',
  PAUSE_CONVERSION: 'pause-conversion',
  RESUME_CONVERSION: 'resume-conversion',
  QUEUE_ADD: 'queue-add',
  QUEUE_REMOVE: 'queue-remove',
  QUEUE_LIST: 'queue-list',
  QUEUE_CANCEL_ALL: 'queue-cancel-all',
  PLAYER_OPEN: 'player-open',
  PLAYER_SEEK: 'player-seek',
  PLAYER_CLOSE: 'player-close',
  PLAYER_GET_FRAME: 'player-get-frame',
  PLAYER_AUDIO: 'player-audio',
  PLAYER_ERROR: 'player-error',
  EXTRACT_WAVEFORM: 'extract-waveform',
  EXTRACT_THUMBNAILS: 'extract-thumbnails',

  WINDOW_MINIMIZE: 'window-minimize',
  WINDOW_MAXIMIZE_TOGGLE: 'window-maximize-toggle',
  WINDOW_CLOSE: 'window-close',
  WINDOW_SET_ALWAYS_ON_TOP: 'window-set-always-on-top',
  WINDOW_MAXIMIZED_CHANGED: 'window-maximized-changed',

  CONVERSION_PROGRESS: 'conversion-progress',
  QUEUE_ADDED: 'queue-added',
  QUEUE_REMOVED: 'queue-removed',
  QUEUE_STATUS_CHANGE: 'queue-status-change',
  QUEUE_PROGRESS: 'queue-progress',
  QUEUE_CANCELLED: 'queue-cancelled',
  PLAYER_FRAME: 'player-frame',
  LOG_MESSAGE: 'log-message',
} as const;
