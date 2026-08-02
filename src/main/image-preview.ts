import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { Logger } from '../shared/logger';
import { isImageFile } from '../shared/file-extensions';

const log = new Logger('main/image-preview');

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

export function mimeTypeForFile(filePath: string): string | null {
  const idx = filePath.lastIndexOf('.');
  if (idx < 0) return null;
  const ext = filePath.slice(idx + 1).toLowerCase();
  return MIME_BY_EXTENSION[ext] ?? null;
}

export async function getImagePreview(filePath: string): Promise<string | null> {
  if (!isImageFile(filePath) || !existsSync(filePath)) {
    log.debug('Not a readable image file:', filePath);
    return null;
  }
  const mimeType = mimeTypeForFile(filePath);
  if (!mimeType) {
    log.debug('Unsupported image mime type:', filePath);
    return null;
  }
  try {
    const data = await readFile(filePath);
    return `data:${mimeType};base64,${data.toString('base64')}`;
  } catch (err) {
    log.warn('Failed to read image preview:', err);
    return null;
  }
}
