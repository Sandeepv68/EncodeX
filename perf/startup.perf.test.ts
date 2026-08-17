/**
 * @fileoverview Startup and cold launch performance tests.
 * Measures capability probe time, queue restore from persistence, and
 * CLI help output time.
 */

import { describe, it, expect } from 'vitest';
import { spawn, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { Timer, writeResults, logSummary } from './test-utils';
import type { PerfResult } from './test-utils';
import { JobQueue } from '../src/main/queue/job-queue';
import type { QueueSnapshot } from '../src/main/queue/persistence';
import { QUEUE_STATUS } from '../src/shared/media-options';

const ROOT = path.resolve(__dirname, '..');

function resolveFfmpegPath(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('ffmpeg-static') as string;
  } catch {
    return 'ffmpeg';
  }
}

function resolveFfprobePath(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffprobeStatic = require('ffprobe-static') as { path: string };
    return ffprobeStatic.path;
  } catch {
    return 'ffprobe';
  }
}

describe('Startup & Cold Launch Performance', () => {
  const results: PerfResult[] = [];

  afterAll(() => {
    const filePath = writeResults('phase1-startup', results);
    logSummary(results);
    console.log(`Results written to: ${filePath}`);
  });

  it('should measure CLI help output time', () => {
    const cliPath = path.join(ROOT, 'bin', 'encodex.js');
    const timer = new Timer();

    try {
      execSync(`node "${cliPath}" --help`, {
        timeout: 10_000,
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'production' },
      });
    } catch {
      // --help may exit with non-zero on some setups; that's fine
    }

    const durationMs = timer.elapsedMs();
    console.log(`  CLI --help: ${durationMs.toFixed(0)}ms`);

    const passed = durationMs < 5_000;
    results.push({
      test: 'CLI --help output time',
      phase: 'phase1-startup',
      durationMs,
      passed,
      details: {},
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);
  });

  it('should measure ffprobe capability probe time', async () => {
    const ffprobePath = resolveFfprobePath();
    const timer = new Timer();

    const probeTime = await new Promise<number>((resolve) => {
      const proc = spawn(ffprobePath, ['-version'], { stdio: ['ignore', 'pipe', 'pipe'] });
      const t = new Timer();
      proc.on('close', () => resolve(t.elapsedMs()));
      proc.on('error', () => resolve(t.elapsedMs()));
    });

    console.log(`  ffprobe -version: ${probeTime.toFixed(0)}ms`);

    results.push({
      test: 'ffprobe capability probe time',
      phase: 'phase1-startup',
      durationMs: probeTime,
      passed: probeTime < 5_000,
      details: { ffprobePath },
      timestamp: new Date().toISOString(),
    });

    expect(probeTime).toBeLessThan(5_000);
  });

  it('should measure ffmpeg encoder listing time', async () => {
    const ffmpegPath = resolveFfmpegPath();
    const timer = new Timer();

    const listTime = await new Promise<number>((resolve) => {
      const proc = spawn(ffmpegPath, ['-hide_banner', '-encoders'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      proc.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      const t = new Timer();
      proc.on('close', () => resolve(t.elapsedMs()));
      proc.on('error', () => resolve(t.elapsedMs()));
    });

    console.log(`  ffmpeg -encoders: ${listTime.toFixed(0)}ms`);

    results.push({
      test: 'FFmpeg encoder listing time',
      phase: 'phase1-startup',
      durationMs: listTime,
      passed: listTime < 10_000,
      details: {},
      timestamp: new Date().toISOString(),
    });

    expect(listTime).toBeLessThan(10_000);
  });

  it('should measure queue restore from 100 persisted jobs', () => {
    // Create a mock persistence adapter with 100 jobs
    const jobs = Array.from({ length: 100 }, (_, i) => ({
      id: `job-${i}`,
      input: `/path/to/input-${i}.mp4`,
      output: `/path/to/output-${i}.mp4`,
      options: { videoCodec: 'libx264', audioCodec: 'aac' },
      transcoder: 'FFMPEG' as const,
      status: QUEUE_STATUS.QUEUED,
      progress: 0,
      priority: 0,
      createdAt: Date.now(),
    }));

    const snapshot: QueueSnapshot = {
      version: 1,
      concurrency: 4,
      jobs,
    };

    const timer = new Timer();
    const queue = new JobQueue({
      concurrency: 4,
      persistence: {
        load: () => snapshot,
        save: () => {},
        clear: () => {},
      },
    });
    const durationMs = timer.elapsedMs();

    const restoredJobs = queue.getJobs();
    console.log(`  Queue restore (100 jobs): ${durationMs.toFixed(0)}ms, restored: ${restoredJobs.length}`);

    const passed = durationMs < 500 && restoredJobs.length === 100;
    results.push({
      test: 'Queue restore from 100 persisted jobs',
      phase: 'phase1-startup',
      durationMs,
      passed,
      details: { jobCount: restoredJobs.length },
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);
  });

  it('should measure queue restore from 500 persisted jobs', () => {
    const jobs = Array.from({ length: 500 }, (_, i) => ({
      id: `job-${i}`,
      input: `/path/to/input-${i}.mp4`,
      output: `/path/to/output-${i}.mp4`,
      options: { videoCodec: 'libx264', audioCodec: 'aac' },
      transcoder: 'FFMPEG' as const,
      status: QUEUE_STATUS.QUEUED,
      progress: 0,
      priority: 0,
      createdAt: Date.now(),
    }));

    const snapshot: QueueSnapshot = {
      version: 1,
      concurrency: 4,
      jobs,
    };

    const timer = new Timer();
    const queue = new JobQueue({
      concurrency: 4,
      persistence: {
        load: () => snapshot,
        save: () => {},
        clear: () => {},
      },
    });
    const durationMs = timer.elapsedMs();

    console.log(`  Queue restore (500 jobs): ${durationMs.toFixed(0)}ms`);

    results.push({
      test: 'Queue restore from 500 persisted jobs',
      phase: 'phase1-startup',
      durationMs,
      passed: durationMs < 2000,
      details: { jobCount: 500 },
      timestamp: new Date().toISOString(),
    });

    expect(durationMs).toBeLessThan(2000);
  });

  it('should measure tmpdir creation and cleanup', () => {
    const timer = new Timer();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-perf-'));
    const createMs = timer.elapsedMs();

    // Write a file
    fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'x'.repeat(1024));

    const cleanupTimer = new Timer();
    fs.rmSync(tmpDir, { recursive: true });
    const cleanupMs = cleanupTimer.elapsedMs();

    console.log(`  Tmpdir create: ${createMs.toFixed(1)}ms, cleanup: ${cleanupMs.toFixed(1)}ms`);

    results.push({
      test: 'Tmpdir create/cleanup',
      phase: 'phase1-startup',
      durationMs: createMs + cleanupMs,
      passed: createMs < 100 && cleanupMs < 100,
      details: { createMs, cleanupMs },
      timestamp: new Date().toISOString(),
    });

    expect(createMs).toBeLessThan(100);
  });
});
