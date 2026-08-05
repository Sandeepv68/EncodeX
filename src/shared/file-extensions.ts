/**
 * @fileoverview File type extensions mapping for different media types.
 * Defines supported file extensions for videos, images, and audio files.
 */

/**
 * Supported video file extensions.
 * @const {readonly string[]} VIDEO_EXTENSIONS
 */
export const VIDEO_EXTENSIONS = [
  'mp4',
  'm4v',
  'avi',
  'mkv',
  'mov',
  'qt',
  'flv',
  'f4v',
  'wmv',
  'asf',
  'webm',
  '3gp',
  '3g2',
  'mpg',
  'mpeg',
  'mts',
  'm2ts',
  'ts',
  'mxf',
  'ogv',
  'ogg',
  'vob',
  'divx',
  'dv',
  'rm',
  'rmvb',
  'h264',
  'h265',
  'hevc',
] as const;

export const OUTPUT_VIDEO_EXTENSIONS = [
  'mp4',
  'm4v',
  'avi',
  'mkv',
  'mov',
  'flv',
  'f4v',
  'wmv',
  'asf',
  'webm',
  '3gp',
  'mpg',
  'mpeg',
  'ts',
  'mxf',
  'ogv',
  'ogg',
  'dv',
] as const;

export const AUDIO_EXTENSIONS = [
  'mp3',
  'aac',
  'wav',
  'flac',
  'ogg',
  'opus',
  'm4a',
  'wma',
  'alac',
  'aiff',
  'aif',
  'au',
  'caf',
  'pcm',
  'mid',
  'midi',
] as const;

export const OUTPUT_AUDIO_EXTENSIONS = ['mp3', 'aac', 'wav', 'flac', 'ogg', 'opus', 'm4a', 'wma', 'alac', 'aiff', 'aif'] as const;

export const IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'bmp',
  'gif',
  'tiff',
  'tif',
  'svg',
  'ico',
  'heic',
  'heif',
  'avif',
  'ppm',
  'pgm',
  'pbm',
  'xbm',
] as const;

export const OUTPUT_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tiff', 'tif', 'ppm', 'pgm', 'pbm'] as const;

export const SUBTITLE_EXTENSIONS = ['srt', 'ass', 'ssa', 'vtt', 'sub', 'idx', 'smi'] as const;

export const MEDIA_INPUT_EXTENSIONS = [...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS, ...IMAGE_EXTENSIONS, ...SUBTITLE_EXTENSIONS] as const;

export const MEDIA_OUTPUT_EXTENSIONS = [...OUTPUT_VIDEO_EXTENSIONS, ...OUTPUT_AUDIO_EXTENSIONS, ...OUTPUT_IMAGE_EXTENSIONS] as const;

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

export const IMAGE_DROPZONE_ACCEPT = 'jpg,jpeg,png,webp,bmp';

export const VIDEO_DROPZONE_ACCEPT = 'mp4,avi,mkv,mov,flv,wmv,webm';

export function isImageFile(filePath: string): boolean {
  const idx = filePath.lastIndexOf('.');
  const ext = idx >= 0 ? filePath.slice(idx + 1).toLowerCase() : '';
  return IMAGE_EXTENSIONS.includes(ext as (typeof IMAGE_EXTENSIONS)[number]);
}

export function isVideoFile(filePath: string): boolean {
  const idx = filePath.lastIndexOf('.');
  const ext = idx >= 0 ? filePath.slice(idx + 1).toLowerCase() : '';
  return VIDEO_EXTENSIONS.includes(ext as (typeof VIDEO_EXTENSIONS)[number]);
}
