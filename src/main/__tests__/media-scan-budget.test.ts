import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { collectMediaFiles, expandMediaPaths } from '../media-files';

/**
 * @fileoverview Phase 8 DoS/resource-limit budgets for the batch folder scan.
 *
 * A real drop of a large folder is the "send 100 000 entries to the UI" case;
 * the full 100 000-file budget lives in the perf tier where the setup cost is
 * tracked, while this committed suite pinches the same algorithmic risk at
 * 30 000 real files: if the walk ever regresses to per-file stat() or an
 * O(n²) structure, the fixed-time budget trips. 30 000 files keeps the suite
 * comfortably inside the 30 s per-test timeout (setup ~12 s, scan ~30 ms).
 */

const SCAN_FILE_COUNT = 30_000;
const SUBDIR_COUNT = 30;
const SCAN_BUDGET_MS = 3_000;

let root: string;

function elapsedMs(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'encodex-scan-'));
  const perDir = SCAN_FILE_COUNT / SUBDIR_COUNT;
  for (let d = 0; d < SUBDIR_COUNT; d++) {
    const dir = join(root, `d${d}`);
    mkdirSync(dir);
    for (let i = 0; i < perDir; i++) {
      writeFileSync(join(dir, `f${d}_${String(i).padStart(5, '0')}.mp4`), '');
    }
    writeFileSync(join(dir, `notes${d}.txt`), 'ignored');
  }
}, 30_000);

afterAll(() => {
  if (root) rmSync(root, { recursive: true, force: true });
}, 30_000);

describe('resource budget: media folder scan', () => {
  it('collects every media file in a 30,000-file tree within the budget', () => {
    let result: string[] = [];
    const ms = elapsedMs(() => {
      result = collectMediaFiles(root);
    });
    expect(result).toHaveLength(SCAN_FILE_COUNT);
    expect(ms).toBeLessThan(SCAN_BUDGET_MS);
    expect(new Set(result).size).toBe(SCAN_FILE_COUNT);
    const sorted = [...result].sort();
    expect(result).toEqual(sorted);
  });

  it('deduplicates overlapping roots and mixed file paths within the budget', () => {
    const first = collectMediaFiles(root)[0];
    let result: string[] = [];
    const ms = elapsedMs(() => {
      result = expandMediaPaths([root, root, first, join(root, 'd0')]);
    });
    expect(result).toHaveLength(SCAN_FILE_COUNT);
    expect(ms).toBeLessThan(SCAN_BUDGET_MS);
  });

  it('walks a deep directory chain without overflowing the stack', () => {
    const deep = join(root, 'deep');
    const deepDir = join(deep, ...Array.from({ length: 300 }, (_, i) => `l${i}`));
    mkdirSync(deepDir, { recursive: true });
    writeFileSync(join(deepDir, 'leaf.mp4'), '');
    let result: string[] = [];
    const ms = elapsedMs(() => {
      result = collectMediaFiles(deep);
    });
    expect(result).toEqual([join(deepDir, 'leaf.mp4')]);
    expect(ms).toBeLessThan(SCAN_BUDGET_MS);
  });
});
