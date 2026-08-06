/**
 * @fileoverview Shared application constants extracted from source files.
 * Groups numeric and string constants used across main and renderer processes,
 * covering image analysis, capability probing, CLI conversion, video preview,
 * waveform/thumbnail extraction, process limits, the media player, timeline UI,
 * histogram charts, notifications, stores, i18n, and window settings.
 */

// --- Image analysis ---
/**
 * Number of bins used in the RGB/luma histogram calculation for images.
 * @const {number} HISTOGRAM_BINS
 */
export const HISTOGRAM_BINS = 256;

/**
 * Maximum width in pixels of the generated histogram image.
 * @const {number} HISTOGRAM_MAX_WIDTH
 */
export const HISTOGRAM_MAX_WIDTH = 256;

/**
 * Bytes per pixel for 24-bit RGB image data.
 * @const {number} RGB_BYTES_PER_PIXEL
 */
export const RGB_BYTES_PER_PIXEL = 3;

/**
 * Weights used to compute luma (brightness) from the RGB channels,
 * matching the ITU-R BT.601 standard.
 * @const {Object} LUMA_WEIGHTS
 * @property {number} R - Weight applied to the red channel.
 * @property {number} G - Weight applied to the green channel.
 * @property {number} B - Weight applied to the blue channel.
 */
export const LUMA_WEIGHTS = {
  R: 0.299,
  G: 0.587,
  B: 0.114,
} as const;

// --- Image file probing ---
/**
 * Number of bytes read from the start of an image file to probe its format/header.
 * @const {number} IMAGE_HEADER_READ_SIZE
 */
export const IMAGE_HEADER_READ_SIZE = 65536;

// --- Capabilities ---
/**
 * Timeout in milliseconds for probing FFmpeg encoder and hardware acceleration capabilities.
 * @const {number} CAPABILITY_PROBE_TIMEOUT_MS
 */
export const CAPABILITY_PROBE_TIMEOUT_MS = 10000;

// --- CLI ---
/**
 * Timeout in milliseconds for a single CLI (FFTOOL) conversion run.
 * @const {number} CLI_CONVERSION_TIMEOUT_MS
 */
export const CLI_CONVERSION_TIMEOUT_MS = 300000;

// --- Video preview ---
/**
 * Maximum width in pixels of extracted video preview frames.
 * @const {number} VIDEO_PREVIEW_MAX_WIDTH
 */
export const VIDEO_PREVIEW_MAX_WIDTH = 480;

/**
 * Timestamp used when extracting the video preview frame.
 * @const {string} VIDEO_PREVIEW_SEEK_TIME
 */
export const VIDEO_PREVIEW_SEEK_TIME = '00:00:01';

// --- Waveform extraction ---
/**
 * Sample rate in Hz at which audio is decoded for waveform extraction.
 * @const {number} WAVEFORM_SAMPLE_RATE
 */
export const WAVEFORM_SAMPLE_RATE = 8000;

/**
 * Target number of waveform buckets generated per second of audio.
 * @const {number} WAVEFORM_BUCKETS_PER_SECOND
 */
export const WAVEFORM_BUCKETS_PER_SECOND = 40;

/**
 * Maximum number of waveform buckets produced for the whole file.
 * @const {number} WAVEFORM_MAX_BUCKETS
 */
export const WAVEFORM_MAX_BUCKETS = 24000;

/**
 * Minimum number of waveform buckets kept when downsampling long files.
 * @const {number} WAVEFORM_MIN_BUCKETS
 */
export const WAVEFORM_MIN_BUCKETS = 200;

/**
 * Duration in seconds of each parallel FFmpeg segment during waveform extraction.
 * @const {number} WAVEFORM_SEGMENT_SECONDS
 */
export const WAVEFORM_SEGMENT_SECONDS = 30;

/**
 * Minimum number of parallel segments used for waveform extraction.
 * @const {number} WAVEFORM_MIN_SEGMENTS
 */
export const WAVEFORM_MIN_SEGMENTS = 12;

/**
 * Maximum number of parallel segments used for waveform extraction.
 * @const {number} WAVEFORM_MAX_SEGMENTS
 */
