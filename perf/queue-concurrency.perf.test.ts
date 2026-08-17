/**
 * @fileoverview Batch queue concurrency and scheduling performance tests.
 * Validates the JobQueue class behavior under various concurrency scenarios
 * using a mock transcoder that completes instantly.
 */

import { describe, it, expect, vi, afterAll } from 'vitest';
import { EventEmitter } from 'events';
import { JobQueue } from '../src/main/queue/job-queue';
import { QUEUE_STATUS } from '../src/shared/media-options';
import { writeResults, logSummary, memorySnapshot, formatBytes } from './test-utils';
import type { PerfResult } from './test-utils';
import type { ConversionOptions } from '../src/shared/types';

// Mock the transcoder factory to avoid Electron/FFmpeg dependencies
vi.mock('../src/main/transcoders/factory', () => ({
  createTranscoder: vi.fn(() => ({
    getInfo: vi.fn().mockResolvedValue({ file: '', format: '', size: 0, duration: 0, bitrate: '', streams: [] }),
    convert: vi.fn((_input: string, _output: string, _options: ConversionOptions) => {
      const emitter = new EventEmitter();
      const delay = 10 + Math.random() * 40;
      setTimeout(() => emitter.emit('end'), delay);
      return emitter;
    }),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getType: vi.fn(() => 'FFMPEG'),
  })),
}));

// Lazily import factory after mock is set up
const { createTranscoder } = await import('../src/main/transcoders/factory');

function makeJobArgs(index: number): [string, string, ConversionOptions, 'FFMPEG'] {
  return [
    `input-${index}.mp4`,
    `output-${index}.mp4`,
    { videoCodec: 'libx264', audioCodec: 'aac' },
    'FFMPEG',
  ];
}

function waitForDrain(queue: JobQueue, timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Drain timeout')), timeoutMs);
    queue.once('drained', () => { clearTimeout(timer); resolve(); });
  });
}

