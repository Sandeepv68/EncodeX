import { describe, it, expect } from 'vitest';
import { QUEUE_EXPORT_MAX_JOBS, QUEUE_EXPORT_VERSION, parseQueueExport, validateQueueExport } from '../queue-transfer';

/**
 * @fileoverview Phase 8 DoS/resource-limit budgets for queue export/import.
 *
 * An export file is attacker-controlled input read off disk and turned into
 * queued ffmpeg jobs, so both the parse step and the per-record validation must
 * be bounded in time regardless of the file's size or shape. The budgets are
 * generous enough to never flake but tight enough to trip on any accidental
 * super-linear behaviour in `JSON.parse` (deep nesting), the record loop, or
 * the size cap.
 */

const BUDGET_MS = 3_000;

function elapsedMs(fn: () => unknown): number {
  const start = performance.now();
  const result = fn();
  return performance.now() - start;
}

function makeJob(i: number, padding: number): unknown {
  return {
    input: `/media/folder/long/path/input${String(i).padStart(5, '0')}.mp4`.padEnd(padding, 'a'),
    output: `/converted/long/path/output${String(i).padStart(5, '0')}.mp4`.padEnd(padding, 'b'),
    options: { videoCodec: 'libx264', audioCodec: 'aac', videoBitrate: '2000k', audioBitrate: '192k', qscale: 23 },
    transcoder: 'FFMPEG',
  };
}

describe('resource budget: queue import', () => {
  it('parses and validates a ~10 MB export within the budget', () => {
    const jobs = Array.from({ length: QUEUE_EXPORT_MAX_JOBS }, (_, i) => makeJob(i, 400));
    const raw = JSON.stringify({ version: QUEUE_EXPORT_VERSION, concurrency: 2, jobs });
    expect(raw.length).toBeGreaterThan(8_000_000);
    const ms = elapsedMs(() => {
      const parsed = parseQueueExport(raw);
      expect(parsed).not.toBeNull();
      expect(parsed!.jobs).toHaveLength(QUEUE_EXPORT_MAX_JOBS);
    });
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it('rejects an export beyond the job cap within the budget', () => {
    const jobs = Array.from({ length: QUEUE_EXPORT_MAX_JOBS + 1 }, (_, i) => makeJob(i, 10));
    const raw = JSON.stringify({ version: QUEUE_EXPORT_VERSION, concurrency: 2, jobs });
    const ms = elapsedMs(() => {
      expect(parseQueueExport(raw)).toBeNull();
      expect(validateQueueExport(JSON.parse(raw))).toBeNull();
    });
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it('survives hostile 10 MB JSON bodies within the budget without hanging', () => {
    const bodies = [' '.repeat(10_000_000), `{"jobs":${'1'.repeat(10_000_000)}`, `${'['.repeat(100_000)}0${']'.repeat(100_000)}`];
    for (const body of bodies) {
      const ms = elapsedMs(() => {
        expect(parseQueueExport(body)).toBeNull();
      });
      expect(ms).toBeLessThan(BUDGET_MS);
    }
  });
});
