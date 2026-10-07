/**
 * @fileoverview Phase 8 DoS/resource-limit budgets at full scale (perf tier).
 *
 * The committed unit suites (media-scan-budget, queue-import-budget, ...)
 * pinch the same algorithmic risks at bounded sizes on every CI run; this
 * suite covers the full Phase-8 rows that need real IO and would outgrow a
 * shared unit-tier fork:
 *
 *   - 100,000-file folder drop: `collectMediaFiles` completes < 5 s with
 *     100,000 unique sorted results and no heap blow-up.
 *   - 20 GB sparse file (truncated seek): the scan is stat-only, so a 20 GB
 *     logical file must not push wall-clock or memory; a regression to a
 *     full-read would fail both budgets loudly.
 *   - 100 MB SRT auxiliary subtitle: the shared remux-plan builder (GUI/CLI/MCP)
 *     treats an added subtitle as a bounded path string and must never read a
 *     100 MB SRT into JS.
 *
 * Runs in its own worker (perf config uses `pool: forks`, `maxWorkers: 1`)
 * and every test writes a `PerfResult` so `perf:compare` baselines it.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, appendFileSync, openSync, ftruncateSync, closeSync, statSync } from 'fs';
import { execFileSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { Timer, memorySnapshot, formatBytes, writeResults, logSummary } from './test-utils';
import type { PerfResult } from './test-utils';
import { collectMediaFiles, expandMediaPaths } from '../src/main/media-files';
import { buildRemuxPlan } from '../src/shared/remux-utils';

const SCAN_FILE_COUNT = 100_000;
const DIR_COUNT = 100;
const FILES_PER_DIR = SCAN_FILE_COUNT / DIR_COUNT;
const SPARSE_BYTES = 20 * 1024 * 1024 * 1024;
const SRT_BYTES = 100 * 1024 * 1024;

const SCAN_BUDGET_MS = 5_000;
const SPARSE_SCAN_BUDGET_MS = 3_000;
const SRT_PLAN_BUDGET_MS = 1_000;

let base: string;
let root: string;
let ioDir: string;
let sparseFile: string;
let srtFile: string;

function elapsedMs<T>(fn: () => T): { ms: number; value: T } {
  const started = performance.now();
  const value = fn();
  return { ms: performance.now() - started, value };
}

function resultsWithinBudget(label: string, ms: number, budgetMs: number, rssDelta: number): void {
  expect(ms, `${label} must complete within ${budgetMs} ms`).toBeLessThan(budgetMs);
  expect(rssDelta, `${label} must not read file bodies into memory`).toBeLessThan(200 * 1024 * 1024);
}

/**
 * Creates a 20 GB *logical* file without ever writing 20 GB. Extending EOF
 * past written data allocates nothing on ext4/APFS; on Windows NTFS the file
 * must first be flagged sparse or the extension allocates disk immediately
 * (`fsutil sparse setflag`), so the flag is applied there before the truncate.
 * A preallocating filesystem would both fill the disk and blow the setup
 * hookTimeout, failing the suite loudly - which is the correct outcome for an
 * environment that violates the sparse-file assumption the row pins.
 * @param {string} file - Path of the file to grow.
 * @param {number} bytes - Logical size to extend to.
 * @returns {void}
 */
function createSparseFile(file: string, bytes: number): void {
  const fd = openSync(file, 'w');
  try {
    if (process.platform === 'win32') {
      execFileSync('fsutil', ['sparse', 'setflag', file], { stdio: 'ignore' });
    }
    ftruncateSync(fd, bytes);
  } finally {
    closeSync(fd);
  }
}

beforeAll(() => {
  const started = performance.now();
  base = mkdtempSync(join(tmpdir(), 'encodex-perf-io-'));
  root = join(base, 'scan');
  ioDir = join(base, 'io');
  mkdirSync(root);
  mkdirSync(ioDir);
  for (let d = 0; d < DIR_COUNT; d += 1) {
    const dir = join(root, `d${d}`);
    mkdirSync(dir);
    for (let i = 0; i < FILES_PER_DIR; i += 1) {
      writeFileSync(join(dir, `f${String(d).padStart(3, '0')}_${String(i).padStart(5, '0')}.mp4`), '');
    }
  }

  sparseFile = join(ioDir, 'sparse-20gb.mp4');
  createSparseFile(sparseFile, SPARSE_BYTES);

  srtFile = join(ioDir, 'huge.srt');
  const cue = '1\n00:00:00,000 --> 00:00:01,000\nLorem ipsum dolor sit amet, consectetur adipiscing elit.\n\n';
  const chunk = cue.repeat(Math.ceil((1024 * 1024) / cue.length)).slice(0, 1024 * 1024);
  for (let written = 0; written < SRT_BYTES; written += chunk.length) {
    appendFileSync(srtFile, chunk);
  }

  console.log(
    `  Setup: ${SCAN_FILE_COUNT} files, 20 GB sparse, 100 MB SRT in ${(performance.now() - started).toFixed(0)}ms; ` +
      `sparse size=${formatBytes(statSync(sparseFile).size)} srt size=${formatBytes(statSync(srtFile).size)}`,
  );
}, 300_000);

