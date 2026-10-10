/**
 * @fileoverview Small, dependency-free numeric helpers for the AI layer.
 *
 * Bitrate/duration/size arithmetic is *code, not a model call* (roadmap §7.3):
 * the model chooses intent and trade-offs, but every number here is computed
 * deterministically and unit-tested. Kept separate from the analysis modules so
 * both the estimator and the recommender share one tested implementation.
 */

/**
 * Parses an FFmpeg-style bitrate string into kilobits per second.
 *
 * Accepts a bare number (treated as kbps, matching {@link isValidBitrate}),
 * an optional `k`/`K` suffix (kbps) or `m`/`M` suffix (Mbps). Values that are
 * not a positive finite number, or that carry an unknown unit, yield
 * `undefined` so callers can fall back rather than compute on garbage.
 * @param {string | number | undefined | null} value - The bitrate to parse.
 * @returns {number | undefined} Bitrate in kbps, or undefined when unusable.
 * @example
 * parseBitrateKbps('2000k') // 2000
 * parseBitrateKbps('8M') // 8000
 * parseBitrateKbps('192') // 192
 * parseBitrateKbps('fast') // undefined
 */
export function parseBitrateKbps(value: string | number | undefined | null): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : undefined;
  const text = value.trim();
  if (text === '') return undefined;
  const match = /^(\d+(?:\.\d+)?)([kKmM]?)$/.exec(text);
  if (!match) return undefined;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  const unit = match[2].toLowerCase();
  if (unit === 'm') return amount * 1000;
  return amount;
}

/**
 * Converts a time value (seconds or `HH:MM:SS[.ms]`) into seconds.
 *
 * Mirrors the accepted input of the conversion `startTime`/`duration` fields.
 * Malformed or negative values yield `undefined` so the caller can fall back to
 * the probed duration.
 * @param {string | number | undefined | null} value - The time to convert.
 * @returns {number | undefined} Seconds, or undefined when unusable.
 * @example
 * toSeconds('90') // 90
 * toSeconds('00:01:30') // 90
 * toSeconds('1:02:05') // 3725
 */
export function toSeconds(value: string | number | undefined | null): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : undefined;
  const text = value.trim();
  if (text === '') return undefined;
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const seconds = Number(text);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
  }
  const parts = text.split(':').map((part) => Number(part));
  if (parts.length === 0 || parts.some((part) => !Number.isFinite(part) || part < 0)) return undefined;
  let seconds = 0;
  for (const part of parts) seconds = seconds * 60 + part;
  return seconds;
}

/**
 * Formats a byte count with a binary unit suffix, one decimal below 10.
 * @param {number | undefined | null} bytes - Byte count to format.
 * @returns {string} e.g. '1.5 MB', '0 B'.
 * @example
 * formatBytesHuman(1572864) // '1.5 MB'
 */
export function formatBytesHuman(bytes: number | undefined | null): string {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let scaled = value;
  let index = 0;
  while (scaled >= 1024 && index < units.length - 1) {
    scaled /= 1024;
    index += 1;
  }
  return `${index === 0 ? scaled : scaled.toFixed(scaled < 10 ? 1 : 0)} ${units[index]}`;
}

/**
 * Parses a `WxH` resolution string into numeric dimensions.
 * @param {string | undefined | null} value - Resolution such as `'1920x1080'`.
 * @returns {{ width: number; height: number } | undefined} Dimensions or undefined.
 * @example
 * parseResolution('1920x1080') // { width: 1920, height: 1080 }
 */
export function parseResolution(value: string | undefined | null): { width: number; height: number } | undefined {
  if (!value) return undefined;
  const match = /^(\d+)\s*[xX]\s*(\d+)$/.exec(value.trim());
  if (!match) return undefined;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return undefined;
  return { width, height };
}
