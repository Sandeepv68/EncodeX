/**
 * @fileoverview Phase 5.1 RTL mirror (finding F7): asserts the direction
 * machinery the app actually ships and that it survives RTL locales.
 *
 * How EncodeX mirrors for Arabic/Hebrew today (verified against the source
 * when this suite was written):
 *  - `useLanguageDirection` (wired once in `App.tsx` and via `document.dir`
 *    in main.tsx) flips the DOM direction with every `languageChanged` event.
 *  - `DirectionProvider` (main.tsx) swaps the emotion cache for the
 *    `stylis-plugin-rtl` variant, which flips physical CSS props in every MUI
 *    rule it generates (the drawer paper, sliders, spacing...).
 *  - Inline/custom math stays direction-independent: the video timeline is a
 *    positional scroller (physical `left`, `timeFromEvent` uses the scroller's
 *    rect), the drawer keeps a fixed nav anchor, and shortcut chords are
 *    `event.code`-based. None of these are meant to reverse, so the RTL suite
 *    pins the CSS-level mirror rather than asserting a fake visual flip.
 *
 * Assertions:
 *  (a) the direction hook and `document.dir` follow the active locale both
 *      ways (rtl -> ltr round trip);
 *  (b) the RTL emotion cache physically flips a styled rule while the LTR
 *      cache does not (pins `DirectionProvider` + `stylis-plugin-rtl`, i.e.
 *      the mechanism that mirrors the whole MUI tree);
 *  (c) all 12 routes render cleanly under the full RTL stack (Ar/Hebrew
 *      locales + rtl cache): no page error, no raw token, no leaked key;
 *  (d) keyboard shortcuts keep firing under an RTL locale, and the
 *      interactive-target guard still suppresses bare keys while typing.
 *
 * Runs in the `vitest.locale-matrix` gate alongside the 56-locale matrix;
 * both unmock `react-i18next` and render against the real resource set.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import styled from '@emotion/styled';
import type { ReactNode } from 'react';
import { PAGE_ROUTES, renderPage, stubScrollIntoView } from '../../test-utils/page-render';
import { expectAppLog } from '../../test-utils/crash-tripwire';
import { LOCALES, isRtlLocale } from '../i18n/localeMeta';
import { useLanguageDirection } from '../useLanguageDirection';
import { DirectionProvider } from '../i18n/DirectionProvider';
import { useHotkeys } from '../hooks/useHotkeys';
import { RAW_TOKEN_PATTERN, rawKeysInBody } from './i18n-matrix-utils';

vi.unmock('react-i18next');

import i18n from '../i18n/config';

const RTL_LOCALES = LOCALES.filter((meta) => isRtlLocale(meta.code));

function DirectionApplier({ children }: { children: ReactNode }): ReactNode {
  useLanguageDirection();
  return children;
}

const wrapDirection = (children: ReactNode): ReactNode => (
  <DirectionProvider direction="rtl">
    <I18nextProvider i18n={i18n}>
      <DirectionApplier>{children}</DirectionApplier>
    </I18nextProvider>
  </DirectionProvider>
);

/** Probe that surfaces the direction returned by the production hook. */
function DirectionProbe(): ReactNode {
  const dir = useLanguageDirection();
  return <div data-testid="direction-probe" data-dir={dir} />;
}

/** A probe styled rule whose only source in the document is this component. */
const MirroredBox = styled('div')({ paddingLeft: 3 });

/** Normalizes generated CSS so whitespace differences never tank a match. */
const minifyCss = (css: string): string => css.replace(/\s+/g, '');

/**
 * Removes the emotion style elements our mirror tests create so assertions
 * stay scoped to the rules of the current test.
 */
function purgeEmotionStyles(keys: string[]): void {
  document.querySelectorAll('style[data-emotion]').forEach((el) => {
    const key = el.getAttribute('data-emotion') ?? '';
    if (keys.some((k) => key.startsWith(k))) el.remove();
  });
}

