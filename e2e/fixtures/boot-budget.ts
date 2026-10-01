/**
 * @fileoverview Cold-boot budget accounting for the e2e harness.
 *
 * F11: `getMainWindow()` used to poll for 30 s and, on success, report nothing.
 * A boot that doubled from 2 s to 6 s looked identical to a boot that was fine
 * just on a busy day - the regression was absorbed as test latency forever. The
 * 30 s ceiling has to stay (a window that never appears is a real hang and must
 * still fail fast), so the fix is to keep the ceiling and add *accounting* on
 * top of it: record what boot actually cost, and fail a named perf assertion
 * when it regresses past the platform budget.
 *
 * Enforcement is platform-scoped on purpose. `perf/baseline.json` only ever has
 * data for the platform that generated it, so a runner with no budget for its own
 * platform gets `no-budget` and reports instead of failing. A boot budget pulled
 * from a different machine class is worse than no budget at all.
 *
 * This module is deliberately free of Electron/Playwright imports so the verdict
 * rules can be unit-tested without launching an app.
 */

import * as fs from 'fs';
import * as path from 'path';

/** Budget overrun allowed before the boot assertion fails. */
export const BOOT_BUDGET_TOLERANCE = 0.25;

/** Hard ceiling on the `getMainWindow` poll; a slower boot is a hang, not a regression. */
export const BOOT_POLL_CEILING_MS = 30_000;

/**
 * Builds the `<platform>-<arch>` key used by `perf/baseline.json`.
 *
 * Deliberately the same expression as `scripts/perf-compare.mjs`; if the two
 * drift, budgets are looked up under a key that never exists and every run
 * silently degrades to report-only.
 * @param {string} [platform] - Defaults to the current process platform.
 * @param {string} [arch] - Defaults to the current process arch.
 * @returns {string} The baseline platform key.
 */
export function platformKey(platform: string = process.platform, arch: string = process.arch): string {
  return `${platform}-${arch}`;
}

export type BootBudgetVerdict =
  | { status: 'no-budget'; actualMs: number; platform: string }
  | { status: 'ok'; actualMs: number; platform: string; budgetMs: number; limitMs: number }
  | { status: 'over-budget'; actualMs: number; platform: string; budgetMs: number; limitMs: number; overByMs: number };

/**
 * Median of a sample set.
 *
 * Odd counts resolve to the middle element; even counts average the two middle
 * ones, which keeps a 2-sample median from silently picking the worse value.
 * @param {number[]} values - Samples; must not be empty.
 * @returns {number} The median.
 */
export function median(values: number[]): number {
  if (values.length === 0) throw new Error('median() requires at least one sample');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Extracts this platform's cold-boot budget from a parsed baseline document.
 *
 * A budget that is present but unusable (0, negative, NaN, a string) throws
 * rather than being treated as "no budget": `perf/baseline.json` is hand-edited,
 * and silently ignoring a typo there would turn the gate off without any signal,
 * which is the exact failure mode this phase exists to prevent.
 * @param {unknown} baseline - Parsed `perf/baseline.json` contents.
 * @param {string} platform - Baseline platform key to look up.
 * @returns {number | null} The budget in ms, or null when this platform has none.
 */
export function parseBootBudgetMs(baseline: unknown, platform: string): number | null {
  if (baseline === null || typeof baseline !== 'object') return null;
  const budgets = (baseline as { e2e?: { bootBudgetMs?: Record<string, unknown> } }).e2e?.bootBudgetMs;
  if (budgets === null || typeof budgets !== 'object') return null;
  const raw = (budgets as Record<string, unknown>)[platform];
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) {
    throw new Error(`perf/baseline.json e2e.bootBudgetMs["${platform}"] must be a positive number of ms, got ${JSON.stringify(raw)}`);
  }
  return raw;
}

/**
 * Compares a measured boot against a platform budget.
 *
 * The limit is `budget * (1 + tolerance)`, so a budget of 2000 ms tolerates
 * 2500 ms and fails 2501 ms - the boundary itself is inclusive, which keeps
 * "exactly at budget plus tolerance" green instead of flapping on float noise.
 * @param {object} input - Measurement and budget to compare.
 * @param {number} input.actualMs - Measured cold-boot duration.
 * @param {number | null | undefined} input.budgetMs - Budget for this platform, if any.
 * @param {number} [input.tolerance] - Overrun fraction allowed.
 * @param {string} [input.platform] - Platform key, for the verdict only.
 * @returns {BootBudgetVerdict} Whether the boot fits the budget.
 */
export function checkBootBudget(input: {
  actualMs: number;
  budgetMs: number | null | undefined;
  tolerance?: number;
  platform?: string;
}): BootBudgetVerdict {
  const { actualMs, budgetMs } = input;
  const tolerance = input.tolerance ?? BOOT_BUDGET_TOLERANCE;
  const platform = input.platform ?? platformKey();

  if (budgetMs === null || budgetMs === undefined) {
    return { status: 'no-budget', actualMs, platform };
  }
  if (typeof budgetMs !== 'number' || !Number.isFinite(budgetMs) || budgetMs <= 0) {
    throw new Error(`boot budget must be a positive number of ms, got ${JSON.stringify(budgetMs)}`);
  }
  const limitMs = budgetMs * (1 + tolerance);
  if (actualMs <= limitMs) {
    return { status: 'ok', actualMs, platform, budgetMs, limitMs };
  }
  return { status: 'over-budget', actualMs, platform, budgetMs, limitMs, overByMs: actualMs - limitMs };
}

/** Default location of the perf baseline, resolved the same way `e2e/helpers.ts` resolves the repo root. */
export function defaultBaselinePath(): string {
  return path.resolve(__dirname, '..', '..', 'perf', 'baseline.json');
}

/**
 * Reads this platform's cold-boot budget off disk.
 *
 * A missing or unreadable baseline is reported as "no budget" instead of
 * throwing: the e2e suite must still run on a checkout with no perf data. A
 * *malformed* baseline still throws, via {@link parseBootBudgetMs}.
 * @param {string} [platform] - Platform key to look up.
 * @param {string} [baselinePath] - Override for the baseline location.
 * @returns {number | null} The budget in ms, or null when unavailable.
 */
export function readBootBudgetMs(platform: string = platformKey(), baselinePath: string = defaultBaselinePath()): number | null {
  let text: string;
  try {
    text = fs.readFileSync(baselinePath, 'utf8');
  } catch {
    return null;
  }
  return parseBootBudgetMs(JSON.parse(text.replace(/^\uFEFF/, '')), platform);
}
