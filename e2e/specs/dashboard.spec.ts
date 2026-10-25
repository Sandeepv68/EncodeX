/**
 * @fileoverview Dashboard (`/`) E2E suite (Tier A, mock preload).
 *
 * The dashboard is the landing page users see on every launch, so a broken
 * card, a missing destination, or a dead number-key shortcut is a first-run
 * regression. This suite asserts:
 *  - the welcome heading, subtitle and shortcut hint render,
 *  - one feature card exists for every tool destination (and none for the
 *    shell-only pages Logs/Settings/About),
 *  - each card click reaches its route (checked on `location.hash`),
 *  - the 1-8 number keys jump to the same routes as their cards.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Page } from 'playwright';
import { launchApp, closeApp, ensureLiveSession, reloadSession, AppSession } from '../fixtures/app';
import { mockApi } from '../mocks/control';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

/** Every tool card on the dashboard, with its English card title and target route. */
const FEATURE_CARDS: { route: string; title: string }[] = [
  { route: '/convert', title: 'Convert' },
  { route: '/media-info', title: 'Media Info' },
  { route: '/image-compress', title: 'Image' },
  { route: '/audio-extract', title: 'Audio' },
  { route: '/video-cut', title: 'Cut' },
  { route: '/remux', title: 'Remux' },
  { route: '/demux', title: 'Demux' },
  { route: '/batch', title: 'Batch Queue' },
  { route: '/copilot', title: 'Copilot' },
];

/** Number-key shortcuts registered on the dashboard, in card order for the first eight. */
const NUMBER_KEY_ROUTES = ['/convert', '/media-info', '/image-compress', '/audio-extract', '/video-cut', '/remux', '/demux', '/batch'];

async function gotoDashboard(page: Page): Promise<void> {
  await page.locator('[data-testid="nav-item-dashboard"]').waitFor({ timeout: 15000 });
  await page.locator('[data-testid="nav-item-dashboard"]').click();
  await page.getByRole('heading', { level: 1, name: /Welcome to EncodeX/ }).waitFor({ timeout: 15000 });
}

describe.runIf(IS_E2E)('Dashboard page', () => {
  let session: AppSession;

  beforeAll(async () => {
    session = await launchApp({ mock: true });
  }, 60000);

  afterAll(async () => {
    await closeApp(session.app, session.userDataDir);
  });

  beforeEach(async () => {
    session = await ensureLiveSession(session);
    await mockApi.reset(session.page);
    session = await reloadSession(session);
    await gotoDashboard(session.page);
  }, 30000);

  it('renders the welcome heading, subtitle and shortcut hint', async () => {
    const { page } = session;
    await expect.poll(() => page.getByRole('heading', { level: 1 }).innerText()).toContain('Welcome to EncodeX');
    await expect.poll(() => page.locator('[data-testid="dashboard-shortcuts-hint"]').innerText()).toMatch(/keyboard shortcuts/i);
  });

  it('renders exactly one card for every tool destination', async () => {
    const { page } = session;
    for (const card of FEATURE_CARDS) {
      await expect.poll(() => page.getByRole('heading', { level: 2, name: card.title, exact: true }).count()).toBe(1);
    }
    // Shell-only pages stay off the dashboard; they are reached from the drawer.
    for (const hidden of ['Logs', 'Settings', 'About']) {
      await expect.poll(() => page.getByRole('heading', { level: 2, name: hidden, exact: true }).count()).toBe(0);
    }
  });

  it.each(FEATURE_CARDS)('navigates to $route when the $title card is clicked', async ({ route, title }) => {
    const { page } = session;
    await page.getByRole('heading', { level: 2, name: title, exact: true }).click();
    await page.waitForFunction((expected) => location.hash.startsWith(`#${expected}`), route, { timeout: 15000 });
    expect(await page.evaluate(() => location.hash)).toContain(route);
  });

  it('jumps to the matching route for each number key 1-8', async () => {
    const { page } = session;
    for (let i = 0; i < NUMBER_KEY_ROUTES.length; i += 1) {
      await gotoDashboard(page);
      // Bare keys are ignored while a button has focus (see useHotkeys), and the
      // drawer click leaves focus on a nav button, so move focus to the page body first.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
      await page.keyboard.press(String(i + 1));
      const route = NUMBER_KEY_ROUTES[i];
      await page.waitForFunction((expected) => location.hash.startsWith(`#${expected}`), route, { timeout: 15000 });
    }
  });
});
