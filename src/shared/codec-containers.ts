/**
 * @fileoverview Codec-to-container compatibility maps and extension helpers.
 * Classifies an FFmpeg video codec string into a generic family, then maps that
 * family to the container formats it can be muxed into and to a preferred default
 * output extension. Also provides audio-extension lookup and path/extension
 * utilities used for suggesting and validating output files.
 */

import type { CodecContainerInfo, MediaStreamInfo, RemuxInput } from './types';
import { SUBTITLE_CODEC_CONTAINERS } from './transcoder-constants';

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
 * Every distinct container extension that the supported audio encoders can be
 * muxed into, for offering an audio container picker. Derived from the unique
 * values of AUDIO_CONTAINERS.
 * @const {readonly string[]} AUDIO_CONTAINER_EXTENSIONS
 */
export const AUDIO_CONTAINER_EXTENSIONS: readonly string[] = [...new Set(Object.values(AUDIO_CONTAINERS))];

/**
 * Maps an FFmpeg audio encoder name to the container extensions it can be
 * muxed into, driving the audio container picker so only compatible choices are
 * offered. Each list always includes the encoder's preferred extension (from
 * AUDIO_CONTAINERS) plus a conservative set of widely compatible muxers. The
 * lists are a UI suggestion, not an exhaustive FFmpeg guarantee.
 * @type {Record<string, string[]>}
 */
const AUDIO_CODEC_CONTAINERS: Record<string, string[]> = {
  aac: ['m4a', 'aac', 'mp4', 'mkv'],
  libfdk_aac: ['m4a', 'aac', 'mp4', 'mkv'],
  libmp3lame: ['mp3', 'mkv', 'mp4'],
  libshine: ['mp3', 'mkv', 'mp4'],
  libtwolame: ['mp2'],
  ac3: ['ac3', 'mkv', 'mp4'],
  eac3: ['eac3', 'mkv', 'mp4'],
  truehd: ['mka', 'mkv'],
  dts: ['dts', 'mkv'],
  mlp: ['mlp', 'mkv'],
  flac: ['flac', 'ogg', 'mka', 'mkv'],
  alac: ['m4a', 'mp4', 'mkv'],
  libwavpack: ['wv', 'mkv'],
  libvorbis: ['ogg', 'ogv', 'mkv'],
  libopus: ['opus', 'ogg', 'mkv', 'mp4'],
  libspeex: ['spx', 'ogg'],
  libvo_amrwbenc: ['amr', 'mp4'],
  pcm_s16le: ['wav', 'mkv'],
  pcm_s24le: ['wav', 'mkv'],
  pcm_f32le: ['wav', 'mkv'],
  pcm_s16be: ['wav'],
  pcm_u8: ['wav'],
  pcm_alaw: ['wav'],
  pcm_mulaw: ['wav'],
  wmav1: ['wma', 'asf'],
  wmav2: ['wma', 'asf'],
  adpcm_ima_wav: ['wav'],
};

/**
 * Returns the container extensions compatible with the given audio encoder.
 * Unknown or empty codecs fall back to the full AUDIO_CONTAINER_EXTENSIONS list;
 * a codec that is known but has no curated list falls back to its preferred
 * extension only.
 * @param {string} [codec] - The FFmpeg audio encoder name (e.g. 'libmp3lame').
 * @returns {string[]} The container extensions the codec can be muxed into.
 */
export function getAudioCodecContainers(codec?: string): string[] {
  if (!codec) return [...AUDIO_CONTAINER_EXTENSIONS];
  const curated = AUDIO_CODEC_CONTAINERS[codec];
  if (curated) return [...curated];
  const preferred = AUDIO_CONTAINERS[codec];
  return preferred ? [preferred] : [];
}

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

/**
 * Replaces the extension of a file path with the given one, preserving any
 * directory portion. If the path has no extension (or only directory dots), the
 * new extension is appended. Extension detection stops at the last slash so
 * directory names containing dots are not mangled.
 * @param {string} path - The file path whose extension is replaced.
 * @param {string} ext - The new extension, without a leading dot.
 * @returns {string} The path with its extension replaced or appended.
 */
export function withExtension(path: string, ext: string): string {
  const slashIdx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const dotIdx = path.lastIndexOf('.');
  const base = dotIdx > slashIdx ? path.slice(0, dotIdx) : path;
  return `${base}.${ext}`;
}

