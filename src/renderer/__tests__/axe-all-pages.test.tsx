/**
 * @fileoverview Phase 5.3 axe matrix (finding F7): `assertNoAxeViolations` on
 * all 12 routed pages in both themes at the three layout breakpoints the app
 * ships.
 *
 * Before this suite, axe ran ad hoc on a handful of pages/components in their
 * own tests. This suite renders every routed page in light + dark at 320 /
 * 768 / 1440px -- the breakpoints `useMediaQuery` maps to mobile / tablet /
 * desktop -- and runs axe against each one in *strict* mode.
 *
 * Strict mode re-enables the DOM-structural rules (`region`,
 * `landmark-one-main`, `scrollable-region-focusable`) that the shared helper
 * disables by default because most page tests render components with no
 * landmark scaffold. Here every page is mounted inside a single `<main>`
 * landmark, which is exactly the contract the real app provides (`App.tsx`
 * renders route content inside `MainContent`), so the rules can be judged
 * honestly. `color-contrast` stays disabled: jsdom cannot compute painted
 * colors, so axe could never observe a real pair; contrast is covered by the
 * token-level `colors.test.ts`.
 *
 * Runs as its own CI gate (`test:a11y`), the way the plan tables it, because
 * 72 axe runs are too slow for the shared unit tier.
 */

import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest';
import { act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { PAGE_ROUTES, renderPage, stubScrollIntoView, stubViewportWidth } from '../../test-utils/page-render';
import { assertNoAxeViolations } from '../../test-utils/axe';
import { expectAppLog, expectCrash } from '../../test-utils/crash-tripwire';
import { THEME_STORAGE_KEY } from '../../shared/app-constants';
import type { ThemeId } from '../types';

/** The two card themes every page must survive. */
const THEMES: readonly ThemeId[] = ['light', 'dark'];

/** The three layout widths the app's breakpoints map to. */
const WIDTHS: readonly number[] = [320, 768, 1440];

/** Wraps a page subtree in the single landmark the real app provides. */
const inMain = (children: ReactNode): ReactNode => <main>{children}</main>;

describe('5.3 axe matrix (12 routes x light/dark x 320/768/1440)', () => {
  let restoreScrollIntoView: (() => void) | undefined;

  beforeAll(() => {
    restoreScrollIntoView = stubScrollIntoView();
  });

  afterAll(() => {
    restoreScrollIntoView?.();
  });

  it('covers the declared axes (guard against a loop that cannot empty out)', () => {
    expect(PAGE_ROUTES).toHaveLength(12);
    expect(THEMES).toEqual(['light', 'dark']);
    expect(WIDTHS).toEqual([320, 768, 1440]);
  });

  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      it(`no axe violations on any route (${theme}, ${width}px)`, async () => {
        // Pages in a benign default state legitimately app-warn; the strict
        // tripwire's console/window-error tiers stay fatal for the real
        // category we care about here.
        expectAppLog('warn', /\[WARN\] \[[^\]]*\]/);

        // MUI `Collapse` (BatchQueue's expandable sections) schedules its
        // enter/exit state updates on react-transition-group timers that fire
        // ~300ms after mount. The per-route `axe.run` runs outside `act`, so a
        // transition settling mid-scan trips React's "not wrapped in act"
        // consoleError. The update is legitimate app bookkeeping that a real
        // browser runs happily; jsdom simply cannot host the async axe pass
        // inside `act`. Declaring it keeps the tripwire strict for everything
        // else while excusing this jsdom-only artifact.
        expectCrash('consoleError', /not wrapped in act/);

        localStorage.setItem(THEME_STORAGE_KEY, theme);
        const restoreWidth = stubViewportWidth(width);
        try {
          const failures: string[] = [];
          for (const route of PAGE_ROUTES) {
            const result = renderPage(route.name, { theme, wrap: inMain });

            // Let mount effects (async store loads, resize observers) settle
            // so axe sees the finished tree, not the loading skeleton.
            await act(async () => {
              await Promise.resolve();
            });

            try {
              await assertNoAxeViolations(result.container, { strict: true });
            } catch (err) {
              failures.push(`\n${route.name}: ${(err as Error).message}${(err as Error).message?.length ? '' : String(err)}`);
            }

            result.unmount();
          }
          expect(failures, `axe violations @ ${theme} / ${width}px across routes:${failures.join('')}`).toEqual([]);
        } finally {
          restoreWidth();
        }
      });
    }
  }
});
