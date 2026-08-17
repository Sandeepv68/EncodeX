/**
 * @fileoverview FFmpeg process lifecycle and resource cleanup tests.
 * Ensures no zombie/orphaned FFmpeg processes under stress scenarios.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { spawn, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { Timer, writeResults, logSummary, fixturePath, hasFixture } from './test-utils';
import type { PerfResult } from './test-utils';

const ffmpegPath = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('ffmpeg-static') as string;
  } catch {
    return 'ffmpeg';
  }
})();

function countFfmpegProcesses(): number {
  try {
    if (process.platform === 'win32') {
      const output = execSync('tasklist /FI "IMAGENAME eq ffmpeg.exe" /FO CSV /NH', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      const lines = output.trim().split('\n').filter((l) => l.includes('ffmpeg.exe'));
      return lines.length;
    } else {
      const output = execSync('pgrep -c ffmpeg || true', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      return parseInt(output.trim(), 10) || 0;
    }
  } catch {
    return 0;
  }
}

function runFfmpeg(args: string[], timeoutMs = 30_000): Promise<{ proc: ReturnType<typeof spawn>; code: number | null }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      resolve({ proc, code: null });
    }, timeoutMs);
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ proc, code });
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

describe('FFmpeg Process Lifecycle & Resource Cleanup', () => {
  const results: PerfResult[] = [];
  const FIXTURE = fixturePath('test-5s-1080p');
  const tmpOutputs: string[] = [];

  afterAll(() => {
    for (const f of tmpOutputs) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
    const filePath = writeResults('phase2-process-lifecycle', results);
    logSummary(results);
    console.log(`Results written to: ${filePath}`);
  });

  it('should have test fixtures', () => {
    expect(hasFixture('test-5s-1080p')).toBe(true);
  });

  it('should clean up process after normal completion', async () => {
    const baselineCount = countFfmpegProcesses();
    const output = path.join(path.dirname(FIXTURE), 'perf-lifecycle-normal.mp4');
    tmpOutputs.push(output);

    const { code } = await runFfmpeg([
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', FIXTURE,
      '-c:v', 'libx264', '-preset', 'ultrafast',
      '-c:a', 'aac',
      output,
    ]);

    expect(code).toBe(0);

    // Wait for process to fully release
    await new Promise((r) => setTimeout(r, 200));
    const afterCount = countFfmpegProcesses();

    console.log(`  Baseline: ${baselineCount}, after: ${afterCount}`);

    results.push({
      test: 'Process cleanup after normal completion',
      phase: 'phase2-process-lifecycle',
      durationMs: 0,
      passed: afterCount <= baselineCount,
      details: { baselineCount, afterCount },
      timestamp: new Date().toISOString(),
    });

    expect(afterCount).toBeLessThanOrEqual(baselineCount);
  });

  it('should clean up process after cancellation (SIGKILL)', async () => {
    const baselineCount = countFfmpegProcesses();
    const output = path.join(path.dirname(FIXTURE), 'perf-lifecycle-cancel.mp4');
    tmpOutputs.push(output);

    // Start a conversion that we'll kill
    const proc = spawn(ffmpegPath, [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', fixturePath('test-30s-1080p'),
      '-c:v', 'libx264', '-preset', 'medium', // slower preset = more time to cancel
      '-c:a', 'aac',
      output,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

    // Wait a bit for the process to start
    await new Promise((r) => setTimeout(r, 500));

    const duringCount = countFfmpegProcesses();
    console.log(`  During conversion: ${duringCount} ffmpeg processes`);

    // Kill it
    proc.kill('SIGKILL');

    // Wait for cleanup
    await new Promise((r) => setTimeout(r, 500));
    const afterCount = countFfmpegProcesses();

    console.log(`  After SIGKILL: ${afterCount} ffmpeg processes`);

    const passed = afterCount <= baselineCount + 1; // Allow 1 for timing tolerance
    results.push({
      test: 'Process cleanup after SIGKILL cancellation',
      phase: 'phase2-process-lifecycle',
      durationMs: 0,
      passed,
      details: { baselineCount, duringCount, afterCount },
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);

    // Cleanup partial output
    try { fs.unlinkSync(output); } catch { /* ignore */ }
  });

  it('should handle rapid sequential conversions without process leaks', async () => {
    const baselineCount = countFfmpegProcesses();
    const tmpDir = path.join(path.dirname(FIXTURE), 'perf-rapid');
    fs.mkdirSync(tmpDir, { recursive: true });

    const outputs: string[] = [];
    const timer = new Timer();

    // Run 10 quick conversions
    for (let i = 0; i < 10; i++) {
      const output = path.join(tmpDir, `rapid-${i}.mp4`);
      outputs.push(output);
      const { code } = await runFfmpeg([
        '-y', '-hide_banner', '-loglevel', 'error',
        '-i', fixturePath('test-5s-480p'),
        '-c:v', 'libx264', '-preset', 'ultrafast',
        '-c:a', 'aac',
        output,
      ]);
      expect(code).toBe(0);
    }

    const durationMs = timer.elapsedMs();
    const afterCount = countFfmpegProcesses();

    console.log(`  Rapid sequential (10): ${durationMs.toFixed(0)}ms, after: ${afterCount}`);

    // Cleanup
    for (const f of outputs) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
    try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }

    const passed = afterCount <= baselineCount;
    results.push({
      test: 'Rapid sequential conversions (10) no leak',
      phase: 'phase2-process-lifecycle',
      durationMs,
      passed,
      details: { conversionCount: 10, afterCount },
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);
  });

  it('should handle concurrent conversions and clean up all', async () => {
    const baselineCount = countFfmpegProcesses();
    const tmpDir = path.join(path.dirname(FIXTURE), 'perf-concurrent');
    fs.mkdirSync(tmpDir, { recursive: true });

    const outputs = Array.from({ length: 4 }, (_, i) => path.join(tmpDir, `concurrent-${i}.mp4`));

    const timer = new Timer();

    // Start 4 conversions simultaneously
    const promises = outputs.map((output, i) =>
      runFfmpeg([
        '-y', '-hide_banner', '-loglevel', 'error',
        '-i', fixturePath('test-5s-480p'),
        '-c:v', 'libx264', '-preset', 'ultrafast',
        '-c:a', 'aac',
        output,
      ]),
    );

    const duringCount = countFfmpegProcesses();
    console.log(`  During 4 concurrent: ${duringCount} ffmpeg processes`);

    const codeResults = await Promise.all(promises);
    const durationMs = timer.elapsedMs();

    await new Promise((r) => setTimeout(r, 300));
    const afterCount = countFfmpegProcesses();

    console.log(`  After 4 concurrent: ${durationMs.toFixed(0)}ms, after: ${afterCount}`);

    // Cleanup
    for (const f of outputs) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
    try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }

    // All should have succeeded
    const allSucceeded = codeResults.every((r) => r.code === 0);

    const passed = allSucceeded && afterCount <= baselineCount;
    results.push({
      test: '4 concurrent conversions cleanup',
      phase: 'phase2-process-lifecycle',
      durationMs,
      passed,
      details: { duringCount, afterCount, allSucceeded },
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);
  });
});
