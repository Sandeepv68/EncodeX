/**
 * @fileoverview Phase 5.3 focus order gate: real-keyboard Tab navigation in a
 * real browser against the built app.
 *
 * axe proves every element is perceptible and labeled; it does not prove that
 * sequential keyboard navigation works. This suite presses the actual Tab/Shift
 * keys and asserts three things hold on the shipped renderer:
 *
 *  - Tab never loses focus to the `body` while moving through the shell (a
 *    "lost focus" bug strands keyboard users on an invisible stop).
 *  - Focus stops stay inside one of the shell landmarks (banner `header`,
 *    `nav` drawer, `main` content) - never on a raw `body`-level element.
 *  - Route content that was made keyboard-addressable (the Logs body window)
 *    is actually reachable, and Shift+Tab returns through the same chain in
 *    reverse without losing focus.
 *
 * Navigation happens at a desktop width (>= 900px, MUI `md`) where the
 * permanent drawer is open; the probe widths are applied after the route is
 * loaded. On mobile widths (< 900px) the nav lives in a modal temporary drawer
 * that only mounts once the hamburger opens it, so those probes open it first.
 * The frameless title-bar window controls sit behind `-webkit-app-region:
 * drag` and stay outside the sequential focus order, so the header landmark is
 * intentionally not asserted as a Tab target.
 *
 * Probes are bounded (a fixed max press count per route) and spread across
 * themes and widths so both breakpoints and a theme reload are exercised.
 *
 * @see plans/ADVERSARIAL_TEST_HARDENING_PLAN.md, Phase 5.3
 */

import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { launchApp, closeApp, reloadSession, ensureLiveSession, type AppSession } from '../fixtures/app';
import { THEME_STORAGE_KEY } from '../../src/shared/app-constants';

const HEIGHT = 900;

interface FocusStop {
  body: boolean;
  testid: string | null;
  landmark: string | null;
  tag: string | null;
  text: string;
}

const SHELL_LANDMARKS = new Set(['header', 'nav', 'main', 'footer']);

function activeStop(session: AppSession): Promise<FocusStop> {
  return session.page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) {
      return { body: true, testid: null, landmark: null, tag: null, text: '' };
    }
    const landmarkEl = el.closest('header, nav[aria-label], main, footer');
    return {
      body: false,
      testid: el.dataset?.testid ?? null,
      landmark: landmarkEl ? landmarkEl.tagName.toLowerCase() : 'none',
      tag: el.tagName.toLowerCase(),
      text: (el.textContent ?? '').slice(0, 48),
    };
  });
}

async function pressAndStop(session: AppSession, key: 'Tab' | 'Shift+Tab'): Promise<FocusStop> {
  await session.page.keyboard.press(key);
  return activeStop(session);
}

/** Blurs the current target so the next Tab starts a fresh chain from `body`. */
async function resetFocus(session: AppSession): Promise<void> {
  await session.page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
  });
  await session.page.waitForTimeout(100);
}

/**
 * Tabs from the current focus target until `reached(stop)` returns true or the
 * press budget expires. Returns whether the target was hit and every stop.
 */
async function tabUntil(
  session: AppSession,
  reached: (stop: FocusStop) => boolean,
  maxPresses: number,
): Promise<{ reached: boolean; stops: FocusStop[] }> {
  const stops: FocusStop[] = [];
  for (let i = 0; i < maxPresses; i += 1) {
    const stop = await pressAndStop(session, 'Tab');
    stops.push(stop);
    if (reached(stop)) return { reached: true, stops };
  }
  return { reached: false, stops };
}

function assertNoLostFocus(stops: FocusStop[], label: string): void {
  const lost = stops.filter((s) => s.body);
  expect(lost, `${label}: Tab must never lose focus to body`).toEqual([]);
}

function assertLandmarkCoverage(stops: FocusStop[], landmarks: string[], label: string): void {
  for (const landmark of landmarks) {
    expect(
      stops.some((s) => s.landmark === landmark),
      `${label}: at least one focus stop must land inside the <${landmark}> landmark`,
    ).toBe(true);
  }
  const outside = stops.filter((s) => !SHELL_LANDMARKS.has(s.landmark ?? ''));
  expect(outside, `${label}: every focus stop must live inside a shell landmark`).toEqual([]);
}

function fmtStops(stops: FocusStop[]): string {
  return stops.map((s) => (s.body ? 'body' : `${s.tag}${s.testid ? `[${s.testid}]` : ''}(${s.landmark}) "${s.text}"`)).join(' -> ');
}

/** Navigates at a desktop width where the permanent drawer renders its items. */
async function gotoRoute(session: AppSession, testId: string, path: string): Promise<void> {
  await session.page.setViewportSize({ width: 1440, height: HEIGHT });
  await session.page.locator(`[data-testid="${testId}"]`).waitFor({ state: 'visible', timeout: 15_000 });
  await session.page.locator(`[data-testid="${testId}"]`).click();
  await session.page.waitForFunction((expected) => window.location.hash.startsWith(`#${expected}`), path, { timeout: 15_000 });
  await session.page.waitForTimeout(250);
}

