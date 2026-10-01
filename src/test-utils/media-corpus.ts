/**
 * @fileoverview Builds a corrupt-media corpus for the `test:media-fuzz` suite.
 *
 * The corpus is *generated* rather than checked in. Every seed is synthesised
 * with the real `ffmpeg-static` binary so the files are genuine, decodable
 * media, and every corrupted variant is then produced by plain byte surgery on
 * those seeds. Nothing about the corruption is mocked, so the suite exercises
 * the real probe/decode paths.
 *
 * Corruption is deterministic. Every random choice comes from a seeded PRNG so
 * a failing case can be reproduced by re-running with the same
 * `MEDIA_FUZZ_SEED`, which matters because a media failure is otherwise
 * effectively impossible to re-create by hand.
 *
 * @see src/main/__tests__/corrupt-media.mediafuzz.test.ts
 */

import { spawnSync } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ffmpegPath = require('ffmpeg-static') as string;

/** Default PRNG seed; override with `MEDIA_FUZZ_SEED` to replay a failure. */
export const DEFAULT_MEDIA_FUZZ_SEED = 0x5eed;

/** How a corpus file was produced, which decides what may be asserted about it. */
export type CorruptionKind =
  /** A pristine, decodable file. Used as the suite's non-vacuity control. */
  | 'pristine'
  /** Cut short at a fixed or proportional offset. */
  | 'truncated'
  /** Valid bytes carrying the wrong extension, or a lying container header. */
  | 'mismatch'
  /** Single-bit flips concentrated in the container header. */
  | 'bitflip'
  /** Nothing but zeros or random bytes. */
  | 'filler';

export type CorpusFile = {
  /** Absolute path to the generated file. */
  path: string;
  /** File name including extension, for test output. */
  name: string;
  /** Which corruption produced it, if any. */
  kind: CorruptionKind;
  /** Name of the pristine seed this was derived from, if any. */
  seedName?: string;
  /** Media family, used to decide which code paths exercise this file. */
  family: 'video' | 'image' | 'audio' | 'text';
};

/** One synthesised media file, before any corruption is applied. */
type Seed = { name: string; family: CorpusFile['family']; buffer: Buffer };

