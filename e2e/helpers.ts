import { spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export function getFfmpegPath(): string {
  try {
    const ffmpegStatic = require('ffmpeg-static') as string;
    if (fs.existsSync(ffmpegStatic)) return ffmpegStatic;
  } catch {}
  return 'ffmpeg';
}

export function generateTestMedia(outputDir: string, name = 'test-input.mp4'): string {
  const outputPath = path.join(outputDir, name);
  if (fs.existsSync(outputPath)) return outputPath;

  const ffmpeg = getFfmpegPath();
  const result = spawnSync(
    ffmpeg,
    [
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=1:size=320x240:rate=1',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=1',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-shortest',
      '-y',
      outputPath,
    ],
    { timeout: 30000 },
  );

  if (result.status !== 0) {
    throw new Error(`Failed to generate test media: ${result.stderr.toString()}`);
  }

  return outputPath;
}

/**
 * Generates a three-kind MKV (video + audio + subtitle) so demux tests can
 * assert per-kind extraction. The subtitle is a text SRT track, so it can also
 * exercise a real `--subtitle-format` conversion.
 */
export function generateTestDemuxSource(outputDir: string, name = 'demux-source.mkv'): string {
  const outputPath = path.join(outputDir, name);
  if (fs.existsSync(outputPath)) return outputPath;

  const ffmpeg = getFfmpegPath();
  const subtitlePath = generateTestSubtitle(outputDir, `${path.parse(name).name}-subs.srt`);
  const result = spawnSync(
    ffmpeg,
    [
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=1:size=320x240:rate=1',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=1',
      '-i',
      subtitlePath,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-c:s',
      'srt',
      '-shortest',
      '-y',
      outputPath,
    ],
    { timeout: 30000 },
  );

  if (result.status !== 0) {
    throw new Error(`Failed to generate demux test source: ${result.stderr.toString()}`);
  }

  return outputPath;
}

export function generateTestImage(outputDir: string, name = 'sample.png'): string {
  const outputPath = path.join(outputDir, name);
  if (fs.existsSync(outputPath)) return outputPath;

  const ffmpeg = getFfmpegPath();
  const result = spawnSync(ffmpeg, ['-f', 'lavfi', '-i', 'color=c=red:s=64x64', '-frames:v', '1', '-y', outputPath], {
    timeout: 30000,
  });

  if (result.status !== 0) {
    throw new Error(`Failed to generate test image: ${result.stderr.toString()}`);
  }

  return outputPath;
}

export function generateTestJpeg(outputDir: string, name = 'cover.jpg'): string {
  return generateTestImage(outputDir, name);
}

export function generateTestAudio(outputDir: string, name = 'extra-audio.m4a'): string {
  const outputPath = path.join(outputDir, name);
  if (fs.existsSync(outputPath)) return outputPath;

  const ffmpeg = getFfmpegPath();
  const result = spawnSync(ffmpeg, ['-f', 'lavfi', '-i', 'sine=frequency=880:duration=1', '-c:a', 'aac', '-y', outputPath], {
    timeout: 30000,
  });

  if (result.status !== 0) {
    throw new Error(`Failed to generate test audio: ${result.stderr.toString()}`);
  }

  return outputPath;
}

/**
 * Atomically writes a text fixture unless it already exists. Uses an exclusive
 * create so an absent check and a later write cannot race (CWE-367).
 */
function writeTestFileIfAbsent(outputPath: string, content: string): void {
  try {
    const fd = fs.openSync(outputPath, 'wx');
    try {
      fs.writeFileSync(fd, content, 'utf8');
    } finally {
      fs.closeSync(fd);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
  }
}

export function generateTestSubtitle(outputDir: string, name = 'extra-subs.srt'): string {
  const outputPath = path.join(outputDir, name);
  writeTestFileIfAbsent(outputPath, '1\n00:00:00,000 --> 00:00:01,000\nEncodeX e2e subtitle\n');
  return outputPath;
}

export function generateTestChapters(outputDir: string, name = 'extra-chapters.ffmeta'): string {
  const outputPath = path.join(outputDir, name);
  writeTestFileIfAbsent(
    outputPath,
    [';FFMETADATA1', '', '[CHAPTER]', 'TIMEBASE=1/1000', 'START=0', 'END=1000', 'title=EncodeX e2e chapter', ''].join('\n'),
  );
  return outputPath;
}

/**
 * Reads the leading bytes of a media file and returns them as a hex string so a
 * test can assert the container signature (EBML for MKV, `ftyp` for MP4).
 */
export function readContainerMagic(filePath: string, byteCount = 8): string {
  const buffer = Buffer.alloc(byteCount);
  const fd = fs.openSync(filePath, 'r');
  try {
    fs.readSync(fd, buffer, 0, byteCount, 0);
  } finally {
    fs.closeSync(fd);
  }
  return buffer.toString('hex');
}

export function getBuildPaths() {
  const root = path.resolve(__dirname, '..');
  return {
    root,
    mainEntry: path.join(root, 'dist', 'main', 'index.js'),
    preloadEntry: path.join(root, 'dist', 'preload', 'index.js'),
    rendererIndex: path.join(root, 'dist', 'renderer', 'index.html'),
  };
}

export function ensureBuildExists(): void {
  const paths = getBuildPaths();
  const missing = [
    ['dist/main/index.js', paths.mainEntry],
    ['dist/preload/index.js', paths.preloadEntry],
    ['dist/renderer/index.html', paths.rendererIndex],
  ].filter(([, p]) => !fs.existsSync(p as string));

  if (missing.length > 0) {
    throw new Error(`Build artifacts missing. Run "npm run build" first.\nMissing: ${missing.map(([name]) => name).join(', ')}`);
  }
}
