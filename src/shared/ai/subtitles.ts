/**
 * @fileoverview Deterministic subtitle serialization (roadmap 2.0, F11/F12).
 * Turns {@link TranscriptSegment}s into SRT, WebVTT, or ASS documents. Pure
 * string code — no engine, no filesystem — so every format is unit-testable and
 * the same output is produced for the same transcript regardless of the STT or
 * translation runtime that produced it.
 */

import { normalizeSegmentText } from './transcript';
import type { TranscriptSegment } from './transcript';

/**
 * Supported subtitle container formats.
 * @typedef {('srt' | 'vtt' | 'ass')} SubtitleFormat
 */
export type SubtitleFormat = 'srt' | 'vtt' | 'ass';

/**
 * Pads a non-negative integer to a fixed width.
 * @param {number} value - The integer.
 * @param {number} width - Minimum digit count.
 * @returns {string} The zero-padded string.
 */
function pad(value: number, width: number): string {
  return String(Math.max(0, Math.floor(value))).padStart(width, '0');
}

/**
 * Formats a timestamp in SRT/VTT clock form (`HH:MM:SS,mmm` / `HH:MM:SS.mmm`).
 * @param {number} seconds - Offset in seconds.
 * @param {',' | '.'} separator - Millisecond separator.
 * @returns {string} The formatted timestamp.
 */
function clock(seconds: number, separator: ',' | '.'): string {
  const safe = Math.max(0, seconds);
  const whole = Math.floor(safe);
  const ms = Math.round((safe - whole) * 1000);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)}${separator}${pad(ms, 3)}`;
}

/**
 * Formats a timestamp in ASS form (`H:MM:SS.cc`, centisecond resolution).
 * @param {number} seconds - Offset in seconds.
 * @returns {string} The formatted ASS timestamp.
 */
export function assTimestamp(seconds: number): string {
  const safe = Math.max(0, seconds);
  const whole = Math.floor(safe);
  const cs = Math.min(99, Math.round((safe - whole) * 100));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  return `${hours}:${pad(minutes, 2)}:${pad(secs, 2)}.${pad(cs, 2)}`;
}

/**
 * Serializes segments as a SubRip (`.srt`) document.
 * @param {TranscriptSegment[]} segments - Ordered segments.
 * @returns {string} The SRT document.
 */
export function toSrt(segments: TranscriptSegment[]): string {
  const blocks = segments.map((segment, index) => {
    const start = clock(segment.start, ',');
    const end = clock(segment.end, ',');
    return `${index + 1}\n${start} --> ${end}\n${normalizeSegmentText(segment.text)}`;
  });
  return `${blocks.join('\n\n')}\n`;
}

/**
 * Serializes segments as a WebVTT (`.vtt`) document.
 * @param {TranscriptSegment[]} segments - Ordered segments.
 * @returns {string} The WebVTT document.
 */
export function toVtt(segments: TranscriptSegment[]): string {
  const blocks = segments.map((segment) => {
    const start = clock(segment.start, '.');
    const end = clock(segment.end, '.');
    return `${start} --> ${end}\n${normalizeSegmentText(segment.text)}`;
  });
  return `WEBVTT\n\n${blocks.join('\n\n')}\n`;
}

/**
 * Serializes segments as an Advanced SubStation Alpha (`.ass`) document with a
 * single default style. Text newlines are escaped as `\N` and literal
 * backslashes doubled so the document stays parseable.
 * @param {TranscriptSegment[]} segments - Ordered segments.
 * @returns {string} The ASS document.
 */
export function toAss(segments: TranscriptSegment[]): string {
  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, ' +
      'Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, ' +
      'MarginR, MarginV, Encoding',
    'Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ].join('\n');
  const events = segments.map((segment) => {
    const text = normalizeSegmentText(segment.text).replace(/\\/g, '\\\\');
    return `Dialogue: 0,${assTimestamp(segment.start)},${assTimestamp(segment.end)},Default,,0,0,0,,${text}`;
  });
  return `${header}\n${events.join('\n')}\n`;
}

/**
 * Serializes segments in the requested subtitle format.
 * @param {TranscriptSegment[]} segments - Ordered segments.
 * @param {SubtitleFormat} format - Target format.
 * @returns {string} The serialized document.
 */
export function formatSubtitles(segments: TranscriptSegment[], format: SubtitleFormat): string {
  if (format === 'vtt') return toVtt(segments);
  if (format === 'ass') return toAss(segments);
  return toSrt(segments);
}

/**
 * Chooses the file extension for a subtitle format.
 * @param {SubtitleFormat} format - The format.
 * @returns {string} The extension without a leading dot.
 */
export function subtitleExtension(format: SubtitleFormat): string {
  return format;
}

/**
 * Derives a sidecar subtitle path from a media path and format
 * (`movie.mkv` + `srt` → `movie.srt`).
 * @param {string} input - The media file path.
 * @param {SubtitleFormat} format - The subtitle format.
 * @returns {string} The derived subtitle path (same directory, base name).
 */
export function deriveSubtitlePath(input: string, format: SubtitleFormat): string {
  const normalized = String(input ?? '').replace(/\\/g, '/');
  const slash = normalized.lastIndexOf('/');
  const dir = slash >= 0 ? normalized.slice(0, slash + 1) : '';
  const base = slash >= 0 ? normalized.slice(slash + 1) : normalized;
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const sep = String(input ?? '').includes('\\') ? '\\' : '/';
  return `${dir}${stem}.${format}`.replace(/\//g, sep);
}
