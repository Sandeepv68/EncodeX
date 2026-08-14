/**
 * @fileoverview Media analysis utilities for the timeline UI.
 * Extracts audio waveform peak data and a grid of video thumbnails from media
 * files by shelling out to ffmpeg. Both extractors split the source file into
 * time segments, decode each segment in parallel (bounded by a global ffmpeg
 * concurrency semaphore), and stitch the results into a single
 * WaveformData/ThumbnailStrip payload for the renderer. Thumbnails are packed
 * into one PNG montage (encoded with a minimal hand-rolled PNG encoder) and
 * shipped to the renderer as a data URL.
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { deflateSync } from 'zlib';
import { Logger } from '../../shared/logger';
import { getFfmpegPath } from '../media-binaries';
import { isVideoFile } from '../../shared/file-extensions';
import { WaveformData, ThumbnailStrip } from '../../shared/types';
import {
  WAVEFORM_SAMPLE_RATE,
  WAVEFORM_BUCKETS_PER_SECOND,
  WAVEFORM_MAX_BUCKETS,
  WAVEFORM_MIN_BUCKETS,
  WAVEFORM_SEGMENT_SECONDS,
  WAVEFORM_MIN_SEGMENTS,
  WAVEFORM_MAX_SEGMENTS,
  WAVEFORM_PARALLEL,
  THUMB_WIDTH,
  THUMB_HEIGHT,
  THUMB_TILE_COLS,
  THUMB_MAX_COUNT,
  THUMB_INTERVAL_SECONDS,
  THUMB_PARALLEL,
  MAX_CONCURRENT_FFMPEG,
  PCM_MAX_AMPLITUDE,
} from '../../shared/constants';
import {
  LOG_FFMPEG_SPAWN_ERROR,
  LOG_NOT_A_THUMBNAIL_ABLE_FILE,
  LOG_NOT_A_WAVEFORM_ABLE_FILE,
  LOG_THUMBNAIL_EXTRACTION_FAILED_NO_FRAMES_DECODED,
  LOG_THUMBNAIL_SEGMENT_FAILED_WITH_CODE,
  LOG_WAVEFORM_EXTRACTION_FAILED_NO_AUDIO_DECODED,
  LOG_WAVEFORM_SEGMENT_FAILED_WITH_CODE,
} from '../../shared/log-constants';

const log = new Logger('main/timeline/timeline-media');

/** Byte size of one raw RGB24 thumbnail frame (`THUMB_WIDTH * THUMB_HEIGHT * 3`). */
const RAW_FRAME_BYTES = THUMB_WIDTH * THUMB_HEIGHT * 3;

/**
 * Clamps a value into the inclusive `[min, max]` range.
 * @param {number} value - The value to clamp
 * @param {number} min - Lower bound of the range
 * @param {number} max - Upper bound of the range
 * @returns {number} `min` if value < min, `max` if value > max, else `value`
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Formats a number of seconds for use in ffmpeg `-ss`/`-t` arguments.
 *
 * Rounds to 3 decimal places (millisecond precision) and returns the result as
 * a string without trailing zeros, keeping generated argument lists compact.
 * @param {number} value - Seconds to format
 * @returns {string} Formatted seconds string, e.g. `'12.345'` or `'30'`
 */
function formatSeconds(value: number): string {
  return String(parseFloat(value.toFixed(3)));
}

/**
 * Determines whether a file can have media extracted from it.
 *
 * A file is extractable when it is a known video file extension, exists on
 * disk, and has a positive reported duration.
 * @param {string} filePath - Absolute path of the candidate media file
 * @param {number} duration - Reported duration in seconds
 * @returns {boolean} True if the file is a video that exists with duration > 0
 */
function isExtractable(filePath: string, duration: number): boolean {
  return isVideoFile(filePath) && existsSync(filePath) && duration > 0;
}