/**
 * Subtitle codecs and the container extensions that can store them for STREAM
 * COPY extraction/remux. A subtitle stream whose codec is absent from its target
 * container's list (or whose list is empty) cannot be muxed without converting.
 * Unknown subtitle codecs resolve to 'mkv' (the most permissive subtitle muxer).
 * @const {Record<string, readonly string[]>} SUBTITLE_CONTAINERS
 */
const SUBTITLE_CONTAINERS: Record<string, readonly string[]> = {
  subrip: ['srt', 'mkv', 'mp4', 'mov', 'ts'],
  mov_text: ['mp4', 'mov', 'mkv'],
  ass: ['ass', 'mkv', 'mov'],
  ssa: ['ass', 'mkv', 'mov'],
  webvtt: ['webvtt', 'mkv', 'webm', 'mp4'],
  hdmv_pgs_subtitle: ['mkv', 'm2ts'],
  dvd_subtitle: ['mkv', 'm2ts'],
  dvb_subtitle: ['mkv', 'm2ts'],
  other: ['mkv'],
};

/**
 * Returns whether a subtitle codec can be stream-copied into the given
 * container extension. Comparison is case-insensitive and dot-tolerant.
 * @param {string} codec - The subtitle codec name (e.g. 'subrip', 'ass').
 * @param {string} extension - The container extension to test (e.g. 'mkv').
 * @returns {boolean} True when the container extension accepts the codec.
 */
export function isSubtitleCodecCompatibleWithContainer(codec: string, extension: string): boolean {
  const ext = extension.toLowerCase().replace(/^\./, '');
  const allowed = SUBTITLE_CONTAINERS[codec.toLowerCase()] ?? SUBTITLE_CONTAINERS.other;
  return allowed.includes(ext);
}

/**
 * Returns whether a subtitle codec is allowed for stream copy into the target
 * container according to the encoder-side guidance in
 * `SUBTITLE_CODEC_CONTAINERS` (e.g. 'mov_text'/'subrip' for MP4). This is the
 * remux-embedding check: a subtitle added for embedding must choose a codec the
 * container accepts in copy mode.
 * @param {string} codec - The subtitle encoder/format (e.g. 'mov_text', 'subrip').
 * @param {string} extension - The container extension (e.g. 'mp4').
 * @returns {boolean} True when the codec appears in the container's allowed list.
 */
export function isSubtitleCodecAllowed(codec: string, extension: string): boolean {
  const ext = extension.toLowerCase().replace(/^\./, '');
  return (SUBTITLE_CODEC_CONTAINERS[ext] as readonly string[] | undefined)?.includes(codec.toLowerCase()) ?? false;
}

/**
 * Whether the target container can hold cover art: MKV/WebM accept an attached
 * picture stream (`-attach`), MP4/MOV accept an `attached_pic` disposition.
 * @param {string} extension - The container extension (e.g. 'mkv').
 * @returns {boolean} True when the container supports some form of cover art.
 */
export function isContainerCompatibleWithCover(extension: string): boolean {
  const ext = extension.toLowerCase().replace(/^\./, '');
  return ext === 'mkv' || ext === 'webm' || ext === 'mp4' || ext === 'mov';
}

/**
 * Container extensions that store chapter metadata. Containers outside this
 * list (TS, AVI, WebM-adjacent) drop chapters on remux.
 * @const {readonly string[]} CHAPTER_CONTAINERS
 */
const CHAPTER_CONTAINERS: readonly string[] = ['mp4', 'mov', 'mkv'];

/**
 * Whether a container extension stores chapter metadata.
 * @param {string} extension - The container extension (e.g. 'mkv').
 * @returns {boolean} True when the container can hold chapters.
 */
export function isContainerCompatibleWithChapters(extension: string): boolean {
  const ext = extension.toLowerCase().replace(/^\./, '');
  return (CHAPTER_CONTAINERS as readonly string[]).includes(ext);
}

/**
 * Returns whether a probed stream can be stream-copied into the given container
 * extension without re-encoding. Video is classified via
 * {@link isExtensionCompatibleWithVideoCodec}, audio is assumed compatible
 * (fallback true, matching the codec-agnostic muxers), and subtitles are checked
 * against {@link isSubtitleCodecCompatibleWithContainer}.
 * @param {string} extension - The container extension (e.g. 'mp4').
 * @param {MediaStreamInfo} stream - The probed source stream.
 * @returns {boolean} True when the stream can be muxed as-is into the container.
 */
