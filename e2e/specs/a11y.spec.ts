/**
 * @fileoverview Phase 5.3 committed gate: every route passes the FULL axe-core
 * rule set (including `color-contrast` and the document-level rules) at every
 * responsive width, under both themes, in a real browser against the built
 * app.
 *
 * jsdom cannot run `color-contrast` (every color resolves to its initial value
 * before paint) and has no viewport, so this is the tier where paint facts and
 * responsive breakpoints finally run. The matrix is 12 routes x light/dark x
 * 320/768/1440 = 72 cells.
 *
 * Two transient artifacts are handled before each axe run:
 *
 *  - Tooltips are open because the last action was a nav-row click that left
 *    focus on the row (condensed drawer) or hover on it. `blur()` closes
 *    focus-triggered tooltips and `mouse.move(1, 1)` clears hover-triggered
 *    ones; MUI unmounts the underlying popper when the tooltip closes, so both
 *    the `.MuiTooltip-popper` `region` nodes and the `.MuiTooltip-tooltip`
 *    `color-contrast` nodes disappear. The committed gate still keeps a narrow
 *    defensive allowlist for the popper `region` nodes only, so a mid-transition
 *    popper on a slow CI box cannot flake the matrix; anything else fails.
 *  - The Footer's `UpdateLoader` only mounts while a real updater check is
 *    running, which the test harness never triggers, so the 14px progressbar
 *    is not present under test.
 *
 * @see plans/ADVERSARIAL_TEST_HARDENING_PLAN.md, Phase 5.3
 */

import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { launchApp, closeApp, reloadSession, type AppSession } from '../fixtures/app';
import { runAxeOnPage, type AxePageResult } from '../fixtures/axe-browser';
import { THEME_STORAGE_KEY } from '../../src/shared/app-constants';

const ROUTES = [
  { path: '/', testId: 'nav-item-dashboard' },
  { path: '/convert', testId: 'nav-item-convert' },
  { path: '/media-info', testId: 'nav-item-media-info' },
  { path: '/image-compress', testId: 'nav-item-image-compress' },
  { path: '/audio-extract', testId: 'nav-item-audio-extract' },
  { path: '/video-cut', testId: 'nav-item-video-cut' },
  { path: '/remux', testId: 'nav-item-remux' },
  { path: '/demux', testId: 'nav-item-demux' },
  { path: '/batch', testId: 'nav-item-batch' },
  { path: '/logs', testId: 'nav-item-logs' },
  { path: '/settings', testId: 'nav-item-settings' },
  { path: '/about', testId: 'nav-item-about' },
] as const;

const THEMES = ['light', 'dark'] as const;
const WIDTHS = [320, 768, 1440] as const;
const HEIGHT = 900;

const ALLOWED_ARTIFACTS = new Set(['.MuiTooltip-popper']);

/**
 * Closes transient MUI tooltip poppers: blur the focused nav row and move the
 * pointer away, then let the close transition unmount the popper.
 */
async function dismissTransientOverlays(session: AppSession): Promise<void> {
  await session.page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
  });
  await session.page.mouse.move(1, 1);
  await session.page.waitForTimeout(200);
}

/**
 * Asserts the cell has zero axe violations (the transient tooltip popper's
 * `region` nodes are the only carve-out). axe's `incomplete` results are axe's
 * own "needs manual review" contract (color-contrast on gradients/images,
 * `aria-prohibited-attr` on role-ambiguous nodes, ...) and are NOT a failure;
 * they are tallied for the summary so the manual-review surface stays visible.
 * @param {AxePageResult} result - The page run to check.
 * @param {string} label - Human-readable cell label for failure messages.
 * @param {Map<string, number>} incompleteByRule - Aggregated manual-review tally.
 */
function assertAxeClean(result: AxePageResult, label: string, incompleteByRule: Map<string, number>): void {
  const realViolations = result.violations
    .map((v) => ({
      ...v,
      nodes: v.nodes.filter((n) => !(v.id === 'region' && n.target.some((t) => [...ALLOWED_ARTIFACTS].some((sel) => t.includes(sel))))),
    }))
    .filter((v) => v.nodes.length > 0);

  expect(realViolations, `${label} must have zero axe violations`).toEqual([]);
  for (const id of result.incomplete) {
    incompleteByRule.set(id, (incompleteByRule.get(id) ?? 0) + 1);
  }
}

describe('5.3 full-matrix browser axe gate (12 routes x light/dark x 320/768/1440)', () => {
  let session: AppSession;
  let cells: string[] = [];

  beforeAll(async () => {
    session = await launchApp();
  });

  afterAll(async () => {
    await closeApp(session.app, session.userDataDir);
  });

  it('asserts zero axe violations on every route x theme x width cell', { timeout: 600_000 }, async () => {
    cells = [];
    const incompleteByRule = new Map<string, number>();
    for (const theme of THEMES) {
      await session.page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: THEME_STORAGE_KEY, value: theme });
      if (theme !== 'light') {
        session = await reloadSession(session);
      }
      for (const route of ROUTES) {
        // The drawer only renders its nav items when the permanent drawer is
        // open, which requires a desktop viewport. Move wide before every hop
        // so a route is never unreachable because the previous cell left the
        // window at a mobile width.
        await session.page.setViewportSize({ width: 1440, height: HEIGHT });
        await session.page.locator(`[data-testid="${route.testId}"]`).waitFor({ state: 'visible', timeout: 15_000 });
        await session.page.locator(`[data-testid="${route.testId}"]`).click();
        await session.page.waitForFunction((expected) => window.location.hash.startsWith(`#${expected}`), route.path, { timeout: 15_000 });
        for (const width of WIDTHS) {
          const label = `${theme} ${route.path} @ ${width}`;
          await session.page.setViewportSize({ width, height: HEIGHT });
          await session.page.waitForTimeout(300);
          await dismissTransientOverlays(session);
          const result = await runAxeOnPage(session.page);
          assertAxeClean(result, label, incompleteByRule);
          cells.push(label);
        }
      }
    }

    expect(cells.length, 'the full theme x route x width matrix must run').toBe(THEMES.length * ROUTES.length * WIDTHS.length);
    const incompleteNote =
      [...incompleteByRule.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, count]) => `${id}=${count}`)
        .join(', ') || 'none';
    console.log(`Axe matrix passed: ${cells.length} cells; manual-review (incomplete) rules: ${incompleteNote}.`);
  });
});
