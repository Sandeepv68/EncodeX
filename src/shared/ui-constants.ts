export const DRAWER_WIDTH = 220;

export const DEV_SERVER_URL = 'http://localhost:5173';

export const WINDOW_SIZE = {
  WIDTH: 1280,
  HEIGHT: 800,
  MIN_WIDTH: 960,
  MIN_HEIGHT: 600,
} as const;

export const APP_NAME = 'OpenConverter';

export const THEME_STORAGE_KEY = 'openconverter-theme';

export const ROOT_ELEMENT_ID = 'root';

export const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
} as const;

export const FILE_EXTENSIONS = {
  MEDIA_INPUT: ['mp4', 'avi', 'mkv', 'mov', 'flv', 'wmv', 'webm', 'mp3', 'aac', 'wav', 'flac', 'ogg', 'jpg', 'jpeg', 'png', 'webp', 'bmp'],
  MEDIA_OUTPUT: ['mp4', 'avi', 'mkv', 'mov', 'webm', 'mp3', 'aac', 'wav', 'flac', 'jpg', 'png', 'webp'],
  VIDEO_INPUT: ['mp4', 'avi', 'mkv', 'mov', 'flv', 'wmv', 'webm'],
  IMAGE_INPUT: ['jpg', 'jpeg', 'png', 'webp', 'bmp'],
} as const;

export const FILE_FILTERS = {
  MEDIA_FILES: { name: 'Media Files', extensions: FILE_EXTENSIONS.MEDIA_INPUT },
} as const;

export const IMAGE_FORMATS = [
  { value: 'jpg', label: 'JPEG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
  { value: 'bmp', label: 'BMP' },
] as const;

export const IMAGE_CODEC_MAP: Record<string, string> = {
  jpg: 'mjpeg',
  jpeg: 'mjpeg',
  png: 'png',
  webp: 'libwebp',
  bmp: 'bmp',
} as const;

export const PIXEL_FORMATS = ['yuv420p', 'yuv422p', 'yuv444p', 'rgb24'] as const;

export const BITRATE_OPTIONS = ['128k', '192k', '256k', '320k', 'lossless'] as const;

export const VIDEO_CODECS = [
  { value: 'libx264', label: 'H.264 (libx264)' },
  { value: 'libx265', label: 'H.265 (libx265)' },
  { value: 'libvpx', label: 'VP8 (libvpx)' },
  { value: 'libvpx-vp9', label: 'VP9 (libvpx-vp9)' },
  { value: 'mpeg4', label: 'MPEG-4' },
  { value: 'libaom-av1', label: 'AV1 (libaom-av1)' },
  { value: 'libxvid', label: 'Xvid' },
  { value: 'h264_nvenc', label: 'H.264 (NVENC)' },
  { value: 'hevc_nvenc', label: 'H.265 (NVENC)' },
] as const;

export const AUDIO_CODECS = [
  { value: 'aac', label: 'AAC' },
  { value: 'libmp3lame', label: 'MP3 (libmp3lame)' },
  { value: 'ac3', label: 'AC3' },
  { value: 'flac', label: 'FLAC' },
  { value: 'pcm_s16le', label: 'WAV (PCM)' },
  { value: 'libvorbis', label: 'Vorbis' },
  { value: 'libopus', label: 'Opus' },
] as const;

export const BATCH_OPERATIONS = [
  { value: 'transcode', label: 'Transcode' },
  { value: 'extract_audio', label: 'Extract Audio' },
  { value: 'compress_image', label: 'Compress Image' },
] as const;

export const QUEUE_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  DONE: 'done',
  ERROR: 'error',
} as const;

export const DEFAULT_SUFFIX = '_converted';

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/convert', label: 'Convert' },
  { to: '/media-info', label: 'Media Info' },
  { to: '/image-compress', label: 'Image' },
  { to: '/audio-extract', label: 'Audio' },
  { to: '/video-cut', label: 'Cut' },
  { to: '/batch', label: 'Batch Queue' },
] as const;

export const FALLBACK_VALUES = {
  UNKNOWN_CODEC: 'unknown',
  UNKNOWN_FORMAT: 'unknown',
  BITRATE_NA: 'N/A',
  DEFAULT_TIME: '00:00:00',
  FILE_SIZE_ZERO: 0,
  DURATION_ZERO: 0,
  INDEX_ZERO: 0,
  STREAMS_EMPTY: [],
} as const;