export function isContainerCompatibleWithStream(extension: string, stream: MediaStreamInfo): boolean {
  const ext = extension.toLowerCase().replace(/^\./, '');
  // A stream entry can be missing `type` when it comes from a hand-built or
  // partially-mapped ffprobe payload; reading it unguarded turned a defensive
  // predicate into a crash on the caller's side.
  if (!stream?.type) return true;
  if (stream.type === 'video') return isExtensionCompatibleWithVideoCodec(ext, stream.codec);
  if (stream.type === 'subtitle') return isSubtitleCodecCompatibleWithContainer(stream.codec, ext);
  return true;
}

/**
 * Severity of a remux compatibility warning, mirroring toast/preload icon tiers.
 * @typedef {'info'|'warning'|'error'} RemuxWarningIcon
 */
export type RemuxWarningIcon = 'info' | 'warning' | 'error';

/**
 * A non-blocking compatibility finding surfaced by {@link remuxWarnings} for the
 * GUI, CLI, and MCP. Hard incompatibilities are reported with icon 'error';
 * conversions/workarounds with 'warning'; informational notes with 'info'.
 * `stream` is null for asset-level (cover/chapters/added subtitle) findings.
 * @interface RemuxWarning
 * @property {RemuxWarningIcon} icon - Severity tier.
 * @property {string} message - Human-readable finding (English; UI localizes via `code`).
 * @property {MediaStreamInfo|null} stream - The affected source stream, if any.
 * @property {string} [code] - Stable finding key for localization.
 */
export interface RemuxWarning {
  icon: RemuxWarningIcon;
  message: string;
  stream: MediaStreamInfo | null;
  code?: string;
}

/**
 * Computes the remux compatibility findings for a target container across the
 * probed source streams and any added assets. Slow-but-simple linear scan used
 * by GUI (Remux page), CLI (`remux --format`), and MCP (`remux_media`).
 * A non-empty `videoFilters` chain additionally reports
 * `filters_force_reencode`: filters can only be applied while re-encoding, so the
 * otherwise lossless copy becomes a re-encode.
 * @param {MediaStreamInfo[]} inputs - Probed source streams.
 * @param {RemuxInput[]} [additionalInputs] - Added subtitles/audio/cover entries.
 * @param {string} [chaptersFile] - FFMETADATA chapters file being imported, if any.
 * @param {string} [containerExt] - Target container extension (e.g. 'mp4').
 * @param {string[]} [videoFilters] - Video filter chain the plan will apply.
 * @returns {RemuxWarning[]} Ordered findings across streams and assets.
 */
export function remuxWarnings(
  inputs: MediaStreamInfo[],
  additionalInputs?: RemuxInput[],
  chaptersFile?: string,
  containerExt?: string,
  videoFilters?: string[],
): RemuxWarning[] {
  const ext = (containerExt ?? '').toLowerCase().replace(/^\./, '');
  if (!ext) return [];
  const warnings: RemuxWarning[] = [];
  let copyableVideo: MediaStreamInfo | null = null;

  for (const stream of inputs) {
    if (stream.type === 'video' && !isExtensionCompatibleWithVideoCodec(ext, stream.codec)) {
      warnings.push({
        icon: 'error',
        code: 'incompatibleVideoStream',
        message: `Video stream ${stream.codec} cannot be muxed into ${ext} without re-encoding.`,
        stream,
      });
    } else if (stream.type === 'video') {
      copyableVideo ??= stream;
    } else if (stream.type === 'subtitle' && !isSubtitleCodecCompatibleWithContainer(stream.codec, ext)) {
      warnings.push({
        icon: isSubtitleCodecAllowed(stream.codec, ext) ? 'warning' : 'error',
        code: 'incompatibleSubtitleStream',
        message: `Subtitle stream ${stream.codec} is not natively supported by ${ext}; conversion is required.`,
        stream,
      });
    }
  }

  if (videoFilters?.length && copyableVideo) {
    warnings.push({
      icon: 'warning',
      code: 'filters_force_reencode',
      message: `Video filters are set, so the output is re-encoded (${videoFilters.length} filter${
        videoFilters.length === 1 ? '' : 's'
      }) instead of being losslessly copied.`,
      stream: copyableVideo,
    });
  }

  for (const entry of additionalInputs ?? []) {
    if (entry.attachment && ext !== 'mkv' && ext !== 'webm') {
      warnings.push({
        icon: 'warning',
        code: 'coverNotSupported',
        message: `Attached cover art is only supported by MKV/WebM, not ${ext}.`,
        stream: null,
      });
    } else if (entry.disposition && ext !== 'mp4' && ext !== 'mov') {
      warnings.push({
        icon: 'warning',
        code: 'coverNotSupported',
        message: `Cover-art disposition is only supported by MP4/MOV, not ${ext}.`,
        stream: null,
      });
    }
    if (entry.codec && entry.codec !== 'copy' && !isSubtitleCodecAllowed(entry.codec, ext)) {
      warnings.push({
        icon: 'warning',
        code: 'addedSubtitleCodecUnsupported',
        message: `Added subtitle codec ${entry.codec} is not accepted by ${ext}.`,
        stream: null,
      });
    }
  }

  if (chaptersFile && !isContainerCompatibleWithChapters(ext)) {
    warnings.push({
      icon: 'warning',
      code: 'chaptersUnsupported',
      message: `${ext} does not store chapter metadata; chapters will be dropped.`,
      stream: null,
    });
  }

  return warnings;
}

