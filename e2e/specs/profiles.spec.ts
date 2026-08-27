import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Page } from 'playwright';
import { launchApp, closeApp, AppSession } from '../fixtures/app';
import { mockApi } from '../mocks/control';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

const PROFILE_NAME = 'My Custom Profile';

async function gotoConvert(page: Page) {
  await page.locator('[data-testid="nav-item-convert"]').click();
  await page.waitForFunction(() => location.hash.startsWith('#/convert'));
}

async function openProfileDropdown(page: Page) {
  await page.locator('[data-testid="profile-selector"] [role="combobox"]').click();
}

async function openCreateProfileModal(page: Page) {
  await openProfileDropdown(page);
  await page.getByRole('button', { name: 'Create Custom Profile' }).click();
  await page.locator('[role="dialog"]').waitFor({ timeout: 5000 });
}

async function selectMuiOption(page: Page, targetId: string, optionText: string) {
  await page.locator(`#${targetId}`).click();
  const option = page.locator('[role="option"]').filter({ hasText: optionText }).first();
  await option.waitFor({ timeout: 5000 });
  await option.click();
}

describe.runIf(IS_E2E)('Create Custom Profile', () => {
  let session: AppSession;

  beforeAll(async () => {
    session = await launchApp({ mock: true });
    await gotoConvert(session.page);
  }, 60000);

  afterAll(async () => {
    await closeApp(session.app, session.userDataDir);
  });

  beforeEach(async () => {
    await mockApi.reset(session.page);
    await session.page.evaluate(() => localStorage.clear());
    await session.page.reload();
    await gotoConvert(session.page);
  });

  it('opens the create profile modal from the selector dropdown', async () => {
    await openCreateProfileModal(session.page);
    await expect.poll(() => session.page.locator('[role="dialog"]').count()).toBeGreaterThan(0);
    await expect.poll(() => session.page.locator('[role="dialog"]').textContent()).toContain('Create Custom Profile');
  });

  it('creates a custom profile, shows a toast, and lists it in the selector', async () => {
    await openCreateProfileModal(session.page);

    await session.page.locator('#profile-name').fill(PROFILE_NAME);

    await selectMuiOption(session.page, 'profile-video-codec', 'H.265/HEVC (libx265)');

    await session.page.getByRole('button', { name: 'Create Profile' }).click();

    await expect.poll(() => session.page.locator('[role="alert"]').filter({ hasText: 'Created' }).count()).toBeGreaterThan(0);
    await expect.poll(() => session.page.locator('[role="alert"]').filter({ hasText: PROFILE_NAME }).count()).toBeGreaterThan(0);

    await openProfileDropdown(session.page);
    const option = session.page.locator('[role="option"]').filter({ hasText: PROFILE_NAME }).first();
    await option.waitFor({ timeout: 5000 });
    expect(await option.count()).toBeGreaterThan(0);
  });
});
