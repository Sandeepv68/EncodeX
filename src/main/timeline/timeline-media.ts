import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { deflateSync } from 'zlib';
import ffmpegStatic from 'ffmpeg-static';
import { Logger } from '../../shared/logger';
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
import { TRANSCODER_COMMANDS } from '../../shared/transcoder-constants';

const log = new Logger('main/timeline/timeline-media');

const RAW_FRAME_BYTES = THUMB_WIDTH * THUMB_HEIGHT * 3;

function getFfmpegPath(): string {
  const staticPath = ffmpegStatic as unknown as string;
  if (existsSync(staticPath)) return staticPath;
  log.warn('ffmpeg-static not found, falling back to system ffmpeg');
  return TRANSCODER_COMMANDS.FFMPEG;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatSeconds(value: number): string {
  return String(parseFloat(value.toFixed(3)));
}

function isExtractable(filePath: string, duration: number): boolean {
  return isVideoFile(filePath) && existsSync(filePath) && duration > 0;
}

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
      log.error('ffmpeg spawn error:', err);
      resolve({ code: -1, data: Buffer.concat(chunks), stderr: err.message });
    });
    child.on('close', (code) => {
      resolve({ code: code ?? -1, data: Buffer.concat(chunks), stderr });
    });
  });
}

let activeSpawns = 0;
const spawnWaiters: Array<() => void> = [];

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

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

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

export function extractWaveform(filePath: string, duration: number): Promise<WaveformData | null> {
  if (!isExtractable(filePath, duration)) {
    log.debug('Not a waveform-able file:', filePath);
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
        log.warn('Waveform segment failed with code:', result.code, result.stderr);
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
      log.warn('Waveform extraction failed: no audio decoded');
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

export function extractThumbnails(filePath: string, duration: number): Promise<ThumbnailStrip | null> {
  if (!isExtractable(filePath, duration)) {
    log.debug('Not a thumbnail-able file:', filePath);
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
        log.warn('Thumbnail segment failed with code:', result.code);
        frames[job.index] = Buffer.alloc(RAW_FRAME_BYTES);
        return false;
      }
      frames[job.index] = result.data;
      return true;
    }),
  ).then((successes) => {
    if (!successes.some(Boolean)) {
      log.warn('Thumbnail extraction failed: no frames decoded');
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
