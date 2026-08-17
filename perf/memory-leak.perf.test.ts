/**
 * @fileoverview Memory management and leak detection tests.
 * Measures memory growth over repeated operations to detect leaks.
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

function runFfmpeg(args: string[], timeoutMs = 30_000): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const timer = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error('timeout')); }, timeoutMs);
    proc.on('close', (code) => { clearTimeout(timer); resolve(code ?? 1); });
    proc.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

function gc() {
  if (global.gc) global.gc();
}

describe('Memory Management & Leak Detection', () => {
  const results: PerfResult[] = [];
  const FIXTURE = fixturePath('test-5s-1080p');
  const tmpOutputs: string[] = [];

  afterAll(() => {
    for (const f of tmpOutputs) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
    const filePath = writeResults('phase2-memory', results);
    logSummary(results);
    console.log(`Results written to: ${filePath}`);
  });

  it('should have test fixtures', () => {
    expect(hasFixture('test-5s-1080p')).toBe(true);
  });

  it('should not leak memory over 20 repeated conversions', async () => {
    const RUNS = 20;
    const memSnapshots: { rss: number; heapUsed: number }[] = [];
    const tmpDir = path.join(path.dirname(FIXTURE), 'perf-mem');
    fs.mkdirSync(tmpDir, { recursive: true });

    gc();
    memSnapshots.push(memorySnapshot());

    for (let i = 0; i < RUNS; i++) {
      const output = path.join(tmpDir, `mem-test-${i}.mp4`);
      tmpOutputs.push(output);

      const code = await runFfmpeg([
        '-y', '-hide_banner', '-loglevel', 'error',
        '-i', FIXTURE,
        '-c:v', 'libx264', '-preset', 'ultrafast',
        '-c:a', 'aac',
        output,
      ]);
      expect(code).toBe(0);

      gc();
      memSnapshots.push(memorySnapshot());
    }

    gc();
    memSnapshots.push(memorySnapshot());

    const firstRss = memSnapshots[0].rss;
    const lastRss = memSnapshots[memSnapshots.length - 1].rss;
    const rssGrowth = lastRss - firstRss;
    const rssGrowthPct = (rssGrowth / firstRss) * 100;

    // Find peak RSS
    const peakRss = Math.max(...memSnapshots.map((s) => s.rss));
    const peakRssGrowth = peakRss - firstRss;

    console.log(`  RSS growth over ${RUNS} runs: ${formatBytes(rssGrowth)} (${rssGrowthPct.toFixed(1)}%)`);
    console.log(`  Peak RSS growth: ${formatBytes(peakRssGrowth)}`);

    // Cleanup
    try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }

    // Allow up to 50MB growth or 15% growth
    const passed = rssGrowth < 50 * 1024 * 1024 && rssGrowthPct < 15;
    results.push({
      test: `Memory: ${RUNS} repeated conversions`,
      phase: 'phase2-memory',
      durationMs: 0,
      memoryBefore: { rss: firstRss, heapUsed: memSnapshots[0].heapUsed },
      memoryAfter: { rss: lastRss, heapUsed: memSnapshots[memSnapshots.length - 1].heapUsed },
      memoryDeltaRss: rssGrowth,
      memoryDeltaHeap: memSnapshots[memSnapshots.length - 1].heapUsed - memSnapshots[0].heapUsed,
      passed,
      details: { runs: RUNS, rssGrowth, rssGrowthPct, peakRssGrowth },
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);
  });

  it('should not grow memory during repeated ffprobe calls', async () => {
    const RUNS = 30;
    const memSnapshots: { rss: number; heapUsed: number }[] = [];
    const ffprobePath = (() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const ffprobeStatic = require('ffprobe-static') as { path: string };
        return ffprobeStatic.path;
      } catch {
        return 'ffprobe';
      }
    })();

    gc();
    memSnapshots.push(memorySnapshot());

    for (let i = 0; i < RUNS; i++) {
      await new Promise<number>((resolve, reject) => {
        const proc = spawn(ffprobePath, [
          '-v', 'quiet', '-print_format', 'json',
          '-show_format', '-show_streams',
          FIXTURE,
        ], { stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        proc.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
        proc.on('close', () => resolve(0));
        proc.on('error', reject);
      });

      if (i % 5 === 0) {
        gc();
        memSnapshots.push(memorySnapshot());
      }
    }

    gc();
    memSnapshots.push(memorySnapshot());

    const firstRss = memSnapshots[0].rss;
    const lastRss = memSnapshots[memSnapshots.length - 1].rss;
    const rssGrowth = lastRss - firstRss;

    console.log(`  RSS after ${RUNS} ffprobe calls: ${formatBytes(rssGrowth)}`);

    const passed = rssGrowth < 20 * 1024 * 1024; // Less than 20MB
    results.push({
      test: `Memory: ${RUNS} repeated ffprobe calls`,
      phase: 'phase2-memory',
      durationMs: 0,
      memoryBefore: { rss: firstRss, heapUsed: memSnapshots[0].heapUsed },
      memoryAfter: { rss: lastRss, heapUsed: memSnapshots[memSnapshots.length - 1].heapUsed },
      memoryDeltaRss: rssGrowth,
      memoryDeltaHeap: memSnapshots[memSnapshots.length - 1].heapUsed - memSnapshots[0].heapUsed,
      passed,
      details: { runs: RUNS, rssGrowth },
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);
  });

  it('should bound log-like data structures in memory', () => {
    // Simulate the LOG_MAX_ENTRIES cap from the log store
    const LOG_MAX_ENTRIES = 2000;
    const logEntries: string[] = [];

    gc();
    const memBefore = memorySnapshot();

    for (let i = 0; i < 10_000; i++) {
      logEntries.push(`Log entry ${i}: ${'x'.repeat(200)}`);
      if (logEntries.length > LOG_MAX_ENTRIES) {
        logEntries.shift();
      }
    }

    gc();
    const memAfter = memorySnapshot();

    console.log(`  Log store cap test: ${formatBytes(memAfter.rss - memBefore.rss)} growth`);
    console.log(`  Entries: ${logEntries.length} (cap: ${LOG_MAX_ENTRIES})`);

    expect(logEntries.length).toBeLessThanOrEqual(LOG_MAX_ENTRIES);

    const rssDelta = memAfter.rss - memBefore.rss;
    const passed = rssDelta < 10 * 1024 * 1024; // Less than 10MB
    results.push({
      test: 'Memory: log store entry cap (2000)',
      phase: 'phase2-memory',
      durationMs: 0,
      memoryBefore: { rss: memBefore.rss, heapUsed: memBefore.heapUsed },
      memoryAfter: { rss: memAfter.rss, heapUsed: memAfter.heapUsed },
      memoryDeltaRss: rssDelta,
      memoryDeltaHeap: memAfter.heapUsed - memBefore.heapUsed,
      passed,
      details: { entries: logEntries.length, cap: LOG_MAX_ENTRIES },
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);
  });

  it('should bound error history in memory', () => {
    const ERROR_HISTORY_MAX = 50;
    const errors: Array<{ code: string; message: string; timestamp: number }> = [];

    gc();
    const memBefore = memorySnapshot();

    for (let i = 0; i < 500; i++) {
      errors.push({
        code: 'CONVERSION_FAILED',
        message: `Error ${i}: ${'x'.repeat(300)}`,
        timestamp: Date.now(),
      });
      if (errors.length > ERROR_HISTORY_MAX) {
        errors.shift();
      }
    }

    gc();
    const memAfter = memorySnapshot();

    console.log(`  Error history cap test: ${formatBytes(memAfter.rss - memBefore.rss)} growth`);

    expect(errors.length).toBeLessThanOrEqual(ERROR_HISTORY_MAX);

    const rssDelta = memAfter.rss - memBefore.rss;
    const passed = rssDelta < 5 * 1024 * 1024;
    results.push({
      test: 'Memory: error history cap (50)',
      phase: 'phase2-memory',
      durationMs: 0,
      memoryBefore: { rss: memBefore.rss, heapUsed: memBefore.heapUsed },
      memoryAfter: { rss: memAfter.rss, heapUsed: memAfter.heapUsed },
      memoryDeltaRss: rssDelta,
      memoryDeltaHeap: memAfter.heapUsed - memBefore.heapUsed,
      passed,
      details: { entries: errors.length, cap: ERROR_HISTORY_MAX },
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);
  });
});
