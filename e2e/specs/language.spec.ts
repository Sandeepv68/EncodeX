/**
 * @fileoverview Language switcher E2E suite (Tier A, mock preload).
 *
 * The locale menu lives in the drawer footer and is reachable from every page.
 * These tests check that a locale switch changes the active label, survives a
 * full reload, and flips the document direction for right-to-left scripts.
 * The language preference is restored to English after each test so the other
 * specs in this file-run start from a known state.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Page } from 'playwright';
import { launchApp, closeApp, ensureLiveSession, reloadSession, AppSession } from '../fixtures/app';
import { mockApi } from '../mocks/control';
import { LANGUAGE_STORAGE_KEY } from '../../src/shared/constants';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

const ENGLISH = 'en-US';
const GERMAN = 'de-DE';
const ARABIC = 'ar-SA';

function menuButton(page: Page) {
  return page.locator('[data-testid="language-menu-button"]');
}

/**
 * Opens the locale menu, filters it by `query`, and clicks the single match.
 * @param {Page} page - The main window.
 * @param {string} query - Locale code or label fragment to search for.
 */
async function chooseLocale(page: Page, query: string): Promise<void> {
  await menuButton(page).click();
  const search = page.locator('.MuiMenu-root input').first();
  await search.waitFor({ timeout: 5000 });
  await search.fill(query);
  const items = page.locator('.MuiMenu-root [role="menuitem"]');
  await expect.poll(() => items.count()).toBe(1);
  await items.first().click();
  await page
    .locator('.MuiMenu-root')
    .waitFor({ state: 'detached', timeout: 10000 })
    .catch(() => undefined);
}

async function storedLocale(page: Page): Promise<string | null> {
  return page.evaluate((key) => localStorage.getItem(key), LANGUAGE_STORAGE_KEY);
}

describe.runIf(IS_E2E)('Language switcher', () => {
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
    await session.page.evaluate((key) => localStorage.removeItem(key), LANGUAGE_STORAGE_KEY);
    session = await reloadSession(session);
    const { page } = session;
    await page.locator('[data-testid="nav-item-dashboard"]').waitFor({ timeout: 15000 });
    // The drawer is condensed by default; the locale label is only rendered when expanded.
    if (!(await menuButton(page).textContent())?.trim()) {
      await page.locator('[data-testid="drawer-condense-button"]').click();
    }
    await expect.poll(() => menuButton(page).textContent()).toMatch(/\S/);
  }, 30000);

  it('lists every supported locale and filters them by search', async () => {
    const { page } = session;
    await menuButton(page).click();
    const search = page.locator('.MuiMenu-root input').first();
    await search.waitFor({ timeout: 5000 });
    const all = await page.locator('.MuiMenu-root [role="menuitem"]').count();
    expect(all).toBeGreaterThan(20);

    await search.fill('deutsch');
    await expect.poll(() => page.locator('.MuiMenu-root [role="menuitem"]').count()).toBeGreaterThan(0);
    await expect.poll(() => page.locator('.MuiMenu-root [role="menuitem"]').count()).toBeLessThan(all);
    await page.keyboard.press('Escape');
  });

  it('switches the active locale and persists the choice across a reload', async () => {
    const { page } = session;
    await chooseLocale(page, GERMAN);

    await expect.poll(() => menuButton(page).textContent()).toContain('Deutsch');
    await expect.poll(() => storedLocale(page)).toBe(GERMAN);

    session = await reloadSession(session);
    await session.page.locator('[data-testid="language-menu-button"]').waitFor({ timeout: 15000 });
    await expect.poll(() => menuButton(session.page).textContent()).toContain('Deutsch');
  });

  it('marks the active locale as selected in the menu', async () => {
    const { page } = session;
    await menuButton(page).click();
    const search = page.locator('.MuiMenu-root input').first();
    await search.fill(ENGLISH);
    const selected = page.locator('.MuiMenu-root [role="menuitem"].Mui-selected');
    await expect.poll(() => selected.count()).toBe(1);
    await expect.poll(() => selected.first().textContent()).toContain('English');
    await page.keyboard.press('Escape');
  });

  it('flips the document to right-to-left for an Arabic locale and back to left-to-right for English', async () => {
    const { page } = session;
    await chooseLocale(page, ARABIC);
    await expect.poll(() => page.evaluate(() => document.dir)).toBe('rtl');
    await expect.poll(() => storedLocale(page)).toBe(ARABIC);

    await chooseLocale(page, ENGLISH);
    await expect.poll(() => page.evaluate(() => document.dir)).toBe('ltr');
    await expect.poll(() => menuButton(page).textContent()).toContain('English');
  });
});
