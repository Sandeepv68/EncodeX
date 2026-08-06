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

/**
 * Video extensions offered as valid conversion outputs; a subset of VIDEO_EXTENSIONS
 * that the app can actually write.
 * @const {readonly string[]} OUTPUT_VIDEO_EXTENSIONS
 */
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

/**
 * Supported audio input file extensions.
 * @const {readonly string[]} AUDIO_EXTENSIONS
 */
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

/**
 * Audio extensions offered as valid conversion outputs.
 * @const {readonly string[]} OUTPUT_AUDIO_EXTENSIONS
 */
export const OUTPUT_AUDIO_EXTENSIONS = ['mp3', 'aac', 'wav', 'flac', 'ogg', 'opus', 'm4a', 'wma', 'alac', 'aiff', 'aif'] as const;

/**
 * Supported image input file extensions.
 * @const {readonly string[]} IMAGE_EXTENSIONS
 */
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

/**
 * Image extensions offered as valid compression outputs.
 * @const {readonly string[]} OUTPUT_IMAGE_EXTENSIONS
 */
export const OUTPUT_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tiff', 'tif', 'ppm', 'pgm', 'pbm'] as const;

/**
 * Supported subtitle file extensions.
 * @const {readonly string[]} SUBTITLE_EXTENSIONS
 */
export const SUBTITLE_EXTENSIONS = ['srt', 'ass', 'ssa', 'vtt', 'sub', 'idx', 'smi'] as const;

/**
 * Every extension accepted as a media input, combining video, audio, image, and
 * subtitle extensions.
 * @const {readonly string[]} MEDIA_INPUT_EXTENSIONS
 */
export const MEDIA_INPUT_EXTENSIONS = [...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS, ...IMAGE_EXTENSIONS, ...SUBTITLE_EXTENSIONS] as const;

/**
 * Every extension supported as a media output, combining the video, audio, and
 * image output lists.
 * @const {readonly string[]} MEDIA_OUTPUT_EXTENSIONS
 */
export const MEDIA_OUTPUT_EXTENSIONS = [...OUTPUT_VIDEO_EXTENSIONS, ...OUTPUT_AUDIO_EXTENSIONS, ...OUTPUT_IMAGE_EXTENSIONS] as const;

/**
 * Grouped file extension lists keyed by their role (input vs output, and by media type).
 * @const {Object} FILE_EXTENSIONS
 * @property {readonly string[]} MEDIA_INPUT - All valid media input extensions.
 * @property {readonly string[]} MEDIA_OUTPUT - All valid media output extensions.
 * @property {readonly string[]} VIDEO_INPUT - Valid video input extensions.
 * @property {readonly string[]} IMAGE_INPUT - Valid image input extensions.
 */
export const FILE_EXTENSIONS = {
  MEDIA_INPUT: MEDIA_INPUT_EXTENSIONS,
  MEDIA_OUTPUT: MEDIA_OUTPUT_EXTENSIONS,
  VIDEO_INPUT: VIDEO_EXTENSIONS,
  IMAGE_INPUT: IMAGE_EXTENSIONS,
} as const;

/**
 * Native file-dialog filter definitions used with Electron's dialog API.
 * @const {Object} FILE_FILTERS
 * @property {{name: string; extensions: string[]}} MEDIA_FILES - Filter for all media files.
 * @property {{name: string; extensions: string[]}} VIDEO_FILES - Filter for video files.
 * @property {{name: string; extensions: string[]}} AUDIO_FILES - Filter for audio files.
 * @property {{name: string; extensions: string[]}} IMAGE_FILES - Filter for image files.
 * @property {{name: string; extensions: string[]}} ALL_FILES - Filter accepting all files.
 */
export const FILE_FILTERS = {
  MEDIA_FILES: { name: 'All Media Files', extensions: [...MEDIA_INPUT_EXTENSIONS] },
  VIDEO_FILES: { name: 'Video Files', extensions: [...VIDEO_EXTENSIONS] },
  AUDIO_FILES: { name: 'Audio Files', extensions: [...AUDIO_EXTENSIONS] },
  IMAGE_FILES: { name: 'Image Files', extensions: [...IMAGE_EXTENSIONS] },
  ALL_FILES: { name: 'All Files', extensions: ['*'] },
} as const;

/**
 * Comma-separated accept string for image dropzones (HTML drag-and-drop / file input).
 * @const {string} IMAGE_DROPZONE_ACCEPT
 */
export const IMAGE_DROPZONE_ACCEPT = 'jpg,jpeg,png,webp,bmp';

/**
 * Comma-separated accept string for video dropzones (HTML drag-and-drop / file input).
 * @const {string} VIDEO_DROPZONE_ACCEPT
 */
export const VIDEO_DROPZONE_ACCEPT = 'mp4,avi,mkv,mov,flv,wmv,webm';

/**
 * Determines whether a path points to an image file by inspecting its extension.
 * The comparison is case-insensitive.
 * @param {string} filePath - The file path to inspect.
 * @returns {boolean} True if the path ends in a known image extension.
 */
export function isImageFile(filePath: string): boolean {
  const idx = filePath.lastIndexOf('.');
  const ext = idx >= 0 ? filePath.slice(idx + 1).toLowerCase() : '';
  return IMAGE_EXTENSIONS.includes(ext as (typeof IMAGE_EXTENSIONS)[number]);
}

/**
 * Determines whether a path points to a video file by inspecting its extension.
 * The comparison is case-insensitive.
 * @param {string} filePath - The file path to inspect.
 * @returns {boolean} True if the path ends in a known video extension.
 */
export function isVideoFile(filePath: string): boolean {
  const idx = filePath.lastIndexOf('.');
  const ext = idx >= 0 ? filePath.slice(idx + 1).toLowerCase() : '';
  return VIDEO_EXTENSIONS.includes(ext as (typeof VIDEO_EXTENSIONS)[number]);
}
