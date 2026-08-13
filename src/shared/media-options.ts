/**
 * @fileoverview Option lists and default values for the media conversion UI.
 * Defines the selectable image formats, pixel formats, bitrate and scale presets,
 * video/audio codecs, batch operation types, and queue status values shared by
 * the main and renderer processes, together with fallback values used when media
 * metadata is missing.
 */

/**
 * Image formats offered by the image compression feature. Each entry maps the
 * output extension (`value`) to the label shown in the UI.
 * @const {readonly {value: string; label: string}[]} IMAGE_FORMATS
 */
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

/**
 * Maps an image extension to the FFmpeg encoder/codec name used to produce it.
 * @const {Record<string, string>} IMAGE_CODEC_MAP
 */
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

/**
 * Pixel formats available for video encoding, grouped by bit depth and color
 * model for display in the UI. Each entry pairs an FFmpeg pixel format name
 * (`value`) with its UI group label.
 * @const {readonly {value: string; group: string}[]} PIXEL_FORMATS
 */
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

/**
 * Audio bitrate presets. The special 'lossless' value indicates that no target
 * bitrate should be applied to the encoder.
 * @const {readonly string[]} BITRATE_OPTIONS
 */
export const BITRATE_OPTIONS = ['128k', '192k', '256k', '320k', 'lossless'] as const;

/**
 * Video bitrate presets in kbps. An empty string means the encoder default is used.
 * @const {readonly string[]} VIDEO_BITRATE_OPTIONS
 */
export const VIDEO_BITRATE_OPTIONS = [
  '',
  '500k',
  '1000k',
  '2000k',
  '4000k',
  '6000k',
  '8000k',
  '10000k',
  '12000k',
  '15000k',
  '20000k',
  '40000k',
] as const;

/**
 * Video scale presets as WIDTHxHEIGHT. An empty string means the original
 * resolution is kept.
 * @const {readonly string[]} SCALE_OPTIONS
 */
export const SCALE_OPTIONS = ['', '3840x2160', '2560x1440', '1920x1080', '1280x720', '854x480', '640x360'] as const;

/**
 * Selectable video encoders. Each entry pairs an FFmpeg encoder name (`value`)
 * with its UI label and the implementation/vendor group it belongs to
 * (Software, NVIDIA NVENC, Intel QSV, AMD AMF, VAAPI, VideoToolbox, ...).
 * @const {readonly {value: string; label: string; group: string}[]} VIDEO_CODECS
 */
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

/**
 * Selectable audio encoders. Each entry pairs an FFmpeg encoder name (`value`)
 * with its UI label and a format group (AAC/MPEG, Dolby, Lossless, Streaming,
 * PCM, Windows Media, Other).
 * @const {readonly {value: string; label: string; group: string}[]} AUDIO_CODECS
 */
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

/**
 * Batch operation types supported by the batch queue. Each entry maps the
 * operation identifier (`value`) to its UI label.
 * @const {readonly {value: string; label: string}[]} BATCH_OPERATIONS
 */
export const BATCH_OPERATIONS = [
  { value: 'transcode', label: 'Transcode' },
  { value: 'extract_audio', label: 'Extract Audio' },
  { value: 'compress_image', label: 'Compress Image' },
] as const;

/**
 * Lifecycle status values for batch queue jobs.
 * @const {Object} QUEUE_STATUS
 * @property {string} QUEUED - Job is waiting to be processed.
 * @property {string} RUNNING - Job is currently being processed.
 * @property {string} DONE - Job completed successfully.
 * @property {string} ERROR - Job failed.
 */
export const QUEUE_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  DONE: 'done',
  ERROR: 'error',
} as const;

/**
 * Suffix appended to auto-generated output filenames (e.g. 'movie_encodex_converted.mp4').
 * @const {string} DEFAULT_SUFFIX
 */
export const DEFAULT_SUFFIX = '_encodex_converted';

/**
 * Fallback values used when media metadata is missing or unreadable, so the UI
 * and serialized payloads always receive defined values.
 * @const {Object} FALLBACK_VALUES
 * @property {string} UNKNOWN_CODEC - Fallback codec name.
 * @property {string} UNKNOWN_FORMAT - Fallback container/format name.
 * @property {string} BITRATE_NA - Fallback bitrate display string.
 * @property {string} DEFAULT_TIME - Fallback timestamp string.
 * @property {number} FILE_SIZE_ZERO - Fallback file size in bytes.
 * @property {number} DURATION_ZERO - Fallback duration in seconds.
 * @property {number} INDEX_ZERO - Fallback stream index.
 * @property {readonly []} STREAMS_EMPTY - Fallback empty stream list.
 */
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
