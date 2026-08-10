import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { generateTestMedia, generateTestImage, getBuildPaths, ensureBuildExists } from './helpers';

const electronBin = (() => {
  try {
    return require('electron') as string;
  } catch {
    return 'electron';
  }
})();

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

const EXIT = {
  SUCCESS: 0,
  ERROR: 1,
  USAGE: 2,
  CANCELLED: 3,
  NOT_FOUND: 4,
  TIMEOUT: 5,
} as const;

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

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });
  });
}

function runCli(args: string[], timeout: number): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return spawnElectron(['--cli', ...args], timeout);
}

function parseJsonFromStdout(stdout: string): unknown {
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error(`No JSON object found in stdout:\n${stdout}`);
  }
  return JSON.parse(stdout.slice(start, end + 1));
}

describe.runIf(IS_E2E)('CLI mode (subcommands)', () => {
  let tmpDir: string;
  let testMedia: string;
  let pngPath: string;
  let batchDir: string;
  let batchA: string;
  let batchB: string;
  let batchOut: string;

  beforeAll(() => {
    ensureBuildExists();

    if (process.env.E2E_SKIP_MEDIA !== 'true') {
      tmpDir = fs.mkdtempSync(path.join(__dirname, '..', 'e2e-media-'));
      testMedia = generateTestMedia(tmpDir);
      pngPath = generateTestImage(tmpDir);
      batchDir = path.join(tmpDir, 'batch');
      fs.mkdirSync(batchDir, { recursive: true });
      batchA = generateTestMedia(batchDir, 'alpha.mp4');
      batchB = generateTestMedia(batchDir, 'beta.mp4');
      batchOut = path.join(tmpDir, 'batch-out');
      fs.mkdirSync(batchOut, { recursive: true });
    }
  });

  afterAll(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('entry and help', () => {
    it('should show help text with --help flag', async () => {
      const result = await runCli(['--help'], 15000);

      expect(result.status).toBe(EXIT.SUCCESS);
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
      const result = await runCli(['-h'], 15000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(result.stdout).toContain('EncodeX');
    });

    it('should show help text when invoked with --cli and no subcommand', async () => {
      const result = await spawnElectron(['--cli'], 15000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(result.stdout).toContain('EncodeX');
      expect(result.stdout).toContain('Usage');
    });

    it('should show help text for every subcommand', async () => {
      const subcommands = ['convert', 'info', 'capabilities', 'compress', 'extract-audio', 'batch'];
      for (const sub of subcommands) {
        const result = await runCli([sub, '--help'], 15000);
        expect(result.status, `${sub} --help should exit 0`).toBe(EXIT.SUCCESS);
        expect(result.stdout, `${sub} --help should mention ${sub}`).toContain(sub);
      }
    });

    it('should exit with usage error for an unknown flag', async () => {
      const result = await runCli(['--bogus-flag'], 15000);

      expect(result.status).toBe(EXIT.USAGE);
      expect(result.stderr).toBeTruthy();
    });

    it('should treat a bare positional as legacy convert input (not-found exit)', async () => {
      const result = await runCli(['bogus-command'], 15000);

      expect(result.status).toBe(EXIT.NOT_FOUND);
      expect(result.stderr).toBeTruthy();
    });
  });

  describe('convert', () => {
    it('should convert a file with positional input and output', async () => {
      const outputPath = path.join(tmpDir, 'converted-output.mp4');

      const result = await runCli(['convert', testMedia, outputPath], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(fs.statSync(outputPath).size).toBeGreaterThan(0);
      expect(result.stdout).toContain('Converted');
    });

    it('should convert a file using -o/--output', async () => {
      const outputPath = path.join(tmpDir, 'output-flag.mp4');

      const result = await runCli(['convert', '-o', outputPath, testMedia], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(fs.statSync(outputPath).size).toBeGreaterThan(0);
    });

    it('should derive an output name when none is given', async () => {
      const derivedPath = path.join(tmpDir, 'test-input_converted.mkv');

      const result = await runCli(['convert', testMedia], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(derivedPath)).toBe(true);
      expect(fs.statSync(derivedPath).size).toBeGreaterThan(0);
    });

    it('should convert with codec, bitrate, pix-fmt, scale and qscale options', async () => {
      const outputPath = path.join(tmpDir, 'custom-output.mp4');

      const result = await runCli(
        [
          'convert',
          '-v',
          'libx264',
          '-a',
          'aac',
          '--bitrate-video',
          '200k',
          '--bitrate-audio',
          '96k',
          '--pix-fmt',
          'yuv420p',
          '-s',
          '160x120',
          '-q',
          '28',
          testMedia,
          outputPath,
        ],
        60000,
      );

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(fs.statSync(outputPath).size).toBeGreaterThan(0);
      expect(result.stdout).toContain('Converted');
    });

    it('should perform a lossless copy with --copy', async () => {
      const outputPath = path.join(tmpDir, 'copy-output.mp4');

      const result = await runCli(['convert', '--copy', testMedia, outputPath], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(fs.statSync(outputPath).size).toBeGreaterThan(0);
    });

    it('should drop audio with --no-audio', async () => {
      const outputPath = path.join(tmpDir, 'no-audio-output.mp4');

      const result = await runCli(['convert', '--no-audio', testMedia, outputPath], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(fs.statSync(outputPath).size).toBeGreaterThan(0);
    });

    it('should drop video with --no-video', async () => {
      const outputPath = path.join(tmpDir, 'no-video-output.m4a');

      const result = await runCli(['convert', '--no-video', testMedia, outputPath], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(fs.statSync(outputPath).size).toBeGreaterThan(0);
    });

    it('should trim with --duration', async () => {
      const outputPath = path.join(tmpDir, 'duration-output.mp4');

      const result = await runCli(['convert', '--duration', '0.5', testMedia, outputPath], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(fs.statSync(outputPath).size).toBeGreaterThan(0);
    });

    it('should trim with --start-time and --end-time', async () => {
      const outputPath = path.join(tmpDir, 'trim-output.mp4');

      const result = await runCli(['convert', '--start-time', '0', '--end-time', '0.5', testMedia, outputPath], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(fs.statSync(outputPath).size).toBeGreaterThan(0);
    });

    it('should print media info with convert --info without creating output', async () => {
      const result = await runCli(['convert', '--info', testMedia], 30000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(result.stdout).toContain('Format');
      expect(result.stdout).toContain('Duration');
    });

    it('should print media info as JSON with convert --info --json', async () => {
      const result = await runCli(['convert', '--info', '--json', testMedia], 30000);

      expect(result.status).toBe(EXIT.SUCCESS);
      const parsed = parseJsonFromStdout(result.stdout) as { file?: string; streams?: unknown[] };
      expect(parsed.file).toBeTruthy();
      expect(Array.isArray(parsed.streams)).toBe(true);
    });

    it('should convert with the FFTOOL transcoder', async () => {
      const outputPath = path.join(tmpDir, 'fftool-output.mp4');

      const result = await runCli(['--transcoder', 'FFTOOL', 'convert', testMedia, outputPath], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(fs.statSync(outputPath).size).toBeGreaterThan(0);
      expect(result.stdout).toContain('Converted');
    });

    it('should fall back to the default transcoder for an unknown --transcoder value', async () => {
      const outputPath = path.join(tmpDir, 'fallback-transcoder-output.mp4');

      const result = await runCli(['--transcoder', 'BOGUS', 'convert', testMedia, outputPath], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(fs.statSync(outputPath).size).toBeGreaterThan(0);
    });

    it('should convert with the legacy flat syntax', async () => {
      const outputPath = path.join(tmpDir, 'legacy-output.mp4');

      const result = await spawnElectron(['--cli', testMedia, outputPath], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(result.stdout).toContain('Converted');
    });

    it('should exit with not-found error for a missing input file', async () => {
      const result = await runCli(['convert', path.join(tmpDir, 'nonexistent-file.mp4'), 'output.mp4'], 15000);

      expect(result.status).toBe(EXIT.NOT_FOUND);
      expect(result.stderr).toBeTruthy();
    });

    it('should exit with usage error when no input is given', async () => {
      const result = await runCli(['convert'], 15000);

      expect(result.status).toBe(EXIT.USAGE);
      expect(result.stderr).toBeTruthy();
    });

    it('should exit with a timeout error when --timeout is exceeded', async () => {
      const outputPath = path.join(tmpDir, 'timeout-output.mp4');

      const result = await runCli(['--timeout', '0.001', 'convert', testMedia, outputPath], 15000);

      expect(result.status).toBe(EXIT.TIMEOUT);
      expect(result.stderr).toBeTruthy();
    });
  });

  describe('info', () => {
    it('should show media info as a human table by default', async () => {
      const result = await runCli(['info', testMedia], 30000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(result.stdout).toContain('Format');
      expect(result.stdout).toContain('Duration');
    });

    it('should show media info as parseable JSON with --json', async () => {
      const result = await runCli(['info', '--json', testMedia], 30000);

      expect(result.status).toBe(EXIT.SUCCESS);
      const parsed = parseJsonFromStdout(result.stdout) as { file?: string; streams?: unknown[]; format?: string };
      expect(parsed.file).toBeTruthy();
      expect(typeof parsed.format).toBe('string');
      expect(Array.isArray(parsed.streams)).toBe(true);
      expect((parsed.streams as unknown[]).length).toBeGreaterThan(0);
    });

    it('should exit with an error for a missing input file', async () => {
      const result = await runCli(['info', path.join(tmpDir, 'nonexistent-file.mp4')], 15000);

      expect(result.status).toBe(EXIT.ERROR);
      expect(result.stderr).toBeTruthy();
    });
  });

  describe('capabilities', () => {
    it('should list encoder capabilities as a human table by default', async () => {
      const result = await runCli(['capabilities'], 30000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(result.stdout).toContain('Video encoders');
    });

    it('should list encoder capabilities as parseable JSON with --json', async () => {
      const result = await runCli(['capabilities', '--json'], 30000);

      expect(result.status).toBe(EXIT.SUCCESS);
      const parsed = parseJsonFromStdout(result.stdout) as {
        videoEncoders?: string[];
        audioEncoders?: string[];
        hwaccels?: string[];
      };
      expect(Array.isArray(parsed.videoEncoders)).toBe(true);
      expect(parsed.videoEncoders).toContain('libx264');
      expect(parsed.audioEncoders).toContain('aac');
      expect(Array.isArray(parsed.hwaccels)).toBe(true);
    });
  });

  describe('compress', () => {
    it('should compress a png into a jpg', async () => {
      const outputPath = path.join(tmpDir, 'sample_compressed.jpg');

      const result = await runCli(['compress', pngPath, '-f', 'jpg'], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(fs.statSync(outputPath).size).toBeGreaterThan(0);
    });

    it('should compress with -o output, -q quality and -s scale options', async () => {
      const outputPath = path.join(tmpDir, 'compressed-scaled.jpg');

      const result = await runCli(['compress', pngPath, '-o', outputPath, '-q', '20', '-s', '32x32'], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(fs.statSync(outputPath).size).toBeGreaterThan(0);
    });

    it('should exit with not-found error for a missing input image', async () => {
      const result = await runCli(['compress', path.join(tmpDir, 'nonexistent.png')], 15000);

      expect(result.status).toBe(EXIT.NOT_FOUND);
      expect(result.stderr).toBeTruthy();
    });
  });

  describe('extract-audio', () => {
    it('should extract the audio track with a derived output name', async () => {
      const outputPath = path.join(tmpDir, 'test-input.mp3');

      const result = await runCli(['extract-audio', testMedia], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(fs.statSync(outputPath).size).toBeGreaterThan(0);
    });

    it('should extract audio with -o output, -a codec and --bitrate-audio options', async () => {
      const outputPath = path.join(tmpDir, 'extracted-options.mp3');

      const result = await runCli(['extract-audio', testMedia, '-o', outputPath, '-a', 'libmp3lame', '--bitrate-audio', '128k'], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(fs.statSync(outputPath).size).toBeGreaterThan(0);
    });

    it('should support the audio alias', async () => {
      const outputPath = path.join(tmpDir, 'aliased-output.mp3');

      const result = await runCli(['audio', testMedia, '-o', outputPath], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(fs.statSync(outputPath).size).toBeGreaterThan(0);
    });

    it('should exit with not-found error for a missing input file', async () => {
      const result = await runCli(['extract-audio', path.join(tmpDir, 'nonexistent-file.mp4')], 15000);

      expect(result.status).toBe(EXIT.NOT_FOUND);
      expect(result.stderr).toBeTruthy();
    });
  });

  describe('batch', () => {
    it('should convert multiple files with derived outputs', async () => {
      const outputA = path.join(batchDir, 'alpha_converted.mkv');
      const outputB = path.join(batchDir, 'beta_converted.mkv');

      const result = await runCli(['batch', batchA, batchB], 120000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputA)).toBe(true);
      expect(fs.existsSync(outputB)).toBe(true);
      expect(result.stdout).toContain('Batch:');
    });

    it('should convert glob patterns into --output-dir with --concurrency', async () => {
      const globPattern = path.join(batchDir, '*.mp4');
      const outputA = path.join(batchOut, 'alpha_converted.mkv');
      const outputB = path.join(batchOut, 'beta_converted.mkv');

      const result = await runCli(['batch', globPattern, '--output-dir', batchOut, '--concurrency', '2'], 120000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputA)).toBe(true);
      expect(fs.existsSync(outputB)).toBe(true);
    });

    it('should apply a custom --suffix to derived outputs', async () => {
      const outputA = path.join(batchDir, 'alpha_out.mkv');
      const outputB = path.join(batchDir, 'beta_out.mkv');

      const result = await runCli(['batch', batchA, batchB, '--suffix', '_out'], 120000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputA)).toBe(true);
      expect(fs.existsSync(outputB)).toBe(true);
    });

    it('should exit with not-found error when no inputs match', async () => {
      const result = await runCli(['batch', path.join(batchDir, 'no-such-*.xyz')], 15000);

      expect(result.status).toBe(EXIT.NOT_FOUND);
      expect(result.stderr).toBeTruthy();
    });
  });

  describe('global flags', () => {
    it('should suppress status output with --quiet', async () => {
      const result = await runCli(['--quiet', 'info', testMedia], 30000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(result.stdout).not.toContain('Format');
      expect(result.stdout).not.toContain('Duration');
    });

    it('should disable colors with --no-color', async () => {
      const outputPath = path.join(tmpDir, 'no-color-output.mp4');

      const result = await runCli(['--no-color', 'convert', testMedia, outputPath], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(result.stdout).not.toContain('\x1b[38;2;');
    });

    it('should accept a --theme value', async () => {
      const result = await runCli(['--theme', 'ocean', 'info', testMedia], 30000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(result.stdout).toContain('Format');
    });
  });
});
