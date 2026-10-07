import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import {
  generateTestMedia,
  generateTestImage,
  generateTestJpeg,
  generateTestAudio,
  generateTestSubtitle,
  generateTestChapters,
  generateTestDemuxSource,
  readContainerMagic,
  getBuildPaths,
  ensureBuildExists,
} from './helpers';

const electronBin = (() => {
  try {
    return require('electron') as string;
  } catch {
    return 'electron';
  }
})();

const ffprobeBin = (require('ffprobe-static') as { path: string }).path;

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
  // CLI mode never touches the GPU; disabling it avoids random access-violation
  // crashes (0xC0000005) from Chromium's GPU process when many short-lived
  // Electron instances are spawned in sequence on Windows.
  return ['--no-sandbox', '--disable-gpu', ...baseArgs];
}

interface SpawnResult {
  status: number | null;
  stdout: string;
  stderr: string;
  /**
   * True only when the harness timeout killed the child before it exited on its
   * own (a `status` of `null`). Distinguishes a starved Electron boot from a
   * process that exited abnormally, which `status: null` alone cannot.
   */
  timedOut: boolean;
}

function spawnElectron(args: string[], timeout: number): Promise<SpawnResult> {
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
      resolve({ status: null, stdout, stderr, timedOut });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ status: timedOut ? null : code, stdout, stderr, timedOut });
    });

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });
  });
}

/**
 * Runs a CLI subcommand in a fresh Electron instance.
 *
 * `retries` re-invokes the command only when the harness timeout killed the
 * child before it booted - the starved-boot signature on a heavily loaded
 * machine. It MUST only be passed to fast-exit commands with no side effects
 * (no output file is written): a `convert`/`batch` test that times out may be
 * mid-write and must not be re-run into the same path.
 * @param {string[]} args - Extra CLI arguments after `--cli`.
 * @param {number} timeout - Per-attempt kill timeout in milliseconds.
 * @param {number} [retries] - Extra attempts after a timeout-kill (default 0).
 * @returns {Promise<SpawnResult>} The last attempt's result.
 */
