import * as fs from 'fs';
import { Logger } from '../../shared/logger';
import { LOG_HISTORY_THUMBNAIL_FAILED } from '../../shared/log-constants';
import { isImageFile, isVideoFile } from '../../shared/file-extensions';
import { HISTORY_LIMITS } from '../../shared/history/limits';
import { getVideoPreview } from '../video-preview';
import type { HistoryMimeType, HistoryThumbnailData } from '../../shared/history/types';

const log = new Logger('main/history/thumbnails');

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function mimeTypeForImage(filePath: string): HistoryMimeType | null {
  const extension = filePath.split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  return null;
}

function decodeDataUrl(dataUrl: string): HistoryThumbnailData | null {
  const match = /^data:(image\/png|image\/jpeg);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  const mimeType = match[1].toLowerCase() === 'image/jpeg' ? 'image/jpeg' : 'image/png';
  const data = Buffer.from(match[2], 'base64');
  if (data.byteLength === 0 || data.byteLength > HISTORY_LIMITS.maxThumbnailBytes) return null;
  return { data, mimeType };
}

export async function generateHistoryThumbnail(sourcePath: string): Promise<HistoryThumbnailData | null> {
  try {
    if (isImageFile(sourcePath)) {
      const mimeType = mimeTypeForImage(sourcePath);
      if (!mimeType) return null;
      const stat = fs.statSync(sourcePath);
      if (!stat.isFile() || stat.size === 0 || stat.size > HISTORY_LIMITS.maxThumbnailBytes) return null;
      return { data: fs.readFileSync(sourcePath), mimeType };
    }
    if (isVideoFile(sourcePath)) {
      const preview = await getVideoPreview(sourcePath);
      return preview ? decodeDataUrl(preview) : null;
    }
    return null;
  } catch (err) {
    log.warn(LOG_HISTORY_THUMBNAIL_FAILED, sourcePath, describeError(err));
    return null;
  }
}
