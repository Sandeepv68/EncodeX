/**
 * @fileoverview Image preview (data URL) generation for the Electron main
 * process.
 *
 * Reads an image file from disk and encodes it as a base64 `data:` URL so the
 * sandboxed renderer process can display it without node access. The MIME type
 * is derived from the file extension via a lookup table rather than from file
 * contents, keeping the read cheap.
 *
 * Exports:
 *  - mimeTypeForFile() - maps a file extension to an image MIME type
 *  - getImagePreview() - returns a base64 data URL for an image file
 *
 * Missing or unreadable files resolve to `null` (after logging) rather than
 * throwing, so the UI can fall back to a placeholder.
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { Logger } from '../shared/logger';
import { isImageFile } from '../shared/file-extensions';
import { LOG_FAILED_TO_READ_IMAGE_PREVIEW, LOG_NOT_A_READABLE_IMAGE_FILE, LOG_UNSUPPORTED_IMAGE_MIME_TYPE } from '../shared/log-constants';

/**
 * Logger instance scoped to the image preview module. Logs unreadable or
 * unsupported files and failures while reading data-URL previews.
 * @const {Logger} log
 */
const log = new Logger('main/image-preview');

/**
 * Maps lowercase file extensions to the corresponding image MIME type used when
 * building data URLs. Unlisted extensions resolve to `null`.
 * @const {Record<string, string>} MIME_BY_EXTENSION
 */
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  bmp: 'image/bmp',
  gif: 'image/gif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  heic: 'image/heic',
  heif: 'image/heif',
  avif: 'image/avif',
  ppm: 'image/x-portable-pixmap',
  pgm: 'image/x-portable-graymap',
  pbm: 'image/x-portable-bitmap',
  xbm: 'image/x-xbitmap',
};

/**
 * Resolves the MIME type of an image file from its extension.
 *
 * The extension is taken from the final `.` in the path and lowercased before
 * lookup. Returns `null` for paths without an extension or with an extension
 * not present in {@link MIME_BY_EXTENSION}.
 *
 * @param {string} filePath - Path to the file.
 * @returns {string | null} The MIME type string (e.g. `'image/jpeg'`), or
 *   `null` when the extension is missing or unsupported.
 */
export function mimeTypeForFile(filePath: string): string | null {
  const idx = filePath.lastIndexOf('.');
  if (idx < 0) return null;
  const ext = filePath.slice(idx + 1).toLowerCase();
  return MIME_BY_EXTENSION[ext] ?? null;
}

/**
 * Reads an image file and returns it as a base64 data URL for the renderer.
 *
 * Returns `null` (with a debug log) when the path is not a recognized image
 * file or does not exist, and when the extension maps to no MIME type. On a
 * read failure the error is logged and `null` is returned. Otherwise the whole
 * file is read and encoded as `data:<mime>;base64,...`.
 *
 * @param {string} filePath - Path to the image file to preview.
 * @returns {Promise<string | null>} The base64 data URL, or `null` if the file
 *   is invalid, unsupported, or unreadable.
 */
export async function getImagePreview(filePath: string): Promise<string | null> {
  if (!isImageFile(filePath) || !existsSync(filePath)) {
    log.debug(LOG_NOT_A_READABLE_IMAGE_FILE, filePath);
    return null;
  }
  const mimeType = mimeTypeForFile(filePath);
  if (!mimeType) {
    log.debug(LOG_UNSUPPORTED_IMAGE_MIME_TYPE, filePath);
    return null;
  }
  try {
    const data = await readFile(filePath);
    return `data:${mimeType};base64,${data.toString('base64')}`;
  } catch (err) {
    log.warn(LOG_FAILED_TO_READ_IMAGE_PREVIEW, err);
    return null;
  }
}
