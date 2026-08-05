import { spawn } from 'child_process';
import { existsSync } from 'fs';
import ffmpegStatic from 'ffmpeg-static';
import { Logger } from '../shared/logger';
import { isVideoFile } from '../shared/file-extensions';
import { VIDEO_PREVIEW_MAX_WIDTH, VIDEO_PREVIEW_SEEK_TIME } from '../shared/constants';
import { TRANSCODER_COMMANDS } from '../shared/transcoder-constants';
import {
  LOG_FFMPEG_STATIC_NOT_FOUND_FALLING_BACK_TO_SYSTEM_FFMPEG,
  LOG_NOT_A_READABLE_VIDEO_FILE,
  LOG_VIDEO_PREVIEW_EXTRACTION_FAILED_STDERR,
  LOG_VIDEO_PREVIEW_FFMPEG_ERROR,
} from '../shared/log-constants';

const log = new Logger('main/video-preview');

function getFfmpegPath(): string {
  const staticPath = ffmpegStatic as unknown as string;
  if (existsSync(staticPath)) return staticPath;
  log.warn(LOG_FFMPEG_STATIC_NOT_FOUND_FALLING_BACK_TO_SYSTEM_FFMPEG);
  return TRANSCODER_COMMANDS.FFMPEG;
}

export function getVideoPreview(filePath: string): Promise<string | null> {
  if (!isVideoFile(filePath) || !existsSync(filePath)) {
    log.debug(LOG_NOT_A_READABLE_VIDEO_FILE, filePath);
    return Promise.resolve(null);
  }
  const ffmpegPath = getFfmpegPath();
  const args = [
    '-v',
    'error',
    '-ss',
    VIDEO_PREVIEW_SEEK_TIME,
    '-i',
    filePath,
    '-frames:v',
    '1',
    '-vf',
    `scale=${VIDEO_PREVIEW_MAX_WIDTH}:-2`,
    '-f',
    'image2pipe',
    '-vcodec',
    'png',
    'pipe:1',
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (err: Error) => {
      log.error(LOG_VIDEO_PREVIEW_FFMPEG_ERROR, err);
      reject(err);
    });
    child.on('close', (code) => {
      if (code !== 0 || chunks.length === 0) {
        log.warn(LOG_VIDEO_PREVIEW_EXTRACTION_FAILED_STDERR, stderr);
        resolve(null);
        return;
      }
      const data = Buffer.concat(chunks);
      resolve(`data:image/png;base64,${data.toString('base64')}`);
    });
  });
}
