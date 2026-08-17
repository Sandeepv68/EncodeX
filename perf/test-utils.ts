/**
 * @fileoverview Shared utilities for performance tests.
 * Provides fixture path resolution, timing helpers, memory measurement,
 * and a structured results writer.
 */

import * as fs from 'fs';
import * as path from 'path';

const FIXTURES_DIR = (() => {
  const viaDirname = path.resolve(__dirname, 'fixtures');
  if (fs.existsSync(viaDirname)) return viaDirname;
  return path.resolve(process.cwd(), 'perf', 'fixtures');
})();

const RESULTS_DIR = (() => {
  const viaDirname = path.resolve(__dirname, 'results');
  if (fs.existsSync(viaDirname)) return viaDirname;
  return path.resolve(process.cwd(), 'perf', 'results');
})();

/**
 * Returns the absolute path to a test media fixture.
 * @param name - Fixture name without extension (e.g. 'test-5s-1080p')
 */
export function fixturePath(name: string): string {
  return path.join(FIXTURES_DIR, `${name}.mp4`);
}

/**
 * Returns true if the named fixture exists on disk.
 */
export function hasFixture(name: string): boolean {
  return fs.existsSync(fixturePath(name));
}

/**
 * Returns all available fixture names (without extension).
 */
export function availableFixtures(): string[] {
  if (!fs.existsSync(FIXTURES_DIR)) return [];
  return fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.mp4'))
    .map((f) => f.replace(/\.mp4$/, ''));
}

/**
 * High-resolution wall-clock timer using `process.hrtime.bigint()`.
 */
export class Timer {
  private start: bigint;

  constructor() {
    this.start = process.hrtime.bigint();
  }

  /** Returns elapsed milliseconds since construction or last `reset()`. */
  elapsedMs(): number {
    const now = process.hrtime.bigint();
    return Number(now - this.start) / 1_000_000;
  }

  /** Returns elapsed milliseconds and resets the timer. */
  lapMs(): number {
    const elapsed = this.elapsedMs();
    this.start = process.hrtime.bigint();
    return elapsed;
  }

  reset(): void {
    this.start = process.hrtime.bigint();
  }
}

/**
 * Captures a heap memory snapshot (RSS and heapUsed) in bytes.
 */
export function memorySnapshot(): { rss: number; heapUsed: number; heapTotal: number } {
  if (global.gc) global.gc();
  const mem = process.memoryUsage();
  return { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal };
}

/**
 * Formats bytes to human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
}

/**
 * A single performance test result entry.
 */
export interface PerfResult {
  test: string;
  phase: string;
  durationMs: number;
  memoryBefore?: { rss: number; heapUsed: number };
  memoryAfter?: { rss: number; heapUsed: number };
  memoryDeltaRss?: number;
  memoryDeltaHeap?: number;
  passed: boolean;
  details?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Writes a batch of results to a JSON file in `perf/results/`.
 */
export function writeResults(phase: string, results: PerfResult[]): string {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
  const filename = `${phase}-${Date.now()}.json`;
  const filepath = path.join(RESULTS_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify({ phase, results, generatedAt: new Date().toISOString() }, null, 2));
  return filepath;
}

/**
 * Logs a result summary to the console.
 */
export function logSummary(results: PerfResult[]): void {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log('');
  console.log('='.repeat(60));
  console.log(`  Performance Test Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  for (const r of results) {
    const status = r.passed ? 'PASS' : 'FAIL';
    const mem = r.memoryDeltaRss != null ? ` | RSS delta: ${formatBytes(r.memoryDeltaRss)}` : '';
    console.log(`  [${status}] ${r.test} — ${r.durationMs.toFixed(1)}ms${mem}`);
  }
  console.log('='.repeat(60));
}
