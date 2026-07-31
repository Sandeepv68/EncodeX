export const TRANSCODER_TYPES = ['FFMPEG', 'FFTOOL', 'BMF'] as const;
export type TranscoderType = (typeof TRANSCODER_TYPES)[number];

export const TRANSCODER_LABELS: Record<TranscoderType, string> = {
  FFMPEG: 'FFmpeg (API)',
  FFTOOL: 'FFmpeg (CLI)',
  BMF: 'BMF Framework',
};

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
  START: '-ss',
  END: '-to',
  DURATION: '-t',
  OVERWRITE: '-y',
  INPUT: '-i',
  RAWVIDEO: 'rawvideo',
  PIX_FMT_RGB24: 'rgb24',
  NO_AUDIO: '-an',
  NO_SUBTITLES: '-sn',
  NO_DATA: '-dn',
  OUTPUT_PIPE: '-',
  REALTIME: '-re',
} as const;

export const FFPROBE_FLAGS = {
  VERBOSE: '-v',
  QUIET: 'quiet',
  PRINT_FORMAT: '-print_format',
  FORMAT_JSON: 'json',
  SHOW_FORMAT: '-show_format',
  SHOW_STREAMS: '-show_streams',
} as const;

export const PROGRESS_PATTERNS = {
  TIME: /time=(\d+:\d+:\d+\.\d+)/g,
  TIME_SINGLE: /time=(\d+:\d+:\d+\.\d+)/,
} as const;

export const TRANSCODER_COMMANDS = {
  BMF_FFMPEG: 'bmf_ffmpeg',
  BMF_FFPROBE: 'bmf_ffprobe',
  FFMPEG: 'ffmpeg',
  FFPROBE: 'ffprobe',
} as const;

export const KILL_SIGNAL = 'SIGKILL' as const;

export const TRANSCODER_DEFAULTS = {
  PROGRESS_INTERVAL_MS: 500,
  BMF_TIMEOUT_MS: 30000,
  PLAYER_FRAME_TIMEOUT_MS: 5000,
  PLAYER_DEFAULT_WIDTH: 640,
  PLAYER_DEFAULT_HEIGHT: 360,
  FFPROBE_TIMEOUT_MS: 30000,
  PROGRESS_THROTTLE_MS: 250,
} as const;

export const COMPLETED_PROGRESS = {
  percent: 100,
  time: 'Done',
  speed: '-',
  eta: '0',
} as const;

export const EMPTY_PROGRESS = {
  time: '00:00:00',
  speed: '0x',
  eta: '0',
  fps: 0,
  percent: 0,
  bitrate: '',
} as const;

export const CONVERSION_DEFAULTS = {
  VIDEO_CODEC: 'libx264',
  AUDIO_CODEC: 'aac',
  QSCALE: 23,
  PIXEL_FORMAT: 'yuv420p',
  SCALE: '1920x1080',
  VIDEO_BITRATE: '2000k',
  AUDIO_BITRATE: '192k',
} as const;

export const QSCALE_RANGE = {
  MIN: 1,
  MAX: 31,
} as const;