export const WAVEFORM_MAX_SEGMENTS = 48;

/**
 * Maximum number of concurrent FFmpeg processes used for waveform extraction.
 * @const {number} WAVEFORM_PARALLEL
 */
export const WAVEFORM_PARALLEL = 8;

// --- Thumbnail extraction ---
/**
 * Width in pixels of each generated thumbnail frame.
 * @const {number} THUMB_WIDTH
 */
export const THUMB_WIDTH = 160;

/**
 * Height in pixels of each generated thumbnail frame.
 * @const {number} THUMB_HEIGHT
 */
export const THUMB_HEIGHT = 90;

/**
 * Number of thumbnails placed per row in the generated contact sheet.
 * @const {number} THUMB_TILE_COLS
 */
export const THUMB_TILE_COLS = 10;

/**
 * Maximum number of thumbnails extracted per file.
 * @const {number} THUMB_MAX_COUNT
 */
export const THUMB_MAX_COUNT = 100;

/**
 * Time in seconds between thumbnails sampled from the source video.
 * @const {number} THUMB_INTERVAL_SECONDS
 */
export const THUMB_INTERVAL_SECONDS = 8;

/**
 * Maximum number of concurrent FFmpeg processes used for thumbnail extraction.
 * @const {number} THUMB_PARALLEL
 */
export const THUMB_PARALLEL = 16;

// --- Process / error reporting ---
/**
 * Global cap on the number of FFmpeg processes running at the same time.
 * @const {number} MAX_CONCURRENT_FFMPEG
 */
export const MAX_CONCURRENT_FFMPEG = 8;

/**
 * Maximum amplitude of a 16-bit signed PCM sample (2^15), used to normalize waveform peaks.
 * @const {number} PCM_MAX_AMPLITUDE
 */
export const PCM_MAX_AMPLITUDE = 32768;

/**
 * Number of trailing characters of process stderr logged when an operation fails.
 * @const {number} ERROR_LOG_TAIL_CHARS
 */
export const ERROR_LOG_TAIL_CHARS = 200;

/**
 * POSIX signal used to suspend a running process (pause) on Unix-like platforms.
 * @const {string} PROCESS_SUSPEND_SIGNAL
 */
export const PROCESS_SUSPEND_SIGNAL = 'SIGSTOP';

/**
 * POSIX signal used to resume a suspended process on Unix-like platforms.
 * @const {string} PROCESS_RESUME_SIGNAL
 */
export const PROCESS_RESUME_SIGNAL = 'SIGCONT';

// --- Frame decoder ---
/**
 * Duration in seconds of each audio chunk decoded by the frame decoder.
 * @const {number} AUDIO_CHUNK_SECONDS
 */
export const AUDIO_CHUNK_SECONDS = 0.05;

/**
 * Minimum buffered duration in milliseconds before decoded frames are flushed to the player.
 * @const {number} FRAME_FLUSH_THRESHOLD_MS
 */
export const FRAME_FLUSH_THRESHOLD_MS = 200;

/**
 * Interval in milliseconds between frame-flush timer ticks.
 * @const {number} FRAME_FLUSH_INTERVAL_MS
 */
export const FRAME_FLUSH_INTERVAL_MS = 16;

/**
 * Exponential smoothing factor (0-1) applied to measured frame durations.
 * @const {number} FRAME_DURATION_SMOOTHING
 */
export const FRAME_DURATION_SMOOTHING = 0.9;

/**
 * Fallback frame duration in seconds (1/30) used when the source frame rate is unknown.
 * @const {number} DEFAULT_FRAME_DURATION
 */
export const DEFAULT_FRAME_DURATION = 1 / 30;

/**
 * Minimum byte size of a decoded audio chunk before it is pushed downstream.
 * @const {number} AUDIO_TARGET_MIN_BYTES
 */
export const AUDIO_TARGET_MIN_BYTES = 512;

/**
 * Buffered frame count that triggers a frame-buffer overflow warning.
 * @const {number} FRAME_BUFFER_OVERFLOW_WARN
 */
export const FRAME_BUFFER_OVERFLOW_WARN = 30;

