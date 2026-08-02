import { spawn } from 'child_process';
import { existsSync } from 'fs';
import ffmpegStatic from 'ffmpeg-static';
import { Logger } from '../shared/logger';
import { isVideoFile } from '../shared/file-extensions';

const log = new Logger('main/video-preview');

const PREVIEW_MAX_WIDTH = 480;

function getFfmpegPath(): string {
  const staticPath = ffmpegStatic as unknown as string;
  if (existsSync(staticPath)) return staticPath;
  log.warn('ffmpeg-static not found, falling back to system ffmpeg');
  return 'ffmpeg';
}

export function getVideoPreview(filePath: string): Promise<string | null> {
  if (!isVideoFile(filePath) || !existsSync(filePath)) {
    log.debug('Not a readable video file:', filePath);
    return Promise.resolve(null);
  }
  const ffmpegPath = getFfmpegPath();
  const args = [
    '-v',
    'error',
    '-ss',
    '00:00:01',
    '-i',
    filePath,
    '-frames:v',
    '1',
    '-vf',
    `scale=${PREVIEW_MAX_WIDTH}:-2`,
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
      log.error('Video preview ffmpeg error:', err);
      reject(err);
    });
    child.on('close', (code) => {
      if (code !== 0 || chunks.length === 0) {
        log.warn('Video preview extraction failed, stderr:', stderr);
        resolve(null);
        return;
      }
      const data = Buffer.concat(chunks);
      resolve(`data:image/png;base64,${data.toString('base64')}`);
    });
  });
}
