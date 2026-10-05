/**
 * @fileoverview Shared page-render harness for the Phase 5 suites.
 *
 * Phase 5 puts the same twelve pages through three very different hostile
 * environments -- all 56 locales (5.1), a missing/lying preload bridge (5.2),
 * and axe at three viewport widths in both themes (5.3). Each of those suites
 * previously would have had to re-derive the provider stack, and the parts of
 * the stack that are *harness gaps* rather than app behaviour are exactly the
 * parts that get re-derived differently, silently.
 *
 * Two of those gaps are handled here once, deliberately:
 *
 *  - **jsdom implements no `Element.prototype.scrollIntoView`.** `Logs`'s
 *    follow-tail effect calls it as soon as it runs, so `Logs.test.tsx` and
 *    `strict-mode.test.tsx` each stub it independently. In a shipped browser
 *    the method always exists, so this is a harness fact, not a defect.
 *  - **jsdom implements no layout and no `matchMedia`.** A viewport width is
 *    therefore expressed the only way it can be: by stubbing `matchMedia` so
 *    MUI's `useMediaQuery` resolves the breakpoints it would resolve in a real
 *    browser. Anything that depends on actual painted geometry stays out of
 *    reach in jsdom, and callers that need it must say so.
 *
 * The harness deliberately does **not** import `react-i18next`. The global test
 * setup mocks that module for the whole suite, and a suite that wants real
 * translations calls `vi.unmock('react-i18next')` itself and passes its own
 * `wrap` provider. A harness that reached for `I18nextProvider` would break
 * every mocked suite, because the mock factory does not export it.
 *
 * @see plans/ADVERSARIAL_TEST_HARDENING_PLAN.md, Phase 5
 */

import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentType, ReactNode } from 'react';
import { ColorModeProvider } from '../renderer/ColorModeContext';
import { THEME_STORAGE_KEY } from '../shared/app-constants';
import type { ThemeId } from '../renderer/types';
import About from '../renderer/pages/About';
import AudioExtract from '../renderer/pages/AudioExtract';
import BatchQueue from '../renderer/pages/BatchQueue';
import Convert from '../renderer/pages/Convert';
import Dashboard from '../renderer/pages/Dashboard';
import Demux from '../renderer/pages/Demux';
import ImageCompress from '../renderer/pages/ImageCompress';
import Logs from '../renderer/pages/Logs';
import MediaInfo from '../renderer/pages/MediaInfo';
import Remux from '../renderer/pages/Remux';
import Settings from '../renderer/pages/Settings';
import VideoCut from '../renderer/pages/VideoCut';

/**
 * One routed page: its name, the path `App.tsx` routes it at, and the component
 * itself.
 *
 * The `path` values are duplicated from `App.tsx`'s route table on purpose --
 * reading them out of the table would mean importing the lazy graph, and a
 * harness that cannot fail when the two drift is decoration. `routes.test.ts`
 * asserts this list against `App.tsx` instead.
 */
export interface PageSpec {
  /** Display name, matching the component's file name. */
  name: string;
  /** Route path as declared in `src/renderer/App.tsx`. */
  path: string;
  /** The page component. */
  Page: ComponentType;
}

/**
 * Every routed page, in the order `App.tsx` declares them.
 *
 * The page components are imported eagerly (not lazily) so a broken import
 * fails the harness at load time rather than surfacing as an empty `Suspense`
 * fallback that satisfies "did not throw".
 */
export const PAGE_ROUTES: readonly PageSpec[] = [
  { name: 'Dashboard', path: '/', Page: Dashboard },
  { name: 'Convert', path: '/convert', Page: Convert },
  { name: 'MediaInfo', path: '/media-info', Page: MediaInfo },
  { name: 'ImageCompress', path: '/image-compress', Page: ImageCompress },
  { name: 'AudioExtract', path: '/audio-extract', Page: AudioExtract },
  { name: 'VideoCut', path: '/video-cut', Page: VideoCut },
  { name: 'Remux', path: '/remux', Page: Remux },
  { name: 'Demux', path: '/demux', Page: Demux },
  { name: 'BatchQueue', path: '/batch', Page: BatchQueue },
  { name: 'Logs', path: '/logs', Page: Logs },
  { name: 'Settings', path: '/settings', Page: Settings },
  { name: 'About', path: '/about', Page: About },
] as const;