/**
 * Subtitle codecs whose payload is a bitmap image (PGS, DVD, DVB subs). These
 * cannot be burned into a text subtitle container without OCR and must be
 * extracted as `.mks` (Matroska subtitle track) or kept inside MKV/TS.
 * @const {readonly string[]} BITMAP_SUBTITLE_CODECS
 */
export const BITMAP_SUBTITLE_CODECS: readonly string[] = ['hdmv_pgs_subtitle', 'dvd_subtitle', 'dvb_subtitle', 'dvb_teletext'];

/**
 * Whether a subtitle codec carries bitmap graphics rather than text.
 * @param {string} codec - The subtitle codec name.
 * @returns {boolean} True for PGS/DVD/DVB bitmap subtitle codecs.
 */
export function isBitmapSubtitleCodec(codec?: string): boolean {
  return BITMAP_SUBTITLE_CODECS.includes((codec ?? '').toLowerCase());
}

/**
 * Suggests the default output extension for a probed stream when extracting it
 * losslessly: video → its codec family's preferred container, audio → the
 * encoder's preferred extension (fallback `mka`), subtitle → `mks` for bitmap
 * subs, otherwise the text subtitle codec's native extension (`subrip` → `srt`,
 * `ass`/`ssa` → `ass`, `webvtt` → `vtt`, fallback `srt`).
 * @param {MediaStreamInfo} stream - The probed source stream.
 * @returns {string} The suggested extension without a leading dot.
 */
export function suggestedExtensionForStream(stream: MediaStreamInfo): string {
  if (stream.type === 'video') return suggestedExtensionForVideoCodec(stream.codec) || 'mkv';
  if (stream.type === 'audio') return suggestedExtensionForAudioCodec(stream.codec) || 'mka';
  if (isBitmapSubtitleCodec(stream.codec)) return 'mks';
  const codec = (stream.codec ?? '').toLowerCase();
  if (codec === 'ass' || codec === 'ssa') return 'ass';
  if (codec === 'webvtt') return 'vtt';
  return 'srt';
}

/**
 * Computes the demux conversion fallback warnings for the selected streams.
 * Two fallbacks are reported:
 *  - Bitmap subtitles (PGS/DVDSUB/DVB) cannot be re-encoded into a plain text
 *    format in a stream-copy pipeline without OCR, so a requested
 *    `subtitleCodec` conversion silently falls back to a `.mks` stream copy.
 *  - A `videoFilters` chain needs a re-encoded video stream, so it is ignored by
 *    a video target that stays a stream copy (no `videoContainer`, or one equal
 *    to the stream's native format).
 * Both are returned as structured findings so the GUI, CLI, and MCP surface the
 * fallback instead of pretending the conversion happened.
 * @param {MediaStreamInfo[]} streams - Probing streams (used in their stored order).
 * @param {DemuxMediaPreferences} [media] - Per-kind conversion preferences.
 * @returns {RemuxWarning[]} Ordered warnings for the bitmap-subtitle and
 *   filters-on-a-stream-copy fallbacks.
 */
