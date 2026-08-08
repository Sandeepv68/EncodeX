/**
 * @fileoverview Video frame preview extraction for the Electron main process.
 *
 * Uses FFmpeg to seek to `VIDEO_PREVIEW_SEEK_TIME` (10 s) into a video file,
 * decode a single frame scaled to `VIDEO_PREVIEW_MAX_WIDTH` (480 px) wide, and
 * re-encode it as a PNG. The PNG bytes are returned as a base64
 * `data:image/png` URL so the sandboxed renderer can render the thumbnail
 * without file access.
 *
 * Exports:
 *  - getVideoPreview() - extracts and encodes one preview frame as a data URL
 *
 * Invalid, missing, or undecodable files resolve to `null` (after logging)
 * rather than rejecting, so the UI can fall back to a placeholder.
 */

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

/**
 * Logger instance scoped to the video preview module. Logs ffmpeg path
 * fallbacks, unrecognized or missing files, and preview extraction failures.
 * @const {Logger} log
 */
const log = new Logger('main/video-preview');

/**
 * Resolves the FFmpeg binary path, preferring the bundled `ffmpeg-static`
 * binary and falling back to the system `ffmpeg` command.
 *
 * @returns {string} Absolute path to the static ffmpeg executable, or the
 *   plain `ffmpeg` command name when the static binary does not exist.
 */
function getFfmpegPath(): string {
  const staticPath = ffmpegStatic as unknown as string;
  if (existsSync(staticPath)) return staticPath;
  log.warn(LOG_FFMPEG_STATIC_NOT_FOUND_FALLING_BACK_TO_SYSTEM_FFMPEG);
  return TRANSCODER_COMMANDS.FFMPEG;
}

/**
 * Extracts a single PNG preview frame from a video file and returns it as a
 * base64 data URL.
 *
 * Returns a resolved `null` (with a debug log) when the path is not a
 * recognized video file or does not exist. Otherwise ffmpeg is spawned with
 * `-ss <SEEK_TIME> -frames:v 1 -vf scale=<maxWidth>:-2 -f image2pipe -vcodec
 * png`, seeking before the input so decoding starts near the target time.
 *
 * If ffmpeg cannot spawn, the promise rejects with the spawn error. If ffmpeg
 * exits non-zero or produces no PNG bytes, the failure is logged and the
 * promise resolves to `null`.
 *
 * @param {string} filePath - Path to the video file to preview.
 * @returns {Promise<string | null>} A `data:image/png;base64,...` URL, or
 *   `null` when the file is invalid, missing, or the frame could not be
 *   decoded.
 * @throws {Error} When the ffmpeg process fails to spawn.
 */
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
