/**
 * @fileoverview Conversion throughput performance benchmark.
 * Measures encoding speed, wall time, and memory across codec/resolution
 * combinations using direct FFmpeg CLI invocations (no Electron dependency).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { Timer, memorySnapshot, fixturePath, hasFixture, writeResults, logSummary, formatBytes } from './test-utils';
import type { PerfResult } from './test-utils';

const ffmpegPath = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('ffmpeg-static') as string;
  } catch {
    return 'ffmpeg';
  }
})();

const FIXTURE_10S_1080P = fixturePath('test-10s-1080p');
const FIXTURE_5S_1080P = fixturePath('test-5s-1080p');

function runFfmpeg(args: string[], timeoutMs = 120_000): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    const timer = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error('timeout')); }, timeoutMs);
    proc.on('close', (code) => { clearTimeout(timer); resolve({ code: code ?? 1, stderr }); });
    proc.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

function fileExists(p: string): boolean {
  try { return fs.statSync(p).size > 0; } catch { return false; }
}

interface ConversionResult {
  codec: string;
  durationMs: number;
  realTimeFactor: number;
  outputSize: number;
  memBefore: ReturnType<typeof memorySnapshot>;
  memAfter: ReturnType<typeof memorySnapshot>;
}

async function benchmarkConversion(
  input: string,
  output: string,
  codec: string,
  extraArgs: string[] = [],
): Promise<ConversionResult> {
  const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', input,
    '-c:v', codec,
    '-c:a', 'aac',
    '-preset', 'ultrafast',
    ...extraArgs,
    output,
  ];

  const memBefore = memorySnapshot();
  const timer = new Timer();
  const { code } = await runFfmpeg(args);
  const durationMs = timer.elapsedMs();
  const memAfter = memorySnapshot();

  if (code !== 0) throw new Error(`FFmpeg exited with code ${code}`);

  const outputSize = fs.statSync(output).size;
  // Parse input duration for real-time factor
  const inputSize = fs.statSync(input).size;
  const realTimeFactor = inputSize > 0 ? (outputSize / inputSize) : 0;

  return { codec, durationMs, realTimeFactor, outputSize, memBefore, memAfter };
}

describe('Conversion Throughput Benchmark', () => {
  const results: PerfResult[] = [];
  const tmpOutputs: string[] = [];

  afterAll(() => {
    // Cleanup temp files
    for (const f of tmpOutputs) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
    const filePath = writeResults('phase1-conversion', results);
    logSummary(results);
    console.log(`Results written to: ${filePath}`);
  });

  it('should have test fixtures available', () => {
    expect(hasFixture('test-10s-1080p')).toBe(true);
    expect(hasFixture('test-5s-1080p')).toBe(true);
  });

  it('should benchmark H.264 1080p conversion', async () => {
    const output = path.join(path.dirname(FIXTURE_10S_1080P), 'perf-out-h264-1080p.mp4');
    tmpOutputs.push(output);

    const result = await benchmarkConversion(FIXTURE_10S_1080P, output, 'libx264');

    console.log(`  H.264 1080p: ${result.durationMs.toFixed(0)}ms, output: ${formatBytes(result.outputSize)}`);
    console.log(`  Memory: RSS delta ${formatBytes(result.memAfter.rss - result.memBefore.rss)}`);

    const passed = result.durationMs < 60_000; // Should complete within 60s
    results.push({
      test: 'H.264 1080p conversion',
      phase: 'phase1-conversion',
      durationMs: result.durationMs,
      memoryBefore: { rss: result.memBefore.rss, heapUsed: result.memBefore.heapUsed },
      memoryAfter: { rss: result.memAfter.rss, heapUsed: result.memAfter.heapUsed },
      memoryDeltaRss: result.memAfter.rss - result.memBefore.rss,
      memoryDeltaHeap: result.memAfter.heapUsed - result.memBefore.heapUsed,
      passed,
      details: { codec: 'libx264', outputSize: result.outputSize },
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);
  });

  it('should benchmark H.265 1080p conversion', async () => {
    const output = path.join(path.dirname(FIXTURE_10S_1080P), 'perf-out-h265-1080p.mp4');
    tmpOutputs.push(output);

    const result = await benchmarkConversion(FIXTURE_10S_1080P, output, 'libx265');

    console.log(`  H.265 1080p: ${result.durationMs.toFixed(0)}ms, output: ${formatBytes(result.outputSize)}`);

    const passed = result.durationMs < 120_000; // H.265 is slower, allow 120s
    results.push({
      test: 'H.265 1080p conversion',
      phase: 'phase1-conversion',
      durationMs: result.durationMs,
      memoryBefore: { rss: result.memBefore.rss, heapUsed: result.memBefore.heapUsed },
      memoryAfter: { rss: result.memAfter.rss, heapUsed: result.memAfter.heapUsed },
      memoryDeltaRss: result.memAfter.rss - result.memBefore.rss,
      memoryDeltaHeap: result.memAfter.heapUsed - result.memBefore.heapUsed,
      passed,
      details: { codec: 'libx265', outputSize: result.outputSize },
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);
  });

  it('should benchmark stream copy (remux) throughput', async () => {
    const output = path.join(path.dirname(FIXTURE_10S_1080P), 'perf-out-copy.mp4');
    tmpOutputs.push(output);

    const timer = new Timer();
    const memBefore = memorySnapshot();
    const { code } = await runFfmpeg([
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', FIXTURE_10S_1080P,
      '-c', 'copy',
      output,
    ]);
    const durationMs = timer.elapsedMs();
    const memAfter = memorySnapshot();

    expect(code).toBe(0);
    const outputSize = fs.statSync(output).size;

    console.log(`  Stream copy: ${durationMs.toFixed(0)}ms, output: ${formatBytes(outputSize)}`);

    const passed = durationMs < 5_000; // Remux should be very fast
    results.push({
      test: 'Stream copy (remux) 1080p',
      phase: 'phase1-conversion',
      durationMs,
      memoryBefore: { rss: memBefore.rss, heapUsed: memBefore.heapUsed },
      memoryAfter: { rss: memAfter.rss, heapUsed: memAfter.heapUsed },
      memoryDeltaRss: memAfter.rss - memBefore.rss,
      memoryDeltaHeap: memAfter.heapUsed - memBefore.heapUsed,
      passed,
      details: { codec: 'copy', outputSize },
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);
  });

  it('should benchmark H.264 720p conversion', async () => {
    const output = path.join(path.dirname(FIXTURE_5S_1080P), 'perf-out-h264-720p.mp4');
    tmpOutputs.push(output);

    const result = await benchmarkConversion(FIXTURE_5S_1080P, output, 'libx264', ['-vf', 'scale=1280:720']);

    console.log(`  H.264 720p: ${result.durationMs.toFixed(0)}ms, output: ${formatBytes(result.outputSize)}`);

    const passed = result.durationMs < 30_000;
    results.push({
      test: 'H.264 720p conversion',
      phase: 'phase1-conversion',
      durationMs: result.durationMs,
      memoryBefore: { rss: result.memBefore.rss, heapUsed: result.memBefore.heapUsed },
      memoryAfter: { rss: result.memAfter.rss, heapUsed: result.memAfter.heapUsed },
      memoryDeltaRss: result.memAfter.rss - result.memBefore.rss,
      memoryDeltaHeap: result.memAfter.heapUsed - result.memBefore.heapUsed,
      passed,
      details: { codec: 'libx264', scale: '1280:720', outputSize: result.outputSize },
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);
  });

  it('should benchmark audio-only extraction', async () => {
    const output = path.join(path.dirname(FIXTURE_10S_1080P), 'perf-out-audio.mp3');
    tmpOutputs.push(output);

    const timer = new Timer();
    const memBefore = memorySnapshot();
    const { code } = await runFfmpeg([
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', FIXTURE_10S_1080P,
      '-vn', '-c:a', 'libmp3lame', '-b:a', '128k',
      output,
    ]);
    const durationMs = timer.elapsedMs();
    const memAfter = memorySnapshot();

    expect(code).toBe(0);
    const outputSize = fs.statSync(output).size;

    console.log(`  Audio extraction: ${durationMs.toFixed(0)}ms, output: ${formatBytes(outputSize)}`);

    const passed = durationMs < 10_000;
    results.push({
      test: 'Audio extraction (MP3)',
      phase: 'phase1-conversion',
      durationMs,
      memoryBefore: { rss: memBefore.rss, heapUsed: memBefore.heapUsed },
      memoryAfter: { rss: memAfter.rss, heapUsed: memAfter.heapUsed },
      memoryDeltaRss: memAfter.rss - memBefore.rss,
      memoryDeltaHeap: memAfter.heapUsed - memBefore.heapUsed,
      passed,
      details: { codec: 'libmp3lame', outputSize },
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);
  });
});
