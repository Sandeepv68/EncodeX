/**
 * @fileoverview Global keyboard shortcut E2E suite (Tier A, mock preload).
 *
 * Exercises the app-wide shortcuts registered in `App.tsx` from the central
 * registry (`src/renderer/constants/shortcuts.ts`):
 *  - Ctrl+/ opens the shortcut help dialog, Escape and the close button dismiss it,
 *  - Alt+1..9 and Alt+0 navigate to their routes,
 *  - Ctrl+Alt+T advances the colour theme.
 * Each assertion is made on the observable result (dialog presence, hash,
 * persisted theme), not on the handler being invoked.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Page } from 'playwright';
import { launchApp, closeApp, ensureLiveSession, reloadSession, AppSession } from '../fixtures/app';
import { mockApi } from '../mocks/control';
import { THEME_STORAGE_KEY } from '../../src/shared/app-constants';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

/** Theme ids in cycle order, matching the `THEMES` table the toggle walks. */
const THEME_IDS = ['light', 'ocean', 'sunset', 'forest', 'lavender', 'rose', 'slate', 'dark'];

/** Alt+digit bindings from the global section of the shortcut registry. */
const ALT_BINDINGS: { chord: string; route: string }[] = [
  { chord: 'Alt+2', route: '#/convert' },
  { chord: 'Alt+3', route: '#/media-info' },
  { chord: 'Alt+4', route: '#/image-compress' },
  { chord: 'Alt+5', route: '#/audio-extract' },
  { chord: 'Alt+6', route: '#/video-cut' },
  { chord: 'Alt+7', route: '#/batch' },
  { chord: 'Alt+8', route: '#/logs' },
  { chord: 'Alt+9', route: '#/settings' },
  { chord: 'Alt+0', route: '#/remux' },
];

function helpDialog(page: Page) {
  return page.locator('[data-testid="shortcuts-help-dialog"]');
}

async function gotoDashboard(page: Page): Promise<void> {
  await page.locator('[data-testid="nav-item-dashboard"]').waitFor({ timeout: 15000 });
  await page.locator('[data-testid="nav-item-dashboard"]').click();
  await page.getByRole('heading', { level: 1, name: /Welcome to EncodeX/ }).waitFor({ timeout: 15000 });
}

describe.runIf(IS_E2E)('Global keyboard shortcuts', () => {
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

  it('opens the shortcut help dialog with Ctrl+/ and lists the registered shortcuts', async () => {
    const { page } = session;
    await page.keyboard.press('Control+/');
    await helpDialog(page).waitFor({ timeout: 5000 });
    await expect.poll(() => helpDialog(page).innerText()).toContain('Keyboard Shortcuts');
    await expect.poll(() => helpDialog(page).innerText()).toContain('Go to Convert');
  });

  it('closes the shortcut help dialog with Escape', async () => {
    const { page } = session;
    await page.keyboard.press('Control+/');
    await helpDialog(page).waitFor({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await expect.poll(() => helpDialog(page).count()).toBe(0);
  });

  it('closes the shortcut help dialog from its close button', async () => {
    const { page } = session;
    await page.keyboard.press('Control+/');
    await helpDialog(page).waitFor({ timeout: 5000 });
    await page.locator('[data-testid="shortcuts-help-close"]').click();
    await expect.poll(() => helpDialog(page).count()).toBe(0);
  });

  it.each(ALT_BINDINGS)('navigates to $route with $chord', async ({ chord, route }) => {
    const { page } = session;
    await page.keyboard.press(chord);
    await page.waitForFunction((expected) => location.hash.startsWith(expected), route, { timeout: 15000 });
  });

  it('advances the colour theme with Ctrl+Alt+T and persists it', async () => {
    const { page } = session;
    const before = await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY);

    await page.keyboard.press('Control+Alt+T');

    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY)).not.toBe(before);
    const after = await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY);
    expect(THEME_IDS).toContain(after);
  });
});