/** Opens the mobile (temporary) drawer via the hamburger in the page header area. */
async function openMobileDrawer(session: AppSession): Promise<void> {
  await session.page.locator('[data-testid="mobile-menu-button"]').waitFor({ state: 'visible', timeout: 15_000 });
  await session.page.locator('[data-testid="mobile-menu-button"]').click();
  // MUI Box renders a native <nav> with a translated aria-label, not an
  // explicit role attribute, so match the implicit role instead of the attr.
  await session.page.getByRole('navigation').waitFor({ state: 'visible', timeout: 15_000 });
  await session.page.waitForTimeout(300);
}

describe('5.3 focus order: real Tab navigation on the shipped renderer', () => {
  let session: AppSession;

  beforeAll(async () => {
    session = await launchApp();
  });

  beforeEach(async () => {
    session = await ensureLiveSession(session);
  });

  afterAll(async () => {
    await closeApp(session.app, session.userDataDir);
  });

  it('keeps focus inside the nav and main landmarks while tabbing the dashboard (light desktop)', { timeout: 120_000 }, async () => {
    await gotoRoute(session, 'nav-item-dashboard', '/');
    await session.page.setViewportSize({ width: 1440, height: HEIGHT });
    await session.page.waitForTimeout(200);
    await resetFocus(session);

    const stops = (await tabUntil(session, () => false, 40)).stops;
    console.log(`dashboard@1440 focus chain: ${fmtStops(stops)}`);
    assertNoLostFocus(stops, 'light@1440');
    assertLandmarkCoverage(stops, ['nav', 'main'], 'light@1440');
  });

  it('keeps focus inside the shell while tabbing inside the open mobile drawer (light 320)', { timeout: 120_000 }, async () => {
    await gotoRoute(session, 'nav-item-dashboard', '/');
    await session.page.setViewportSize({ width: 320, height: HEIGHT });
    await session.page.waitForTimeout(200);
    await openMobileDrawer(session);
    await resetFocus(session);

    const stops = (await tabUntil(session, () => false, 10)).stops;
    assertNoLostFocus(stops, 'light@320 mobile drawer');
    expect(
      stops.filter((s) => s.landmark === 'nav').length,
      'light@320: the opened drawer must contribute several focus stops inside its nav landmark',
    ).toBeGreaterThanOrEqual(3);
  });

  it('tabs the Remux page controls inside main without losing focus (light 1440)', { timeout: 120_000 }, async () => {
    await gotoRoute(session, 'nav-item-remux', '/remux');
    await session.page.setViewportSize({ width: 1440, height: HEIGHT });
    await session.page.waitForTimeout(200);
    await resetFocus(session);

    const stops = (await tabUntil(session, () => false, 16)).stops;
    assertNoLostFocus(stops, 'remux@1440');
    const mainStops = stops.filter((s) => s.landmark === 'main');
    expect(mainStops.length, 'remux@1440: page controls must be reachable in <main>').toBeGreaterThanOrEqual(2);
    console.log(`remux focus chain: ${fmtStops(stops)}`);
  });

  it('keeps condensed mobile focus inside the open temporary drawer nav after a dark-theme reload', { timeout: 120_000 }, async () => {
    await session.page.setViewportSize({ width: 320, height: HEIGHT });
    await session.page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: THEME_STORAGE_KEY, value: 'dark' });
    session = await reloadSession(session);
    await openMobileDrawer(session);
    await resetFocus(session);

    const stops = (await tabUntil(session, () => false, 12)).stops;
    assertNoLostFocus(stops, 'dark@320 mobile drawer');
    expect(
      stops.filter((s) => s.landmark === 'nav').length,
      'dark@320: the opened drawer must contribute several focus stops inside its nav landmark',
    ).toBeGreaterThanOrEqual(3);
    expect(stops[0]?.landmark === 'nav', 'dark@320: the temporary drawer is a modal, so the first Tab lands inside its nav landmark').toBe(
      true,
    );
  });

  it('reaches the keyboard-addressable Logs body window and Shift+Tab returns through the nav', { timeout: 120_000 }, async () => {
    // Dark theme persisted by the previous test; keep it for this probe.
    // Desktop width so the permanent drawer stays on the left of the DOM chain.
    await gotoRoute(session, 'nav-item-logs', '/logs');
    await session.page.setViewportSize({ width: 1440, height: HEIGHT });
    await session.page.waitForTimeout(200);
    await resetFocus(session);

    const run = await tabUntil(session, (s) => s.testid === 'logs-body', 60);
    expect(run.reached, `Logs body must be keyboard-addressable (${fmtStops(run.stops)})`).toBe(true);
    assertNoLostFocus(run.stops, 'logs Tab');

    const reverse: FocusStop[] = [];
    for (let i = 0; i < 40; i += 1) {
      const stop = await pressAndStop(session, 'Shift+Tab');
      reverse.push(stop);
      if (stop.landmark === 'nav') break;
    }
    console.log(`logs reverse chain: ${fmtStops(reverse)}`);
    assertNoLostFocus(reverse, 'logs Shift+Tab');
    expect(
      reverse.some((s) => s.landmark === 'nav'),
      'logs Shift+Tab must return into the nav drawer',
    ).toBe(true);
  });
});
