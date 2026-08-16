/**
 * @fileoverview Deep image metadata analysis (EXIF + RGB/luma histogram) for
 * the Electron main process.
 *
 * Uses `exifr` to parse EXIF, XMP, IPTC, and other metadata blocks into a flat
 * `Record<string, string>`, and uses FFmpeg to decode a downscaled raw RGB
 * frame whose pixel values feed an `{ r, g, b, luma }` histogram. The FFmpeg
 * binary is resolved via {@link getFfmpegPath} (bundled static binary when
 * available, otherwise the system `ffmpeg` command).
 *
 * Exports:
 *  - flattenExif()          - converts nested EXIF objects into flat strings
 *  - computeHistogram()     - builds RGB + luma histograms from raw RGB data
 *  - decodeImageHistogram() - decodes one downscaled RGB frame via ffmpeg
 *  - getImageInfo()         - combines EXIF + histogram for a single image
 *
 * All individual analysis steps are defensive: a failed EXIF parse or a failed
 * ffmpeg decode is logged and reported as missing rather than thrown.
 */

import { spawn } from 'child_process';
import exifr from 'exifr';
import { Logger } from '../shared/logger';
import { getFfmpegPath } from './media-binaries';
import { isImageFile } from '../shared/file-extensions';
import { ImageExifData, ImageHistogram } from '../shared/types';
import { HISTOGRAM_BINS, HISTOGRAM_MAX_WIDTH, RGB_BYTES_PER_PIXEL, LUMA_WEIGHTS } from '../shared/constants';
import {
  LOG_EXIF_PARSE_FAILED,
  LOG_HISTOGRAM_DECODE_FAILED,
  LOG_HISTOGRAM_DECODE_FAILED_STDERR,
  LOG_HISTOGRAM_FFMPEG_ERROR,
} from '../shared/log-constants';

/**
 * Logger instance scoped to the image info module. Logs EXIF parse failures,
 * histogram decode failures, and ffmpeg path fallbacks.
 * @const {Logger} log
 */
const log = new Logger('main/image-info');

/**
 * Recursively flattens nested EXIF objects into a flat `Record<string, string>`.
 *
 * Nested objects are joined with `.` separators (e.g. `GPS.Latitude`), arrays
 * are joined with `", "`, and all scalar values are stringified. `null` and
 * `undefined` values are skipped so they never appear in the result.
 *
 * @param {unknown} input - The parsed EXIF object (or any value) returned by
 *   `exifr.parse`.
 * @param {string} [prefix=''] - Dot-separated key prefix accumulated during
 *   recursion; callers normally pass nothing.
 * @returns {Record<string, string>} A flat map of dotted keys to string values.
 *   An empty object is returned for non-object input.
 */
export function flattenExif(input: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== 'object') return out;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (value == null) continue;
    if (Array.isArray(value)) {
      out[name] = value.join(', ');
    } else if (typeof value === 'object') {
      Object.assign(out, flattenExif(value, name));
    } else {
      out[name] = String(value);
    }
  }
  return out;
}

/**
 * Computes per-channel RGB and combined luma histograms from raw RGB24 data.
 *
 * Iterates every pixel of the buffer (`width * height` pixels, 3 bytes each),
 * increments the corresponding histogram bin for each channel, and adds to the
 * luma histogram using the Rec. 601 luma coefficients from `LUMA_WEIGHTS`.
 * Each histogram array has `HISTOGRAM_BINS` (256) entries, one per byte value.
 *
 * @param {Buffer} buffer - Raw `rgb24` pixel data, at least
 *   `width * height * RGB_BYTES_PER_PIXEL` bytes long.
 * @param {number} width - Width of the decoded image in pixels.
 * @param {number} height - Height of the decoded image in pixels.
 * @returns {ImageHistogram} An object with `r`, `g`, `b`, and `luma` arrays,
 *   each of length `HISTOGRAM_BINS` holding per-value pixel counts.
 */
export function computeHistogram(buffer: Buffer, width: number, height: number): ImageHistogram {
  const r = new Array(HISTOGRAM_BINS).fill(0);
  const g = new Array(HISTOGRAM_BINS).fill(0);
  const b = new Array(HISTOGRAM_BINS).fill(0);
  const luma = new Array(HISTOGRAM_BINS).fill(0);
  const total = width * height;
  for (let i = 0; i < total; i++) {
    const idx = i * RGB_BYTES_PER_PIXEL;
    const rv = buffer[idx];
    const gv = buffer[idx + 1];
    const bv = buffer[idx + 2];
    r[rv] += 1;
    g[gv] += 1;
    b[bv] += 1;
    luma[Math.round(LUMA_WEIGHTS.R * rv + LUMA_WEIGHTS.G * gv + LUMA_WEIGHTS.B * bv)] += 1;
  }
  return { r, g, b, luma };
}

