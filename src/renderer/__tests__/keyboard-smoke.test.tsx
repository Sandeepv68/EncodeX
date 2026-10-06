/**
 * @fileoverview Phase 5.3 keyboard smoke (plan row 5.3, finding F7): every
 * routed page must be fully reachable and traversable by keyboard, in the exact
 * focus order a browser would move through, with `Tab`-into-`<body>` as the only
 * exit once the route is exhausted (no focus-trap leaks).
 *
 * The expected tab order is computed with the same rules user-event applies when
 * it moves focus: its focusable selector, the enabled/visible filters, positive
 * tabindexes sorted before `tabindex="0"` elements, and radio-group pruning,
 * with `document.body` as the wrap-around anchor. Each page is then walked with
 * `user.tab()` / `user.tab({ shift: true })` and compared element-for-element
 * against that expectation, so a page that hides a control from the tab
 * sequence, seeks in document order instead of tabindex order, or traps focus
 * before the walk can exit to `<body>` fails here with the offending diff.
 *
 * Runs in the shared unit tier; the harness contract is the same as the other
 * Phase 5 route suites (`renderPage` + `stubScrollIntoView`), so pages render in
 * their real provider stack without the App chrome.
 *
 * @see plans/ADVERSARIAL_TEST_HARDENING_PLAN.md, 5.3
 */

import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PAGE_ROUTES, renderPage, stubScrollIntoView, stubViewportWidth } from '../../test-utils/page-render';
import { expectAppLog, expectCrash } from '../../test-utils/crash-tripwire';

/**
 * The focusable selector `@testing-library/user-event` walks. Kept next to the
 * test so the expected-order computation and the walk stay over one source of
 * truth instead of two drifting lists.
 * @const {string}
 */
const FOCUSABLE_SELECTOR = [
  'input:not([type=hidden]):not([disabled])',
  'button:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  'a[href]',
  '[tabindex]:not([disabled])',
].join(', ');

/** Tags whose `disabled` attribute propagates to descendants, per user-event. @const {ReadonlySet<string>} */
const DISABLED_TAGS = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'OPTGROUP', 'OPTION']);

/**
 * Mirror of user-event's `isDisabled`: a control is disabled when it or any
 * ancestor control carries `disabled`, or an ancestor fieldset does (outside its
 * first legend).
 * @param {HTMLElement} el - The element to test.
 * @returns {boolean} True when the element is disabled or inside one.
 */
function isDisabledLike(el: HTMLElement): boolean {
  for (let cur: HTMLElement | null = el; cur; cur = cur.parentElement) {
    if (DISABLED_TAGS.has(cur.tagName)) {
      if (cur.hasAttribute('disabled')) return true;
    } else if (cur.tagName === 'FIELDSET' && cur.hasAttribute('disabled')) {
      const legend = cur.querySelector(':scope > legend');
      if (!legend || !legend.contains(el)) return true;
    }
  }
  return false;
}

/**
 * Mirror of user-event's `isVisible`: any ancestor chain with computed
 * `display:none` or `visibility:hidden` removes the element from the walk.
 * @param {HTMLElement} el - The element to test.
 * @returns {boolean} True when the element and all ancestors are visible.
 */
