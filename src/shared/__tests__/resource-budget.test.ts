import { describe, it, expect } from 'vitest';
import {
  VIDEO_FILTER_MAX_ENTRIES,
  VIDEO_FILTER_MAX_ENTRY,
  buildFilterChain,
  normalizeFilterChain,
  validateVideoFilters,
} from '../video-filters';
import { formatBitrate, formatClockTime, formatDuration, formatSize, timeToSeconds } from '../../renderer/utils/formatters';

/**
 * @fileoverview Phase 8 DoS/resource-limit budgets for the filter chain and the
 * parsing/formatter functions that consume attacker-controlled strings.
 *
 * The budgets are deliberately generous (seconds) so they can never flake on
 * slow CI machines while still tripping on a quadratic or backtracking
 * regression: a synthetically slow path grows with the input size, so it blows
 * a fixed budget long before a linear one does. These are guards over the
 * functions that run on user-supplied queue/CLI/filter data, not micro-metric
 * timings.
 */

const WINDOWS_CREATEPROCESS_CMDLINE_LIMIT = 32_767;
const BUDGET_MS = 1_000;

function elapsedMs(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

describe('resource budget: video filter chain', () => {
  it('refuses a 1,000-entry filter chain within the budget', () => {
    const thousand = Array.from({ length: 1_000 }, () => 'eq=contrast=1.0');
    const ms = elapsedMs(() => {
      expect(validateVideoFilters(thousand)).toContain(`Too many filters (max ${VIDEO_FILTER_MAX_ENTRIES}).`);
    });
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it('normalizes a 1,000-entry chain within the budget', () => {
    const chain = 'eq=contrast=1.0,'.repeat(1_000);
    const ms = elapsedMs(() => {
      expect(normalizeFilterChain(chain)).toHaveLength(1_000);
    });
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it('validates the worst-case accepted chain within the budget and keeps ffmpeg argv legal on Windows', () => {
    const worstEntry = 'a'.repeat(VIDEO_FILTER_MAX_ENTRY);
    const worst = Array.from({ length: VIDEO_FILTER_MAX_ENTRIES }, () => worstEntry);
    const ms = elapsedMs(() => {
      expect(validateVideoFilters(worst)).toEqual([]);
    });
    expect(ms).toBeLessThan(BUDGET_MS);
    const chain = buildFilterChain({ videoFilters: worst });
    expect(chain).not.toBeNull();
    expect(chain!.length).toBeLessThan(WINDOWS_CREATEPROCESS_CMDLINE_LIMIT);
  });

  it('rejects an oversized single entry within the budget', () => {
    const entry = 'x'.repeat(1_000_000);
    const ms = elapsedMs(() => {
      expect(validateVideoFilters([entry])).toContain('Filter #1: Filter is too long.');
    });
    expect(ms).toBeLessThan(BUDGET_MS);
  });
});

describe('resource budget: adversarial parsing inputs', () => {
  it('parses pathological time strings within the budget', () => {
    const inputs = ['9'.repeat(100_000), `99:98:97:${'9'.repeat(100_000)}`, '9:'.repeat(50_000), '1:2:3.0000'.repeat(20_000)];
    for (const input of inputs) {
      const ms = elapsedMs(() => {
        timeToSeconds(input);
      });
      expect(ms).toBeLessThan(BUDGET_MS);
    }
  });

  it('formats pathological numeric inputs within the budget', () => {
    const calls: Array<() => string> = [
      () => formatBitrate('9'.repeat(100_000)),
      () => formatSize(Number.MAX_SAFE_INTEGER),
      () => formatSize(Number.POSITIVE_INFINITY),
      () => formatDuration(1e15),
      () => formatClockTime(86_399.9999),
      () => formatClockTime(1e15),
    ];
    for (const call of calls) {
      const ms = elapsedMs(call);
      expect(typeof call()).toBe('string');
      expect(ms).toBeLessThan(BUDGET_MS);
    }
  });

  it('keeps chain normalization linear on a huge hostile chain', () => {
    const chain = 'eq=contrast=1.0,'.repeat(50_000);
    const ms = elapsedMs(() => {
      expect(normalizeFilterChain(chain)).toHaveLength(50_000);
    });
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it('keeps filter validation linear on an oversized hostile list', () => {
    const entries = Array.from({ length: 50_000 }, () => 'eq=contrast=1.0');
    const ms = elapsedMs(() => {
      const errors = validateVideoFilters(entries);
      expect(errors).toContain(`Too many filters (max ${VIDEO_FILTER_MAX_ENTRIES}).`);
    });
    expect(ms).toBeLessThan(BUDGET_MS);
  });
});