/**
 * Decodes a single downscaled RGB frame of the given image via FFmpeg.
 *
 * Invokes ffmpeg with `-frames:v 1 -vf scale=<maxWidth>:-2 -f rawvideo
 * -pix_fmt rgb24` to produce raw RGB bytes on stdout. The frame is scaled to
 * `HISTOGRAM_MAX_WIDTH` pixels wide while preserving aspect ratio (even height).
 *
 * Resolution semantics: the promise resolves with `null` when the process exits
 * non-zero (the stderr is logged and stdout data is discarded) or when the
 * emitted bytes are too few to form a single row, and rejects with the spawn
 * error when ffmpeg cannot be started (e.g. binary not found). The returned
 * buffer is truncated to an exact multiple of `width * height *
 * RGB_BYTES_PER_PIXEL` so it can be indexed directly by
 * {@link computeHistogram}.
 *
 * @param {string} filePath - Path to the image file to decode.
 * @returns {Promise<{ buffer: Buffer; width: number; height: number } | null>}
 *   The truncated raw RGB24 buffer plus its logical dimensions, or `null` when
 *   decoding failed or produced no usable pixels.
 * @throws {Error} When the ffmpeg process fails to spawn.
 */
export function decodeImageHistogram(filePath: string): Promise<{ buffer: Buffer; width: number; height: number } | null> {
  const ffmpegPath = getFfmpegPath();
  const args = [
    '-v',
    'error',
    '-i',
    filePath,
    '-frames:v',
    '1',
    '-vf',
    `scale=${HISTOGRAM_MAX_WIDTH}:-2`,
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgb24',
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
      log.error(LOG_HISTOGRAM_FFMPEG_ERROR, err);
      reject(err);
    });
    child.on('close', (code) => {
      if (code !== 0) {
        log.warn(LOG_HISTOGRAM_DECODE_FAILED_STDERR, stderr);
        resolve(null);
        return;
      }
      const buffer = Buffer.concat(chunks);
      const width = HISTOGRAM_MAX_WIDTH;
      const height = Math.floor(buffer.length / (width * RGB_BYTES_PER_PIXEL));
      if (height <= 0) {
        resolve(null);
        return;
      }
      resolve({ buffer: buffer.subarray(0, width * height * RGB_BYTES_PER_PIXEL), width, height });
    });
  });
}

/**
 * Gathers EXIF metadata and an RGB/luma histogram for a single image file.
 *
 * Returns `null` for paths that do not have a recognized image extension. EXIF
 * is parsed via `exifr` (unknown keys skipped, values not revived to `Date` or
 * other objects) and flattened with {@link flattenExif}; the histogram is
 * decoded via {@link decodeImageHistogram} and computed with
 * {@link computeHistogram}. Either step may fail independently and is logged,
 * in which case the corresponding result is an empty object / `null`. When
 * neither step produced anything, `null` is returned.
 *
 * @param {string} filePath - Path to the image file to analyze.
 * @returns {Promise<ImageExifData | null>} An object with the file path, flat
 *   EXIF map, and histogram (or `null`), or `null` when the file is not an
 *   image or no metadata/histogram could be produced.
 */
export async function getImageInfo(filePath: string): Promise<ImageExifData | null> {
  if (!isImageFile(filePath)) return null;

  let exif: Record<string, string> = {};
  try {
    const parsed = await exifr.parse(filePath, { skipUnknown: true, reviveValues: false } as Parameters<typeof exifr.parse>[1]);
    exif = flattenExif(parsed);
  } catch (err) {
    log.warn(LOG_EXIF_PARSE_FAILED, err);
  }

  let histogram: ImageHistogram | null = null;
  try {
    const decoded = await decodeImageHistogram(filePath);
    if (decoded) {
      histogram = computeHistogram(decoded.buffer, decoded.width, decoded.height);
    }
  } catch (err) {
    log.warn(LOG_HISTOGRAM_DECODE_FAILED, err);
  }

  if (Object.keys(exif).length === 0 && histogram === null) return null;
  return { file: filePath, exif, histogram };
}