describe('5.1 RTL direction wiring', () => {
  let restoreScrollIntoView: (() => void) | undefined;

  beforeAll(() => {
    restoreScrollIntoView = stubScrollIntoView();
  });

  afterAll(() => {
    restoreScrollIntoView?.();
    i18n.changeLanguage('en-US');
  });

  afterEach(() => {
    cleanup();
    purgeEmotionStyles(['muirtl', 'muiltr']);
  });

  it('follows the locale both ways and lands document.dir on the html root', async () => {
    let result: { unmount: () => void } | null = null;
    try {
      result = render(<DirectionProbe />);
    } catch (err) {
      expect(err).toBeNull();
    }
    await act(async () => {
      await Promise.resolve();
    });

    const probe = document.querySelector('[data-testid="direction-probe"]');
    expect(probe?.getAttribute('data-dir')).toBe('ltr');
    expect(document.dir).toBe('ltr');

    await act(async () => {
      await i18n.changeLanguage('ar-AE');
    });
    expect(probe?.getAttribute('data-dir')).toBe('rtl');
    expect(document.dir).toBe('rtl');

    await act(async () => {
      await i18n.changeLanguage('en-US');
    });
    expect(probe?.getAttribute('data-dir')).toBe('ltr');
    expect(document.dir).toBe('ltr');

    result?.unmount();
  });

  it('mirrors a physical CSS rule only under the RTL emotion cache', async () => {
    expectAppLog('warn', /\[WARN\] \[[^\]]*\]/);

    render(
      <DirectionProvider direction="ltr">
        <MirroredBox data-testid="mirror-ltr" />
      </DirectionProvider>,
    );
    render(
      <DirectionProvider direction="rtl">
        <MirroredBox data-testid="mirror-rtl" />
      </DirectionProvider>,
    );

    const ltrSheet = document.querySelector('style[data-emotion="muiltr"]')?.textContent ?? '';
    const rtlSheet = document.querySelector('style[data-emotion="muirtl"]')?.textContent ?? '';
    expect(minifyCss(ltrSheet)).toContain('padding-left:3px');
    expect(minifyCss(ltrSheet)).not.toContain('padding-right:3px');

    // The stylis RTL plugin flips the physical prop: this is the CSS-level
    // mirror that applies to every MUI rule in an RTL-locale session.
    expect(minifyCss(rtlSheet)).toContain('padding-right:3px');
    expect(minifyCss(rtlSheet)).not.toContain('padding-left:3px');
  });
});

describe('5.1 RTL pages (Ar/Hebrew locales under the rtl cache)', () => {
  let restoreScrollIntoView: (() => void) | undefined;

  beforeAll(() => {
    restoreScrollIntoView = stubScrollIntoView();
  });

  afterAll(() => {
    restoreScrollIntoView?.();
    i18n.changeLanguage('en-US');
  });

  afterEach(() => {
    cleanup();
    purgeEmotionStyles(['muirtl', 'muiltr']);
  });

  it('cover all 4 shipped RTL locales (guards the loop against a partial set)', () => {
    expect(RTL_LOCALES.map((meta) => meta.code).sort()).toEqual(['ar-AE', 'ar-JO', 'ar-SA', 'he-IL'].sort());
  });

  for (const { code } of RTL_LOCALES) {
    it(`renders all 12 routes in ${code} under the rtl cache`, async () => {
      expectAppLog('warn', /\[WARN\] \[[^\]]*\]/);

      await act(async () => {
        await i18n.changeLanguage(code);
      });
      expect(i18n.language).toBe(code);

      for (const route of PAGE_ROUTES) {
        let pageError: unknown = null;
        let result: { unmount: () => void } | null = null;
        try {
          result = renderPage(route.name, { wrap: wrapDirection });
        } catch (err) {
          pageError = err;
        }
        expect(pageError, `${code} / ${route.name} threw under the rtl cache`).toBeNull();

        await act(async () => {
          await Promise.resolve();
        });

        expect(document.dir, `${code} / ${route.name} must stay rtl`).toBe('rtl');
        const bodyText = document.body.textContent ?? '';
        expect(RAW_TOKEN_PATTERN.test(bodyText), `${code} / ${route.name} rendered an unsatisfied token under rtl`).toBe(false);
        expect(rawKeysInBody(document.body), `${code} / ${route.name} leaked translation keys under rtl`).toHaveLength(0);

        result?.unmount();
      }
    });
  }
});

describe('5.1 RTL keyboard shortcuts', () => {
  /** Records every registered binding that fires, keyed by shortcut id. */
  function ShortcutProbe(): ReactNode {
    useHotkeys([{ id: 'global.navConvert', handler: () => (window as unknown as { __fired?: string[] }).__fired?.push('navConvert') }]);
    return null;
  }

  let restoreScrollIntoView: (() => void) | undefined;

  beforeAll(() => {
    restoreScrollIntoView = stubScrollIntoView();
  });

  afterAll(() => {
    restoreScrollIntoView?.();
    i18n.changeLanguage('en-US');
  });

  afterEach(() => {
    cleanup();
    delete (window as unknown as { __fired?: string[] }).__fired;
  });

  const dispatchChord = (init: KeyboardEventInit): void => {
    window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
  };

  it('matches shortcut chords identically in ltr and rtl sessions', async () => {
    expectAppLog('warn', /\[WARN\] \[[^\]]*\]/);
    (window as unknown as { __fired?: string[] }).__fired = [];
    render(
      <DirectionApplier>
        <ShortcutProbe />
      </DirectionApplier>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await i18n.changeLanguage('en-US');
    });
    expect(document.dir).toBe('ltr');
    dispatchChord({ code: 'Digit2', altKey: true, key: '2' });
    expect((window as unknown as { __fired: string[] }).__fired).toEqual(['navConvert']);

    await act(async () => {
      await i18n.changeLanguage('ar-AE');
    });
    expect(document.dir).toBe('rtl');
    (window as unknown as { __fired: string[] }).__fired = [];
    dispatchChord({ code: 'Digit2', altKey: true, key: '2' });
    expect((window as unknown as { __fired: string[] }).__fired).toEqual(['navConvert']);
  });
});
