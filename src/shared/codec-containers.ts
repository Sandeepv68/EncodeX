/**
 * @fileoverview Codec-to-container compatibility maps and extension helpers.
 * Classifies an FFmpeg video codec string into a generic family, then maps that
 * family to the container formats it can be muxed into and to a preferred default
 * output extension. Also provides audio-extension lookup and path/extension
 * utilities used for suggesting and validating output files.
 */

import type { CodecContainerInfo } from './types';

/**
 * Maps a generic video codec family to its preferred output extension and the
 * container formats that support it. `extension` is the suggested default output
 * extension (no leading dot); `containers` lists every container the codec can
 * be muxed into. The `other` entry is the fallback for unclassifiable codecs.
 * @type {Record<string, CodecContainerInfo>}
 */
const CONTAINERS: Record<string, CodecContainerInfo> = {
  h264: { extension: 'mp4', containers: ['mp4', 'mkv', 'mov', 'm4v', 'avi', 'ts', 'm2ts', '3gp', 'flv', 'f4v', 'mpg', 'mpeg'] },
  h265: { extension: 'mp4', containers: ['mp4', 'mkv', 'mov', 'm4v', 'ts', 'm2ts'] },
  vp8: { extension: 'webm', containers: ['webm', 'mkv', 'avi'] },
  vp9: { extension: 'webm', containers: ['webm', 'mkv', 'mp4', 'mov', 'avi'] },
  av1: { extension: 'webm', containers: ['webm', 'mkv', 'mp4', 'mov'] },
  theora: { extension: 'ogv', containers: ['ogv', 'ogg', 'mkv'] },
  prores: { extension: 'mov', containers: ['mov', 'mkv'] },
  dnx: { extension: 'mxf', containers: ['mxf', 'mov', 'mkv'] },
  mpeg1: { extension: 'mpg', containers: ['mpg', 'mpeg'] },
  mpeg2: { extension: 'mpg', containers: ['mpg', 'mpeg', 'ts', 'vob', 'm2ts'] },
  mpeg4: { extension: 'avi', containers: ['avi', 'mp4', 'mkv', 'mov', 'wmv', 'asf'] },
  mjpeg: { extension: 'avi', containers: ['avi', 'mpg', 'mpeg', 'mov', 'mkv'] },
  other: { extension: 'mkv', containers: ['mkv', 'mp4', 'mov', 'avi'] },
};

/**
 * Classifies a raw FFmpeg video codec string into a generic family key.
 * Matching is case-insensitive and checks for identifying substrings in a
 * deliberate order so that specific codecs (theora, av1, vp9, ...) are matched
 * before generic patterns like '264'/'265'. Unknown codecs fall back to 'other'.
 * @param {string} [codec] - The FFmpeg codec name to classify (e.g. 'h264_nvenc').
 * @returns {string} A family key used by CONTAINERS: 'h264', 'h265', 'vp8', 'vp9',
 * 'av1', 'theora', 'prores', 'dnx', 'mpeg1', 'mpeg2', 'mpeg4', 'mjpeg', or 'other'.
 */
export function classifyVideoCodec(codec?: string): string {
  const c = (codec ?? '').toLowerCase();
  if (c.includes('theora')) return 'theora';
  if (c.includes('av1') || c.includes('libaom') || c.includes('svtav1')) return 'av1';
  if (c.includes('vp9')) return 'vp9';
  if (c.includes('vp8') || c.includes('libvpx')) return 'vp8';
  if (c.includes('prores')) return 'prores';
  if (c.includes('dnxhd') || c.includes('dnxhr')) return 'dnx';
  if (c.includes('mpeg2')) return 'mpeg2';
  if (c.includes('mpeg1')) return 'mpeg1';
  if (c.includes('mjpeg')) return 'mjpeg';
  if (c.includes('mpeg4')) return 'mpeg4';
  if (c.includes('265') || c.includes('hevc')) return 'h265';
  if (c.includes('264') || c.includes('x264')) return 'h264';
  return 'other';
}

