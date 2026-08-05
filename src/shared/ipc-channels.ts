/**
 * @fileoverview IPC channel constants for inter-process communication.
 * Defines all available channels for communication between main, preload, and renderer processes.
 */

/**
 * Inter-process communication channel names.
 * @const {Object} IPC
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