/**
 * Maps a collection of items to promises with a bounded concurrency limit.
 *
 * Spawns up to `limit` parallel "runner" workers that each pull the next
 * unprocessed index in order and await `worker`; results are written into a
 * pre-sized array so the final order matches the input order regardless of
 * completion timing. This is used to decode waveform/thumbnail segments in
 * parallel without flooding the machine with ffmpeg processes.
 * @template T - The input item type
 * @template R - The output result type
 * @param {T[]} items - Items to process
 * @param {number} limit - Maximum number of workers running concurrently
 * @param {function(T, number): Promise<R>} worker - Async mapping function
 *   receiving each item and its original index
 * @returns {Promise<R[]>} Results in the same order as `items`
 */
async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * Spawns ffmpeg and collects all stdout/stderr until the process exits.
 *
 * Resolves (never rejects) with a record containing the exit code, the complete
 * stdout payload as a Buffer, and the accumulated stderr text. Spawn failures
 * (e.g. missing executable) resolve with code `-1` and the error message in
 * stderr so callers can log and degrade gracefully.
 * @param {string[]} args - Full ffmpeg argument list (no binary name)
 * @returns {Promise<{code: number, data: Buffer, stderr: string}>} Exit code
 *   (or -1 on spawn error), captured stdout bytes, and stderr text
 */
function spawnBuffer(args: string[]): Promise<{ code: number; data: Buffer; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(getFfmpegPath(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (err: Error) => {
      log.error(LOG_FFMPEG_SPAWN_ERROR, err);
      resolve({ code: -1, data: Buffer.concat(chunks), stderr: err.message });
    });
    child.on('close', (code) => {
      resolve({ code: code ?? -1, data: Buffer.concat(chunks), stderr });
    });
  });
}

/**
 * Global ffmpeg concurrency semaphore state.
 * `activeSpawns` counts currently running ffmpeg children; `spawnWaiters`
 * holds resolver callbacks for calls that are waiting for a free slot.
 */
let activeSpawns = 0;
const spawnWaiters: Array<() => void> = [];

/**
 * Runs a function while holding a global ffmpeg spawn slot.
 *
 * If the number of concurrently active ffmpeg processes has reached
 * `MAX_CONCURRENT_FFMPEG`, the caller awaits a queued slot. Slots are released
 * in FIFO order via a promise resolver stored in `spawnWaiters`. This keeps the
 * total number of concurrent ffmpeg children across all extractors bounded.
 * @template T - The return type of `fn`
 * @param {function(): Promise<T>} fn - The work to run while holding the slot
 * @returns {Promise<T>} The result of `fn` once a slot becomes available
 */
async function withSpawnSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (activeSpawns >= MAX_CONCURRENT_FFMPEG) {
    await new Promise<void>((resolve) => spawnWaiters.push(resolve));
  }
  activeSpawns++;
  try {
    return await fn();
  } finally {
    activeSpawns--;
    const next = spawnWaiters.shift();
    if (next) next();
  }
}

/**
 * Computes the standard CRC-32 checksum of a buffer (IEEE 802.3 polynomial,
 * reflected, initial value 0xFFFFFFFF). Used for PNG chunk validation.
 * @param {Buffer} buf - The bytes to checksum
 * @returns {number} Unsigned 32-bit CRC value
 */
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Builds a single PNG chunk (length, type, data, CRC) for a PNG stream.
 * @param {string} type - Four-character ASCII chunk type (e.g. 'IHDR', 'IDAT')
 * @param {Buffer} data - Chunk payload bytes
 * @returns {Buffer} Concatenated length + type + data + CRC32 of type+data
 */
function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

/**
 * Encodes raw RGB24 pixels into a minimal valid PNG image.
 *
 * Produces an 8-bit RGB (color type 2) PNG containing the PNG signature,
 * IHDR, a single zlib-deflated IDAT (with a filter byte `0` per scanline), and
 * IEND chunks. Compression level 9 is used for the smallest thumbnail montage.
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @param {Buffer} rgb - Raw RGB24 pixel data, exactly `width * height * 3` bytes
 * @returns {Buffer} Complete encoded PNG file bytes
 */