/**
 * Returns the container compatibility info for the family of the given codec.
 * Always resolves to a valid entry because classification falls back to 'other'.
 * @param {string} [codec] - The FFmpeg video codec name.
 * @returns {CodecContainerInfo} The preferred extension and compatible container list.
 */
export function getVideoCodecContainer(codec?: string): CodecContainerInfo {
  return CONTAINERS[classifyVideoCodec(codec)];
}

/**
 * Suggests the default output file extension for a video codec.
 * @param {string} [codec] - The FFmpeg video codec name.
 * @returns {string} The preferred extension without a leading dot (e.g. 'mp4').
 */
export function suggestedExtensionForVideoCodec(codec?: string): string {
  return getVideoCodecContainer(codec).extension;
}

/**
 * Checks whether a given container extension can hold a given video codec.
 * The extension comparison is case-insensitive and tolerant of a leading dot.
 * @param {string} extension - The container extension to test (e.g. 'mp4' or '.MKV').
 * @param {string} [codec] - The FFmpeg video codec name.
 * @returns {boolean} True if the extension appears in the codec family's compatible
 * container list, false otherwise.
 */
export function isExtensionCompatibleWithVideoCodec(extension: string, codec?: string): boolean {
  const ext = extension.toLowerCase().replace(/^\./, '');
  return getVideoCodecContainer(codec).containers.includes(ext);
}

/**
 * Maps an FFmpeg audio encoder name to its preferred output container extension.
 * @type {Record<string, string>}
 */
const AUDIO_CONTAINERS: Record<string, string> = {
  aac: 'm4a',
  libfdk_aac: 'm4a',
  libmp3lame: 'mp3',
  libshine: 'mp3',
  libtwolame: 'mp2',
  ac3: 'ac3',
  eac3: 'eac3',
  truehd: 'mka',
  dts: 'dts',
  mlp: 'mlp',
  flac: 'flac',
  alac: 'm4a',
  libwavpack: 'wv',
  libvorbis: 'ogg',
  libopus: 'opus',
  libspeex: 'spx',
  libvo_amrwbenc: 'amr',
  pcm_s16le: 'wav',
  pcm_s24le: 'wav',
  pcm_f32le: 'wav',
  pcm_s16be: 'wav',
  pcm_u8: 'wav',
  pcm_alaw: 'wav',
  pcm_mulaw: 'wav',
  wmav1: 'wma',
  wmav2: 'wma',
  adpcm_ima_wav: 'wav',
};

/**
 * Suggests the default output file extension for an audio encoder.
 * @param {string} [codec] - The FFmpeg audio encoder name (e.g. 'libmp3lame').
 * @returns {string} The preferred extension without a leading dot (e.g. 'mp3'),
 * or '' when the codec is empty or not present in the map.
 */
export function suggestedExtensionForAudioCodec(codec?: string): string {
  if (!codec) return '';
  return AUDIO_CONTAINERS[codec] ?? '';
}

/**
 * Extracts the file extension from a path, lowercased and without a leading dot.
 * Handles both Windows and POSIX path separators as well as dotted filenames.
 * @param {string} [path] - The file path to inspect.
 * @returns {string} The lowercased extension, or '' if the path has no extension.
 */
export function getExtension(path?: string): string {
  const match = /\.([^./\\]+)$/.exec(path ?? '');
  return match ? match[1].toLowerCase() : '';
}

/**
 * Replaces the final extension of a path with a new one, preserving the rest of the path.
 * @param {string} path - The original file path.
 * @param {string} newExtension - The new extension, with or without a leading dot.
 * @returns {string} The path with its final extension replaced.
 */
export function replaceExtension(path: string, newExtension: string): string {
  const ext = newExtension.replace(/^\./, '');
  return path.replace(/\.[^./\\]+$/, `.${ext}`);
}
