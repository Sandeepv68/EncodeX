/**
 * @fileoverview Image file dimension and size probing for the Electron main
 * process.
 *
 * Reads only the first `IMAGE_HEADER_READ_SIZE` bytes of an image file and
 * inspects its binary header to determine the pixel dimensions of common
 * formats (PNG, GIF, BMP, WebP, and JPEG). It works without a full image
 * decoder and without spawning FFmpeg, making it cheap enough to call for every
 * file in a directory listing.
 *
 * Exports:
 *  - readImageDimensions() - parses width/height from a raw image header buffer
 *  - getImageFileInfo()    - stat + header read for a single image file
 *
 * Failures (missing/unreadable files, bad headers) are logged and reported as
 * `null` or null-dimension results instead of throwing, so the caller can show
 * the file with unknown dimensions.
 */

import { open, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { Logger } from '../shared/logger';
import { isImageFile } from '../shared/file-extensions';
import { ImageFileInfo } from '../shared/types';
import { IMAGE_HEADER_READ_SIZE } from '../shared/constants';
import { LOG_FAILED_TO_READ_IMAGE_DIMENSIONS, LOG_FAILED_TO_STAT_IMAGE_FILE, LOG_NOT_A_READABLE_IMAGE_FILE } from '../shared/log-constants';

/**
 * Logger instance scoped to the image file info module. Logs stat/read
 * failures and unrecognized or missing image paths encountered while probing.
 * @const {Logger} log
 */
const log = new Logger('main/image-file-info');

/**
 * Reads an unsigned 16-bit little-endian integer from a buffer.
 * Used for the GIF and BMP width/height fields, which are stored
 * little-endian.
 * @param {Buffer} buf - The buffer to read from.
 * @param {number} offset - Byte offset of the least-significant byte.
 * @returns {number} The decoded 16-bit unsigned integer.
 */
function readUInt16LE(buf: Buffer, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8);
}

/**
 * Extracts pixel dimensions from the raw bytes of a JPEG/Exif file.
 *
 * Walks the JPEG segment markers starting after the SOI marker (0xFFD8). For
 * each marker in the SOF range (0xC0-0xCF, excluding DHT 0xC4, JPG 0xC8, and
 * DAC 0xCC), reads the 16-bit big-endian height and width that follow the
 * segment length field.
 *
 * @param {Buffer} buffer - The image header bytes. SOF markers usually appear
 *   within the first kilobyte of a JPEG.
 * @returns {{ width: number; height: number } | null} The detected dimensions,
 *   or `null` if no SOF marker is found within the scanned region.
 */
function jpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset < buffer.length - 1) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + buffer.readUInt16BE(offset + 2);
  }
  return null;
}

/**
 * Detects image pixel dimensions from a raw header buffer by inspecting magic
 * bytes for PNG, GIF, BMP, WebP (VP8X/VP8L/VP8), and JPEG formats.
 *
 * The buffer must contain at least 24 bytes for the fixed-layout formats; JPEG
 * dimensions are found by scanning for an SOF marker (see {@link jpegDimensions}).
 * For BMP, the height is stored as a signed value (negative means top-down) and
 * is returned as its absolute value. WebP VP8X dimensions are stored as
 * little-endian 24-bit values that are incremented by one to recover the
 * logical size.
 *
 * @param {Buffer} buffer - Raw file header bytes, typically the first
 *   `IMAGE_HEADER_READ_SIZE` bytes of the file.
 * @returns {{ width: number; height: number } | null} The pixel dimensions, or
 *   `null` if the buffer is too short or the format is not recognized.
 */
export function readImageDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (!buffer || buffer.length < 24) return null;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return { width: readUInt16LE(buffer, 6), height: readUInt16LE(buffer, 8) };
  }
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return { width: buffer.readInt32LE(18), height: Math.abs(buffer.readInt32LE(22)) };
  }
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    const fourCC = buffer.toString('ascii', 12, 16);
    if (fourCC === 'VP8X') {
      return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 };
    }
    if (fourCC === 'VP8L') {
      const width = 1 + (((buffer[22] & 0x3f) << 8) | buffer[21]);
      const height = 1 + (((buffer[24] & 0x0f) << 10) | (buffer[23] << 2) | ((buffer[22] & 0xc0) >> 6));
      return { width, height };
    }
    if (fourCC === 'VP8 ') {
      return { width: buffer.readUInt16LE(26), height: buffer.readUInt16LE(28) };
    }
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return jpegDimensions(buffer);
  }
  return null;
}

/**
 * Collects basic info (pixel dimensions and byte size) for a single image file.
 *
 * Returns `null` when the file path is not a recognized image extension or the
 * file does not exist. Size comes from `fs.stat`; dimensions are read from the
 * first `IMAGE_HEADER_READ_SIZE` bytes via {@link readImageDimensions}. Stat or
 * read failures are logged and degrade to `null`/null-dimensions rather than
 * throwing.
 *
 * @param {string} filePath - Absolute or relative path to the image file.
 * @returns {Promise<ImageFileInfo | null>} An object with `width`, `height`
 *   (each `null` when the header could not be parsed) and `size` in bytes, or
 *   `null` when the path is not an image or does not exist.
 */
export async function getImageFileInfo(filePath: string): Promise<ImageFileInfo | null> {
  if (!isImageFile(filePath) || !existsSync(filePath)) {
    log.debug(LOG_NOT_A_READABLE_IMAGE_FILE, filePath);
    return null;
  }
  let fileSize: number;
  try {
    fileSize = (await stat(filePath)).size;
  } catch (err) {
    log.warn(LOG_FAILED_TO_STAT_IMAGE_FILE, err);
    return null;
  }
  let dims: { width: number; height: number } | null = null;
  try {
    const handle = await open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(IMAGE_HEADER_READ_SIZE);
      const { bytesRead } = await handle.read(buffer, 0, IMAGE_HEADER_READ_SIZE, 0);
      dims = readImageDimensions(buffer.subarray(0, bytesRead));
    } finally {
      await handle.close();
    }
  } catch (err) {
    log.warn(LOG_FAILED_TO_READ_IMAGE_DIMENSIONS, err);
  }
  return { width: dims?.width ?? null, height: dims?.height ?? null, size: fileSize };
}
