/**
 * @fileoverview Copilot responsive layout E2E suite (Tier A, mock preload).
 *
 * The unit tier cannot measure layout, so this suite checks the shipped CSS at
 * the three widths the app targets: the composer and every action must stay
 * inside the viewport with no horizontal overflow, and the saved-chats panel
 * must overlay the conversation below `md` while keeping the desktop push
 * behaviour at `md+`.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Page } from 'playwright';
import { launchApp, closeApp, ensureLiveSession, reloadSession, type AppSession } from '../fixtures/app';
import { mockApi } from '../mocks/control';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;
const WIDTHS = [320, 768, 1440] as const;
const HEIGHT = 900;

/** Navigates to `/copilot` through the drawer and waits for the route to mount. */
async function gotoCopilot(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: HEIGHT });
  await page.locator('[data-testid="nav-item-copilot"]').waitFor({ timeout: 15000 });
  await page.locator('[data-testid="nav-item-copilot"]').click();
  await page.waitForFunction(() => location.hash.startsWith('#/copilot'));
  await page.locator('[data-testid="copilot-conversation"]').waitFor({ timeout: 15000 });
}

/**
 * Reads the document and main scroll widths.
 * @param {Page} page - The Playwright page.
 * @returns {Promise<object>} The measurements.
 */
async function overflowMetrics(page: Page): Promise<{ viewport: number; document: number; mainClient: number; mainScroll: number }> {
  return page.evaluate(() => {
    const main = document.querySelector('main');
    return {
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      mainClient: main?.clientWidth ?? 0,
      mainScroll: main?.scrollWidth ?? 0,
    };
  });
}

/**
 * Asserts that every named control is laid out inside the viewport.
 * @param {Page} page - The Playwright page.
 * @param {string} label - Failure message prefix.
 */
async function expectControlsInViewport(page: Page, label: string): Promise<void> {
  const testIds = ['copilot-plan', 'copilot-choose-files', 'copilot-choose-folder', 'copilot-advanced', 'copilot-ai-settings'];
  const viewport = await page.evaluate(() => window.innerWidth);

  for (const testId of testIds) {
    const box = await page.locator(`[data-testid="${testId}"]`).boundingBox();
    expect(box, `${label}: ${testId} must be rendered`).not.toBeNull();
    expect(box!.x, `${label}: ${testId} must not overflow the inline start`).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width, `${label}: ${testId} must not overflow the inline end`).toBeLessThanOrEqual(viewport + 1);
  }
}

describe.runIf(IS_E2E)('Copilot responsive layout', () => {
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
    await gotoCopilot(session.page);
  }, 30000);

  for (const width of WIDTHS) {
    it(`has no horizontal overflow and keeps the composer visible at ${width}px`, async () => {
      const { page } = session;
      await page.setViewportSize({ width, height: HEIGHT });
      await page.locator('[data-testid="copilot-conversation"]').waitFor({ timeout: 15000 });

      await expect
        .poll(async () => {
          const metrics = await overflowMetrics(page);
          return metrics.document <= metrics.viewport + 1 && metrics.mainScroll <= metrics.mainClient + 1;
        })
        .toBe(true);

      await expectControlsInViewport(page, `${width}px`);
    });
  }

  it('overlays the saved-chats panel below md', async () => {
    const { page } = session;
    await page.setViewportSize({ width: 320, height: HEIGHT });
    await page.locator('[data-testid="copilot-saved-chats"]').click();
    const backdrop = page.locator('[data-testid="saved-chats-backdrop"]');
    await backdrop.waitFor({ state: 'visible', timeout: 5000 });

    const drawer = await page.locator('[data-testid="saved-chats-drawer"]').boundingBox();
    expect(drawer).not.toBeNull();
    expect(drawer!.x).toBeGreaterThanOrEqual(-1);
    expect(drawer!.x + drawer!.width).toBeLessThanOrEqual(320 + 1);

    const backdropBox = await backdrop.boundingBox();
    expect(backdropBox).not.toBeNull();
    await page.mouse.click(backdropBox!.x + backdropBox!.width - 2, backdropBox!.y + 120);
    await backdrop.waitFor({ state: 'detached', timeout: 5000 });
  });

  it('keeps the desktop push drawer and hides the backdrop at md+', async () => {
    const { page } = session;
    await page.setViewportSize({ width: 1440, height: HEIGHT });
    await page.locator('[data-testid="copilot-saved-chats"]').click();
    await page.locator('[data-testid="saved-chats-drawer"]').waitFor({ state: 'visible', timeout: 5000 });

    await expect.poll(() => page.locator('[data-testid="saved-chats-backdrop"]').isVisible()).toBe(false);
  });

  it('separates the plan button from the provider logo and matches the configure button to the row', async () => {
    const { page } = session;
    await page.setViewportSize({ width: 1440, height: HEIGHT });

    const divider = page.locator('[data-testid="copilot-composer-divider"]');
    await expect.poll(() => divider.count()).toBe(1);

    // The configure button sits on the same baseline and with the same height
    // as the other actions in the row.
    const configure = await page.locator('[data-testid="copilot-ai-settings"]').boundingBox();
    const chooseFiles = await page.locator('[data-testid="copilot-choose-files"]').boundingBox();
    expect(configure).not.toBeNull();
    expect(chooseFiles).not.toBeNull();
    expect(Math.abs(configure!.height - chooseFiles!.height)).toBeLessThanOrEqual(2);
    const centerY = (box: { y: number; height: number }): number => box.y + box.height / 2;
    expect(Math.abs(centerY(configure!) - centerY(chooseFiles!))).toBeLessThanOrEqual(2);
  });
});
