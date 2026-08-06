/**
 * @fileoverview Input validation utilities for conversion options and file information.
 * Validates time formats, scale values, resolution, and codec configurations.
 */

/**
 * Validates if a string is a valid time value (seconds or HH:MM:SS format).
 * @param {string} value - The time string to validate
 * @returns {boolean} True if the value is a valid time format
 * @example
 * isValidTime("10.5") // true
 * isValidTime("00:01:30") // true
 * isValidTime("invalid") // false
 */
export function isValidTime(value: string): boolean {
  if (!value.trim()) return false;
  if (/^\d+(\.\d+)?$/.test(value)) return parseFloat(value) >= 0;
  return /^\d{1,2}:\d{2}:\d{2}(\.\d+)?$/.test(value);
}

/**
 * Validates if a string is a valid scale value (percentage or dimension).
 * @param {string} value - The scale value to validate (e.g. "75%" or "1280x720")
 * @returns {boolean} True if the value is a valid scale format
 * @example
 * isValidScale("75%") // true
 * isValidScale("1280x720") // true
 * isValidScale("720") // true (single dimension, treated as a target width/height)
 * isValidScale("invalid") // false
 */
export function isValidScale(value: string): boolean {
  if (!value.trim()) return false;
  if (/^\d{1,3}%$/.test(value)) {
    const pct = parseInt(value);
    return pct >= 1 && pct <= 999;
  }
  if (/^-?\d+(\.\d+)?[:x]-?\d+(\.\d+)?$/.test(value)) return true;
  if (/^-?\d+(\.\d+)?$/.test(value)) return parseInt(value) > 0;
  return false;
}

/**
 * Validates if a string is a valid audio/video bitrate value.
 * Accepts a positive integer optionally followed by a 'K'/'k' (kbps) or 'M'/'m'
 * (Mbps) unit suffix.
 * @param {string} value - The bitrate string to validate (e.g. "192k" or "2000").
 * @returns {boolean} True if the value matches the bitrate format.
 * @example
 * isValidBitrate("192k") // true
 * isValidBitrate("4M") // true
 * isValidBitrate("abc") // false
 */
export function isValidBitrate(value: string): boolean {
  if (!value.trim()) return false;
  return /^\d+[KkMm]?$/.test(value);
}

/**
 * Checks that a number is finite and falls within an inclusive range.
 * @param {number} value - The value to test.
 * @param {number} min - Inclusive lower bound.
 * @param {number} max - Inclusive upper bound.
 * @returns {boolean} True if `value` is finite and min <= value <= max.
 * @example
 * isInRange(5, 1, 10) // true
 * isInRange(NaN, 1, 10) // false
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}