export function demuxWarnings(streams: MediaStreamInfo[], media?: DemuxMediaPreferences): RemuxWarning[] {
  const warnings: RemuxWarning[] = [];
  const subtitleCodec = (media?.subtitleCodec ?? '').toLowerCase();
  if (subtitleCodec && subtitleCodec !== 'copy') {
    for (const stream of streams) {
      if (stream.type !== 'subtitle' || !isBitmapSubtitleCodec(stream.codec)) continue;
      warnings.push({
        icon: 'warning',
        code: 'bitmapSubtitleWarning',
        message:
          `Subtitle stream #${stream.index} (${stream.codec}) is a bitmap subtitle and cannot be converted ` +
          `to ${subtitleCodec}; it will be extracted as a .mks stream copy.`,
        stream,
      });
    }
  }

  const filters = media?.videoFilters ?? [];
  if (filters.length > 0) {
    const container = (media?.videoContainer ?? '').toLowerCase().replace(/^\./, '');
    const copied = streams.filter((stream) => stream.type === 'video' && (!container || container === suggestedExtensionForStream(stream)));
    if (copied.length > 0) {
      warnings.push({
        icon: 'warning',
        code: 'filtersIgnoredCopy',
        message:
          `Video filters are ignored for stream-copied video stream #${copied[0].index}; ` +
          `choose a different video container to re-encode it with the filter chain.`,
        stream: copied[0],
      });
    }
  }

  return warnings;
}

/**
 * Optional per-kind conversion targets for demux. Any kind left unset is
 * extracted losslessly (stream copy) into the extension suggested by
 * {@link suggestedExtensionForStream}. Values are FFmpeg-native: a container
 * extension for video (`videoContainer`, e.g. 'mp4'), an encoder name for audio
 * (`audioCodec`, e.g. 'mp3'/'aac'/'flac'), and an encoder/format name for
 * subtitles (`subtitleCodec`, e.g. 'srt'/'ass').
 * @interface DemuxMediaPreferences
 * @property {string} [videoContainer] - Re-encode video into this container
 *   (extension) when it differs from the stream's native format; forces copy:false.
 * @property {string} [audioCodec] - Audio encoder to convert to (e.g. 'mp3').
 * @property {string} [subtitleCodec] - Subtitle format to convert to (e.g. 'srt').
 * @property {string[]} [videoFilters] - Ordered FFmpeg video filter expressions.
 *   Only meaningful for a video target that re-encodes (`videoContainer` set and
 *   differing from the stream's native format); a stream-copied video target
 *   ignores them and {@link demuxWarnings} reports `filtersIgnoredCopy`.
 */
export interface DemuxMediaPreferences {
  videoContainer?: string;
  audioCodec?: string;
  subtitleCodec?: string;
  videoFilters?: string[];
}

/**
 * A single demux extraction unit: which source stream, how it is mapped, whether
 * it is stream-copied or re-encoded, and where the output goes.
 * @interface DemuxTarget
 * @property {number} index - Source stream index (ffprobe global index, input 0).
 * @property {'video'|'audio'|'subtitle'} kind - Stream kind.
 * @property {string} map - Single `-map` spec targeting this stream (e.g. '0:v:1').
 * @property {boolean} copy - True = `-c copy`; false = re-encode with `codec`.
 * @property {string} [codec] - Re-encode target encoder when `copy` is false.
 * @property {string} [container] - Output container extension for re-encoded video.
 * @property {string[]} [videoFilters] - Video filter chain carried onto this
 *   target; set only for a re-encoded video target (absent for stream copies).
 * @property {string} output - Absolute output path (baseName + kind_index + ext).
 */
export interface DemuxTarget {
  index: number;
  kind: 'video' | 'audio' | 'subtitle';
  map: string;
  copy: boolean;
  codec?: string;
  container?: string;
  videoFilters?: string[];
  output: string;
}

/**
 * Default video encoders for containers when a demux conversion re-encodes
 * video, keyed by container extension.
 * @const {Record<string, string>} DEFAULT_VIDEO_ENCODERS
 */
export const DEFAULT_VIDEO_ENCODERS: Record<string, string> = {
  mp4: 'libx264',
  m4v: 'libx264',
  mov: 'libx264',
  mkv: 'libx264',
  webm: 'libvpx-vp9',
  ogv: 'libtheora',
  avi: 'mpeg4',
  ts: 'libx264',
  m2ts: 'libx264',
};

