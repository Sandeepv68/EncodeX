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
