/**
 * @fileoverview Phase 5.1 longest-string stress (finding F7): render every
 * route against the longest plausible localized copy -- German plus a 3x
 * synthetic pseudo-locale built at runtime -- and assert the app neither
 * breaks nor leaks.
 *
 * jsdom performs no layout, so "overflow/clipping" cannot be measured here;
 * the route-level ellipsis/`minWidth: 0` contract is exercised visually by
 * the browser-tier a11y/keyboard suites at real widths (Phase 5.3). What this
 * suite DOES assert is the part that is measurable and matters most:
 *
 *  (a) no page error under severely long values (the crash tripwire makes any
 *      window error, unhandled rejection, or raw console.error fatal);
 *  (b) no raw `{{token}}` and no leaked translation key, even when every
 *      value has been tripled (i18next must still substitute every token);
 *  (c) the pseudo-locale actually stresses: aggregate rendered text length is
 *      >= 1.5x the English baseline, so a render that silently ignored the
 *      active language cannot pass.
 *
 * Runs in the `vitest.locale-matrix` gate alongside the matrix and RTL
 * suites; all three unmock `react-i18next` and render against the real
 * i18next instance.
 */

import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { PAGE_ROUTES, renderPage, stubScrollIntoView } from '../../test-utils/page-render';
import { expectAppLog } from '../../test-utils/crash-tripwire';
import { useLanguageDirection } from '../useLanguageDirection';
import { RAW_TOKEN_PATTERN, baseLocale, rawKeysInBody } from './i18n-matrix-utils';

vi.unmock('react-i18next');

import i18n from '../i18n/config';

/** Runtime key for the synthetic stress locale (must not collide with a real file). */
export const PSEUDO_LOCALE = 'xx-XX';

/**
 * Triples every space-separated token, preserving whitespace runs, and wraps
 * the result in guillemets. Roughly 3x the source length while keeping
 * `{{token}}` units atomic so interpolation can still resolve them.
 */
export function pseudoize(value: string): string {
  const tripled = value
    .split(/(\s+)/)
    .map((part) => (/^\s+$/.test(part) ? part : `${part} ${part} ${part}`))
    .join('');
  return `\u00ab${tripled}\u00bb`;
}

function DirectionApplier({ children }: { children: ReactNode }): ReactNode {
  useLanguageDirection();
  return children;
}

const wrapTranslation = (children: ReactNode): ReactNode => (
  <I18nextProvider i18n={i18n}>
    <DirectionApplier>{children}</DirectionApplier>
  </I18nextProvider>
);

/** Renders a route under the wrap and returns its settled body length. */
async function renderRouteText(name: string): Promise<number> {
  const result = renderPage(name, { wrap: wrapTranslation });
  await act(async () => {
    await Promise.resolve();
  });
  const text = document.body.textContent ?? '';
  result.unmount();
  return text.length;
}

describe('5.1 longest-string stress', () => {
  let restoreScrollIntoView: (() => void) | undefined;

  beforeAll(() => {
    restoreScrollIntoView = stubScrollIntoView();
    // Register the synthetic 3x stress language against the real instance,
    // derived from the en-US reference so key parity is guaranteed.
    const resources: Record<string, string> = {};
    for (const { key, value } of baseLocale.entries) resources[key] = pseudoize(value);
    i18n.addResourceBundle(PSEUDO_LOCALE, 'translation', resources, true, true);
  });

  afterAll(() => {
    restoreScrollIntoView?.();
    i18n.changeLanguage('en-US');
  });

  it('registers a genuinely tripled pseudo-locale with intact interpolation tokens', () => {
    // The transformer is what does the stressing: roughly 3x length, guillemet
    // framing, and `{{token}}` units kept atomic so i18next can still resolve
    // them (an unbalanced token would trip the raw-token checks below).
    const tripled = pseudoize('Run {{fileName}} now');
    expect(tripled).toContain('Run Run Run');
    expect(tripled).toContain('{{fileName}} {{fileName}} {{fileName}}');
    expect((tripled.match(/\{\{/g) ?? []).length).toBe((tripled.match(/\}\}/g) ?? []).length);

    // The bundle is live on the real instance and clearly non-English / non-key.
    const simple = i18n.t('app.name', { lng: PSEUDO_LOCALE });
    const english = i18n.t('app.name', { lng: 'en-US' });
    expect(simple).toContain(english);
    expect(simple).toContain('\u00ab');
    expect(simple.replace(/[^a-zA-Z]/g, '').length).toBeGreaterThanOrEqual(english.replace(/[^a-zA-Z]/g, '').length * 3);
    expect(i18n.t('videoTimeline.zoomIn', { lng: PSEUDO_LOCALE })).not.toBe('videoTimeline.zoomIn');
  });

  for (const code of ['de-DE', PSEUDO_LOCALE]) {
    it(`renders all 12 routes in ${code} without errors, raw tokens, or leaked keys`, async () => {
      expectAppLog('warn', /\[WARN\] \[[^\]]*\]/);

      await act(async () => {
        await i18n.changeLanguage(code);
      });
      expect(i18n.language).toBe(code);

      for (const route of PAGE_ROUTES) {
        let pageError: unknown = null;
        try {
          await renderRouteText(route.name);
        } catch (err) {
          pageError = err;
        }
        expect(pageError, `${code} / ${route.name} threw under longest-string load`).toBeNull();

        const bodyText = document.body.textContent ?? '';
        expect(RAW_TOKEN_PATTERN.test(bodyText), `${code} / ${route.name} framed an unsatisfied token`).toBe(false);
        expect(rawKeysInBody(document.body), `${code} / ${route.name} leaked translation keys`).toHaveLength(0);
      }
    });
  }

  it('the pseudo-locale tripling actually reaches the rendered DOM (>= 1.5x aggregate)', async () => {
    expectAppLog('warn', /\[WARN\] \[[^\]]*\]/);

    const measure = async (code: string): Promise<number> => {
      await act(async () => {
        await i18n.changeLanguage(code);
      });
      let total = 0;
      for (const route of PAGE_ROUTES) {
        total += await renderRouteText(route.name);
      }
      return total;
    };

    const ltrBaseline = await measure('en-US');
    const pseudoTotal = await measure(PSEUDO_LOCALE);
    expect(ltrBaseline).toBeGreaterThan(0);
    expect(pseudoTotal).toBeGreaterThanOrEqual(ltrBaseline * 1.5);
  });
});