/**
 * Output extensions for user-facing audio codec short names (e.g. 'mp3', 'aac')
 * as accepted by `DemuxMediaPreferences.audioCodec`. Long encoder names
 * (e.g. 'libmp3lame') resolve through the existing AUDIO_CONTAINERS map instead.
 * @const {Record<string, string>} AUDIO_SHORT_EXTENSIONS
 */
const AUDIO_SHORT_EXTENSIONS: Record<string, string> = {
  mp3: 'mp3',
  m4a: 'm4a',
  aac: 'm4a',
  ac3: 'ac3',
  eac3: 'eac3',
  flac: 'flac',
  alac: 'm4a',
  opus: 'opus',
  ogg: 'ogg',
  wav: 'wav',
  pcm_s16le: 'wav',
};

/**
 * Resolves the output extension for an audio conversion target, accepting both
 * encoder long names (libmp3lame) and user-facing short names (mp3).
 * @param {string} codec - The audio codec or encoder name.
 * @returns {string} The extension without a leading dot, or '' when unknown.
 */
export function audioCodecToExtension(codec: string): string {
  const key = codec.toLowerCase();
  return suggestedExtensionForAudioCodec(key) || AUDIO_SHORT_EXTENSIONS[key] || '';
}

/**
 * Builds the per-stream demux extraction targets. `selectedStreams` is a
 * filtered slice of the probed streams (all streams with `stream.selected` true);
 * per-kind ordinal indices are derived anew so `-map` specs stay valid regardless
 * of which streams were deselected. When `media` requests a kind conversion, the
 * matching targets drop `copy` and carry the target codec/container. A
 * `media.videoFilters` chain is carried onto video targets that re-encode; a
 * stream-copied video target ignores it (see {@link demuxWarnings}).
 * @param {string} input - Absolute path of the source file (embedded in output path).
 * @param {string} baseName - Output basename without extension (e.g. 'movie-video').
 * @param {MediaStreamInfo[]} selectedStreams - Probing streams selected for extraction.
 * @param {DemuxMediaPreferences} [media] - Optional per-kind conversion preferences.
 * @returns {DemuxTarget[]} Extraction targets in input-stream order.
 */
export function buildDemuxTargets(
  input: string,
  baseName: string,
  selectedStreams: MediaStreamInfo[],
  media?: DemuxMediaPreferences,
): DemuxTarget[] {
  const kindCounts: Record<string, number> = { video: 0, audio: 0, subtitle: 0 };
  const targets: DemuxTarget[] = [];
  const videoFilters = media?.videoFilters?.length ? [...media.videoFilters] : undefined;

  for (const stream of selectedStreams) {
    const kind = stream.type;
    const ordinal = kindCounts[kind]++;
    const map = `0:${kind[0]}:${ordinal}`;
    const prettyKind = kind === 'subtitle' ? 'subtitle' : kind;

    let copy = true;
    let codec: string | undefined;
    let container: string | undefined;
    let ext = suggestedExtensionForStream(stream);
    let targetVideoFilters: string[] | undefined;

    if (kind === 'video' && media?.videoContainer) {
      const containerExt = media.videoContainer.toLowerCase().replace(/^\./, '');
      if (containerExt !== ext) {
        copy = false;
        container = containerExt;
        codec = DEFAULT_VIDEO_ENCODERS[containerExt] ?? 'libx264';
        ext = containerExt;
        targetVideoFilters = videoFilters;
      }
    } else if (kind === 'audio' && media?.audioCodec) {
      codec = media.audioCodec.toLowerCase();
      copy = false;
      ext = audioCodecToExtension(codec) || 'mka';
    } else if (kind === 'subtitle' && media?.subtitleCodec) {
      const targetCodec = media.subtitleCodec.toLowerCase();
      if (targetCodec !== 'copy' && !isBitmapSubtitleCodec(stream.codec)) {
        codec = targetCodec;
        copy = false;
        ext = targetCodec === 'webvtt' ? 'vtt' : targetCodec;
      }
    }

    const name = kind === 'video' && kindCounts[kind] <= 1 ? `${baseName}.${prettyKind}` : `${baseName}.${prettyKind}_${ordinal}`;
    targets.push({
      index: stream.index,
      kind,
      map,
      copy,
      codec,
      container,
      videoFilters: targetVideoFilters,
      output: `${name}.${ext}`,
    });
  }

  return targets;
}