describe('Batch Queue Concurrency & Scheduling', () => {
  const results: PerfResult[] = [];

  afterAll(() => {
    const filePath = writeResults('phase1-queue', results);
    logSummary(results);
    console.log(`Results written to: ${filePath}`);
  });

  it('should run 4 jobs sequentially at concurrency 1', async () => {
    const queue = new JobQueue({ concurrency: 1 });
    const activeCount = { max: 0, current: 0 };

    queue.on('statusChange', (job) => {
      if (job.status === QUEUE_STATUS.RUNNING) {
        activeCount.current++;
        activeCount.max = Math.max(activeCount.max, activeCount.current);
      } else if (job.status === QUEUE_STATUS.DONE || job.status === QUEUE_STATUS.ERROR) {
        activeCount.current--;
      }
    });

    for (let i = 0; i < 4; i++) {
      queue.addJob(...makeJobArgs(i));
    }

    const timer = { startMs: Date.now() };
    queue.start();
    await waitForDrain(queue);
    const totalMs = Date.now() - timer.startMs;

    console.log(`  Concurrency 1, 4 jobs: ${totalMs.toFixed(0)}ms, max active: ${activeCount.max}`);

    results.push({
      test: 'Queue concurrency=1, 4 jobs sequential',
      phase: 'phase1-queue',
      durationMs: totalMs,
      passed: activeCount.max <= 1,
      details: { concurrency: 1, jobCount: 4, maxActive: activeCount.max },
      timestamp: new Date().toISOString(),
    });

    expect(activeCount.max).toBeLessThanOrEqual(1);
  });

  it('should run 4 jobs in parallel at concurrency 4', async () => {
    const queue = new JobQueue({ concurrency: 4 });
    const activeCount = { max: 0, current: 0 };

    queue.on('statusChange', (job) => {
      if (job.status === QUEUE_STATUS.RUNNING) {
        activeCount.current++;
        activeCount.max = Math.max(activeCount.max, activeCount.current);
      } else if (job.status === QUEUE_STATUS.DONE || job.status === QUEUE_STATUS.ERROR) {
        activeCount.current--;
      }
    });

    for (let i = 0; i < 4; i++) {
      queue.addJob(...makeJobArgs(i));
    }

    const timer = { startMs: Date.now() };
    queue.start();
    await waitForDrain(queue);
    const totalMs = Date.now() - timer.startMs;

    console.log(`  Concurrency 4, 4 jobs parallel: ${totalMs.toFixed(0)}ms, max active: ${activeCount.max}`);

    results.push({
      test: 'Queue concurrency=4, 4 jobs parallel',
      phase: 'phase1-queue',
      durationMs: totalMs,
      passed: activeCount.max === 4,
      details: { concurrency: 4, jobCount: 4, maxActive: activeCount.max },
      timestamp: new Date().toISOString(),
    });

    expect(activeCount.max).toBe(4);
  });

  it('should handle dynamic concurrency change from 1 to 4', async () => {
    const queue = new JobQueue({ concurrency: 1 });

    for (let i = 0; i < 8; i++) {
      queue.addJob(...makeJobArgs(i));
    }

    queue.start();
    await new Promise((r) => setTimeout(r, 5));
    queue.setConcurrency(4);

    const timer = { startMs: Date.now() };
    await waitForDrain(queue);
    const totalMs = Date.now() - timer.startMs;

    console.log(`  Dynamic concurrency 1→4, 8 jobs: ${totalMs.toFixed(0)}ms`);

    results.push({
      test: 'Queue dynamic concurrency 1→4',
      phase: 'phase1-queue',
      durationMs: totalMs,
      passed: true,
      details: { initialConcurrency: 1, finalConcurrency: 4, jobCount: 8 },
      timestamp: new Date().toISOString(),
    });
  });

  it('should handle priority scheduling correctly', async () => {
    const order: number[] = [];

    // Override the mock convert to track execution order by job index
    vi.mocked(createTranscoder).mockImplementation(() => ({
      getInfo: vi.fn().mockResolvedValue({ file: '', format: '', size: 0, duration: 0, bitrate: '', streams: [] }),
      convert: vi.fn((_input: string, _output: string) => {
        const jobIdx = parseInt(_input.match(/input-(\d+)\.mp4/)?.[1] ?? '-1', 10);
        const emitter = new EventEmitter();
        setTimeout(() => {
          order.push(jobIdx);
          emitter.emit('end');
        }, 10);
        return emitter;
      }),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      getType: vi.fn(() => 'FFMPEG'),
    }));

    const queue = new JobQueue({ concurrency: 1 });

    queue.addJob(...makeJobArgs(0)); // priority 0
    queue.addJob(...makeJobArgs(1)); // priority 0
    queue.addJob(...makeJobArgs(2), 2); // priority 2 — should run first
    queue.addJob(...makeJobArgs(3)); // priority 0

    queue.start();
    await waitForDrain(queue);

    console.log(`  Priority order: ${JSON.stringify(order)}`);

    // The highest priority job (index 2, priority 2) should run first
    const passed = order[0] === 2;

    results.push({
      test: 'Queue priority scheduling',
      phase: 'phase1-queue',
      durationMs: 0,
      passed,
      details: { executionOrder: order },
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);

    // Reset mock for other tests
    vi.mocked(createTranscoder).mockImplementation(() => ({
      getInfo: vi.fn().mockResolvedValue({ file: '', format: '', size: 0, duration: 0, bitrate: '', streams: [] }),
      convert: vi.fn(() => {
        const emitter = new EventEmitter();
        setTimeout(() => emitter.emit('end'), 10 + Math.random() * 40);
        return emitter;
      }),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      getType: vi.fn(() => 'FFMPEG'),
    }));
  });

  it('should stress test with 50 jobs at concurrency 4', async () => {
    const queue = new JobQueue({ concurrency: 4 });
    const memBefore = memorySnapshot();
    let completedCount = 0;

    queue.on('statusChange', (job) => {
      if (job.status === QUEUE_STATUS.DONE) completedCount++;
    });

    for (let i = 0; i < 50; i++) {
      queue.addJob(...makeJobArgs(i));
    }

    const timer = { startMs: Date.now() };
    queue.start();
    await waitForDrain(queue, 60_000);
    const totalMs = Date.now() - timer.startMs;
    const memAfter = memorySnapshot();

    const rssDelta = memAfter.rss - memBefore.rss;

    console.log(`  Stress: 50 jobs, concurrency 4: ${totalMs.toFixed(0)}ms, completed: ${completedCount}, RSS delta: ${formatBytes(rssDelta)}`);

    // All 50 jobs should have completed
    expect(completedCount).toBe(50);

    const passed = rssDelta < 100 * 1024 * 1024;
    results.push({
      test: 'Queue stress: 50 jobs, concurrency 4',
      phase: 'phase1-queue',
      durationMs: totalMs,
      memoryBefore: { rss: memBefore.rss, heapUsed: memBefore.heapUsed },
      memoryAfter: { rss: memAfter.rss, heapUsed: memAfter.heapUsed },
      memoryDeltaRss: rssDelta,
      memoryDeltaHeap: memAfter.heapUsed - memBefore.heapUsed,
      passed,
      details: { jobCount: 50, concurrency: 4, rssDelta, completedCount },
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);
  });

  it('should emit drained event exactly once after all jobs complete', async () => {
    const queue = new JobQueue({ concurrency: 2 });
    let drainCount = 0;

    queue.on('drained', () => { drainCount++; });

    for (let i = 0; i < 6; i++) {
      queue.addJob(...makeJobArgs(i));
    }

    queue.start();
    await waitForDrain(queue);

    await new Promise((r) => setTimeout(r, 100));

    console.log(`  Drain event count: ${drainCount}`);

    results.push({
      test: 'Queue drain event correctness',
      phase: 'phase1-queue',
      durationMs: 0,
      passed: drainCount === 1,
      details: { drainCount },
      timestamp: new Date().toISOString(),
    });

    expect(drainCount).toBe(1);
  });

  it('should handle cancel all mid-flight', async () => {
    // Override mock to simulate slow jobs
    vi.mocked(createTranscoder).mockImplementation(() => ({
      getInfo: vi.fn().mockResolvedValue({ file: '', format: '', size: 0, duration: 0, bitrate: '', streams: [] }),
      convert: vi.fn(() => {
        const emitter = new EventEmitter();
        setTimeout(() => emitter.emit('end'), 5000);
        return emitter;
      }),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      getType: vi.fn(() => 'FFMPEG'),
    }));

    const queue = new JobQueue({ concurrency: 4 });

    for (let i = 0; i < 8; i++) {
      queue.addJob(...makeJobArgs(i));
    }
    queue.start();

    await new Promise((r) => setTimeout(r, 50));

    const timer = { startMs: Date.now() };
    queue.cancelAll();
    const cancelMs = Date.now() - timer.startMs;

    console.log(`  CancelAll: ${cancelMs.toFixed(0)}ms`);

    expect(queue.getJobs()).toHaveLength(0);
    expect(cancelMs).toBeLessThan(1000);

    results.push({
      test: 'Queue cancelAll mid-flight',
      phase: 'phase1-queue',
      durationMs: cancelMs,
      passed: true,
      details: { cancelMs },
      timestamp: new Date().toISOString(),
    });

    // Reset mock
    vi.mocked(createTranscoder).mockImplementation(() => ({
      getInfo: vi.fn().mockResolvedValue({ file: '', format: '', size: 0, duration: 0, bitrate: '', streams: [] }),
      convert: vi.fn(() => {
        const emitter = new EventEmitter();
        setTimeout(() => emitter.emit('end'), 10 + Math.random() * 40);
        return emitter;
      }),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      getType: vi.fn(() => 'FFMPEG'),
    }));
  });
});
