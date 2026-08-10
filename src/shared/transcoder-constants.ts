/**
 * @fileoverview Constants for the transcoder backends (FFmpeg API, FFmpeg CLI, BMF).
 * Centralizes transcoder identifiers and labels, FFmpeg/FFprobe CLI flags,
 * progress-parsing regexes, process timeouts and defaults, and the default
 * encoding parameters used when starting a conversion.
 */

import type { TranscoderType } from './types';

/**
 * Supported transcoder backend identifiers.
 * @const {readonly string[]} TRANSCODER_TYPES
 */
export const TRANSCODER_TYPES = ['FFMPEG', 'FFTOOL', 'BMF'] as const;

/**
 * Human-readable labels for each transcoder backend, shown in the UI.
 * @const {Record<TranscoderType, string>} TRANSCODER_LABELS
 */
export const TRANSCODER_LABELS: Record<TranscoderType, string> = {
  FFMPEG: 'FFmpeg (API)',
  FFTOOL: 'FFmpeg (CLI)',
  BMF: 'BMF Framework',
};

/**
 * FFmpeg CLI argument flags used to build command lines for conversions,
 * extractions, and previews.
 * @const {Object} FFMPEG_FLAGS
 * @property {string} COPY - Flag to select a stream (-c).
 * @property {string} COPY_VALUE - Value meaning "copy the stream unchanged".
 * @property {string} VIDEO_CODEC - Flag for the video encoder (-vcodec).
 * @property {string} AUDIO_CODEC - Flag for the audio encoder (-acodec).
 * @property {string} VIDEO_BITRATE - Flag for the video bitrate (-b:v).
 * @property {string} AUDIO_BITRATE - Flag for the audio bitrate (-b:a).
 * @property {string} QSCALE - Flag for the video quality scale (-qscale:v).
 * @property {string} VIDEO_FILTER - Flag introducing a video filter chain (-vf).
 * @property {string} SCALE - Filter name prefix for scaling (scale=).
 * @property {string} PIX_FMT - Flag for the pixel format (-pix_fmt).
 * @property {string} COLOR_RANGE - Flag for the color range (-color_range).
 * @property {string} COLOR_RANGE_FULL - Value meaning full color range.
 * @property {string} START - Flag for the start offset (-ss).
 * @property {string} END - Flag for the end time (-to).
 * @property {string} DURATION - Flag for the duration limit (-t).
 * @property {string} OVERWRITE - Flag to overwrite output files (-y).
 * @property {string} INPUT - Flag introducing an input file (-i).
 * @property {string} RAWVIDEO - Value selecting the rawvideo decoder.
 * @property {string} PIX_FMT_RGB24 - Pixel format value for 24-bit RGB.
 * @property {string} NO_AUDIO - Flag disabling the audio stream (-an).
 * @property {string} NO_VIDEO - Flag disabling the video stream (-vn).
 * @property {string} NO_SUBTITLES - Flag disabling subtitle streams (-sn).
 * @property {string} NO_DATA - Flag disabling data streams (-dn).
 * @property {string} OUTPUT_PIPE - Output target meaning stdout (pipe) ('-').
 * @property {string} REALTIME - Flag to read input at native rate (-re).
 * @property {string} COPYTS - Flag to copy timestamps (-copyts).
 */
export const FFMPEG_FLAGS = {
  COPY: '-c',
  COPY_VALUE: 'copy',
  VIDEO_CODEC: '-vcodec',
  AUDIO_CODEC: '-acodec',
  VIDEO_BITRATE: '-b:v',
  AUDIO_BITRATE: '-b:a',
  QSCALE: '-qscale:v',
  VIDEO_FILTER: '-vf',
  SCALE: 'scale=',
  PIX_FMT: '-pix_fmt',
  COLOR_RANGE: '-color_range',
  COLOR_RANGE_FULL: 'full',
  START: '-ss',
  END: '-to',
  DURATION: '-t',
  OVERWRITE: '-y',
  INPUT: '-i',
  RAWVIDEO: 'rawvideo',
  PIX_FMT_RGB24: 'rgb24',
  NO_AUDIO: '-an',
  NO_VIDEO: '-vn',
  NO_SUBTITLES: '-sn',
  NO_DATA: '-dn',
  OUTPUT_PIPE: '-',
  REALTIME: '-re',
  COPYTS: '-copyts',
} as const;

/**
 * FFprobe CLI flags used to produce machine-readable media information.
 * @const {Object} FFPROBE_FLAGS
 * @property {string} VERBOSE - Flag controlling verbosity (-v).
 * @property {string} QUIET - Value suppressing informational output ('quiet').
 * @property {string} PRINT_FORMAT - Flag selecting the output format (-print_format).
 * @property {string} FORMAT_JSON - Value selecting JSON output ('json').
 * @property {string} SHOW_FORMAT - Flag to show container-level info (-show_format).
 * @property {string} SHOW_STREAMS - Flag to show stream-level info (-show_streams).
 */
export const FFPROBE_FLAGS = {
  VERBOSE: '-v',
  QUIET: 'quiet',
  PRINT_FORMAT: '-print_format',
  FORMAT_JSON: 'json',
  SHOW_FORMAT: '-show_format',
  SHOW_STREAMS: '-show_streams',
} as const;

/**
 * Regular expressions used to parse progress information from FFmpeg output.
 * @const {Object} PROGRESS_PATTERNS
 * @property {RegExp} TIME - Global regex matching every time=HH:MM:SS.fff marker.
 * @property {RegExp} TIME_SINGLE - Non-global regex matching the first time marker.
 */
