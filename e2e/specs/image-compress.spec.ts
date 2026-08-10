import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { launchApp, closeApp, AppSession } from '../fixtures/app';
import { mockApi } from '../mocks/control';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

describe.runIf(IS_E2E)('Image Compress page', () => {
  let session: AppSession;

  beforeAll(async () => {
    session = await launchApp({ mock: true });
  }, 60000);

  afterAll(async () => {
    await closeApp(session.app, session.userDataDir);
  });

  beforeEach(async () => {
    const { page } = session;
    await mockApi.reset(page);
    await page.reload();
    await page.locator('[data-testid="nav-item-image-compress"]').waitFor({ timeout: 15000 });
    await page.locator('[data-testid="nav-item-image-compress"]').click();
    await page.waitForFunction(() => location.hash.startsWith('#/image-compress'));
    await page.locator('[data-testid="file-drop-zone"]').waitFor({ timeout: 15000 });
  }, 30000);

  it('shows the dropzone while idle', async () => {
    await expect.poll(() => session.page.locator('[data-testid="file-drop-zone"]').count()).toBe(1);
  });

  it('selects an image and shows its preview and file info', async () => {
    await mockApi.setSelectFile(session.page, '/media/photo.png');
    await mockApi.setImagePreview(session.page, 'data:image/png;base64,AAAA');
    await mockApi.setImageFileInfo(session.page, { width: 800, height: 600, size: 100000 });
    await session.page.locator('[data-testid="file-drop-zone"]').click();

    await expect.poll(() => session.page.locator('[data-testid="selected-image"]').textContent()).toContain('photo.png');
    await expect.poll(() => session.page.locator('[data-testid="image-file-info"]').textContent()).toContain('800');
    await expect.poll(() => session.page.locator('[data-testid="image-compress-compress"]').count()).toBe(1);
  });

  it('changes the output format', async () => {
    await mockApi.setSelectFile(session.page, '/media/photo.png');
    await mockApi.setImagePreview(session.page, 'data:image/png;base64,AAAA');
    await mockApi.setImageFileInfo(session.page, { width: 800, height: 600, size: 100000 });
    await session.page.locator('[data-testid="file-drop-zone"]').click();
    await session.page.locator('[data-testid="image-compress-format"] [role="combobox"]').waitFor({ timeout: 10000 });

    await session.page.locator('[data-testid="image-compress-format"] [role="combobox"]').click();
    const formatOption = session.page.locator('[role="option"]').filter({ hasText: 'WebP' }).first();
    await formatOption.waitFor({ timeout: 5000 });
    await formatOption.click();
    await expect
      .poll(() => session.page.locator('[data-testid="image-compress-format"] [role="combobox"]').innerText())
      .toContain('WebP');
  });

  it('compresses an image and shows a success toast', async () => {
    await mockApi.setSelectFile(session.page, '/media/photo.png');
    await mockApi.setImagePreview(session.page, 'data:image/png;base64,AAAA');
    await mockApi.setImageFileInfo(session.page, { width: 800, height: 600, size: 100000 });
    await session.page.locator('[data-testid="file-drop-zone"]').click();
    await session.page.locator('[data-testid="selected-image"]').waitFor({ timeout: 10000 });

    await mockApi.setSelectOutput(session.page, '/media/photo_compressed');
    await session.page.locator('[data-testid="image-compress-output"] button').click();
    await expect.poll(() => session.page.locator('[data-testid="image-compress-output"] input').inputValue()).toContain('photo_compressed');
    await expect.poll(() => session.page.locator('[data-testid="image-compress-compress"]').isEnabled()).toBe(true);

    await session.page.locator('[data-testid="image-compress-compress"]').click();
    await expect
      .poll(() => session.page.locator('[role="alert"]').filter({ hasText: 'Image compressed successfully' }).count())
      .toBeGreaterThan(0);
  });
});
