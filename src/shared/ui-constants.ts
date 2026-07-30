export const DRAWER_WIDTH = 220;

export const DEV_SERVER_URL = 'http://localhost:5173';

export const WINDOW_SIZE = {
  WIDTH: 1280,
  HEIGHT: 800,
  MIN_WIDTH: 960,
  MIN_HEIGHT: 600,
} as const;

export const APP_NAME = 'EncodeX';

export const THEME_STORAGE_KEY = 'openconverter-theme';

export const ROOT_ELEMENT_ID = 'root';

export const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
} as const;

export const VIDEO_EXTENSIONS = [
  'mp4', 'm4v', 'avi', 'mkv', 'mov', 'qt', 'flv', 'f4v', 'wmv', 'asf',
  'webm', '3gp', '3g2', 'mpg', 'mpeg', 'mts', 'm2ts', 'ts', 'mxf',
  'ogv', 'ogg', 'vob', 'divx', 'dv', 'rm', 'rmvb', 'h264', 'h265', 'hevc',
] as const;

export const OUTPUT_VIDEO_EXTENSIONS = [
  'mp4', 'm4v', 'avi', 'mkv', 'mov', 'flv', 'f4v', 'wmv', 'asf',
  'webm', '3gp', 'mpg', 'mpeg', 'ts', 'mxf', 'ogv', 'ogg', 'dv',
] as const;

export const AUDIO_EXTENSIONS = [
  'mp3', 'aac', 'wav', 'flac', 'ogg', 'opus', 'm4a', 'wma',
  'alac', 'aiff', 'aif', 'au', 'caf', 'pcm', 'mid', 'midi',
] as const;

export const OUTPUT_AUDIO_EXTENSIONS = [
  'mp3', 'aac', 'wav', 'flac', 'ogg', 'opus', 'm4a', 'wma',
  'alac', 'aiff', 'aif',
] as const;

export const IMAGE_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tiff', 'tif',
  'svg', 'ico', 'heic', 'heif', 'avif', 'ppm', 'pgm', 'pbm', 'xbm',
] as const;

export const OUTPUT_IMAGE_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tiff', 'tif',
  'ppm', 'pgm', 'pbm',
] as const;

export const SUBTITLE_EXTENSIONS = [
  'srt', 'ass', 'ssa', 'vtt', 'sub', 'idx', 'smi',
] as const;

export const MEDIA_INPUT_EXTENSIONS = [
  ...VIDEO_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
  ...IMAGE_EXTENSIONS,
  ...SUBTITLE_EXTENSIONS,
] as const;

export const MEDIA_OUTPUT_EXTENSIONS = [
  ...OUTPUT_VIDEO_EXTENSIONS,
  ...OUTPUT_AUDIO_EXTENSIONS,
  ...OUTPUT_IMAGE_EXTENSIONS,
] as const;

export const FILE_EXTENSIONS = {
  MEDIA_INPUT: MEDIA_INPUT_EXTENSIONS,
  MEDIA_OUTPUT: MEDIA_OUTPUT_EXTENSIONS,
  VIDEO_INPUT: VIDEO_EXTENSIONS,
  IMAGE_INPUT: IMAGE_EXTENSIONS,
} as const;

export const FILE_FILTERS = {
  MEDIA_FILES: { name: 'All Media Files', extensions: [...MEDIA_INPUT_EXTENSIONS] },
  VIDEO_FILES: { name: 'Video Files', extensions: [...VIDEO_EXTENSIONS] },
  AUDIO_FILES: { name: 'Audio Files', extensions: [...AUDIO_EXTENSIONS] },
  IMAGE_FILES: { name: 'Image Files', extensions: [...IMAGE_EXTENSIONS] },
  ALL_FILES: { name: 'All Files', extensions: ['*'] },
} as const;