// --- Player audio ---
/**
 * Minimum allowed audio sample rate in Hz for player audio output.
 * @const {number} AUDIO_MIN_SAMPLE_RATE
 */
export const AUDIO_MIN_SAMPLE_RATE = 8000;

/**
 * Default audio sample rate in Hz used when the source rate is unsupported.
 * @const {number} AUDIO_DEFAULT_SAMPLE_RATE
 */
export const AUDIO_DEFAULT_SAMPLE_RATE = 48000;

/**
 * Minimum allowed audio channel count for player audio output.
 * @const {number} AUDIO_MIN_CHANNELS
 */
export const AUDIO_MIN_CHANNELS = 1;

/**
 * Default audio channel count used when the source channel layout is unsupported.
 * @const {number} AUDIO_DEFAULT_CHANNELS
 */
export const AUDIO_DEFAULT_CHANNELS = 2;

/**
 * Minimum video frame dimension (width or height) in pixels accepted by the player.
 * @const {number} PLAYER_MIN_DIMENSION
 */
export const PLAYER_MIN_DIMENSION = 2;

// --- Renderer media player ---
/**
 * How far ahead of the current playback position, in seconds, audio is scheduled.
 * @const {number} AUDIO_LOOKAHEAD_SECONDS
 */
export const AUDIO_LOOKAHEAD_SECONDS = 0.75;

/**
 * Maximum number of audio chunks kept pending in the renderer audio queue.
 * @const {number} MAX_PENDING_AUDIO_CHUNKS
 */
export const MAX_PENDING_AUDIO_CHUNKS = 200;

/**
 * Time window in milliseconds during which rapid seek requests are coalesced.
 * @const {number} SEEK_COALESCE_MS
 */
export const SEEK_COALESCE_MS = 120;

/**
 * Maximum number of video frames buffered ahead of the playback position.
 * @const {number} MAX_BUFFERED_FRAMES
 */
export const MAX_BUFFERED_FRAMES = 30;

/**
 * Maximum lookahead in seconds used when buffering frames ahead of playback.
 * @const {number} MAX_FRAME_LOOKAHEAD_S
 */
export const MAX_FRAME_LOOKAHEAD_S = 3;

/**
 * Duration in milliseconds without a new frame before the player force-draws a stalled frame.
 * @const {number} STALL_DRAW_TIMEOUT_MS
 */
export const STALL_DRAW_TIMEOUT_MS = 400;

/**
 * Duration in milliseconds after which the audio clock is considered frozen and resynced.
 * @const {number} AUDIO_CLOCK_FROZEN_MS
 */
export const AUDIO_CLOCK_FROZEN_MS = 500;

/**
 * Maximum number of scheduled audio chunks allowed before the scheduler backs off.
 * @const {number} AUDIO_SCHEDULE_GUARD_MAX
 */
export const AUDIO_SCHEDULE_GUARD_MAX = 200;

/**
 * Duration in milliseconds with no new frames before a frame-stall warning is logged.
 * @const {number} FRAME_STALL_WARN_MS
 */
export const FRAME_STALL_WARN_MS = 3000;

// --- Timeline UI ---
/**
 * Default width in pixels of the timeline ruler.
 * @const {number} DEFAULT_TIMELINE_WIDTH
 */
export const DEFAULT_TIMELINE_WIDTH = 600;

/**
 * Minimum timeline zoom level (pixels per second).
 * @const {number} TIMELINE_MIN_ZOOM
 */
export const TIMELINE_MIN_ZOOM = 2;

/**
 * Maximum timeline zoom level (pixels per second).
 * @const {number} TIMELINE_MAX_ZOOM
 */
export const TIMELINE_MAX_ZOOM = 300;

/**
 * Multiplier applied to the zoom level per zoom step.
 * @const {number} TIMELINE_ZOOM_STEP
 */
export const TIMELINE_ZOOM_STEP = 1.5;

/**
 * Minimum gap in seconds between adjacent timeline segments/markers.
 * @const {number} TIMELINE_MIN_GAP
 */
export const TIMELINE_MIN_GAP = 0.1;

/**
 * Minimum pixel gap between rendered timeline labels.
 * @const {number} TIMELINE_LABEL_MIN_GAP
 */
