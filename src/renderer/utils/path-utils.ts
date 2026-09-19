/**
 * @fileoverview Shared, DOM-free path helpers for the renderer.
 *
 * Consolidates the basename/dirname/stem implementations that were copy-pasted
 * across pages and components (refactor.md §1). All functions are pure and
 * handle both POSIX (`/`) and Windows (`\`) separators.
 *
 * `basename` preserves the "fall back to the original path" behavior used by
 * most call sites; `basenameOrEmpty` reproduces the null-guarding call sites
 * that fall back to `''`. Keep the two distinct — do not collapse them.
 */

import { getExtension, replaceExtension } from '../../shared/codec-containers';

export { getExtension, replaceExtension };

/**
 * Extracts the basename of a file path, handling both Windows backslashes and
 * POSIX forward slashes. Falls back to the original path when it has no
 * separators or ends with an empty segment.
 * @param {string} path - The file path to process.
 * @returns {string} The trailing path segment, or the original path.
 */
export function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/**
 * Extracts the basename of a file path, returning `''` for undefined, empty,
 * or separator-terminated paths.
 * @param {string | undefined} path - The file path to process.
 * @returns {string} The trailing path segment, or ''.
 */
export function basenameOrEmpty(path?: string | null): string {
  if (!path) return '';
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || '';
}

/**
 * Extracts the trailing path segment via split/pop. Mirrors the `fileName`
 * helpers previously defined inline in Convert/ImageCompress/AudioExtract.
 * @param {string} path - The file path to process.
 * @returns {string} The trailing path segment (original path when empty).
 */
export function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/**
 * Extracts the directory portion of a file path, handling both Windows
 * backslashes and POSIX forward slashes. The trailing separator is removed.
 * @param {string} file - The file path to process.
 * @returns {string} The directory path, or '' when the path has no separators.
 */
export function dirname(file: string): string {
  const idx = Math.max(file.lastIndexOf('/'), file.lastIndexOf('\\'));
  return idx >= 0 ? file.slice(0, idx) : '';
}

/**
 * Extracts the basename stem (filename without its final extension). A leading
 * dot is not treated as an extension separator, so dotfiles (`.env`) keep their
 * whole name as the stem.
 * @param {string} file - The file path to process.
 * @returns {string} The basename without its extension.
 */
export function stem(file: string): string {
  const base = basename(file);
  const dotIdx = base.lastIndexOf('.');
  return dotIdx > 0 ? base.slice(0, dotIdx) : base;
}

/**
 * Normalizes a file path for duplicate comparison: lowercases and unifies
 * Windows backslashes with POSIX forward slashes.
 * @param {string} path - The file path to normalize.
 * @returns {string} The normalized path.
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase();
}
