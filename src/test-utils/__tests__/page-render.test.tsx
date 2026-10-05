/**
 * @fileoverview Self-tests for the shared page-render harness (`page-render.tsx`).
 *
 * A harness that quietly stops working is worse than no harness: Phase 5's
 * three suites are built on it, and every one of their assertions degrades to
 * "it rendered something" if `renderPage` returns an empty container or the
 * theme/widow stubs stop taking effect. So the harness itself gets the same
 * treatment this plan has applied everywhere else -- every property it claims is
 * pinned, and the route list is checked against the real `App.tsx` route table
 * rather than trusted.
 *
 * The `App.tsx` parity check reads the route table out of the real source
 * instead of importing the lazy component graph, because importing `App` here
 * would mount nothing but would still cost the whole lazy graph. Parsing the
 * array literal is enough: `App.tsx` declares `const routes: { path: string;
 * element: ReactNode }[]` with one `{ path: '...', element: ... }` per route,
 * and a route added there without being added here would show up as a length or
 * membership mismatch.
 */

import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { useMediaQuery, ThemeProvider } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { PAGE_ROUTES, pageSpec, renderPage, stubViewportWidth, stubScrollIntoView } from '../page-render';
import { THEME_STORAGE_KEY } from '../../shared/app-constants';
import { createAppTheme } from '../../renderer/theme';

/**
 * Counts the drawer's condense toggle inside `container`.
 *
 * Found by its `data-testid`, which the component sets explicitly, so this does
 * not depend on the i18n mock's dictionary or on MUI's generated class names.
 */
function condenseToggleCount(container: HTMLElement): number {
  return container.querySelectorAll('[data-testid="drawer-condense-button"]').length;
}

let restoreScroll: () => void;

beforeAll(() => {
  restoreScroll = stubScrollIntoView();
});

afterAll(() => {
  restoreScroll();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe('PAGE_ROUTES', () => {
  it('covers all twelve pages', () => {
    expect(PAGE_ROUTES).toHaveLength(12);
    expect(new Set(PAGE_ROUTES.map((s) => s.name)).size).toBe(12);
  });

  it('declares no duplicate route paths', () => {
    const paths = PAGE_ROUTES.map((s) => s.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('matches the route table declared in App.tsx', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../renderer/App.tsx'), 'utf8');
    const declared = [...source.matchAll(/\{\s*path:\s*'([^']+)'\s*,\s*element:/g)].map((m) => m[1]);
    // Non-vacuity: a regex that stopped matching would make this `[]`, and an
    // empty array trivially "matches" nothing it could disagree with.
    expect(declared.length, 'the App.tsx route regex matched nothing - the guard below would be vacuous').toBe(12);
    expect(PAGE_ROUTES.map((s) => s.path).sort()).toEqual([...declared].sort());
  });
});

describe('pageSpec', () => {
  it('resolves a known page', () => {
    expect(pageSpec('Logs').path).toBe('/logs');
  });

  it('throws on an unknown name rather than returning undefined', () => {
    expect(() => pageSpec('Nope')).toThrow(/unknown page "Nope"/);
  });
});

describe('renderPage', () => {
  it('mounts a page and produces DOM', () => {
    const { container, spec } = renderPage('About');
    expect(spec.name).toBe('About');
    expect(container.childElementCount).toBeGreaterThan(0);
  });

  it('seeds the theme into storage and defaults to light', () => {
    renderPage('About');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('honours an explicit theme', () => {
    renderPage('About', { theme: 'dark' });
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('resets document.dir to ltr so a prior RTL render cannot leak', () => {
    document.dir = 'rtl';
    renderPage('About');
    expect(document.dir).toBe('ltr');
  });

  it('applies extra providers from `wrap`', () => {
    const marker = (children: React.ReactNode) => <div data-testid="wrapper">{children}</div>;
    const { getByTestId } = renderPage('About', { wrap: marker });
    expect(getByTestId('wrapper')).toBeInTheDocument();
  });

  it('renders at a route other than the page default', () => {
    // A page that reads router state should still mount at a foreign route
    // rather than throwing on a missing match.
    expect(() => renderPage('Logs', { route: '/' })).not.toThrow();
  });
});

describe('stubViewportWidth', () => {
  it('answers max-width queries from the stubbed viewport', () => {
    const restore = stubViewportWidth(320);
    try {
      expect(window.matchMedia('(max-width:899.95px)').matches).toBe(true);
      expect(window.matchMedia('(min-width:900px)').matches).toBe(false);
      expect(window.innerWidth).toBe(320);
    } finally {
      restore();
    }
  });

  it('answers min-width queries at a wide viewport', () => {
    const restore = stubViewportWidth(1440);
    try {
      expect(window.matchMedia('(min-width:900px)').matches).toBe(true);
      expect(window.matchMedia('(max-width:899.95px)').matches).toBe(false);
    } finally {
      restore();
    }
  });

  it('reports no match for a query it cannot interpret', () => {
    const restore = stubViewportWidth(1440);
    try {
      expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(false);
    } finally {
      restore();
    }
  });

  it('restores the previous matchMedia and innerWidth', () => {
    const beforeWidth = window.innerWidth;
    const beforeMatch = window.matchMedia;
    const restore = stubViewportWidth(500);
    expect(window.matchMedia).not.toBe(beforeMatch);
    restore();
    expect(window.matchMedia).toBe(beforeMatch);
    expect(window.innerWidth).toBe(beforeWidth);
  });

  it("actually reaches the app's useMediaQuery", () => {
    // The guards above test the stub's own answers. This tests that MUI's
    // `useMediaQuery` reads them: `AppLayout` branches on
    // `useMediaQuery(theme.breakpoints.down('md'))`, so a probe through the
    // same hook proves the effect the stub is installed for. Without it, a stub
    // that never reached MUI would leave every 5.3 width assertion passing
    // against one identical layout.
    function Probe() {
      const theme = useTheme();
      const isMobile = useMediaQuery(theme.breakpoints.down('md'));
      return <div data-testid="probe">{isMobile ? 'mobile' : 'desktop'}</div>;
    }

    const at = (width: number) => {
      const restore = stubViewportWidth(width);
      try {
        const { getByTestId } = render(
          <ThemeProvider theme={createAppTheme('light', 'ltr')}>
            <Probe />
          </ThemeProvider>,
        );
        return getByTestId('probe').textContent;
      } finally {
        restore();
        cleanup();
      }
    };

    expect(at(320)).toBe('mobile');
    expect(at(768)).toBe('mobile');
    expect(at(1440)).toBe('desktop');
  });
});

describe('stubScrollIntoView', () => {
  it('is installed and restorable', () => {
    // The outer beforeAll already installed one, so this proves a *second*
    // install/restore cycle leaves the first intact rather than deleting it.
    const restore = stubScrollIntoView();
    expect(typeof Element.prototype.scrollIntoView).toBe('function');
    restore();
    expect(typeof Element.prototype.scrollIntoView).toBe('function');
  });
});
