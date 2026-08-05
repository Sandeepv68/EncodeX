import { spawn } from 'child_process';
import { existsSync } from 'fs';
import exifr from 'exifr';
import ffmpegStatic from 'ffmpeg-static';
import { Logger } from '../shared/logger';
import { isImageFile } from '../shared/file-extensions';
import { ImageExifData, ImageHistogram } from '../shared/types';
import { HISTOGRAM_BINS, HISTOGRAM_MAX_WIDTH, RGB_BYTES_PER_PIXEL, LUMA_WEIGHTS } from '../shared/constants';
import { TRANSCODER_COMMANDS } from '../shared/transcoder-constants';
import {
  LOG_EXIF_PARSE_FAILED,
  LOG_FFMPEG_STATIC_NOT_FOUND_FALLING_BACK_TO_SYSTEM_FFMPEG,
  LOG_HISTOGRAM_DECODE_FAILED,
  LOG_HISTOGRAM_DECODE_FAILED_STDERR,
  LOG_HISTOGRAM_FFMPEG_ERROR,
} from '../shared/log-constants';

const log = new Logger('main/image-info');

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

function getFfmpegPath(): string {
  const staticPath = ffmpegStatic as unknown as string;
  if (existsSync(staticPath)) return staticPath;
  log.warn(LOG_FFMPEG_STATIC_NOT_FOUND_FALLING_BACK_TO_SYSTEM_FFMPEG);
  return TRANSCODER_COMMANDS.FFMPEG;
}

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
