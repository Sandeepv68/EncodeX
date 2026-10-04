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
  const clock = /^(\d{1,2}):(\d{2}):(\d{2})(\.\d+)?$/.exec(value);
  if (!clock) return false;
  // The shape alone is not enough: `00:60:00` matches a naive `\d{2}:\d{2}:\d{2}`
  // pattern but is not a time, and it previously passed validation straight
  // through to an ffmpeg seek argument.
  const minutes = Number(clock[2]);
  const seconds = Number(clock[3]);
  return minutes <= 59 && seconds <= 59;
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

/**
 * Narrows an untrusted value to a usable string, or reports that it is not one.
 *
 * Every IPC argument arrives from a process this codebase does not control, so a value declared
 * `string` in a handler signature is a *claim*, not a guarantee. Passing such a claim straight
 * through to a native API is how a `shell.showItemInFolder(1n)` ends up rejecting the renderer's
 * promise with a raw `TypeError: Argument must be a string` instead of a formatted `AppError`.
 *
 * This is deliberately a narrowing function rather than a predicate: the call sites are
 * best-effort OS actions (reveal a file, open release notes, run an installer) where the correct
 * response to nonsense is to do nothing and say so, not to reject a request the renderer believes
 * is harmless. `String(value)` is never applied, because `"1"` and `"[object Object]"` are not
 * paths anyone asked for.
 *
 * @param {unknown} value - The received IPC argument.
 * @returns {string|null} `value` when it is a string with non-whitespace content, else null.
 * @example
 * coerceNonEmptyString('C:\\out.mp4') // 'C:\\out.mp4'
 * coerceNonEmptyString(10n ** 30n) // null
 * coerceNonEmptyString('   ') // null
 */
export function coerceNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim() === '' ? null : value;
}

/**
 * The longest string this app will hand to an OS launch API.
 *
 * Found by `e2e/specs/ipc-abuse.spec.ts`, which passed a 1 MB string to `revealFile`,
 * `openReleaseNotes` and `installUpdate` and watched all three forward it verbatim to
 * `shell.*`. A type check alone does not stop that: the value *is* a string, it is simply not a
 * path. Windows caps an extended-length path at 32,767 characters, so 4,096 leaves generous
 * headroom for legitimate long paths while rejecting megabyte payloads outright.
 */
export const MAX_OS_STRING_LENGTH = 4096;

/**
 * Narrows an untrusted value to a string that is plausible as an OS path or URL.
 *
 * {@link coerceNonEmptyString} plus an upper bound on length. Use this - not the plain variant -
 * for anything that will be handed to `shell.openPath`, `shell.openExternal` or
 * `shell.showItemInFolder`, where a pathological string is expensive for the OS layer to reject
 * and for the process to hold.
 *
 * @param {unknown} value - The received IPC argument.
 * @returns {string|null} `value` when it is a non-blank string within the length bound, else null.
 * @example
 * coerceOsString('C:\\out.mp4') // 'C:\\out.mp4'
 * coerceOsString('x'.repeat(1_048_576)) // null
 */
export function coerceOsString(value: unknown): string | null {
  const text = coerceNonEmptyString(value);
  if (text === null) return null;
  return text.length > MAX_OS_STRING_LENGTH ? null : text;
}

/**
 * Narrows an untrusted value to an array, reporting anything else as unusable.
 *
 * The companion to {@link coerceNonEmptyString}, for the same reason: a declared `string[]` is not
 * guaranteed to be one. It matters more here, because a bare string *is* iterable - so without
 * this guard an `expandPaths('/some/dir')` walks the filesystem once per character, and one of
 * those characters is `.`, which expands the entire working directory.
 *
 * @param {unknown} value - The received IPC argument.
 * @returns {unknown[]|null} `value` when it is a real array, else null.
 * @example
 * coerceNonEmptyArray(['a.mp4']) // ['a.mp4']
 * coerceNonEmptyArray('a.mp4') // null
 * coerceNonEmptyArray({ length: 1 }) // null
 */
export function coerceNonEmptyArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}
