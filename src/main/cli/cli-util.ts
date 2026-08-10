/**
 * @fileoverview Shared helper utilities for the EncodeX CLI.
 * Provides input expansion (globs/directories), output path derivation, and
 * small formatting/parsing helpers used by the convert, batch, compress, and
 * extract-audio subcommands.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Options controlling how an output file path is derived from an input path.
 * @typedef {Object} DeriveOutputOptions
 * @property {string} [outputDir] - Directory to place the output in. Defaults
 *   to the input's directory when omitted.
 * @property {string} [suffix] - Text appended to the file stem before the
 *   extension (e.g. `_converted`). Defaults to '' when omitted.
 * @property {string} [outputExt] - Extension (without dot) to give the output.
 *   When omitted the input extension is kept.
 * @property {boolean} [keepExt] - When false and `outputExt` is omitted, drop
 *   the input extension entirely instead of keeping it.
 */
export interface DeriveOutputOptions {
  outputDir?: string;
  suffix?: string;
  outputExt?: string;
  keepExt?: boolean;
}

/**
 * Returns the lower-cased extension (without the leading dot) of a file path,
 * or '' when the path has no extension.
 * @param {string} filePath - The file path to inspect.
 * @returns {string} The lower-cased extension without dot, or ''.
 * @example
 * getInputExtension('/a/b/video.MP4') // 'mp4'
 */
export function getInputExtension(filePath: string): string {
  const ext = path.extname(filePath);
  return ext ? ext.slice(1).toLowerCase() : '';
}

/**
 * Expands CLI input arguments into a deduplicated list of existing files.
 *
 * Each pattern may be a plain file path, a directory (whose media files are
 * collected non-recursively), or a glob supporting `*`, `?`, and `**`. Home
 * directory (`~`) is expanded and results are sorted for deterministic output.
 *
 * @param {string[]} patterns - Raw input arguments.
 * @returns {string[]} Sorted, unique, absolute file paths that exist on disk.
 * @example
 * expandInputs(['~/videos/*.mp4', 'clip.avi']) // ['/home/u/videos/a.mp4', '/cwd/clip.avi']
 */
export function expandInputs(patterns: string[]): string[] {
  const found = new Map<string, string>();
  const seen = new Set<string>();

  const visit = (candidate: string): void => {
    const resolved = path.resolve(candidate.replace(/^~(?=[\\/]|$)/, os.homedir()));
    const abs = path.normalize(resolved);
    if (seen.has(abs)) return;
    seen.add(abs);

    let stat: fs.Stats | undefined;
    try {
      stat = fs.statSync(abs);
    } catch {
      return;
    }

    if (stat.isDirectory()) {
      let entries: string[];
      try {
        entries = fs.readdirSync(abs);
      } catch {
        return;
      }
      for (const entry of entries) {
        const child = path.join(abs, entry);
        try {
          if (fs.statSync(child).isFile()) found.set(path.normalize(child), child);
        } catch {
          /* unreadable entry */
        }
      }
      return;
    }

    if (stat.isFile()) found.set(abs, abs);
  };

  for (const pattern of patterns) {
    if (!/[?*[\]]/.test(pattern)) {
      visit(pattern);
      continue;
    }
    for (const match of expandGlob(pattern)) visit(match);
  }

  return [...found.values()].sort();
}

/**
 * Tests whether a glob segment still contains magic characters.
 * @param {string} segment - A single path segment.
 * @returns {boolean} True when the segment contains `*`, `?`, `[`, or `]`.
 */
function hasMagic(segment: string): boolean {
  return /[?*[\]]/.test(segment);
}

/**
 * Converts a single glob segment into an anchored RegExp.
 *
 * `*` matches any run of characters (not crossing a path separator), `?`
 * matches exactly one, and `[...]` character classes are passed through.
 *
 * @param {string} segment - A single path segment.
 * @returns {RegExp} Anchored regular expression for the segment.
 */