async function runCli(args: string[], timeout: number, retries = 0): Promise<SpawnResult> {
  let result = await spawnElectron(['--cli', ...args], timeout);
  for (let attempt = 0; result.timedOut && attempt < retries; attempt += 1) {
    result = await spawnElectron(['--cli', ...args], timeout);
  }
  return result;
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
  let remuxSource: string;
  let demuxSource: string;
  let coverJpeg: string;
  let extraAudio: string;
  let extraSubtitle: string;
  let extraChapters: string;
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
      remuxSource = generateTestMedia(tmpDir, 'remux-source.mkv');
      demuxSource = generateTestDemuxSource(tmpDir);
      coverJpeg = generateTestJpeg(tmpDir);
      extraAudio = generateTestAudio(tmpDir);
      extraSubtitle = generateTestSubtitle(tmpDir);
      extraChapters = generateTestChapters(tmpDir);
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
      expect(result.stdout).toContain('remux');
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
      const subcommands = ['convert', 'info', 'capabilities', 'compress', 'extract-audio', 'remux', 'demux', 'batch'];
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

    it('should apply --filters and rewrite the frame rate to 24 fps', async () => {
      const outputPath = path.join(tmpDir, 'filtered-output.mp4');

      const result = await runCli(['convert', '--filters', 'fps=24', testMedia, outputPath], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputPath)).toBe(true);
      const probe = spawnSync(
        ffprobeBin,
        ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', outputPath],
        { encoding: 'utf8', timeout: 30000 },
      );
      expect(probe.stdout.trim()).toBe('24/1');
    });

    it('should expand --preset grayscale into the hue filter chain', async () => {
      const outputPath = path.join(tmpDir, 'preset-output.mp4');

      const result = await runCli(['convert', '--verbose', '--preset', 'grayscale', testMedia, outputPath], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(result.stdout).toContain('hue=s=0');
    });

    it('should reject --filters combined with --copy as a usage error', async () => {
      const outputPath = path.join(tmpDir, 'never-copy-filtered.mp4');

      const result = await runCli(['convert', '--filters', 'fps=24', '--copy', testMedia, outputPath], 30000);

      expect(result.status).toBe(EXIT.USAGE);
      expect(result.stderr).toMatch(/re-encod/i);
      expect(fs.existsSync(outputPath)).toBe(false);
    });

    it('should reject an unknown --preset as a usage error', async () => {
      // Fast-exit command: the preset id is validated in memory before any
      // ffmpeg spawn, so a `status: null` can only mean the harness timeout
      // killed a starved Electron boot rather than a real hang. The bounded
      // retry absorbs that environmental hiccup without touching a file output;
      // the assertion still requires a genuine usage exit code (2).
      const result = await runCli(['convert', '--preset', 'bogus', testMedia, 'out.mp4'], 15000, 2);

      expect(result.status).toBe(EXIT.USAGE);
      expect(result.stderr).toMatch(/preset/i);
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

  describe('remux', () => {
    it('should stream-copy an MKV into an MP4 with a derived output name', async () => {
      const derivedPath = path.join(tmpDir, 'remux-source.mp4');

      const result = await runCli(['remux', remuxSource, '-f', 'mp4'], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(derivedPath)).toBe(true);
      expect(readContainerMagic(derivedPath).slice(8, 16)).toBe('66747970');
      expect(result.stdout).toContain('Remuxed');
    });

    it('should honour -o/--output and the rmx alias', async () => {
      const outputPath = path.join(tmpDir, 'remux-aliased.mp4');

      const result = await runCli(['rmx', remuxSource, '-o', outputPath], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(readContainerMagic(outputPath).slice(8, 16)).toBe('66747970');
    });

    it('should add an external audio track with --add-audio', async () => {
      const outputPath = path.join(tmpDir, 'remux-add-audio.mkv');

      const result = await runCli(['remux', remuxSource, '-o', outputPath, '--add-audio', extraAudio], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputPath)).toBe(true);
      const probe = spawnSync(
        ffprobeBin,
        ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', outputPath],
        {
          encoding: 'utf8',
          timeout: 30000,
        },
      );
      expect(probe.stdout.trim().split('\n').filter(Boolean)).toHaveLength(2);
    });

    it('should add a subtitle, cover art and chapters in one run', async () => {
      const outputPath = path.join(tmpDir, 'remux-assets.mkv');

      const result = await runCli(
        [
          'remux',
          remuxSource,
          '-o',
          outputPath,
          '--add-subtitle',
          `${extraSubtitle}::srt`,
          '--set-sync',
          '0.25',
          '--thumbnail',
          coverJpeg,
          '--chapters',
          extraChapters,
        ],
        60000,
      );

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputPath)).toBe(true);
      const probe = spawnSync(
        ffprobeBin,
        ['-v', 'error', '-show_entries', 'stream=codec_type:stream_disposition=attached_pic', '-show_chapters', '-of', 'json', outputPath],
        { encoding: 'utf8', timeout: 30000 },
      );
      const parsed = JSON.parse(probe.stdout) as {
        streams?: Array<{ codec_type: string; disposition?: { attached_pic?: number } }>;
        chapters?: unknown[];
      };
      expect(parsed.streams?.filter((s) => s.codec_type === 'subtitle')).toHaveLength(1);
      expect(parsed.streams?.filter((s) => s.disposition?.attached_pic === 1)).toHaveLength(1);
      expect(parsed.chapters).toHaveLength(1);
    });

    it('should shift the primary audio with --audio-sync', async () => {
      const outputPath = path.join(tmpDir, 'remux-audio-sync.mkv');

      const result = await runCli(['remux', remuxSource, '-o', outputPath, '--audio-sync', '0.5'], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputPath)).toBe(true);
      const probe = spawnSync(
        ffprobeBin,
        ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=start_time', '-of', 'csv=p=0', outputPath],
        {
          encoding: 'utf8',
          timeout: 30000,
        },
      );
      const startTimes = probe.stdout.trim().split('\n').filter(Boolean).map(Number);
      expect(startTimes).toHaveLength(1);
      expect(startTimes[0]).toBeGreaterThanOrEqual(0.4);
    });

    it('should exit with usage error for a container that cannot hold a selected stream', async () => {
      const result = await runCli(['remux', remuxSource, '-f', 'webm', '--map', '0:v:0'], 30000);

      expect(result.status).toBe(EXIT.USAGE);
      expect(fs.existsSync(path.join(tmpDir, 'remux-source.webm'))).toBe(false);
    });

    it('should exit with not-found error for a missing auxiliary input', async () => {
      const result = await runCli(
        ['remux', remuxSource, '-o', path.join(tmpDir, 'never.mkv'), '--add-audio', path.join(tmpDir, 'no-such.m4a')],
        30000,
      );

      expect(result.status).toBe(EXIT.NOT_FOUND);
      expect(result.stderr).toBeTruthy();
    });
  });

  describe('demux', () => {
    /**
     * Creates an isolated output directory for one demux test.
     * @param {string} name - Directory name.
     * @returns {string} The created directory path.
     */
    function demuxOutDir(name: string): string {
      const dir = path.join(tmpDir, name);
      fs.mkdirSync(dir, { recursive: true });
      return dir;
    }

    it('should extract every stream kind into a new output directory', async () => {
      const outDir = path.join(tmpDir, 'demux-all-missing');

      const result = await runCli(['demux', demuxSource, '--output-dir', outDir], 120000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outDir)).toBe(true);
      const videoPath = path.join(outDir, 'demux-source.video.mp4');
      const audioPath = path.join(outDir, 'demux-source.audio_0.m4a');
      const subtitlePath = path.join(outDir, 'demux-source.subtitle_0.srt');
      expect(fs.existsSync(videoPath)).toBe(true);
      expect(fs.existsSync(audioPath)).toBe(true);
      expect(fs.existsSync(subtitlePath)).toBe(true);
      expect(readContainerMagic(videoPath).slice(8, 16)).toBe('66747970');
      expect(result.stdout).toContain(videoPath);
      expect(result.stdout).toContain(audioPath);
      expect(result.stdout).toContain(subtitlePath);
    });

    it('should honour the split alias and write next to the input by default', async () => {
      const sourceDir = demuxOutDir('demux-default-dir');
      const source = generateTestDemuxSource(sourceDir, 'local-source.mkv');

      const result = await runCli(['split', source, '--video'], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(path.join(sourceDir, 'local-source.video.mp4'))).toBe(true);
    });

    it('should extract only the requested kinds', async () => {
      const outDir = demuxOutDir('demux-audio-only');

      const result = await runCli(['demux', demuxSource, '--output-dir', outDir, '--audio'], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.readdirSync(outDir)).toEqual(['demux-source.audio_0.m4a']);
    });

    it('should re-encode audio with --audio-codec', async () => {
      const outDir = demuxOutDir('demux-audio-mp3');

      const result = await runCli(['demux', demuxSource, '--output-dir', outDir, '--audio', '--audio-codec', 'mp3'], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      const audioPath = path.join(outDir, 'demux-source.audio_0.mp3');
      expect(fs.existsSync(audioPath)).toBe(true);
      const probe = spawnSync(ffprobeBin, ['-v', 'error', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', audioPath], {
        encoding: 'utf8',
        timeout: 30000,
      });
      expect(probe.stdout.trim()).toBe('mp3');
    });

    it('should convert subtitles with --subtitle-format', async () => {
      const outDir = demuxOutDir('demux-subs-ass');

      const result = await runCli(['demux', demuxSource, '--output-dir', outDir, '--subtitles', '--subtitle-format', 'ass'], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      const subtitlePath = path.join(outDir, 'demux-source.subtitle_0.ass');
      expect(fs.existsSync(subtitlePath)).toBe(true);
      expect(fs.readFileSync(subtitlePath, 'utf8')).toContain('EncodeX e2e subtitle');
    });

    it('should re-encode video with --video-container', async () => {
      const outDir = demuxOutDir('demux-video-mkv');

      const result = await runCli(['demux', demuxSource, '--output-dir', outDir, '--video', '--video-container', 'mkv'], 60000);

      expect(result.status).toBe(EXIT.SUCCESS);
      const videoPath = path.join(outDir, 'demux-source.video.mkv');
      expect(fs.existsSync(videoPath)).toBe(true);
      expect(readContainerMagic(videoPath).startsWith('1a45dfa3')).toBe(true);
    });

    it('should exit with usage error when a kind filter matches no stream', async () => {
      const result = await runCli(['demux', remuxSource, '--output-dir', demuxOutDir('demux-empty'), '--subtitles'], 30000);

      expect(result.status).toBe(EXIT.USAGE);
    });

    it('should exit with not-found error for a missing input', async () => {
      const result = await runCli(['demux', path.join(tmpDir, 'no-such-source.mkv')], 30000);

      expect(result.status).toBe(EXIT.NOT_FOUND);
    });
  });

  describe('batch', () => {
    it('should convert multiple files with derived outputs', async () => {
      const outputA = path.join(batchDir, 'alpha_encodex_converted.mkv');
      const outputB = path.join(batchDir, 'beta_encodex_converted.mkv');

      const result = await runCli(['batch', batchA, batchB], 120000);

      expect(result.status).toBe(EXIT.SUCCESS);
      expect(fs.existsSync(outputA)).toBe(true);
      expect(fs.existsSync(outputB)).toBe(true);
      expect(result.stdout).toContain('Batch:');
    });

    it('should convert glob patterns into --output-dir with --concurrency', async () => {
      const globPattern = path.join(batchDir, '*.mp4');
      const outputA = path.join(batchOut, 'alpha_encodex_converted.mkv');
      const outputB = path.join(batchOut, 'beta_encodex_converted.mkv');

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
