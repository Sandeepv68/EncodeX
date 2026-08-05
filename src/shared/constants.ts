/**
 * @fileoverview Shared application constants extracted from source files.
 * Groups numeric and string constants used across main and renderer processes.
 */

// --- Image analysis ---
export const HISTOGRAM_BINS = 256;
export const HISTOGRAM_MAX_WIDTH = 256;
export const RGB_BYTES_PER_PIXEL = 3;
export const LUMA_WEIGHTS = {
  R: 0.299,
  G: 0.587,
  B: 0.114,
} as const;

// --- Image file probing ---
export const IMAGE_HEADER_READ_SIZE = 65536;

// --- Capabilities ---
export const CAPABILITY_PROBE_TIMEOUT_MS = 10000;

// --- CLI ---
export const CLI_CONVERSION_TIMEOUT_MS = 300000;

// --- Video preview ---
export const VIDEO_PREVIEW_MAX_WIDTH = 480;
export const VIDEO_PREVIEW_SEEK_TIME = '00:00:01';

// --- Waveform extraction ---
export const WAVEFORM_SAMPLE_RATE = 8000;
export const WAVEFORM_BUCKETS_PER_SECOND = 40;
export const WAVEFORM_MAX_BUCKETS = 24000;
export const WAVEFORM_MIN_BUCKETS = 200;
export const WAVEFORM_SEGMENT_SECONDS = 30;
export const WAVEFORM_MIN_SEGMENTS = 12;
export const WAVEFORM_MAX_SEGMENTS = 48;
export const WAVEFORM_PARALLEL = 8;

// --- Thumbnail extraction ---
export const THUMB_WIDTH = 160;
export const THUMB_HEIGHT = 90;
export const THUMB_TILE_COLS = 10;
export const THUMB_MAX_COUNT = 100;
export const THUMB_INTERVAL_SECONDS = 8;
export const THUMB_PARALLEL = 16;

// --- Process / error reporting ---
export const MAX_CONCURRENT_FFMPEG = 8;
export const PCM_MAX_AMPLITUDE = 32768;
export const ERROR_LOG_TAIL_CHARS = 200;
export const PROCESS_SUSPEND_SIGNAL = 'SIGSTOP';
export const PROCESS_RESUME_SIGNAL = 'SIGCONT';

// --- Frame decoder ---
export const AUDIO_CHUNK_SECONDS = 0.05;
export const FRAME_FLUSH_THRESHOLD_MS = 200;
export const FRAME_FLUSH_INTERVAL_MS = 16;
export const FRAME_DURATION_SMOOTHING = 0.9;
export const DEFAULT_FRAME_DURATION = 1 / 30;
export const AUDIO_TARGET_MIN_BYTES = 512;
export const FRAME_BUFFER_OVERFLOW_WARN = 30;

// --- Player audio ---
export const AUDIO_MIN_SAMPLE_RATE = 8000;
export const AUDIO_DEFAULT_SAMPLE_RATE = 48000;
export const AUDIO_MIN_CHANNELS = 1;
export const AUDIO_DEFAULT_CHANNELS = 2;
export const PLAYER_MIN_DIMENSION = 2;

// --- Renderer media player ---
export const AUDIO_LOOKAHEAD_SECONDS = 0.75;
export const MAX_PENDING_AUDIO_CHUNKS = 200;
export const SEEK_COALESCE_MS = 120;
export const MAX_BUFFERED_FRAMES = 30;
export const MAX_FRAME_LOOKAHEAD_S = 3;
export const STALL_DRAW_TIMEOUT_MS = 400;
export const AUDIO_CLOCK_FROZEN_MS = 500;
export const AUDIO_SCHEDULE_GUARD_MAX = 200;
export const FRAME_STALL_WARN_MS = 3000;

// --- Timeline UI ---
export const DEFAULT_TIMELINE_WIDTH = 600;
export const TIMELINE_MIN_ZOOM = 2;
export const TIMELINE_MAX_ZOOM = 300;
export const TIMELINE_ZOOM_STEP = 1.5;
export const TIMELINE_MIN_GAP = 0.1;
export const TIMELINE_LABEL_MIN_GAP = 56;
export const TIMELINE_MIN_BAR_PITCH = 5;
export const TIMELINE_THUMB_MONTAGE_CLASS = 'timeline-thumb-montage';
export const TIMELINE_TICK_STEPS = [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600] as const;
export const TIMELINE_RULER_MIN_TICK_PX = 50;
export const TIMELINE_RULER_MIN_SUB_PX = 5;
export const TIMELINE_SCROLL_MARGIN = 40;

// --- Histogram chart (renderer) ---
export const EXIF_HISTOGRAM_BINS = 64;
export const EXIF_HISTOGRAM_WIDTH = 160;
export const EXIF_HISTOGRAM_HEIGHT = 48;

// --- Notifications ---
export const SNACKBAR_AUTO_HIDE_MS = 6000;
export const TOAST_DEFAULT_DURATION_MS = 4000;

// --- Stores ---
export const LOG_MAX_ENTRIES = 2000;
export const LOG_EXPORT_FILENAME_PREFIX = 'encodex-logs';
export const ERROR_HISTORY_MAX = 50;
export const AUDIO_EXTRACT_DEFAULT_CODEC = 'libmp3lame';

// --- i18n ---
export const LANGUAGE_STORAGE_KEY = 'encodex-lang';
export const DEFAULT_LANGUAGE = 'en-US';

// --- Window settings ---
export const WINDOW_ALWAYS_ON_TOP_STORAGE_KEY = 'encodex-always-on-top';
