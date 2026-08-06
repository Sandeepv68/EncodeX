/**
 * @fileoverview Maps raw ffprobe JSON output into the application's MediaInfo
 * structure. Normalizes ffprobe's string-typed numbers/ratios/rates into the
 * typed fields of MediaStreamInfo and MediaInfo, extracts container and stream
 * tags, and converts disposition bitflags into a human-readable flag list.
 * Used by all three transcoder backends so they report identical metadata.
 */

import { MediaInfo, MediaStreamInfo } from '../../shared/types';
import type { ProbeStream, ProbeFormat, ProbeData } from './types';

/**
 * Parses an ffprobe aspect-ratio/frame-rate string like `'16/9'` or `'30000/1001'`.
 *
 * Splits the fraction, computes `num / den`, and returns the result rounded to
 * 2 decimal places when both parts are finite and the denominator is non-zero
 * and the quotient is positive; otherwise returns undefined.
 * @param {string} ratio - Ratio string in `'num/den'` form
 * @returns {string | undefined} Rounded ratio (e.g. `'1.78'`) or undefined if
 *   the input is not a valid positive ratio
 */
export function parseRatio(ratio: string): string | undefined {
  const parts = ratio.split('/');
  if (parts.length === 2) {
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
      const value = num / den;
      if (value > 0) return value.toFixed(2);
    }
  }
  return undefined;
}

/**
 * Coerces an ffprobe numeric value (number or numeric string) to a number.
 * Returns undefined for null/undefined/non-finite values.
 * @param {string | number | undefined} value - Raw ffprobe value
 * @returns {number | undefined} The numeric value, or undefined if invalid
 */
function toNumber(value: string | number | undefined): number | undefined {
  if (value == null) return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Coerces an ffprobe value to a string, or undefined for null/undefined.
 * @param {string | number | undefined} value - Raw ffprobe value
 * @returns {string | undefined} The string representation, or undefined
 */
function toStringValue(value: string | number | undefined): string | undefined {
  if (value == null) return undefined;
  return String(value);
}

/**
 * Converts a raw ffprobe tags object into a plain string map.
 *
 * Stringifies every non-null value; returns undefined when tags are absent or
 * contain no usable entries.
 * @param {Record<string, unknown> | undefined} tags - Raw ffprobe `tags` object
 * @returns {Record<string, string> | undefined} Tag map, or undefined if empty
 */
function toTags(tags: Record<string, unknown> | undefined): Record<string, string> | undefined {
  if (!tags) return undefined;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(tags)) {
    if (value != null) result[key] = String(value);
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Known ffprobe disposition flags, used to convert the disposition bitmask.
 * @const {readonly string[]} DISPOSITION_FLAGS
 */
const DISPOSITION_FLAGS = [
  'default',
  'dub',
  'original',
  'comment',
  'lyrics',
  'karaoke',
  'forced',
  'hearing_impaired',
  'visual_impaired',
  'clean_effects',
  'attached_pic',
  'timed_thumbnails',
  'captions',
  'descriptions',
  'metadata',
  'dependent',
  'still_image',
] as const;

/**
 * Converts a raw ffprobe disposition bitmask into a list of enabled flag names.
 *
 * Filters DISPOSITION_FLAGS to those whose bit in the disposition object is
 * exactly 1; returns undefined when disposition is absent or nothing is set.
 * @param {Record<string, number> | undefined} disposition - Raw `disposition`
 *   object mapping flag name to 0/1
 * @returns {string[] | undefined} Enabled flag names, or undefined if none
 */
function toDisposition(disposition: Record<string, number> | undefined): string[] | undefined {
  if (!disposition) return undefined;
  const flags = DISPOSITION_FLAGS.filter((flag) => disposition[flag] === 1);
  return flags.length > 0 ? flags : undefined;
}

/**
 * Maps a raw ffprobe JSON document into the application's MediaInfo shape.
 *
 * Streams: each ProbeStream is normalized to a MediaStreamInfo - the codec
 * type defaults to 'video', codec name to 'unknown', frame rates are parsed via
 * {@link parseRatio}, numeric fields via {@link toNumber}, bitrate/sample rate
 * fields via toStringValue, bit depth falls back from bits_per_raw_sample to
 * bits_per_sample, and language/title are pulled from tags. Format: filename
 * falls back to `fallbackFile`, size/duration default to 0, bitrate to 'N/A',
 * and both stream and format tags are converted through {@link toTags}.
 * @param {ProbeData} data - Raw ffprobe output (streams + format sections)
 * @param {string} fallbackFile - File path to use when the format does not
 *   report a filename
 * @returns {MediaInfo} Fully typed media information for the probed file
 */
export function mapFfprobeData(data: ProbeData, fallbackFile: string): MediaInfo {
  const streams: MediaStreamInfo[] = (data.streams || []).map((s) => ({
    index: s.index ?? 0,
    type: (s.codec_type as MediaStreamInfo['type']) ?? 'video',
    codec: s.codec_name ?? 'unknown',
    codecLong: s.codec_long_name,
    codecTag: s.codec_tag_string,
    profile: s.profile != null ? String(s.profile) : undefined,
    level: toNumber(s.level),
    width: s.width,
    height: s.height,
    displayAspectRatio: s.display_aspect_ratio,
    pixelFormat: s.pix_fmt,
    colorRange: s.color_range,
    colorSpace: s.color_space,
    colorTransfer: s.color_transfer,
    colorPrimaries: s.color_primaries,
    fieldOrder: s.field_order,
    frameRate: s.r_frame_rate ? parseRatio(s.r_frame_rate) : undefined,
    avgFrameRate: s.avg_frame_rate ? parseRatio(s.avg_frame_rate) : undefined,
    bitDepth: toNumber(s.bits_per_raw_sample) ?? toNumber(s.bits_per_sample),
    bitrate: toStringValue(s.bit_rate),
    sampleRate: toNumber(s.sample_rate),
    sampleFormat: s.sample_fmt,
    channels: s.channels,
    channelLayout: s.channel_layout,
    bitsPerSample: toNumber(s.bits_per_sample),
    duration: toNumber(s.duration),
    startTime: toNumber(s.start_time),
    frameCount: toNumber(s.nb_frames),
    language: s.tags?.language != null ? String(s.tags.language) : undefined,
    title: s.tags?.title != null ? String(s.tags.title) : undefined,
    disposition: toDisposition(s.disposition),
    tags: toTags(s.tags),
  }));
  const fmt = data.format || {};
  return {
    file: fmt.filename ?? fallbackFile,
    format: fmt.format_name ?? 'unknown',
    formatLong: fmt.format_long_name,
    size: fmt.size != null ? Number(fmt.size) : 0,
    duration: fmt.duration != null ? Number(fmt.duration) : 0,
    bitrate: fmt.bit_rate != null ? String(fmt.bit_rate) : 'N/A',
    startTime: toNumber(fmt.start_time),
    probeScore: fmt.probe_score,
    streams,
    tags: toTags(fmt.tags),
  };
}
