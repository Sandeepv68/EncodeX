import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { generateTestMedia, getBuildPaths, ensureBuildExists } from './helpers';

const electronBin = (() => {
  try {
    return require('electron') as string;
  } catch {
    return 'electron';
  }
})();

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

describe.runIf(IS_E2E)('CLI mode (--headless)', () => {
  let testMedia: string;

  beforeAll(() => {
    ensureBuildExists();

    if (process.env.E2E_SKIP_MEDIA !== 'true') {
      const tmpDir = fs.mkdtempSync(path.join(__dirname, '..', 'e2e-media-'));
      testMedia = generateTestMedia(tmpDir);
    }
  });

  it('should show help text with --help flag', () => {
    const result = spawnSync(electronBin, [
      path.join(getBuildPaths().root, 'dist', 'main', 'index.js'),
      '--help',
    ], { encoding: 'utf-8', timeout: 15000 });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('EncodeX');
    expect(result.stdout).toContain('Usage');
    expect(result.stdout).toContain('--transcoder');
    expect(result.stdout).toContain('--video-codec');
    expect(result.stdout).toContain('--audio-codec');
    expect(result.stdout).toContain('--info');
  });

  it('should show help text with -h flag', () => {
    const result = spawnSync(electronBin, [
      path.join(getBuildPaths().root, 'dist', 'main', 'index.js'),
      '-h',
    ], { encoding: 'utf-8', timeout: 15000 });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('EncodeX');
  });

  it('should exit with error for invalid input', () => {
    const result = spawnSync(electronBin, [
      path.join(getBuildPaths().root, 'dist', 'main', 'index.js'),
      'nonexistent-file.mp4',
      'output.mp4',
    ], { encoding: 'utf-8', timeout: 15000 });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toBeTruthy();
  });

  it('should detect --headless flag and route to CLI', () => {
    const result = spawnSync(electronBin, [
      path.join(getBuildPaths().root, 'dist', 'main', 'index.js'),
      '--headless',
      'input.mp4',
      'output.mp4',
    ], { encoding: 'utf-8', timeout: 15000 });

    expect(result.stdout).toContain('Starting conversion');
    expect(result.stdout).toContain('Transcoder: FFMPEG');
  });

  it('should show media info with --info flag', () => {
    const result = spawnSync(electronBin, [
      path.join(getBuildPaths().root, 'dist', 'main', 'index.js'),
      '--headless',
      '--info',
      testMedia,
      'output.mp4',
    ], { encoding: 'utf-8', timeout: 30000 });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('format');
    expect(result.stdout).toContain('streams');
  });

  it('should convert a file successfully', () => {
    const outputPath = path.join(path.dirname(testMedia), 'converted-output.mp4');

    const result = spawnSync(electronBin, [
      path.join(getBuildPaths().root, 'dist', 'main', 'index.js'),
      '--headless',
      testMedia,
      outputPath,
    ], { encoding: 'utf-8', timeout: 60000 });

    expect(result.status).toBe(0);
    expect(fs.existsSync(outputPath)).toBe(true);
    expect(fs.statSync(outputPath).size).toBeGreaterThan(0);
    expect(result.stdout).toContain('completed');
  });

  it('should convert with custom transcoder options', () => {
    const outputPath = path.join(path.dirname(testMedia), 'custom-output.mp4');

    const result = spawnSync(electronBin, [
      path.join(getBuildPaths().root, 'dist', 'main', 'index.js'),
      '--headless',
      '--transcoder', 'FFMPEG',
      '-v', 'libx264',
      '-a', 'aac',
      '--pix-fmt', 'yuv420p',
      testMedia,
      outputPath,
    ], { encoding: 'utf-8', timeout: 60000 });

    expect(result.status).toBe(0);
    expect(fs.existsSync(outputPath)).toBe(true);
    expect(result.stdout).toContain('completed');
  });

  it('should convert with FFTOOL transcoder', () => {
    const outputPath = path.join(path.dirname(testMedia), 'fftool-output.mp4');

    const result = spawnSync(electronBin, [
      path.join(getBuildPaths().root, 'dist', 'main', 'index.js'),
      '--headless',
      '--transcoder', 'FFTOOL',
      testMedia,
      outputPath,
    ], { encoding: 'utf-8', timeout: 60000 });

    expect(result.status).toBe(0);
    expect(fs.existsSync(outputPath)).toBe(true);
    expect(result.stdout).toContain('completed');
  });
});
