/**
 * @fileoverview Integration tests for the CLI handlers against the real FFmpeg
 * backends (`ffmpeg-static` / `ffprobe-static`). Unlike the mocked unit tests,
 * these exercise the actual conversion, probing, compression, extraction, and
 * batch pipelines end-to-end in-process — without launching Electron.
 *
 * Run with: `npm run test:integration` (see vitest.integration.config.ts).
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { createCliTranscoder, runConvert } from '../cli-convert';
import { runInfo, runCapabilities } from '../cli-info';
import { runCompress, runExtractAudio } from '../cli-compress';
import { runBatch } from '../cli-batch';
import { configureCliOutput } from '../cli-ui';
import { CliExitError } from '../cli-options';
import { ErrorCode } from '../../../shared/errors';
import { CLI_EXIT_TIMEOUT, CLI_EXIT_NOT_FOUND } from '../../../shared/constants';
import { DEFAULT_CLI_THEME } from '../../cli-logo';
import type { ITranscoder } from '../../transcoders/types';

const ffmpegStatic = require('ffmpeg-static') as string;
const theme = DEFAULT_CLI_THEME;

let tmpDir: string;
let videoPath: string;
let imagePath: string;

function run(cmd: string, args: string[], cwd?: string): number {
  const result = spawnSync(cmd, args, { cwd, stdio: 'ignore', timeout: 60000 });
  return result.status ?? -1;
}

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-cli-integration-'));
  videoPath = path.join(tmpDir, 'input.mp4');
  imagePath = path.join(tmpDir, 'input.png');

  const videoOk = run(ffmpegStatic, [
    '-f',
    'lavfi',
    '-i',
    'testsrc=duration=1:size=320x240:rate=10',
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
    videoPath,
  ]);

  const imageOk = run(ffmpegStatic, ['-f', 'lavfi', '-i', 'color=c=red:s=64x64', '-frames:v', '1', '-y', imagePath]);

  if (videoOk !== 0 || imageOk !== 0 || !fs.existsSync(videoPath) || !fs.existsSync(imagePath)) {
    throw new Error('Failed to generate test media with ffmpeg-static');
  }
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('runConvert (real FFmpeg)', () => {
  it('converts an mp4 to a new output file with the FFMPEG backend', async () => {
    const output = path.join(tmpDir, 'converted.mp4');
    const transcoder = createCliTranscoder('FFMPEG');

    await runConvertFor({ transcoder, input: videoPath, output });

    expect(fs.existsSync(output)).toBe(true);
    expect(fs.statSync(output).size).toBeGreaterThan(0);
  });

  it('converts with the FFTOOL backend and a derived output name', async () => {
    const transcoder = createCliTranscoder('FFTOOL');
    const output = path.join(tmpDir, 'fftool-converted.mp4');

    await runConvertFor({ transcoder, input: videoPath, output });

    expect(fs.existsSync(output)).toBe(true);
    expect(fs.statSync(output).size).toBeGreaterThan(0);
  });

  it('performs a lossless stream copy with --copy', async () => {
    const transcoder = createCliTranscoder('FFMPEG');
    const output = path.join(tmpDir, 'copy.mkv');

    await runConvertFor({ transcoder, input: videoPath, output, flags: { copy: true } });

    expect(fs.existsSync(output)).toBe(true);
    expect(fs.statSync(output).size).toBeGreaterThan(0);
  });

  it('drops the video stream with --no-video', async () => {
    const transcoder = createCliTranscoder('FFMPEG');
    const output = path.join(tmpDir, 'audio-only.m4a');

    await runConvertFor({ transcoder, input: videoPath, output, flags: { video: false, audioCodec: 'aac' } });

    expect(fs.existsSync(output)).toBe(true);
    expect(fs.statSync(output).size).toBeGreaterThan(0);
  });

  it('scales the video with -s', async () => {
    const transcoder = createCliTranscoder('FFMPEG');
    const output = path.join(tmpDir, 'scaled.mp4');

    await runConvertFor({ transcoder, input: videoPath, output, flags: { scale: '160x120' } });

    expect(fs.existsSync(output)).toBe(true);
    expect(fs.statSync(output).size).toBeGreaterThan(0);
  });

  it('trims with --duration', async () => {
    const transcoder = createCliTranscoder('FFMPEG');
    const output = path.join(tmpDir, 'trimmed.mp4');

    await runConvertFor({ transcoder, input: videoPath, output, flags: { duration: '0.5' } });

    expect(fs.existsSync(output)).toBe(true);
    expect(fs.statSync(output).size).toBeGreaterThan(0);
  });

  it('throws FILE_NOT_FOUND for a missing input', async () => {
    const transcoder = createCliTranscoder('FFMPEG');

    await expect(
      runConvertFor({ transcoder, input: path.join(tmpDir, 'missing.mp4'), output: path.join(tmpDir, 'never.mp4') }),
    ).rejects.toMatchObject({ code: ErrorCode.FILE_NOT_FOUND });
  });

  it('rejects with a timeout CliExitError when the conversion exceeds the timeout', async () => {
    const transcoder = createCliTranscoder('FFMPEG');

    await expect(
      runConvertFor({ transcoder, input: videoPath, output: path.join(tmpDir, 'timeout.mp4'), timeoutSeconds: 0.001 }),
    ).rejects.toMatchObject({ exitCode: CLI_EXIT_TIMEOUT });
  });
});

describe('runInfo / runCapabilities (real FFmpeg)', () => {
  it('prints media info as JSON on stdout when json=true', async () => {
    const transcoder = createCliTranscoder('FFMPEG');
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await runInfo(transcoder, videoPath, true, theme);

    const written = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    stdoutSpy.mockRestore();
    const parsed = JSON.parse(written);
    expect(parsed.streams.length).toBeGreaterThan(0);
    expect(typeof parsed.format).toBe('string');
  });

  it('prints media info as a human table by default', async () => {
    const transcoder = createCliTranscoder('FFMPEG');
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await runInfo(transcoder, videoPath, false, theme);

    const written = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    stdoutSpy.mockRestore();
    expect(written).toContain('Format');
    expect(written).toContain('Duration');
  });

  it('lists encoder capabilities as JSON on stdout', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await runCapabilities(true, theme);

    const written = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    stdoutSpy.mockRestore();
    const parsed = JSON.parse(written);
    expect(parsed.videoEncoders).toContain('libx264');
    expect(parsed.audioEncoders).toContain('aac');
  });
});

describe('runCompress / runExtractAudio (real FFmpeg)', () => {
  it('compresses a png into a jpg', async () => {
    const transcoder = createCliTranscoder('FFMPEG');
    const output = path.join(tmpDir, 'compressed.jpg');

    await runCompress(imagePath, { output, format: 'jpg' }, transcoder, 60, theme);

    expect(fs.existsSync(output)).toBe(true);
    expect(fs.statSync(output).size).toBeGreaterThan(0);
  });

  it('extracts the audio track to mp3', async () => {
    const transcoder = createCliTranscoder('FFMPEG');
    const output = path.join(tmpDir, 'extracted.mp3');

    await runExtractAudio(videoPath, { output, audioCodec: 'libmp3lame' }, transcoder, 60, theme);

    expect(fs.existsSync(output)).toBe(true);
    expect(fs.statSync(output).size).toBeGreaterThan(0);
  });
});

describe('runBatch (real FFmpeg)', () => {
  it('converts multiple inputs with concurrency and derives outputs', async () => {
    const second = path.join(tmpDir, 'second.mp4');
    run(ffmpegStatic, [
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=1:size=160x120:rate=10',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=330:duration=1',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-shortest',
      '-y',
      second,
    ]);
    const outDir = path.join(tmpDir, 'batch-out');
    fs.mkdirSync(outDir, { recursive: true });

    await runBatch({
      inputs: [videoPath, second],
      outputDir: outDir,
      flags: {},
      transcoder: 'FFMPEG',
      concurrency: 2,
      timeoutSeconds: 60,
      themeId: theme,
    });

    expect(fs.existsSync(path.join(outDir, 'input_encodex_converted.mkv'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'second_encodex_converted.mkv'))).toBe(true);
  });

  it('applies a custom suffix to outputs with and without --output-dir', async () => {
    const second = path.join(tmpDir, 'second.mp4');
    run(ffmpegStatic, [
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=1:size=160x120:rate=10',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=330:duration=1',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-shortest',
      '-y',
      second,
    ]);
    const outDir = path.join(tmpDir, 'batch-suffix-out');
    fs.mkdirSync(outDir, { recursive: true });

    await runBatch({
      inputs: [videoPath, second],
      outputDir: outDir,
      suffix: '_out',
      flags: {},
      transcoder: 'FFMPEG',
      concurrency: 2,
      timeoutSeconds: 60,
      themeId: theme,
    });
    await runBatch({
      inputs: [videoPath, second],
      suffix: '_out',
      flags: {},
      transcoder: 'FFMPEG',
      concurrency: 2,
      timeoutSeconds: 60,
      themeId: theme,
    });

    expect(fs.existsSync(path.join(outDir, 'input_out.mkv'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'second_out.mkv'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'input_out.mkv'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'second_out.mkv'))).toBe(true);
  });

  it('throws NOT_FOUND CliExitError when no inputs match', async () => {
    await expect(
      runBatch({
        inputs: [path.join(tmpDir, 'no-such-*.xyz')],
        flags: {},
        transcoder: 'FFMPEG',
        concurrency: 1,
        timeoutSeconds: 60,
        themeId: theme,
      }),
    ).rejects.toMatchObject({ exitCode: CLI_EXIT_NOT_FOUND });
  });
});

async function runConvertFor(params: {
  transcoder: ITranscoder;
  input: string;
  output: string;
  flags?: Record<string, unknown>;
  timeoutSeconds?: number;
}): Promise<void> {
  const { transcoder, input, output, flags = {}, timeoutSeconds = 60 } = params;
  await runConvert({
    input,
    output,
    flags: flags as never,
    transcoder,
    timeoutSeconds,
    themeId: theme,
  });
}