/** Small deterministic PRNG (mulberry32) so corpus contents are reproducible. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Runs the real ffmpeg to synthesise one seed, failing loudly if it cannot. */
function synthesise(dir: string, name: string, args: string[]): Buffer {
  const target = join(dir, name);
  const result = spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...args, target], {
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw new Error(`ffmpeg failed to synthesise ${name}: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`ffmpeg exited ${result.status} for ${name}: ${result.stderr?.toString().slice(0, 400) ?? ''}`);
  }
  return readFileSync(target);
}

/** The pristine corpus. One short clip/image/tone per container we claim to open. */
export function createSeeds(dir: string): Seed[] {
  mkdirSync(dir, { recursive: true });
  const video = 'testsrc=size=160x120:rate=10:duration=1';
  const audio = 'sine=frequency=440:duration=1';
  const still = 'testsrc=size=160x120';

  const seeds: Seed[] = [
    {
      name: 'seed.mp4',
      family: 'video',
      buffer: synthesise(dir, 'seed.mp4', ['-f', 'lavfi', '-i', video, '-c:v', 'libx264', '-pix_fmt', 'yuv420p']),
    },
    // Carries both an audio and a video stream, and runs long enough for the
    // timeline extractors to produce more than one bucket. A video-only seed
    // cannot exercise `extractWaveform` at all, which would make every
    // waveform assertion vacuous.
    {
      name: 'seed-av.mp4',
      family: 'video',
      buffer: synthesise(dir, 'seed-av.mp4', [
        '-f',
        'lavfi',
        '-i',
        'testsrc=size=160x120:rate=10:duration=3',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:duration=3',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-shortest',
      ]),
    },
    {
      name: 'seed.mkv',
      family: 'video',
      buffer: synthesise(dir, 'seed.mkv', ['-f', 'lavfi', '-i', video, '-c:v', 'libx264', '-pix_fmt', 'yuv420p']),
    },
    {
      name: 'seed.webm',
      family: 'video',
      buffer: synthesise(dir, 'seed.webm', ['-f', 'lavfi', '-i', video, '-c:v', 'libvpx', '-b:v', '200k']),
    },
    { name: 'seed.mov', family: 'video', buffer: synthesise(dir, 'seed.mov', ['-f', 'lavfi', '-i', video, '-c:v', 'mjpeg']) },
    { name: 'seed.avi', family: 'video', buffer: synthesise(dir, 'seed.avi', ['-f', 'lavfi', '-i', video, '-c:v', 'mjpeg']) },
    { name: 'seed.jpg', family: 'image', buffer: synthesise(dir, 'seed.jpg', ['-f', 'lavfi', '-i', still, '-frames:v', '1']) },
    { name: 'seed.png', family: 'image', buffer: synthesise(dir, 'seed.png', ['-f', 'lavfi', '-i', still, '-frames:v', '1']) },
    {
      name: 'seed.gif',
      family: 'image',
      buffer: synthesise(dir, 'seed.gif', ['-f', 'lavfi', '-i', 'testsrc=size=160x120:rate=5:duration=1']),
    },
    { name: 'seed.mp3', family: 'audio', buffer: synthesise(dir, 'seed.mp3', ['-f', 'lavfi', '-i', audio, '-c:a', 'libmp3lame']) },
    { name: 'seed.flac', family: 'audio', buffer: synthesise(dir, 'seed.flac', ['-f', 'lavfi', '-i', audio, '-c:a', 'flac']) },
  ];

  // Subtitles need no encoder: a valid SRT is just text.
  const srt = '1\n00:00:00,000 --> 00:00:01,000\nEncodeX fuzz corpus\n\n2\n00:00:01,000 --> 00:00:02,000\nSecond line\n';
  writeFileSync(join(dir, 'seed.srt'), srt, 'utf8');
  seeds.push({ name: 'seed.srt', family: 'text', buffer: Buffer.from(srt, 'utf8') });

  return seeds;
}

/** Fixed byte counts a truncation sweep cuts at, plus proportional offsets. */
const TRUNCATION_OFFSETS = [0, 1, 2, 8, 64, 512];
const TRUNCATION_RATIOS = [0.01, 0.05, 0.25, 0.5, 0.99];

/**
 * Derives corrupted variants from the pristine seeds.
 *
 * @param dir - Directory to write variants into; must already exist.
 * @param seeds - Pristine files from {@link createSeeds}.
 * @param seed - PRNG seed, so bit flips and filler bytes are reproducible.
 * @returns Every corpus file, pristine seeds first.
 */
export function buildCorpus(dir: string, seeds: Seed[], seed: number = DEFAULT_MEDIA_FUZZ_SEED): CorpusFile[] {
  const rng = makeRng(seed);
  const out: CorpusFile[] = [];

  const write = (name: string, buffer: Buffer, kind: CorruptionKind, family: CorpusFile['family'], seedName?: string): void => {
    writeFileSync(join(dir, name), buffer);
    out.push({ path: join(dir, name), name, kind, family, seedName });
  };

  for (const s of seeds) {
    write(s.name, s.buffer, 'pristine', s.family);

    const offsets = [...TRUNCATION_OFFSETS, ...TRUNCATION_RATIOS.map((r) => Math.min(Math.floor(s.buffer.length * r), s.buffer.length))];
    for (const offset of offsets) {
      const cut = Math.max(0, Math.min(offset, s.buffer.length));
      const stem = s.name.replace(/\.[^.]+$/, '');
      write(`${stem}.trunc${cut}.${s.name.split('.').pop()}`, s.buffer.subarray(0, cut), 'truncated', s.family, s.name);
    }

    // Flip one bit in each of the first 512 bytes, so container headers are hit
    // hard while payload data is left alone.
    const headerEnd = Math.min(512, s.buffer.length);
    const flipped = Buffer.from(s.buffer);
    for (let i = 0; i < headerEnd; i++) {
      flipped[i] = flipped[i] ^ (1 << Math.floor(rng() * 8));
    }
    const stem = s.name.replace(/\.[^.]+$/, '');
    write(`${stem}.bitflip.${s.name.split('.').pop()}`, flipped, 'bitflip', s.family, s.name);

    // Zeros and random bytes at the same size as the real thing.
    write(`${stem}.zeros.${s.name.split('.').pop()}`, Buffer.alloc(s.buffer.length), 'filler', s.family, s.name);
    const noise = Buffer.alloc(s.buffer.length);
    for (let i = 0; i < noise.length; i++) noise[i] = Math.floor(rng() * 256);
    write(`${stem}.noise.${s.name.split('.').pop()}`, noise, 'filler', s.family, s.name);
  }

  // Extension/content mismatches: real bytes wearing the wrong name, plus a
  // valid container header followed by nothing of substance.
  const byName = new Map(seeds.map((s) => [s.name, s] as const));
  const mp4 = byName.get('seed.mp4');
  const jpg = byName.get('seed.jpg');
  const mkv = byName.get('seed.mkv');
  if (mp4 && jpg && mkv) {
    write('mismatch.mkv-as.mp4', mkv.buffer, 'mismatch', 'video', 'seed.mkv');
    write('mismatch.jpg-as.mkv', jpg.buffer, 'mismatch', 'image', 'seed.jpg');
    write('mismatch.mp4-as.jpg', mp4.buffer, 'mismatch', 'image', 'seed.mp4');
    write('mismatch.zeros.mp4', Buffer.alloc(8192), 'mismatch', 'video');
    const headerPlusNoise = Buffer.concat([mp4.buffer.subarray(0, 32), Buffer.alloc(1024 * 1024)]);
    write('mismatch.header-plus-noise.mp4', headerPlusNoise, 'mismatch', 'video', 'seed.mp4');
  }

  return out;
}

/** Reads `MEDIA_FUZZ_SEED` so a CI failure can be replayed exactly. */
export function corpusSeedFromEnv(): number {
  const raw = process.env.MEDIA_FUZZ_SEED;
  if (!raw) return DEFAULT_MEDIA_FUZZ_SEED;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_MEDIA_FUZZ_SEED;
}
