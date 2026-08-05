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
 * @param {string} value - The scale value to validate (e.g., "75%" or "1280x720")
 * @returns {boolean} True if the value is a valid scale format
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

export function isValidBitrate(value: string): boolean {
  if (!value.trim()) return false;
  return /^\d+[KkMm]?$/.test(value);
}

export function isInRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}
