/**
 * @fileoverview About page and in-app update flow E2E suite (Tier A, mock preload).
 *
 * Covers the metadata a user relies on when reporting bugs or checking
 * licensing (version, author, repository, license, contact), and the update
 * lifecycle the About page triggers. The update tests drive the same
 * main-process events the real updater emits (`update-available`,
 * `update-progress`, `update-downloaded`, `update-error`) and assert what the
 * dialog and footer show at each step.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { Page } from 'playwright';
import { launchApp, closeApp, ensureLiveSession, reloadSession, AppSession } from '../fixtures/app';
import { mockApi } from '../mocks/control';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

const PACKAGE_VERSION: string = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'package.json'), 'utf8')).version;

const AUTHOR_URL = 'https://github.com/Sandeepv68';
const REPOSITORY_URL = 'https://github.com/Sandeepv68/EncodeX';
const LICENSE_URL = `${REPOSITORY_URL}/blob/main/LICENSE`;
const CONTACT_HREF = 'mailto:developer@encodex.in';

async function gotoAbout(page: Page): Promise<void> {
  await page.locator('[data-testid="nav-item-about"]').waitFor({ timeout: 15000 });
  await page.locator('[data-testid="nav-item-about"]').click();
  await page.waitForFunction(() => location.hash.startsWith('#/about'));
  await page.getByRole('heading', { level: 1, name: 'About' }).waitFor({ timeout: 15000 });
}

function updateDialog(page: Page) {
  return page.locator('[data-testid="update-dialog"]');
}

async function openUpdateDialogFromAbout(page: Page): Promise<void> {
  await page.getByRole('button', { name: /check for updates/i }).click();
  await updateDialog(page).waitFor({ timeout: 10000 });
}

describe.runIf(IS_E2E)('About page and updates', () => {
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
    await gotoAbout(session.page);
  }, 30000);

  it('shows the installed version read from package.json', async () => {
    const { page } = session;
    await expect.poll(() => page.locator('body').innerText()).toContain(PACKAGE_VERSION);
  });

  it('links the author, repository, licence and contact address', async () => {
    const { page } = session;
    await expect.poll(() => page.locator(`a[href="${AUTHOR_URL}"]`).count()).toBe(1);
    await expect.poll(() => page.locator(`a[href="${REPOSITORY_URL}"]`).count()).toBe(1);
    await expect.poll(() => page.locator(`a[href="${LICENSE_URL}"]`).count()).toBe(1);
    await expect.poll(() => page.locator(`a[href="${CONTACT_HREF}"]`).count()).toBe(1);
  });

  it('opens the update dialog and shows up-to-date when the check finds nothing', async () => {
    const { page } = session;
    await openUpdateDialogFromAbout(page);
    await expect.poll(() => updateDialog(page).innerText()).toMatch(/checking/i);

    await mockApi.emit(page, 'update-not-available', undefined);
    await expect.poll(() => updateDialog(page).innerText()).toContain("You're up to date!");
  });

  it('walks an available update through download, progress and ready-to-install', async () => {
    const { page } = session;
    await openUpdateDialogFromAbout(page);

    await mockApi.emit(page, 'update-available', {
      version: '9.9.9',
      releaseNotes: 'Fixes everything',
      releaseUrl: `${REPOSITORY_URL}/releases/tag/v9.9.9`,
    });
    await expect.poll(() => updateDialog(page).innerText()).toContain('v9.9.9');
    await expect.poll(() => updateDialog(page).innerText()).toContain('Fixes everything');

    await updateDialog(page).getByRole('button', { name: 'Download', exact: true }).click();
    await mockApi.emit(page, 'update-progress', { percent: 40, transferred: 100, total: 250 });
    await expect.poll(() => updateDialog(page).innerText()).toContain('40%');

    await mockApi.emit(page, 'update-downloaded', '/tmp/EncodeX-setup.exe');
    await expect.poll(() => page.locator('[data-testid="footer-update-ready"]').count()).toBe(1);
  });

  it('shows the error message and offers a retry when the updater fails', async () => {
    const { page } = session;
    await openUpdateDialogFromAbout(page);

    await mockApi.emit(page, 'update-error', 'Network unreachable');
    await expect.poll(() => updateDialog(page).innerText()).toContain('Network unreachable');
    await expect.poll(() => updateDialog(page).getByRole('button', { name: /retry/i }).count()).toBe(1);
  });
});