export const IMAGE_FORMATS = [
  { value: 'jpg', label: 'JPEG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
  { value: 'bmp', label: 'BMP' },
  { value: 'gif', label: 'GIF' },
  { value: 'tiff', label: 'TIFF' },
  { value: 'ppm', label: 'PPM' },
  { value: 'pgm', label: 'PGM' },
  { value: 'pbm', label: 'PBM' },
] as const;

export const IMAGE_CODEC_MAP: Record<string, string> = {
  jpg: 'mjpeg',
  jpeg: 'mjpeg',
  png: 'png',
  webp: 'libwebp',
  bmp: 'bmp',
  gif: 'gif',
  tiff: 'tiff',
  tif: 'tiff',
  ppm: 'ppm',
  pgm: 'pgm',
  pbm: 'pbm',
} as const;

export const PIXEL_FORMATS = [
  { value: 'yuv420p', group: 'YUV 8-bit' },
  { value: 'yuv422p', group: 'YUV 8-bit' },
  { value: 'yuv444p', group: 'YUV 8-bit' },
  { value: 'yuv410p', group: 'YUV 8-bit' },
  { value: 'yuv411p', group: 'YUV 8-bit' },
  { value: 'yuv440p', group: 'YUV 8-bit' },
  { value: 'yuvj420p', group: 'YUV 8-bit' },
  { value: 'yuvj422p', group: 'YUV 8-bit' },
  { value: 'yuvj444p', group: 'YUV 8-bit' },
  { value: 'yuv420p10le', group: 'YUV 10-bit' },
  { value: 'yuv422p10le', group: 'YUV 10-bit' },
  { value: 'yuv444p10le', group: 'YUV 10-bit' },
  { value: 'yuv420p12le', group: 'YUV 12-bit' },
  { value: 'yuv422p12le', group: 'YUV 12-bit' },
  { value: 'yuv444p12le', group: 'YUV 12-bit' },
  { value: 'yuv420p16le', group: 'YUV 16-bit' },
  { value: 'yuv444p16le', group: 'YUV 16-bit' },
  { value: 'nv12', group: 'YUV Semi-planar' },
  { value: 'nv21', group: 'YUV Semi-planar' },
  { value: 'nv16', group: 'YUV Semi-planar' },
  { value: 'nv20le', group: 'YUV Semi-planar' },
  { value: 'yuva420p', group: 'YUV with Alpha' },
  { value: 'yuva422p', group: 'YUV with Alpha' },
  { value: 'yuva444p', group: 'YUV with Alpha' },
  { value: 'yuva420p10le', group: 'YUV with Alpha' },
  { value: 'yuva444p10le', group: 'YUV with Alpha' },
  { value: 'yuva444p16le', group: 'YUV with Alpha' },
  { value: 'rgb24', group: 'RGB Packed' },
  { value: 'bgr24', group: 'RGB Packed' },
  { value: 'rgb0', group: 'RGB Packed' },
  { value: 'bgr0', group: 'RGB Packed' },
  { value: 'rgba', group: 'RGB Packed' },
  { value: 'bgra', group: 'RGB Packed' },
  { value: 'argb', group: 'RGB Packed' },
  { value: 'abgr', group: 'RGB Packed' },
  { value: 'rgb48le', group: 'RGB Packed' },
  { value: 'bgr48le', group: 'RGB Packed' },
  { value: 'rgba64le', group: 'RGB Packed' },
  { value: 'bgra64le', group: 'RGB Packed' },
  { value: 'gbrp', group: 'Planar RGB' },
  { value: 'gbrp10le', group: 'Planar RGB' },
  { value: 'gbrp12le', group: 'Planar RGB' },
  { value: 'gbrp16le', group: 'Planar RGB' },
  { value: 'gbrap', group: 'Planar RGB' },
  { value: 'gbrap10le', group: 'Planar RGB' },
  { value: 'gbrap16le', group: 'Planar RGB' },
  { value: 'gray', group: 'Monochrome' },
  { value: 'gray10le', group: 'Monochrome' },
  { value: 'gray12le', group: 'Monochrome' },
  { value: 'gray16le', group: 'Monochrome' },
  { value: 'grayf32le', group: 'Monochrome' },
  { value: 'ya8', group: 'Monochrome' },
  { value: 'ya16le', group: 'Monochrome' },
  { value: 'p010le', group: 'HDR' },
  { value: 'p016le', group: 'HDR' },
  { value: 'x2rgb10le', group: 'HDR' },
] as const;

export const BITRATE_OPTIONS = ['128k', '192k', '256k', '320k', 'lossless'] as const;

export const VIDEO_CODECS = [
  { value: 'libx264', label: 'H.264 (libx264)', group: 'Software' },
  { value: 'libx264rgb', label: 'H.264 RGB (libx264rgb)', group: 'Software' },
  { value: 'libx265', label: 'H.265/HEVC (libx265)', group: 'Software' },
  { value: 'libvpx', label: 'VP8 (libvpx)', group: 'Software' },
  { value: 'libvpx-vp9', label: 'VP9 (libvpx-vp9)', group: 'Software' },
  { value: 'libaom-av1', label: 'AV1 (libaom-av1)', group: 'Software' },
  { value: 'libsvtav1', label: 'AV1 (SVT-AV1)', group: 'Software' },
  { value: 'librav1e', label: 'AV1 (rav1e)', group: 'Software' },
  { value: 'libxvid', label: 'MPEG-4 / Xvid (libxvid)', group: 'Software' },
  { value: 'mpeg4', label: 'MPEG-4 Part 2', group: 'Software' },
  { value: 'mpeg1video', label: 'MPEG-1 Video', group: 'Software' },
  { value: 'mpeg2video', label: 'MPEG-2 Video', group: 'Software' },
  { value: 'libtheora', label: 'Theora (libtheora)', group: 'Software' },
  { value: 'libopenjpeg', label: 'JPEG 2000 (libopenjpeg)', group: 'Software' },
  { value: 'libwebp', label: 'WebP (libwebp)', group: 'Software' },
  { value: 'libwebp_anim', label: 'WebP Animation (libwebp_anim)', group: 'Software' },
  { value: 'prores_ks', label: 'Apple ProRes', group: 'Software' },
  { value: 'prores', label: 'Apple ProRes (prores)', group: 'Software' },
  { value: 'huffyuv', label: 'Huffyuv (lossless)', group: 'Software' },
  { value: 'ffv1', label: 'FFV1 (lossless)', group: 'Software' },
  { value: 'utvideo', label: 'Ut Video (lossless)', group: 'Software' },
  { value: 'libkvazaar', label: 'HEVC (Kvazaar)', group: 'Software' },
  { value: 'vc2', label: 'VC-2 / Dirac Pro', group: 'Software' },
  { value: 'mjpeg', label: 'MJPEG', group: 'Software' },
  { value: 'png', label: 'PNG (lossless)', group: 'Software' },
  { value: 'tiff', label: 'TIFF', group: 'Software' },
  { value: 'libxavs', label: 'AVS (libxavs)', group: 'Software' },
  { value: 'libxavs2', label: 'AVS2 (libxavs2)', group: 'Software' },
  { value: 'h264_nvenc', label: 'H.264 (NVENC)', group: 'NVIDIA NVENC' },
  { value: 'hevc_nvenc', label: 'H.265 (NVENC)', group: 'NVIDIA NVENC' },
  { value: 'av1_nvenc', label: 'AV1 (NVENC)', group: 'NVIDIA NVENC' },
  { value: 'h264_qsv', label: 'H.264 (QSV)', group: 'Intel QSV' },
  { value: 'hevc_qsv', label: 'H.265 (QSV)', group: 'Intel QSV' },
  { value: 'mpeg2_qsv', label: 'MPEG-2 (QSV)', group: 'Intel QSV' },
  { value: 'vp9_qsv', label: 'VP9 (QSV)', group: 'Intel QSV' },
  { value: 'av1_qsv', label: 'AV1 (QSV)', group: 'Intel QSV' },
  { value: 'h264_amf', label: 'H.264 (AMF)', group: 'AMD AMF' },
  { value: 'hevc_amf', label: 'H.265 (AMF)', group: 'AMD AMF' },
  { value: 'av1_amf', label: 'AV1 (AMF)', group: 'AMD AMF' },
  { value: 'h264_vaapi', label: 'H.264 (VAAPI)', group: 'VAAPI' },
  { value: 'hevc_vaapi', label: 'H.265 (VAAPI)', group: 'VAAPI' },
  { value: 'mjpeg_vaapi', label: 'MJPEG (VAAPI)', group: 'VAAPI' },
  { value: 'vp8_vaapi', label: 'VP8 (VAAPI)', group: 'VAAPI' },
  { value: 'vp9_vaapi', label: 'VP9 (VAAPI)', group: 'VAAPI' },
  { value: 'av1_vaapi', label: 'AV1 (VAAPI)', group: 'VAAPI' },
  { value: 'h264_videotoolbox', label: 'H.264 (VideoToolbox)', group: 'Apple VideoToolbox' },
  { value: 'hevc_videotoolbox', label: 'H.265 (VideoToolbox)', group: 'Apple VideoToolbox' },
  { value: 'prores_videotoolbox', label: 'ProRes (VideoToolbox)', group: 'Apple VideoToolbox' },
  { value: 'vp9_videotoolbox', label: 'VP9 (VideoToolbox)', group: 'Apple VideoToolbox' },
  { value: 'h264_mf', label: 'H.264 (Media Foundation)', group: 'Media Foundation' },
  { value: 'hevc_mf', label: 'H.265 (Media Foundation)', group: 'Media Foundation' },
] as const;

export const AUDIO_CODECS = [
  { value: 'aac', label: 'AAC (native)', group: 'AAC / MPEG' },
  { value: 'libfdk_aac', label: 'AAC (FDK)', group: 'AAC / MPEG' },
  { value: 'libmp3lame', label: 'MP3 (LAME)', group: 'AAC / MPEG' },
  { value: 'libshine', label: 'MP3 (libshine)', group: 'AAC / MPEG' },
  { value: 'libtwolame', label: 'MP2 (libtwolame)', group: 'AAC / MPEG' },
  { value: 'ac3', label: 'Dolby AC-3', group: 'Dolby' },
  { value: 'eac3', label: 'Dolby E-AC-3', group: 'Dolby' },
  { value: 'truehd', label: 'Dolby TrueHD', group: 'Dolby' },
  { value: 'dts', label: 'DTS', group: 'Dolby' },
  { value: 'mlp', label: 'Meridian Lossless Packing', group: 'Dolby' },
  { value: 'flac', label: 'FLAC (lossless)', group: 'Lossless' },
  { value: 'alac', label: 'Apple Lossless (ALAC)', group: 'Lossless' },
  { value: 'libwavpack', label: 'WavPack (libwavpack)', group: 'Lossless' },
  { value: 'libvorbis', label: 'Vorbis (libvorbis)', group: 'Streaming' },
  { value: 'libopus', label: 'Opus (libopus)', group: 'Streaming' },
  { value: 'libspeex', label: 'Speex (libspeex)', group: 'Streaming' },
  { value: 'libvo_amrwbenc', label: 'AMR-WB (libvo_amrwbenc)', group: 'Streaming' },
  { value: 'pcm_s16le', label: 'PCM 16-bit signed LE (WAV)', group: 'PCM' },
  { value: 'pcm_s24le', label: 'PCM 24-bit signed LE', group: 'PCM' },
  { value: 'pcm_f32le', label: 'PCM 32-bit float LE', group: 'PCM' },
  { value: 'pcm_s16be', label: 'PCM 16-bit signed BE', group: 'PCM' },
  { value: 'pcm_u8', label: 'PCM 8-bit unsigned', group: 'PCM' },
  { value: 'pcm_alaw', label: 'PCM A-law', group: 'PCM' },
  { value: 'pcm_mulaw', label: 'PCM Mu-law', group: 'PCM' },
  { value: 'wmav1', label: 'Windows Media Audio v1', group: 'Windows Media' },
  { value: 'wmav2', label: 'Windows Media Audio v2', group: 'Windows Media' },
  { value: 'adpcm_ima_wav', label: 'ADPCM IMA (WAV)', group: 'Other' },
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