/** Names of every routed page. */
export type PageName = (typeof PAGE_ROUTES)[number]['name'];

/**
 * Looks up a page by name.
 * @param {string} name - A name from {@link PAGE_ROUTES}.
 * @returns {PageSpec} The matching page spec.
 * @throws {Error} If no page has that name, which is a typo in the caller.
 */
export function pageSpec(name: string): PageSpec {
  const found = PAGE_ROUTES.find((spec) => spec.name === name);
  if (!found) throw new Error(`unknown page "${name}" - not one of ${PAGE_ROUTES.map((s) => s.name).join(', ')}`);
  return found;
}

/**
 * Options for {@link renderPage}.
 * @interface
 */
export interface PageRenderOptions {
  /** Route to render at. Defaults to the page's own path. */
  route?: string;
  /** Theme id to seed into storage before mounting. Defaults to `'light'`. */
  theme?: ThemeId;
  /**
   * Extra providers wrapped inside the router and theme, closest to the page.
   * This is how a suite that unmocked `react-i18next` supplies its own
   * `I18nextProvider` without the harness depending on that module.
   */
  wrap?: (children: ReactNode) => ReactNode;
}

/**
 * A page render, with the spec it came from attached.
 * @typedef
 */
export type PageRenderResult = RenderResult & { spec: PageSpec };

/**
 * Renders one routed page inside the provider stack the real app gives it:
 * a memory router (so `useNavigate`/route params work) and the
 * `ColorModeProvider` (which installs the MUI theme every page reads).
 *
 * `document.dir` is reset to `'ltr'` first. `useLanguageDirection` writes it
 * from the i18n locale, and jsdom keeps it between tests in the same file, so a
 * suite that ran an RTL locale first would otherwise leak `dir="rtl"` into every
 * later LTR assertion in the file.
 *
 * @param {string} name - A page name from {@link PAGE_ROUTES}.
 * @param {PageRenderOptions} [options] - Route, theme, and extra providers.
 * @returns {PageRenderResult} The render result plus the resolved page spec.
 */
export function renderPage(name: string, options: PageRenderOptions = {}): PageRenderResult {
  const spec = pageSpec(name);
  const theme = options.theme ?? 'light';
  document.dir = 'ltr';
  localStorage.setItem(THEME_STORAGE_KEY, theme);

  const inner = <spec.Page />;
  const withExtra = options.wrap ? options.wrap(inner) : inner;

  const result = render(
    <MemoryRouter initialEntries={[options.route ?? spec.path]}>
      <ColorModeProvider>{withExtra}</ColorModeProvider>
    </MemoryRouter>,
  );

  return Object.assign(result, { spec });
}

/**
 * Installs a `matchMedia` stub that answers width queries from a fixed viewport,
 * so MUI's `useMediaQuery` takes the branch a real browser would take at that
 * width.
 *
 * Only `min-width`/`max-width` queries are interpreted, and anything else
 * matches `false` -- jsdom has no media features to consult, so a `false` here
 * means "not reported as matching" rather than "known not to match".
 *
 * @param {number} width - Viewport width in CSS pixels.
 * @returns {() => void} Restores whatever `window.matchMedia` was before.
 */
export function stubViewportWidth(width: number): () => void {
  const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  const originalWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');

  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => {
      const px = /(-?\d*\.?\d+)px/.exec(query);
      let matches = false;
      if (px) {
        const bound = Number(px[1]);
        if (/max-width/.test(query)) matches = width <= bound;
        else if (/min-width/.test(query)) matches = width >= bound;
      }
      return {
        matches,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      };
    },
  });

  return () => {
    if (original) Object.defineProperty(window, 'matchMedia', original);
    else delete (window as { matchMedia?: unknown }).matchMedia;
    if (originalWidth) Object.defineProperty(window, 'innerWidth', originalWidth);
    else delete (window as { innerWidth?: unknown }).innerWidth;
  };
}

/**
 * Installs a no-op `Element.prototype.scrollIntoView`, which jsdom lacks.
 *
 * Returns a restore function; prefer calling it from `afterAll` rather than
 * leaving the stub in place for the rest of the worker.
 *
 * @returns {() => void} Restores the previous descriptor.
 */
export function stubScrollIntoView(): () => void {
  const original = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: () => undefined,
  });
  return () => {
    if (original) Object.defineProperty(Element.prototype, 'scrollIntoView', original);
    else delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  };
}