export const TIMELINE_LABEL_MIN_GAP = 56;

/**
 * Minimum pixel pitch between thumbnail bars rendered on the timeline.
 * @const {number} TIMELINE_MIN_BAR_PITCH
 */
export const TIMELINE_MIN_BAR_PITCH = 5;

/**
 * CSS class applied to the thumbnail montage element on the timeline.
 * @const {string} TIMELINE_THUMB_MONTAGE_CLASS
 */
export const TIMELINE_THUMB_MONTAGE_CLASS = 'timeline-thumb-montage';

/**
 * Allowed tick intervals in seconds for the timeline ruler.
 * @const {readonly number[]} TIMELINE_TICK_STEPS
 */
export const TIMELINE_TICK_STEPS = [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600] as const;

/**
 * Minimum pixels between major ruler ticks.
 * @const {number} TIMELINE_RULER_MIN_TICK_PX
 */
export const TIMELINE_RULER_MIN_TICK_PX = 50;

/**
 * Minimum pixels between minor ruler sub-ticks.
 * @const {number} TIMELINE_RULER_MIN_SUB_PX
 */
export const TIMELINE_RULER_MIN_SUB_PX = 5;

/**
 * Pixel margin near the timeline edges that triggers automatic scrolling.
 * @const {number} TIMELINE_SCROLL_MARGIN
 */
export const TIMELINE_SCROLL_MARGIN = 40;

// --- Histogram chart (renderer) ---
/**
 * Number of bins in the EXIF histogram thumbnail.
 * @const {number} EXIF_HISTOGRAM_BINS
 */
export const EXIF_HISTOGRAM_BINS = 64;

/**
 * Width in pixels of the EXIF histogram thumbnail.
 * @const {number} EXIF_HISTOGRAM_WIDTH
 */
export const EXIF_HISTOGRAM_WIDTH = 160;

/**
 * Height in pixels of the EXIF histogram thumbnail.
 * @const {number} EXIF_HISTOGRAM_HEIGHT
 */
export const EXIF_HISTOGRAM_HEIGHT = 48;

// --- Notifications ---
/**
 * Auto-dismiss delay in milliseconds for snackbar notifications.
 * @const {number} SNACKBAR_AUTO_HIDE_MS
 */
export const SNACKBAR_AUTO_HIDE_MS = 6000;

/**
 * Default display duration in milliseconds for toast notifications.
 * @const {number} TOAST_DEFAULT_DURATION_MS
 */
export const TOAST_DEFAULT_DURATION_MS = 4000;

// --- Stores ---
/**
 * Maximum number of log entries kept in the in-memory log store.
 * @const {number} LOG_MAX_ENTRIES
 */
export const LOG_MAX_ENTRIES = 2000;

/**
 * Filename prefix used when exporting logs to a file.
 * @const {string} LOG_EXPORT_FILENAME_PREFIX
 */
export const LOG_EXPORT_FILENAME_PREFIX = 'encodex-logs';

/**
 * Maximum number of past errors retained in the error history store.
 * @const {number} ERROR_HISTORY_MAX
 */
export const ERROR_HISTORY_MAX = 50;

/**
 * Default audio encoder used by the audio extraction feature.
 * @const {string} AUDIO_EXTRACT_DEFAULT_CODEC
 */
export const AUDIO_EXTRACT_DEFAULT_CODEC = 'libmp3lame';

// --- i18n ---
/**
 * localStorage key used to persist the selected UI language.
 * @const {string} LANGUAGE_STORAGE_KEY
 */
export const LANGUAGE_STORAGE_KEY = 'encodex-lang';

/**
 * Fallback UI language tag used when no language is configured.
 * @const {string} DEFAULT_LANGUAGE
 */
export const DEFAULT_LANGUAGE = 'en-US';

// --- Window settings ---
/**
 * localStorage key used to persist the always-on-top window preference.
 * @const {string} WINDOW_ALWAYS_ON_TOP_STORAGE_KEY
 */
export const WINDOW_ALWAYS_ON_TOP_STORAGE_KEY = 'encodex-always-on-top';
