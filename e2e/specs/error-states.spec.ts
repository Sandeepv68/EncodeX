/**
 * @fileoverview Failure-path E2E suite (Tier A, mock preload).
 *
 * The happy paths are covered per page. This suite checks that a backend
 * failure reaches the user as a readable alert while the app stays usable:
 * the conversion page must show the classified error, return the start button
 * to its idle state, and accept a retry without a reload.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Page } from 'playwright';
import { launchApp, closeApp, ensureLiveSession, reloadSession, AppSession } from '../fixtures/app';
import { mockApi } from '../mocks/control';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

const INPUT = '/media/video.mp4';
const OUTPUT = '/media/video_encodex_converted.mp4';

async function gotoConvert(page: Page): Promise<void> {
  await page.locator('[data-testid="nav-item-convert"]').waitFor({ timeout: 15000 });
  await page.locator('[data-testid="nav-item-convert"]').click();
  await page.waitForFunction(() => location.hash.startsWith('#/convert'));
}

async function selectInput(page: Page): Promise<void> {
  await mockApi.setSelectFile(page, INPUT);
  await page.locator('[data-testid="file-drop-zone"]').click();
  await expect.poll(() => page.locator('[data-testid="convert-output"] input').inputValue()).toBe(OUTPUT);
}

describe.runIf(IS_E2E)('Failure paths', () => {
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
    await gotoConvert(session.page);
  }, 30000);

  it('shows the classified error when a conversion is rejected and returns to idle', async () => {
    const { page } = session;
    await mockApi.setConvertBehavior(page, 'reject');
    await selectInput(page);

    await page.locator('[data-testid="convert-start"]').click();
    await expect.poll(() => page.locator('[role="alert"]').filter({ hasText: 'The conversion process failed' }).count()).toBeGreaterThan(0);
    await expect.poll(() => page.locator('[data-testid="convert-pause"]').count()).toBe(0);
    await expect.poll(() => page.locator('[data-testid="convert-start"]').isDisabled()).toBe(false);
  });

  it('accepts a retry after a failed conversion without reloading the app', async () => {
    const { page } = session;
    await mockApi.setConvertBehavior(page, 'reject');
    await selectInput(page);
    await page.locator('[data-testid="convert-start"]').click();
    await expect.poll(() => page.locator('[role="alert"]').filter({ hasText: 'The conversion process failed' }).count()).toBeGreaterThan(0);

    await mockApi.setConvertBehavior(page, 'resolve');
    await page.locator('[data-testid="convert-start"]').click();
    await expect.poll(() => page.locator('[role="alert"]').filter({ hasText: 'Conversion complete' }).count()).toBeGreaterThan(0);
  });
});