function isVisibleLike(el: HTMLElement): boolean {
  for (let cur: HTMLElement | null = el; cur; cur = cur.parentElement) {
    const style = getComputedStyle(cur);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
}

/**
 * Recomputes the tab order a browser would follow, mirroring user-event's
 * `getTabDestination`: focusables sorted by tabindex (positives ascending,
 * `tabindex="0"` last, staying in document order within each band), radio
 * groups pruned to the checked member, hidden elements dropped.
 * @returns {HTMLElement[]} The expected tab-stop sequence, excluding `<body>`.
 */
function expectedTabOrder(): HTMLElement[] {
  const enabled = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((el) => !isDisabledLike(el) && Number(el.getAttribute('tabindex')) >= 0)
    .sort((a, b) => {
      const ia = Number(a.getAttribute('tabindex'));
      const ib = Number(b.getAttribute('tabindex'));
      if (ia === ib) return 0;
      if (ia === 0) return 1;
      if (ib === 0) return -1;
      return ia - ib;
    });

  const pruned: HTMLElement[] = [];
  const checkedRadio = new Set<string>();
  for (const el of enabled) {
    if (el instanceof HTMLInputElement && el.type === 'radio' && el.name) {
      if (el.checked) {
        for (let i = pruned.length - 1; i >= 0; i -= 1) {
          const candidate = pruned[i];
          if (candidate instanceof HTMLInputElement && candidate.type === 'radio' && candidate.name === el.name) {
            pruned.splice(i, 1);
          }
        }
        pruned.push(el);
        checkedRadio.add(el.name);
        continue;
      }
      if (checkedRadio.has(el.name)) continue;
    }
    pruned.push(el);
  }

  return pruned.filter((el) => isVisibleLike(el));
}

/**
 * A stable fingerprint of the current tab order, so the settle loop below can
 * recognise when the page has finished hydrating.
 * @returns {string} The zero-indexed positions of the tab stops in the DOM.
 */
function tabSignature(): string {
  const all = Array.from(document.querySelectorAll('*'));
  return expectedTabOrder()
    .map((el) => String(all.indexOf(el)))
    .join(',');
}

/**
 * Lets mount effects and async store loads settle for as long as the tab order
 * keeps changing, then returns the order as it stabilised.
 * @returns {Promise<HTMLElement[]>} The converged tab-stop sequence.
 */
async function settleToStableTabOrder(): Promise<HTMLElement[]> {
  let previous = '';
  for (let i = 0; i < 40; i += 1) {
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    const signature = tabSignature();
    if (signature === previous) return expectedTabOrder();
    previous = signature;
  }
  return expectedTabOrder();
}

describe('5.3 keyboard smoke (12 routed pages: Tab order, Shift+Tab back, no trap leaks)', () => {
  let restoreScrollIntoView: (() => void) | undefined;

  beforeAll(() => {
    restoreScrollIntoView = stubScrollIntoView();
  });

  afterAll(() => {
    restoreScrollIntoView?.();
  });

  for (const route of PAGE_ROUTES) {
    it(`${route.name}: Tab reaches every focusable in browser order and Shift+Tab returns exactly`, async () => {
      // A benign page legitimately app-warns; the strict tripwire classifies
      // console/window faults as fatal, which is the category this suite is for.
      expectAppLog('warn', /\[WARN\] \[[^\]]*\]/);
      // MUI transitions (BatchQueue's collapsible sections, dialog fades) settle
      // on react-transition-group timers that can fire between two `user.tab`
      // calls, outside `act`. jsdom cannot host them inside the walk; declaring
      // them keeps the tripwire strict for everything else (same carve-out as
      // the Phase 5.3 axe suite).
      expectCrash('consoleError', /not wrapped in act/);

      const user = userEvent.setup();
      const restoreWidth = stubViewportWidth(1440);
      const result = renderPage(route.name);

      try {
        const expected = await settleToStableTabOrder();
        expect(expected.length, `${route.name} exposes at least one focusable control`).toBeGreaterThan(0);

        const forward: HTMLElement[] = [];
        for (let i = 0; i < 250; i += 1) {
          await user.tab();
          if (document.activeElement === document.body) break;
          forward.push(document.activeElement as HTMLElement);
        }

        expect(forward, `${route.name}: Tab order diverges from browser focus order`).toEqual(expected);
        expect(document.activeElement, `${route.name}: Tab must exit to <body>, not loop forever`).toBe(document.body);

        const backward: HTMLElement[] = [];
        for (let i = 0; i < 250; i += 1) {
          await user.tab({ shift: true });
          if (document.activeElement === document.body) break;
          backward.push(document.activeElement as HTMLElement);
        }

        expect(backward, `${route.name}: Shift+Tab must walk the same order in reverse`).toEqual([...forward].reverse());
        expect(document.activeElement, `${route.name}: Shift+Tab must also exit to <body>`).toBe(document.body);
      } finally {
        result.unmount();
        restoreWidth();
      }
    });
  }
});
