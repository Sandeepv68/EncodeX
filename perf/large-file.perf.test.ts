/**
 * @fileoverview Large file handling performance tests.
 * Validates behavior with files at the upper bound and batch processing of
 * many small files.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { Timer, memorySnapshot, formatBytes, fixturePath, hasFixture, writeResults, logSummary } from './test-utils';
import type { PerfResult } from './test-utils';

const ffmpegPath = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('ffmpeg-static') as string;
  } catch {
    return 'ffmpeg';
  }
})();

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

function generateTestFile(output: string, duration: number, width: number, height: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'lavfi', '-i', `testsrc=duration=${duration}:size=${width}x${height}:rate=30`,
      '-f', 'lavfi', '-i', `sine=frequency=440:duration=${duration}`,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k',
      output,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg generation failed with code ${code}`));
    });
    proc.on('error', reject);
  });
}

function gc() {
  if (global.gc) global.gc();
}

describe('Large File Handling', () => {
  const results: PerfResult[] = [];
  const tmpDir = path.resolve(__dirname, 'fixtures', 'perf-large');
  const tmpOutputs: string[] = [];

  beforeAll(async () => {
    fs.mkdirSync(tmpDir, { recursive: true });

    // Generate a larger test file (60s, 1080p) for large file tests
    const largeFile = path.join(tmpDir, 'large-60s-1080p.mp4');
    if (!fs.existsSync(largeFile)) {
      console.log('  Generating 60s 1080p test file...');
      await generateTestFile(largeFile, 60, 1920, 1080);
    }
  });

  afterAll(() => {
    for (const f of tmpOutputs) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
    try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }
    const filePath = writeResults('phase2-large-file', results);
    logSummary(results);
    console.log(`Results written to: ${filePath}`);
  });

  it('should convert a 60s 1080p file without excessive memory', async () => {
    const input = path.join(tmpDir, 'large-60s-1080p.mp4');
    const output = path.join(tmpDir, 'large-converted.mp4');
    tmpOutputs.push(output);

    gc();
    const memBefore = memorySnapshot();
    const timer = new Timer();

    const { code } = await runFfmpeg([
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', input,
      '-c:v', 'libx264', '-preset', 'ultrafast',
      '-c:a', 'aac',
      output,
    ]);

    const durationMs = timer.elapsedMs();
    gc();
    const memAfter = memorySnapshot();

    expect(code).toBe(0);

    const rssDelta = memAfter.rss - memBefore.rss;
    const outputSize = fs.statSync(output).size;

    console.log(`  60s 1080p convert: ${durationMs.toFixed(0)}ms, output: ${formatBytes(outputSize)}`);
    console.log(`  RSS delta: ${formatBytes(rssDelta)}`);

    const passed = durationMs < 120_000 && rssDelta < 200 * 1024 * 1024; // < 200MB
    results.push({
      test: 'Large file: 60s 1080p conversion',
      phase: 'phase2-large-file',
      durationMs,
      memoryBefore: { rss: memBefore.rss, heapUsed: memBefore.heapUsed },
      memoryAfter: { rss: memAfter.rss, heapUsed: memAfter.heapUsed },
      memoryDeltaRss: rssDelta,
      memoryDeltaHeap: memAfter.heapUsed - memBefore.heapUsed,
      passed,
      details: { inputDuration: 60, rssDelta, outputSize },
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);
  });

  it('should handle batch conversion of 20 small files', async () => {
    const BATCH_COUNT = 20;
    const batchDir = path.join(tmpDir, 'batch');
    fs.mkdirSync(batchDir, { recursive: true });

    // Generate small test files
    const inputs: string[] = [];
    for (let i = 0; i < BATCH_COUNT; i++) {
      const input = path.join(batchDir, `batch-${i}.mp4`);
      if (!fs.existsSync(input)) {
        await generateTestFile(input, 2, 320, 240); // 2s, tiny
      }
      inputs.push(input);
    }

    gc();
    const memBefore = memorySnapshot();
    const timer = new Timer();

    let completed = 0;
    for (const input of inputs) {
      const output = path.join(batchDir, `batch-${completed}-out.mp4`);
      tmpOutputs.push(output);
      const { code } = await runFfmpeg([
        '-y', '-hide_banner', '-loglevel', 'error',
        '-i', input,
        '-c:v', 'libx264', '-preset', 'ultrafast',
        '-c:a', 'aac',
        output,
      ]);
      expect(code).toBe(0);
      completed++;
    }

    const durationMs = timer.elapsedMs();
    gc();
    const memAfter = memorySnapshot();

    const rssDelta = memAfter.rss - memBefore.rss;

    console.log(`  Batch ${BATCH_COUNT} files: ${durationMs.toFixed(0)}ms (${(durationMs / BATCH_COUNT).toFixed(0)}ms avg)`);
    console.log(`  RSS delta: ${formatBytes(rssDelta)}`);

    // Cleanup batch outputs
    try { fs.rmSync(batchDir, { recursive: true }); } catch { /* ignore */ }

    const passed = rssDelta < 50 * 1024 * 1024; // < 50MB
    results.push({
      test: `Large file: batch ${BATCH_COUNT} small files`,
      phase: 'phase2-large-file',
      durationMs,
      memoryBefore: { rss: memBefore.rss, heapUsed: memBefore.heapUsed },
      memoryAfter: { rss: memAfter.rss, heapUsed: memAfter.heapUsed },
      memoryDeltaRss: rssDelta,
      memoryDeltaHeap: memAfter.heapUsed - memBefore.heapUsed,
      passed,
      details: { batchCount: BATCH_COUNT, rssDelta, avgMs: durationMs / BATCH_COUNT },
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);
  });

  it('should probe a large file within time limit', async () => {
    const input = path.join(tmpDir, 'large-60s-1080p.mp4');
    const ffprobePath = (() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const ffprobeStatic = require('ffprobe-static') as { path: string };
        return ffprobeStatic.path;
      } catch {
        return 'ffprobe';
      }
    })();

    const timer = new Timer();
    const probeResult = await new Promise<{ code: number; stdout: string }>((resolve, reject) => {
      const proc = spawn(ffprobePath, [
        '-v', 'quiet', '-print_format', 'json',
        '-show_format', '-show_streams',
        input,
      ], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      proc.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.on('close', (code) => resolve({ code: code ?? 1, stdout }));
      proc.on('error', reject);
    });

    const durationMs = timer.elapsedMs();

    expect(probeResult.code).toBe(0);
    const parsed = JSON.parse(probeResult.stdout);
    expect(parsed.format).toBeDefined();
    expect(parsed.streams).toBeDefined();
    expect(parsed.streams.length).toBeGreaterThanOrEqual(1);

    console.log(`  Large file probe: ${durationMs.toFixed(0)}ms, streams: ${parsed.streams.length}`);

    const passed = durationMs < 10_000;
    results.push({
      test: 'Large file: probe within time limit',
      phase: 'phase2-large-file',
      durationMs,
      passed,
      details: { streamCount: parsed.streams.length },
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);
  });
});
