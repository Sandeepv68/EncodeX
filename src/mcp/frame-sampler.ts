/**
 * @fileoverview FFmpeg-backed frame sampler for perceptual hashing (roadmap 2.0,
 * F10). Runs FFmpeg to decode a single 8×8 grayscale frame from a media file and
 * returns its average hash. Kept in `src/mcp` (not `shared/`) because it spawns a
 * process; the hashing math and comparison live in `shared/ai/similarity.ts`.
 */

import { spawn } from 'child_process';
import { getFfmpegPath } from '../main/media-binaries';
import { averageHash } from '../shared/ai/similarity';
import type { FrameSampler } from '../shared/ai/similarity';

/**
 * Maximum time to wait for a single frame extraction before giving up.
 * @const {number}
 */
const FRAME_TIMEOUT_MS = 15000;

/**
 * Decodes one 8×8 grayscale frame at `atSeconds` and returns its average hash.
 *
 * Never rejects: any spawn error, timeout, or empty output resolves to
 * `undefined`, so a file that cannot be sampled simply falls back to metadata
 * comparison instead of failing the whole tool call.
 * @param {string} file - Absolute path of the media file.
 * @param {number} [atSeconds=0] - Seek offset in seconds.
 * @returns {Promise<string | undefined>} The hex hash, or `undefined`.
 */
export function sampleFrameHash(file: string, atSeconds = 0): Promise<string | undefined> {
  return new Promise((resolve) => {
    let ffmpeg: string;
    try {
      ffmpeg = getFfmpegPath();
    } catch {
      resolve(undefined);
      return;
    }
    const args = [
      '-v',
      'error',
      ...(atSeconds > 0 ? ['-ss', String(atSeconds)] : []),
      '-i',
      file,
      '-frames:v',
      '1',
      '-vf',
      'scale=8:8:flags=area,format=gray',
      '-f',
      'rawvideo',
      '-',
    ];
    let settled = false;
    const finish = (value: string | undefined): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(ffmpeg, args, { windowsHide: true });
    } catch {
      finish(undefined);
      return;
    }
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      finish(undefined);
    }, FRAME_TIMEOUT_MS);
    child.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.on('error', () => {
      clearTimeout(timer);
      finish(undefined);
    });
    child.on('close', () => {
      clearTimeout(timer);
      const buffer = Buffer.concat(chunks);
      finish(buffer.length >= 64 ? averageHash(buffer.subarray(0, 64), 8, 8) : undefined);
    });
  });
}

/**
 * The default {@link FrameSampler} used by the MCP server.
 * @param {string} file - Absolute path of the media file.
 * @param {number} atSeconds - Seek offset in seconds.
 * @returns {Promise<string | undefined>} The hex hash, or `undefined`.
 */
export const defaultFrameSampler: FrameSampler = (file, atSeconds) => sampleFrameHash(file, atSeconds);