afterAll(() => {
  if (base) rmSync(base, { recursive: true, force: true });
}, 300_000);

describe('Phase 8 io-perf: 100,000-file scan / 20 GB sparse / 100 MB SRT', () => {
  const results: PerfResult[] = [];

  afterAll(() => {
    const filePath = writeResults('phase8-io', results);
    logSummary(results);
    console.log(`Results written to: ${filePath}`);
  });

  it('collects all 100,000 files within budget without reading bodies', () => {
    const before = memorySnapshot();
    const { ms, value: found } = elapsedMs(() => collectMediaFiles(root));
    const after = memorySnapshot();

    expect(found).toHaveLength(SCAN_FILE_COUNT);
    expect(new Set(found).size).toBe(SCAN_FILE_COUNT);
    expect(found).toEqual([...found].sort());
    expect(ms).toBeLessThan(SCAN_BUDGET_MS);

    const rssDelta = after.rss - before.rss;
    resultsWithinBudget('100,000-file scan', ms, SCAN_BUDGET_MS, rssDelta);
    console.log(`  100,000-file scan: ${ms.toFixed(1)}ms, RSS delta ${formatBytes(rssDelta)}`);
    results.push({
      test: 'Phase 8 io: 100,000-file folder scan',
      phase: 'phase8-io',
      durationMs: ms,
      memoryBefore: { rss: before.rss, heapUsed: before.heapUsed },
      memoryAfter: { rss: after.rss, heapUsed: after.heapUsed },
      memoryDeltaRss: rssDelta,
      memoryDeltaHeap: after.heapUsed - before.heapUsed,
      passed: found.length === SCAN_FILE_COUNT && ms < SCAN_BUDGET_MS,
      details: { fileCount: found.length, ms },
      timestamp: new Date().toISOString(),
    });
  });

  it('scans a tree containing a 20 GB sparse file without a full read', () => {
    writeFileSync(join(ioDir, 'real.mp4'), 'x');

    expect(statSync(sparseFile).size, 'sparse file must actually be 20 GB logical').toBe(SPARSE_BYTES);

    const before = memorySnapshot();
    const { ms, value: found } = elapsedMs(() => collectMediaFiles(ioDir));
    const after = memorySnapshot();

    expect(ms).toBeLessThan(SPARSE_SCAN_BUDGET_MS);
    const rssDelta = after.rss - before.rss;
    resultsWithinBudget('20 GB sparse tree scan', ms, SPARSE_SCAN_BUDGET_MS, rssDelta);
    expect(found).toContain(sparseFile);

    const dedup = expandMediaPaths([ioDir, sparseFile, sparseFile]);
    expect(dedup.filter((p) => p === sparseFile)).toHaveLength(1);

    console.log(`  20 GB sparse tree scan: ${ms.toFixed(1)}ms, RSS delta ${formatBytes(rssDelta)}`);
    results.push({
      test: 'Phase 8 io: 20 GB sparse file scan (no full read)',
      phase: 'phase8-io',
      durationMs: ms,
      memoryBefore: { rss: before.rss, heapUsed: before.heapUsed },
      memoryAfter: { rss: after.rss, heapUsed: after.heapUsed },
      memoryDeltaRss: rssDelta,
      memoryDeltaHeap: after.heapUsed - before.heapUsed,
      passed: ms < SPARSE_SCAN_BUDGET_MS && rssDelta < 200 * 1024 * 1024,
      details: { ms, sparseBytes: SPARSE_BYTES, rssDelta },
      timestamp: new Date().toISOString(),
    });
  });

  it('builds a remux plan with a 100 MB SRT as an unread path string', () => {
    const before = memorySnapshot();
    const timer = new Timer();
    const plan = buildRemuxPlan({
      input: join(root, 'movie.mkv'),
      container: 'mkv',
      additionalInputs: [{ path: srtFile, map: ['1:0'], codec: 'subrip' }],
    });
    const ms = timer.elapsedMs();
    const after = memorySnapshot();

    expect(ms).toBeLessThan(SRT_PLAN_BUDGET_MS);
    const rssDelta = after.rss - before.rss;
    expect(rssDelta, 'plan building must not read the 100 MB SRT').toBeLessThan(20 * 1024 * 1024);
    expect(plan.options.additionalInputs?.[0].path).toBe(srtFile);

    console.log(`  100 MB SRT remux plan: ${ms.toFixed(1)}ms, RSS delta ${formatBytes(rssDelta)}`);
    results.push({
      test: 'Phase 8 io: 100 MB SRT remux plan (path-bounded)',
      phase: 'phase8-io',
      durationMs: ms,
      memoryBefore: { rss: before.rss, heapUsed: before.heapUsed },
      memoryAfter: { rss: after.rss, heapUsed: after.heapUsed },
      memoryDeltaRss: rssDelta,
      memoryDeltaHeap: after.heapUsed - before.heapUsed,
      passed: ms < SRT_PLAN_BUDGET_MS && rssDelta < 20 * 1024 * 1024,
      details: { ms, rssDelta },
      timestamp: new Date().toISOString(),
    });
  });
});