function encodePng(width: number, height: number, rgb: Buffer): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([signature, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

/**
 * Extracts audio waveform peak data from a video file.
 *
 * Workflow: rejects non-video/missing files up front (returns null). Computes
 * the number of amplitude buckets (clamped to WAVEFORM_MIN/MAX_BUCKETS) and
 * splits the file into a clamped number of `WAVEFORM_SEGMENT_SECONDS`-long
 * segments. Each segment is decoded concurrently (up to WAVEFORM_PARALLEL, and
 * globally capped by MAX_CONCURRENT_FFMPEG) with a command of the form
 * `ffmpeg -v error -ss <start> -t <span> -i <file> -vn -ac 1 -ar <rate> -f
 * s16le pipe:1`; the returned S16LE mono samples are walked two bytes at a time
 * to update the min/max amplitude of the bucket covering each sample's absolute
 * time. Segments that fail or decode no data are skipped. If every segment
 * fails, null is returned. Buckets with no samples are filled by interpolating
 * between the nearest filled neighbors via `fillWaveformGaps`, then normalized
 * to the [-1, 1] range by dividing by PCM_MAX_AMPLITUDE.
 * @param {string} filePath - Absolute path of the video file
 * @param {number} duration - Duration of the file in seconds
 * @returns {Promise<WaveformData | null>} Waveform with sampleRate,
 *   samplesPerBucket and normalized min/max buckets; null if the file is not
 *   extractable or no audio could be decoded at all
 */
export function extractWaveform(filePath: string, duration: number): Promise<WaveformData | null> {
  if (!isExtractable(filePath, duration)) {
    log.debug(LOG_NOT_A_WAVEFORM_ABLE_FILE, filePath);
    return Promise.resolve(null);
  }
  const bucketCount = clamp(Math.round(duration * WAVEFORM_BUCKETS_PER_SECOND), WAVEFORM_MIN_BUCKETS, WAVEFORM_MAX_BUCKETS);
  const samplesPerBucket = Math.max(1, Math.floor((WAVEFORM_SAMPLE_RATE * duration) / bucketCount));
  const bucketsPerSecond = bucketCount / duration;
  const segmentCount = clamp(Math.round(duration / WAVEFORM_SEGMENT_SECONDS), WAVEFORM_MIN_SEGMENTS, WAVEFORM_MAX_SEGMENTS);
  const span = duration / segmentCount;

  const buckets: Array<{ min: number; max: number }> = Array.from({ length: bucketCount }, () => ({
    min: PCM_MAX_AMPLITUDE,
    max: -PCM_MAX_AMPLITUDE,
  }));

  const segments = Array.from({ length: segmentCount }, (_, i) => ({
    start: (i * duration) / segmentCount,
    samples: 0,
    args: [
      '-v',
      'error',
      '-ss',
      formatSeconds((i * duration) / segmentCount),
      '-t',
      formatSeconds(span),
      '-i',
      filePath,
      '-vn',
      '-ac',
      '1',
      '-ar',
      String(WAVEFORM_SAMPLE_RATE),
      '-f',
      's16le',
      'pipe:1',
    ],
  }));

  log.debug(`Waveform extraction: segments=${segmentCount} span=${span.toFixed(2)}s parallel=${WAVEFORM_PARALLEL}`);
  return mapWithConcurrency(segments, WAVEFORM_PARALLEL, (segment) =>
    withSpawnSlot(() => spawnBuffer(segment.args)).then((result) => {
      if (result.code !== 0) {
        log.warn(LOG_WAVEFORM_SEGMENT_FAILED_WITH_CODE, result.code, result.stderr);
        return false;
      }
      const data = result.data;
      for (let offset = 0; offset + 1 < data.length; offset += 2) {
        const sample = data.readInt16LE(offset);
        const absoluteTime = segment.start + segment.samples / WAVEFORM_SAMPLE_RATE;
        const idx = Math.floor(absoluteTime * bucketsPerSecond);
        if (idx < bucketCount) {
          if (sample < buckets[idx].min) buckets[idx].min = sample;
          if (sample > buckets[idx].max) buckets[idx].max = sample;
        }
        segment.samples++;
      }
      return data.length > 0;
    }),
  ).then((successes) => {
    if (!successes.some(Boolean)) {
      log.warn(LOG_WAVEFORM_EXTRACTION_FAILED_NO_AUDIO_DECODED);
      return null;
    }
    const filled: Array<{ min: number; max: number } | null> = buckets.map((b) => (b.min <= b.max ? { min: b.min, max: b.max } : null));
    const bucketValues = fillWaveformGaps(filled).map((b) => ({
      min: b.min === PCM_MAX_AMPLITUDE ? 0 : b.min / PCM_MAX_AMPLITUDE,
      max: b.max === -PCM_MAX_AMPLITUDE ? 0 : b.max / PCM_MAX_AMPLITUDE,
    }));
    return { sampleRate: WAVEFORM_SAMPLE_RATE, samplesPerBucket, buckets: bucketValues };
  });
}

/**
 * Fills empty waveform buckets by interpolating from the nearest filled ones.
 *
 * Walks the bucket array once forward recording for each index the last filled
 * index before it, and once backward recording the next filled index after it.
 * For an empty bucket at index i:
 * - if no filled buckets exist at all, a zeroed `{min:0, max:0}` bucket is used,
 * - if only one side has a filled neighbor, that neighbor's values are copied,
 * - if both sides have neighbors, min/max are linearly interpolated by the
 *   normalized distance between them (`t = (i - prev) / (next - prev)`).
 * @param {Array<{min: number, max: number} | null>} buckets - Bucket array where
 *   null marks a bucket with no samples
 * @returns {Array<{min: number, max: number}>} Fully populated bucket array
 *   with the same length as the input
 */
function fillWaveformGaps(buckets: Array<{ min: number; max: number } | null>): Array<{ min: number; max: number }> {
  const result: Array<{ min: number; max: number }> = [];
  const lastFilled = new Array<number>(buckets.length).fill(-1);
  const nextFilled = new Array<number>(buckets.length).fill(-1);
  let last = -1;
  for (let i = 0; i < buckets.length; i++) {
    lastFilled[i] = last;
    if (buckets[i]) last = i;
  }
  let next = -1;
  for (let i = buckets.length - 1; i >= 0; i--) {
    nextFilled[i] = next;
    if (buckets[i]) next = i;
  }
  for (let i = 0; i < buckets.length; i++) {
    const current = buckets[i];
    if (current) {
      result.push(current);
      continue;
    }
    const prevIndex = lastFilled[i];
    const nextIndex = nextFilled[i];
    if (prevIndex === -1 && nextIndex === -1) {
      result.push({ min: 0, max: 0 });
      continue;
    }
    if (prevIndex === -1) {
      result.push(buckets[nextIndex]!);
      continue;
    }
    if (nextIndex === -1) {
      result.push(buckets[prevIndex]!);
      continue;
    }
    const prevBucket = buckets[prevIndex]!;
    const nextBucket = buckets[nextIndex]!;
    const t = (i - prevIndex) / (nextIndex - prevIndex);
    result.push({
      min: prevBucket.min + (nextBucket.min - prevBucket.min) * t,
      max: prevBucket.max + (nextBucket.max - prevBucket.max) * t,
    });
  }
  return result;
}

/**
 * Extracts a grid of video thumbnails and packs them into a PNG montage.
 *
 * Workflow: rejects non-video/missing files up front (returns null). Computes
 * the number of thumbnails as `count = clamp(round(duration / interval))` capped
 * at THUMB_MAX_COUNT, and derives the montage dimensions from THUMB_TILE_COLS.
 * Each thumbnail is decoded concurrently (up to THUMB_PARALLEL, globally capped
 * by MAX_CONCURRENT_FFMPEG) with a command of the form `ffmpeg -v error -ss
 * <start> -noaccurate_seek -i <file> -frames:v 1 -vf
 * scale=W:H:force_original_aspect_ratio=increase,crop=W:H,setsar=1 -f rawvideo
 * -pix_fmt rgb24 pipe:1`. A result whose exit code is non-zero or whose payload
 * is not exactly `RAW_FRAME_BYTES` is treated as a failure: a black placeholder
 * frame is stored and the job is marked unsuccessful. If every job fails, null
 * is returned. On success the frames are blitted into the montage row by row,
 * the montage is encoded to PNG via {@link encodePng}, and a ThumbnailStrip
 * describing the grid geometry is returned.
 * @param {string} filePath - Absolute path of the video file
 * @param {number} duration - Duration of the file in seconds
 * @returns {Promise<ThumbnailStrip | null>} Thumbnail strip containing a PNG
 *   data URL and grid geometry (cols, rows, thumb dimensions, per-thumbnail
 *   interval, count); null if the file is not extractable or no frames could be
 *   decoded at all
 */
export function extractThumbnails(filePath: string, duration: number): Promise<ThumbnailStrip | null> {
  if (!isExtractable(filePath, duration)) {
    log.debug(LOG_NOT_A_THUMBNAIL_ABLE_FILE, filePath);
    return Promise.resolve(null);
  }
  const count = Math.max(1, Math.min(THUMB_MAX_COUNT, Math.round(duration / THUMB_INTERVAL_SECONDS)));
  const cols = THUMB_TILE_COLS;
  const rows = Math.ceil(count / cols);
  const montageWidth = cols * THUMB_WIDTH;
  const montageHeight = rows * THUMB_HEIGHT;

  const jobs = Array.from({ length: count }, (_, i) => ({
    index: i,
    args: [
      '-v',
      'error',
      '-ss',
      formatSeconds((i * duration) / count),
      '-noaccurate_seek',
      '-i',
      filePath,
      '-frames:v',
      '1',
      '-vf',
      `scale=${THUMB_WIDTH}:${THUMB_HEIGHT}:force_original_aspect_ratio=increase,crop=${THUMB_WIDTH}:${THUMB_HEIGHT},setsar=1`,
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      'pipe:1',
    ],
  }));

  const frames = new Array<Buffer>(count);
  log.debug(`Thumbnail extraction: count=${count} parallel=${THUMB_PARALLEL}`);
  return mapWithConcurrency(jobs, THUMB_PARALLEL, (job) =>
    withSpawnSlot(() => spawnBuffer(job.args)).then((result) => {
      if (result.code !== 0 || result.data.length !== RAW_FRAME_BYTES) {
        log.warn(LOG_THUMBNAIL_SEGMENT_FAILED_WITH_CODE, result.code);
        frames[job.index] = Buffer.alloc(RAW_FRAME_BYTES);
        return false;
      }
      frames[job.index] = result.data;
      return true;
    }),
  ).then((successes) => {
    if (!successes.some(Boolean)) {
      log.warn(LOG_THUMBNAIL_EXTRACTION_FAILED_NO_FRAMES_DECODED);
      return null;
    }
    const montage = Buffer.alloc(montageWidth * montageHeight * 3);
    for (let i = 0; i < count; i++) {
      const frame = frames[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const destX = col * THUMB_WIDTH;
      const destY = row * THUMB_HEIGHT;
      for (let y = 0; y < THUMB_HEIGHT; y++) {
        frame.copy(montage, ((destY + y) * montageWidth + destX) * 3, y * THUMB_WIDTH * 3, (y + 1) * THUMB_WIDTH * 3);
      }
    }
    const dataUrl = `data:image/png;base64,${encodePng(montageWidth, montageHeight, montage).toString('base64')}`;
    return { dataUrl, cols, rows, thumbWidth: THUMB_WIDTH, thumbHeight: THUMB_HEIGHT, interval: duration / count, count };
  });
}
