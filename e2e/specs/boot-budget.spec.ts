/**
 * @fileoverview Cold-boot regression guard (F11).
 *
 * This is the only spec that fails on performance, deliberately. Boot cost is a
 * property of the machine as much as of the app, so coupling every functional
 * spec to a duration threshold would turn a busy CI runner into a wall of
 * unrelated red. Instead the boot is recorded by the harness and asserted here,
 * where a failure reads as "boot regressed" rather than "media-info failed".
 *
 * The measurement is a median of {@link BOOT_SAMPLES} launches, not a single
 * launch. A one-shot reading on Windows spans roughly 1.9 s to 3.4 s for an
 * unchanged binary - antivirus scans and background load alone exceed the 25%
 * tolerance, so a single-sample gate here would flap red constantly and get
 * ignored, which is F11 all over again. Median-of-N is also what
 * `perf/baseline.json` already stores (`medianMs`), so budget and measurement
 * agree on what a number means.
 *
 * The budget is per-platform. On a platform with no recorded budget this test
 * reports and skips instead of failing - there is nothing to compare against,
 * and importing a threshold from another machine class would be noise.
 */

import { afterAll, beforeAll, expect, test } from 'vitest';
import { BOOT_BUDGET_TOLERANCE, checkBootBudget, median, readBootBudgetMs } from '../fixtures/boot-budget';
import { closeApp, launchApp } from '../fixtures/app';

/** Launches per run. Three is enough to drop a single contended launch. */
const BOOT_SAMPLES = 3;

describe('cold boot', () => {
  const samples: number[] = [];

  beforeAll(async () => {
    for (let i = 0; i < BOOT_SAMPLES; i += 1) {
      const session = await launchApp();
      samples.push(session.bootMs);
      await closeApp(session.app, session.userDataDir);
    }
  }, 180_000);

  afterAll(() => {
    samples.length = 0;
  });

  test('boots within the platform budget', async (ctx) => {
    const budgetMs = readBootBudgetMs();
    const bootMs = median(samples);
    const verdict = checkBootBudget({ actualMs: bootMs, budgetMs });

    // Always report the full spread, so a red run shows how noisy it was.
    console.log(
      `cold boot: median ${bootMs} ms of ${BOOT_SAMPLES} [${samples.join(', ')}] ` +
        `(platform=${verdict.platform}, budget=${budgetMs ?? 'none'}` +
        `${verdict.status === 'no-budget' ? '' : `, tolerance=${BOOT_BUDGET_TOLERANCE}, limit=${verdict.limitMs} ms`})`,
    );

    expect(samples).toHaveLength(BOOT_SAMPLES);

    if (verdict.status === 'no-budget') {
      // No recorded budget for this machine class: report only, never fail.
      ctx.skip();
      return;
    }

    if (verdict.status === 'over-budget') {
      throw new Error(
        `cold boot regressed: median ${verdict.actualMs} ms exceeds the ${verdict.platform} budget of ` +
          `${verdict.budgetMs} ms (+${BOOT_BUDGET_TOLERANCE * 100}% = ${verdict.limitMs} ms limit) by ${verdict.overByMs} ms. ` +
          `Samples: [${samples.join(', ')}] ms. Re-measure with "npm run perf:baseline" only if the slowdown is intended.`,
      );
    }

    expect(verdict.actualMs).toBeLessThanOrEqual(verdict.limitMs);
  });
});
