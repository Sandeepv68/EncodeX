import { describe, it, expect, beforeAll } from 'vitest';
import { spawn } from 'child_process';
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

function electronArgs(scriptArgs: string[]): string[] {
  const baseArgs = [path.join(getBuildPaths().root, 'dist', 'main', 'index.js'), ...scriptArgs];
  if (process.env.CI || process.platform === 'linux') {
    return ['--no-sandbox', '--disable-gpu', ...baseArgs];
  }
  return baseArgs;
}

function spawnElectron(args: string[], timeout: number): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(electronBin, electronArgs(args));
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeout);

    child.on('error', () => {
      clearTimeout(timer);
      resolve({ status: null, stdout, stderr });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ status: timedOut ? null : code, stdout, stderr });
    });

    child.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
    child.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });
  });
}

describe.runIf(IS_E2E)('CLI mode (subcommands)', () => {
  let testMedia: string;

  beforeAll(() => {
    ensureBuildExists();

    if (process.env.E2E_SKIP_MEDIA !== 'true') {
      const tmpDir = fs.mkdtempSync(path.join(__dirname, '..', 'e2e-media-'));
      testMedia = generateTestMedia(tmpDir);
    }
  });

  it('should show help text with --help flag', async () => {
    const result = await spawnElectron(['--help'], 15000);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('EncodeX');
    expect(result.stdout).toContain('Usage');
    expect(result.stdout).toContain('convert');
    expect(result.stdout).toContain('info');
    expect(result.stdout).toContain('capabilities');
    expect(result.stdout).toContain('compress');
    expect(result.stdout).toContain('extract-audio');
    expect(result.stdout).toContain('batch');
    expect(result.stdout).toContain('--transcoder');
  });

  it('should show help text with -h flag', async () => {
    const result = await spawnElectron(['-h'], 15000);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('EncodeX');
  });

  it('should show subcommand help for convert', async () => {
    const result = await spawnElectron(['convert', '--help'], 15000);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('convert');
    expect(result.stdout).toContain('--video-codec');
    expect(result.stdout).toContain('--audio-codec');
    expect(result.stdout).toContain('--info');
  });

  it('should exit with usage error for an unknown flag', async () => {
    const result = await spawnElectron(['--bogus-flag'], 15000);

    expect(result.status).toBe(2);
    expect(result.stderr).toBeTruthy();
  });

  it('should exit with not-found error for invalid input', async () => {
    const result = await spawnElectron(['convert', 'nonexistent-file.mp4', 'output.mp4'], 15000);

    expect(result.status).toBe(4);
    expect(result.stderr).toBeTruthy();
  });

  it('should detect --cli flag and route to CLI', async () => {
    const result = await spawnElectron(['--cli', '--help'], 15000);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('EncodeX');
    expect(result.stdout).toContain('Usage');
  });

  it('should show media info as JSON with info --json', async () => {
    const result = await spawnElectron(['--cli', 'info', '--json', testMedia], 30000);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"file"');
    expect(result.stdout).toContain('"streams"');
  });

  it('should show media info as a human table by default', async () => {
    const result = await spawnElectron(['--cli', 'info', testMedia], 30000);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Format');
    expect(result.stdout).toContain('Duration');
  });

  it('should convert a file successfully', async () => {
    const outputPath = path.join(path.dirname(testMedia), 'converted-output.mp4');

    const result = await spawnElectron(['--cli', 'convert', testMedia, outputPath], 60000);

    expect(result.status).toBe(0);
    expect(fs.existsSync(outputPath)).toBe(true);
    expect(fs.statSync(outputPath).size).toBeGreaterThan(0);
    expect(result.stdout).toContain('Converted');
  });

  it('should convert with custom transcoder options', async () => {
    const outputPath = path.join(path.dirname(testMedia), 'custom-output.mp4');

    const result = await spawnElectron(['--cli', '--transcoder', 'FFMPEG', 'convert', '-v', 'libx264', '-a', 'aac', '--pix-fmt', 'yuv420p', testMedia, outputPath], 60000);

    expect(result.status).toBe(0);
    expect(fs.existsSync(outputPath)).toBe(true);
    expect(result.stdout).toContain('Converted');
  });

  it('should convert with the legacy flat syntax', async () => {
    const outputPath = path.join(path.dirname(testMedia), 'legacy-output.mp4');

    const result = await spawnElectron(['--cli', testMedia, outputPath], 60000);

    expect(result.status).toBe(0);
    expect(fs.existsSync(outputPath)).toBe(true);
    expect(result.stdout).toContain('Converted');
  });

  it('should convert with FFTOOL transcoder', async () => {
    const outputPath = path.join(path.dirname(testMedia), 'fftool-output.mp4');

    const result = await spawnElectron(['--cli', '--transcoder', 'FFTOOL', 'convert', testMedia, outputPath], 60000);

    expect(result.status).toBe(0);
    expect(fs.existsSync(outputPath)).toBe(true);
    expect(result.stdout).toContain('Converted');
  });

  it('should compress an image', async () => {
    const pngPath = path.join(path.dirname(testMedia), 'sample.png');
    const outputPath = path.join(path.dirname(testMedia), 'sample_compressed.jpg');

    if (!fs.existsSync(pngPath)) {
      const { spawnSync } = await import('child_process');
      spawnSync('ffmpeg', ['-f', 'lavfi', '-i', 'color=c=red:s=64x64', '-y', pngPath], { stdio: 'ignore' });
    }

    const result = await spawnElectron(['--cli', 'compress', pngPath, '-f', 'jpg'], 60000);

    expect(result.status).toBe(0);
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  it('should extract audio from a media file', async () => {
    const outputPath = path.join(path.dirname(testMedia), 'test-input.mp3');

    const result = await spawnElectron(['--cli', 'extract-audio', testMedia], 60000);

    expect(result.status).toBe(0);
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  it('should list capabilities', async () => {
    const result = await spawnElectron(['--cli', 'capabilities'], 30000);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Video encoders');
  });
});
