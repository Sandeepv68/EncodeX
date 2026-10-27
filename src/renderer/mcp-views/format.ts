/**
 * @fileoverview Formatting helpers shared by the MCP App views.
 *
 * The hand-written HTML views each carried their own copy of these helpers
 * (`basename` appeared in seven files, `formatSize` in four). They live here so
 * every React view formats values identically.
 */

/**
 * Returns the last path segment of a file path, handling both POSIX and
 * Windows separators.
 * @param {string | undefined | null} value - The path to shorten.
 * @returns {string} The file name, or an empty string when there is no path.
 */
export function basename(value: string | undefined | null): string {
  if (!value) return '';
  const parts = value.split(/[\\/]/);
  return parts[parts.length - 1] || value;
}

/** Binary size units, ordered from bytes up. @const {readonly string[]} */
const SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/**
 * Formats a byte count as a human-readable size.
 * @param {number | undefined | null} bytes - The size in bytes.
 * @returns {string} The formatted size, or a dash when the size is unknown.
 */
export function formatSize(bytes: number | undefined | null): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '-';
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < SIZE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} ${SIZE_UNITS[unit]}`;
}

/**
 * Formats a duration in seconds as `H:MM:SS` (or `M:SS` under an hour).
 * @param {number | undefined | null} seconds - The duration in seconds.
 * @returns {string} The formatted duration, or a dash when it is unknown.
 */
export function formatDuration(seconds: number | undefined | null): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '-';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

/**
 * Clamps a completion percentage into the 0-100 range.
 * @param {number | undefined | null} percent - The raw percentage.
 * @returns {number} The clamped percentage.
 */
export function clampPercent(percent: number | undefined | null): number {
  if (typeof percent !== 'number' || !Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, percent));
}

/**
 * Turns a camelCase key into a human-readable label (`videoBitrateKbps` becomes
 * `Video bitrate kbps`).
 * @param {string} key - The key to humanize.
 * @returns {string} The humanized label.
 */
export function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
