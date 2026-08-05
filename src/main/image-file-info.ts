import { open, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { Logger } from '../shared/logger';
import { isImageFile } from '../shared/file-extensions';
import { ImageFileInfo } from '../shared/types';
import { IMAGE_HEADER_READ_SIZE } from '../shared/constants';
import { LOG_FAILED_TO_READ_IMAGE_DIMENSIONS, LOG_FAILED_TO_STAT_IMAGE_FILE, LOG_NOT_A_READABLE_IMAGE_FILE } from '../shared/log-constants';

const log = new Logger('main/image-file-info');

function readUInt16LE(buf: Buffer, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8);
}

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