export const PROGRESS_PATTERNS = {
  TIME: /time=(\d+:\d+:\d+\.\d+)/g,
  TIME_SINGLE: /time=(\d+:\d+:\d+\.\d+)/,
} as const;

/**
 * Executable command names for each transcoder backend and its probe utility.
 * @const {Object} TRANSCODER_COMMANDS
 * @property {string} BMF_FFMPEG - BMF-bundled ffmpeg executable name.
 * @property {string} BMF_FFPROBE - BMF-bundled ffprobe executable name.
 * @property {string} FFMPEG - System ffmpeg executable name.
 * @property {string} FFPROBE - System ffprobe executable name.
 */
export const TRANSCODER_COMMANDS = {
  BMF_FFMPEG: 'bmf_ffmpeg',
  BMF_FFPROBE: 'bmf_ffprobe',
  FFMPEG: 'ffmpeg',
  FFPROBE: 'ffprobe',
} as const;

/**
 * Signal used to force-kill child processes.
 * @const {string} KILL_SIGNAL
 */
export const KILL_SIGNAL = 'SIGKILL' as const;

/**
 * Default process and timing settings for the transcoders and the player.
 * @const {Object} TRANSCODER_DEFAULTS
 * @property {number} PROGRESS_INTERVAL_MS - Interval between progress emissions.
 * @property {number} BMF_TIMEOUT_MS - Timeout for BMF operations.
 * @property {number} PLAYER_FRAME_TIMEOUT_MS - Timeout when waiting for a player frame.
 * @property {number} PLAYER_DEFAULT_WIDTH - Default player video width in pixels.
 * @property {number} PLAYER_DEFAULT_HEIGHT - Default player video height in pixels.
 * @property {number} PLAYER_PREVIEW_MAX_WIDTH - Maximum preview width in pixels.
 * @property {number} PLAYER_PREVIEW_MAX_HEIGHT - Maximum preview height in pixels.
 * @property {number} PLAYER_FPS_CAP - Maximum frames per second delivered to the player.
 * @property {number} FFPROBE_TIMEOUT_MS - Timeout for ffprobe operations.
 * @property {number} PROGRESS_THROTTLE_MS - Minimum interval between throttled progress updates.
 */
export const TRANSCODER_DEFAULTS = {
  PROGRESS_INTERVAL_MS: 500,
  BMF_TIMEOUT_MS: 30000,
  PLAYER_FRAME_TIMEOUT_MS: 5000,
  PLAYER_DEFAULT_WIDTH: 640,
  PLAYER_DEFAULT_HEIGHT: 360,
  PLAYER_PREVIEW_MAX_WIDTH: 640,
  PLAYER_PREVIEW_MAX_HEIGHT: 360,
  PLAYER_FPS_CAP: 30,
  FFPROBE_TIMEOUT_MS: 30000,
  PROGRESS_THROTTLE_MS: 250,
} as const;

/**
 * Sentinel progress value reported when a conversion has completed (100%).
 * @const {Object} COMPLETED_PROGRESS
 * @property {number} percent - Final progress percentage (100).
 * @property {string} time - Final time marker ('Done').
 * @property {string} speed - Speed indicator ('-').
 * @property {string} eta - Remaining time ('0').
 */
export const COMPLETED_PROGRESS = {
  percent: 100,
  time: 'Done',
  speed: '-',
  eta: '0',
} as const;

/**
 * Initial/zero progress value reported before a conversion produces data.
 * @const {Object} EMPTY_PROGRESS
 * @property {string} time - Time marker ('00:00:00').
 * @property {string} speed - Speed indicator ('0x').
 * @property {string} eta - Remaining time ('0').
 * @property {number} fps - Frames per second (0).
 * @property {number} percent - Progress percentage (0).
 * @property {string} bitrate - Current bitrate ('').
 */
export const EMPTY_PROGRESS = {
  time: '00:00:00',
  speed: '0x',
  eta: '0',
  fps: 0,
  percent: 0,
  bitrate: '',
} as const;

/**
 * Default encoding parameters applied when a conversion is started without
 * explicit values for them.
 * @const {Object} CONVERSION_DEFAULTS
 * @property {string} VIDEO_CODEC - Default video encoder ('libx264').
 * @property {string} AUDIO_CODEC - Default audio encoder ('aac').
 * @property {number} QSCALE - Default video quality scale (23).
 * @property {string} PIXEL_FORMAT - Default pixel format ('yuv420p').
 * @property {string} SCALE - Default output resolution ('1920x1080').
 * @property {string} VIDEO_BITRATE - Default video bitrate ('2000k').
 * @property {string} AUDIO_BITRATE - Default audio bitrate ('192k').
 */
export const CONVERSION_DEFAULTS = {
  VIDEO_CODEC: 'libx264',
  AUDIO_CODEC: 'aac',
  QSCALE: 23,
  PIXEL_FORMAT: 'yuv420p',
  SCALE: '1920x1080',
  VIDEO_BITRATE: '2000k',
  AUDIO_BITRATE: '192k',
} as const;

/**
 * Valid range for the -qscale:v quality scale value.
 * @const {Object} QSCALE_RANGE
 * @property {number} MIN - Minimum quality scale (1 = best quality).
 * @property {number} MAX - Maximum quality scale (31 = worst quality).
 */
export const QSCALE_RANGE = {
  MIN: 1,
  MAX: 31,
} as const;