function globToRegex(segment: string): RegExp {
  let out = '';
  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i];
    if (ch === '*') {
      out += '[^/\\\\]*';
    } else if (ch === '?') {
      out += '[^/\\\\]';
    } else if (ch === '[') {
      const close = segment.indexOf(']', i + 1);
      if (close > i) {
        out += segment.slice(i, close + 1);
        i = close;
      } else {
        out += '\\[';
      }
    } else {
      out += ch.replace(/[.+^${}()|\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${out}$`);
}

/**
 * Expands a single glob pattern into matching file paths.
 *
 * Supports `*`, `?`, `[...]`, and `**` (recursive). Matching is done against
 * the filesystem one directory level at a time, so results only include paths
 * that exist. The pattern is resolved relative to the current working
 * directory and `~` is expanded to the home directory.
 *
 * @param {string} pattern - Glob pattern to expand.
 * @returns {string[]} Matching absolute file paths.
 * @example
 * expandGlob('~/videos/*.mp4') // ['C:\\Users\\u\\videos\\a.mp4', ...]
 */
function expandGlob(pattern: string): string[] {
  const resolved = path.resolve(pattern.replace(/^~(?=[\\/]|$)/, os.homedir()));
  const root = path.parse(resolved).root;
  const remainder = resolved.slice(root.length);
  const tokens = remainder.split(/[\\/]/).filter((token) => token.length > 0);
  const result: string[] = [];

  const walk = (base: string, index: number): void => {
    if (index >= tokens.length) {
      result.push(base);
      return;
    }
    const token = tokens[index];
    const isLast = index === tokens.length - 1;

    if (token === '**') {
      walk(base, index + 1);
      let entries: string[] = [];
      try {
        entries = fs.readdirSync(base);
      } catch {
        return;
      }
      for (const entry of entries) {
        const child = path.join(base, entry);
        let stat: fs.Stats;
        try {
          stat = fs.statSync(child);
        } catch {
          continue;
        }
        if (stat.isDirectory()) {
          if (isLast) result.push(child);
          walk(child, index);
        } else if (isLast) {
          result.push(child);
        }
      }
      return;
    }

    if (!hasMagic(token)) {
      walk(path.join(base, token), index + 1);
      return;
    }

    let entries: string[] = [];
    try {
      entries = fs.readdirSync(base);
    } catch {
      return;
    }
    const regex = globToRegex(token);
    for (const entry of entries) {
      if (!regex.test(entry)) continue;
      const child = path.join(base, entry);
      if (isLast) {
        try {
          if (fs.statSync(child).isFile()) result.push(child);
        } catch {
          /* unreadable entry */
        }
      } else {
        walk(child, index + 1);
      }
    }
  };

  walk(root, 0);
  return result;
}

/**
 * Derives the output file path for an input path.
 *
 * Naming mirrors the GUI: the input stem is preserved and optionally suffixed
 * (e.g. `clip_converted.mp4`), the extension follows `outputExt` when given,
 * and the result is placed in `outputDir` or next to the input.
 *
 * @param {string} input - Input file path.
 * @param {DeriveOutputOptions} [opts] - Output derivation options.
 * @returns {string} The derived output file path.
 * @example
 * deriveOutputPath('/a/b/clip.mp4', { suffix: '_converted', outputExt: 'webm' })
 * // '/a/b/clip_converted.webm'
 */
export function deriveOutputPath(input: string, opts: DeriveOutputOptions = {}): string {
  const ext = opts.outputExt ?? (opts.keepExt === false ? '' : getInputExtension(input));
  const extName = path.extname(input);
  const stem = extName ? input.slice(0, -extName.length) : input;
  const fileName = `${stem}${opts.suffix ?? ''}${ext ? `.${ext}` : ''}`;
  const dir = opts.outputDir ? path.resolve(opts.outputDir) : path.dirname(input);
  return path.join(dir, path.basename(fileName));
}

/**
 * Parses an ffmpeg-style `timemark` string into seconds.
 *
 * Accepts `HH:MM:SS`, `HH:MM:SS.mmm`, `MM:SS`, and plain seconds. Returns
 * `NaN` when the value cannot be parsed.
 *
 * @param {string} timemark - Timemark string from transcoder progress output.
 * @returns {number} Elapsed seconds, or NaN when unparsable.
 * @example
 * timemarkToSeconds('00:01:30.5') // 90.5
 */
export function timemarkToSeconds(timemark: string): number {
  if (!timemark.trim()) return NaN;
  const parts = timemark.split(':').map(Number);
  if (parts.some(isNaN)) return NaN;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] ?? NaN;
}

/**
 * Converts a timemark and a source duration into a clamped 0-100 percentage.
 *
 * @param {string} timemark - Timemark string from transcoder progress output.
 * @param {number} duration - Source duration in seconds.
 * @returns {number} Percentage, clamped to the inclusive 0-100 range; 0 when
 *   either value is invalid or the duration is not positive.
 * @example
 * percentFromTimemark('00:00:30', 120) // 25
 */
export function percentFromTimemark(timemark: string, duration: number): number {
  const seconds = timemarkToSeconds(timemark);
  if (!Number.isFinite(seconds) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(100, Math.max(0, (seconds / duration) * 100));
}

/**
 * Formats a byte count into a human readable string using binary units.
 * @param {number} bytes - Byte count.
 * @returns {string} Formatted size, e.g. `1.5 MB`.
 * @example
 * formatBytes(1572864) // '1.5 MB'
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = units[0];
  for (let i = 1; i < units.length && value >= 1024; i++) {
    value /= 1024;
    unit = units[i];
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${unit}`;
}

/**
 * Formats a number of seconds into a compact human readable duration.
 * @param {number} seconds - Duration in seconds.
 * @returns {string} Formatted duration, e.g. `1m 30s`.
 * @example
 * formatDuration(90) // '1m 30s'
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0s';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Parses a CLI time argument into seconds.
 *
 * Accepts plain seconds (e.g. `90`) or `HH:MM:SS`/`MM:SS` strings. Returns
 * `NaN` when the value is not a valid time format.
 *
 * @param {string} value - Time argument value.
 * @returns {number} Seconds, or NaN when invalid.
 * @example
 * parseTimeValue('00:01:30') // 90
 */
export function parseTimeValue(value: string): number {
  if (!value.trim()) return NaN;
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return parseFloat(trimmed);
  const parts = trimmed.split(':').map(Number);
  if (parts.some(isNaN) || parts.length < 2 || parts.length > 3) return NaN;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + parts[1];
}
