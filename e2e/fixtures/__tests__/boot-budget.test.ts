import { describe, expect, it } from 'vitest';
import {
  BOOT_BUDGET_TOLERANCE,
  BOOT_POLL_CEILING_MS,
  checkBootBudget,
  median,
  parseBootBudgetMs,
  platformKey,
  readBootBudgetMs,
} from '../boot-budget';

describe('platformKey', () => {
  it('joins platform and arch the way perf-compare.mjs does', () => {
    expect(platformKey('win32', 'x64')).toBe('win32-x64');
    expect(platformKey('linux', 'arm64')).toBe('linux-arm64');
  });

  it('defaults to the running process', () => {
    expect(platformKey()).toBe(`${process.platform}-${process.arch}`);
  });
});

describe('median', () => {
  it('takes the middle value of an odd-sized set', () => {
    expect(median([2023, 1907, 2225])).toBe(2023);
  });

  it('averages the two middle values of an even-sized set', () => {
    expect(median([100, 200, 300, 400])).toBe(250);
  });

  it('does not depend on input order', () => {
    expect(median([300, 100, 200])).toBe(200);
    expect(median([100, 300, 200])).toBe(200);
  });

  it('does not mutate the caller array', () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });

  it('handles duplicates and a single sample', () => {
    expect(median([5, 5, 5])).toBe(5);
    expect(median([42])).toBe(42);
  });

  it('handles negative values', () => {
    expect(median([-10, 0, 10])).toBe(0);
  });

  it('throws on an empty set rather than returning NaN', () => {
    expect(() => median([])).toThrow(/at least one sample/);
  });
});

describe('parseBootBudgetMs', () => {
  const withBudget = (value: unknown) => ({ e2e: { bootBudgetMs: { 'win32-x64': value } } });

  it('reads the budget for the requested platform', () => {
    expect(parseBootBudgetMs(withBudget(2000), 'win32-x64')).toBe(2000);
  });

  it('returns null when the platform has no budget', () => {
    expect(parseBootBudgetMs(withBudget(2000), 'linux-x64')).toBeNull();
  });

  it('returns null when the document has no e2e section at all', () => {
    expect(parseBootBudgetMs({ platforms: {} }, 'win32-x64')).toBeNull();
    expect(parseBootBudgetMs({}, 'win32-x64')).toBeNull();
  });

  it('returns null for an explicit null budget', () => {
    expect(parseBootBudgetMs(withBudget(null), 'win32-x64')).toBeNull();
  });

  it('returns null for a non-object document', () => {
    expect(parseBootBudgetMs(null, 'win32-x64')).toBeNull();
    expect(parseBootBudgetMs(undefined, 'win32-x64')).toBeNull();
    expect(parseBootBudgetMs(42, 'win32-x64')).toBeNull();
  });

  // A typo'd budget must not silently disable the gate.
  it.each([
    ['zero', 0],
    ['negative', -1],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['string', '2000'],
    ['object', {}],
  ])('throws on a %s budget rather than treating it as absent', (_label, value) => {
    expect(() => parseBootBudgetMs(withBudget(value), 'win32-x64')).toThrow(/must be a positive number/);
  });
});

describe('checkBootBudget', () => {
  it('defaults the tolerance to 25%', () => {
    expect(BOOT_BUDGET_TOLERANCE).toBe(0.25);
  });

  it('passes a boot comfortably under budget', () => {
    const verdict = checkBootBudget({ actualMs: 1500, budgetMs: 2000, platform: 'win32-x64' });
    expect(verdict).toMatchObject({ status: 'ok', actualMs: 1500, budgetMs: 2000, limitMs: 2500 });
  });

  it('treats exactly budget + tolerance as passing', () => {
    expect(checkBootBudget({ actualMs: 2500, budgetMs: 2000 }).status).toBe('ok');
  });

  it('fails one millisecond past budget + tolerance', () => {
    const verdict = checkBootBudget({ actualMs: 2501, budgetMs: 2000, platform: 'win32-x64' });
    expect(verdict).toMatchObject({ status: 'over-budget', limitMs: 2500, overByMs: 1 });
  });

  it('reports no-budget for both null and undefined', () => {
    expect(checkBootBudget({ actualMs: 9000, budgetMs: null, platform: 'linux-x64' })).toEqual({
      status: 'no-budget',
      actualMs: 9000,
      platform: 'linux-x64',
    });
    expect(checkBootBudget({ actualMs: 9000, budgetMs: undefined }).status).toBe('no-budget');
  });

  it('honours a custom tolerance', () => {
    expect(checkBootBudget({ actualMs: 1100, budgetMs: 1000, tolerance: 0.5 }).status).toBe('ok');
    expect(checkBootBudget({ actualMs: 1600, budgetMs: 1000, tolerance: 0.5 }).status).toBe('over-budget');
  });

  it('defaults the reported platform to the running process', () => {
    expect(checkBootBudget({ actualMs: 1, budgetMs: 10 }).platform).toBe(`${process.platform}-${process.arch}`);
  });

  it('rejects a non-positive budget instead of ignoring it', () => {
    expect(() => checkBootBudget({ actualMs: 1, budgetMs: 0 })).toThrow(/must be a positive number/);
    expect(() => checkBootBudget({ actualMs: 1, budgetMs: Number.NaN })).toThrow(/must be a positive number/);
  });
});

describe('readBootBudgetMs', () => {
  it('returns null when the baseline file is absent', () => {
    expect(readBootBudgetMs('win32-x64', 'does/not/exist.json')).toBeNull();
  });

  it('strips a BOM, as PowerShell-written files carry one', () => {
    const file = `${process.env.TEMP ?? '/tmp'}/encodex-baseline-bom-${process.pid}.json`;
    require('fs').writeFileSync(file, `\uFEFF${JSON.stringify({ e2e: { bootBudgetMs: { 'win32-x64': 1234 } } })}`, 'utf8');
    try {
      expect(readBootBudgetMs('win32-x64', file)).toBe(1234);
    } finally {
      require('fs').unlinkSync(file);
    }
  });
});

describe('poll ceiling', () => {
  it('keeps the original 30 s hard cap', () => {
    expect(BOOT_POLL_CEILING_MS).toBe(30_000);
  });
});
