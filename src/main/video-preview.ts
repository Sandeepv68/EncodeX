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
 * When the primary seek produces no frame — which happens for videos shorter
 * than the 10 s seek point, since ffmpeg exits 0 with empty output after
 * seeking past the end — the extraction is retried from the start of the video
 * (`VIDEO_PREVIEW_FALLBACK_SEEK_TIME`) so short clips still get a thumbnail.
 *
 * Invalid, missing, or undecodable files resolve to `null` (after logging)
 * rather than rejecting, so the UI can fall back to a placeholder.
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { Logger } from '../shared/logger';
import { getFfmpegPath } from './media-binaries';
import { isVideoFile } from '../shared/file-extensions';
import { VIDEO_PREVIEW_FALLBACK_SEEK_TIME, VIDEO_PREVIEW_MAX_WIDTH, VIDEO_PREVIEW_SEEK_TIME } from '../shared/constants';
import {
  LOG_NOT_A_READABLE_VIDEO_FILE,
  LOG_VIDEO_PREVIEW_EXTRACTION_FAILED_STDERR,
  LOG_VIDEO_PREVIEW_FFMPEG_ERROR,
} from '../shared/log-constants';

/**
 * Outcome of a single ffmpeg preview-extraction run.
 * @interface PreviewAttempt
 * @property {string | null} dataUrl - Base64 PNG data URL, or `null` when the
 *   run exited non-zero or produced no frame bytes.
 * @property {number | null} code - Exit code of the ffmpeg process (`null` when
 *   `close` fired without a code, e.g. the process was killed).
 * @property {string} stderr - Captured stderr text (may be empty when the
 *   failure produced no diagnostics, e.g. `-v error` suppresses the empty
 *   output warning for short videos).
 */
interface PreviewAttempt {
  dataUrl: string | null;
  code: number | null;
  stderr: string;
}

/**
 * Logger instance scoped to the video preview module. Logs ffmpeg path
 * fallbacks, unrecognized or missing files, and preview extraction failures.
 * @const {Logger} log
 */
const log = new Logger('main/video-preview');

/**
 * Runs a single ffmpeg frame-extraction attempt for a video file.
 *
 * Spawns ffmpeg with `-ss <seekTime> -frames:v 1 -vf scale=<maxWidth>:-2 -f
 * image2pipe -vcodec png`, seeking before the input so decoding starts near
 * the target time. The resolved {@link PreviewAttempt} reports the exit code,
 * any stderr, and the PNG data URL when a frame was actually produced.
 *
 * @param {string} filePath - Path to the video file to preview.
 * @param {string} seekTime - FFmpeg timestamp to seek to before decoding.
 * @returns {Promise<PreviewAttempt>} The outcome of the attempt.
 * @throws {Error} When the ffmpeg process fails to spawn.
 */
function extractPreviewFrame(filePath: string, seekTime: string): Promise<PreviewAttempt> {
  const ffmpegPath = getFfmpegPath();
  const args = [
    '-v',
    'error',
    '-ss',
    seekTime,
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
      const dataUrl = code === 0 && chunks.length > 0 ? `data:image/png;base64,${Buffer.concat(chunks).toString('base64')}` : null;
      resolve({ dataUrl, code: code ?? null, stderr });
    });
  });
}

/**
 * Extracts a single PNG preview frame from a video file and returns it as a
 * base64 data URL.
 *
 * Returns a resolved `null` (with a debug log) when the path is not a
 * recognized video file or does not exist. Otherwise the frame is sought at
 * {@link VIDEO_PREVIEW_SEEK_TIME}; when that attempt produces no frame —
 * typical for videos shorter than the seek point — the extraction is retried
 * once from the start of the video.
 *
 * If ffmpeg cannot spawn, the promise rejects with the spawn error. If both
 * attempts fail, the failure (file path, exit codes, stderr) is logged and the
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
  return extractPreviewFrame(filePath, VIDEO_PREVIEW_SEEK_TIME).then((attempt) => {
    if (attempt.dataUrl) return attempt.dataUrl;
    return extractPreviewFrame(filePath, VIDEO_PREVIEW_FALLBACK_SEEK_TIME).then((retry) => {
      if (retry.dataUrl) return retry.dataUrl;
      log.warn(
        LOG_VIDEO_PREVIEW_EXTRACTION_FAILED_STDERR,
        `file=${filePath} firstExit=${attempt.code} retryExit=${retry.code}`,
        `firstStderr=${attempt.stderr || '(empty)'}`,
        `retryStderr=${retry.stderr || '(empty)'}`,
      );
      return null;
    });
  });
}
