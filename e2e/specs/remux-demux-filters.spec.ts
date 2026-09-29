import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Page } from 'playwright';
import type { MediaInfo } from '../../src/shared/types';
import { launchApp, closeApp, ensureLiveSession, reloadSession, AppSession } from '../fixtures/app';
import { mockApi } from '../mocks/control';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

const INPUT = '/media/video.mp4';

/** H.264 in MP4, so a `.mkv` video target forces a re-encode and `copy` does not. */
const VIDEO_INFO: MediaInfo = {
  file: INPUT,
  format: 'mov,mp4,m4a,3gp,3g2,mj2',
  size: 4194304,
  duration: 30,
  bitrate: '2000k',
  streams: [
    { index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080, bitrate: '1800k' },
    { index: 1, type: 'audio', codec: 'aac', channels: 2, sampleRate: 48000, bitrate: '192k', language: 'eng' },
  ],
};

async function gotoPage(page: Page, route: 'remux' | 'demux'): Promise<void> {
  await page.locator(`[data-testid="nav-item-${route}"]`).click();
  await page.waitForFunction((r) => location.hash.startsWith(`#/${r}`), route);
  await page.locator('[data-testid="file-drop-zone"]').waitFor({ timeout: 15000 });
}

async function selectSource(page: Page): Promise<void> {
  await mockApi.setSelectFile(page, INPUT);
  await mockApi.setMediaInfo(page, VIDEO_INFO);
  await page.locator('[data-testid="file-drop-zone"]').click();
  await expect.poll(() => page.locator('[data-testid="selected-video"]').textContent()).toContain('video.mp4');
}

async function chooseOption(page: Page, testId: string, value: string): Promise<void> {
  await page.locator(`[data-testid="${testId}"] [role="combobox"]`).click();
  const option = page.locator(`[role="option"][data-value="${value}"]`);
  await option.waitFor({ timeout: 5000 });
  await option.click();
}

async function addCustomFilter(page: Page, value: string): Promise<void> {
  await page.locator('[data-testid="filters-custom-input"] input').fill(value);
  await page.locator('[data-testid="filters-add-custom"]').click();
}

async function addPresetFilter(page: Page, presetId: string): Promise<void> {
  await chooseOption(page, 'filters-preset-select', presetId);
  await page.locator('[data-testid="filters-add-preset"]').click();
}

describe.runIf(IS_E2E)('Remux/Demux video filters', () => {
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
    await session.page.locator('[data-testid="nav-item-remux"]').waitFor({ timeout: 15000 });
  }, 30000);

  describe('Remux page', () => {
    beforeEach(async () => {
      await gotoPage(session.page, 'remux');
      await selectSource(session.page);
    }, 30000);

    it('shows the filters section with no re-encode warning before a filter is added', async () => {
      await expect.poll(() => session.page.locator('[data-testid="video-filters-section"]').count()).toBe(1);
      await expect.poll(() => session.page.locator('[data-testid="remux-filters-reencode"]').count()).toBe(0);
    });

    it('adds a custom filter and shows the re-encode warning', async () => {
      await addCustomFilter(session.page, 'fps=24');
      await expect.poll(() => session.page.locator('[data-testid="filters-entry-0"]').textContent()).toContain('fps=24');
      await expect.poll(() => session.page.locator('[data-testid="filters-preview"]').textContent()).toContain('fps=24');
      await expect.poll(() => session.page.locator('[data-testid="remux-filters-reencode"]').count()).toBe(1);
    });

    it('adds a catalog preset and merges it into the single chain', async () => {
      await addPresetFilter(session.page, 'grayscale');
      await expect.poll(() => session.page.locator('[data-testid="filters-entry-0"]').textContent()).toContain('hue=s=0');
      await addCustomFilter(session.page, 'fps=24');
      await expect.poll(() => session.page.locator('[data-testid="filters-entry-1"]').count()).toBe(1);
      await expect.poll(() => session.page.locator('[data-testid="filters-preview"]').textContent()).toContain('hue=s=0,fps=24');
    });

    it('reorders and removes filter entries', async () => {
      await addCustomFilter(session.page, 'fps=24');
      await addCustomFilter(session.page, 'eq=brightness=0.1');
      await expect.poll(() => session.page.locator('[data-testid="filters-entry-1"]').count()).toBe(1);

      await session.page.locator('[data-testid="filters-move-up-1"]').click();
      await expect.poll(() => session.page.locator('[data-testid="filters-entry-0"]').textContent()).toContain('eq=brightness=0.1');

      await session.page.locator('[data-testid="filters-remove-0"]').click();
      await expect.poll(() => session.page.locator('[data-testid="filters-entry-1"]').count()).toBe(0);
      await expect.poll(() => session.page.locator('[data-testid="filters-entry-0"]').textContent()).toContain('fps=24');
    });

    it('rejects an invalid custom chain and keeps the add button disabled', async () => {
      await session.page.locator('[data-testid="filters-custom-input"] input').fill('fps=30;rm -rf');
      await expect.poll(() => session.page.locator('[data-testid="filters-add-custom"]').isDisabled()).toBe(true);
      await expect.poll(() => session.page.locator('[data-testid="filters-entry-0"]').count()).toBe(0);
    });

    it('clears every filter and drops the re-encode warning', async () => {
      await addCustomFilter(session.page, 'fps=24');
      await expect.poll(() => session.page.locator('[data-testid="remux-filters-reencode"]').count()).toBe(1);

      await session.page.locator('[data-testid="filters-clear-all"]').click();
      await expect.poll(() => session.page.locator('[data-testid="filters-entry-0"]').count()).toBe(0);
      await expect.poll(() => session.page.locator('[data-testid="remux-filters-reencode"]').count()).toBe(0);
    });
  });

  describe('Demux page', () => {
    beforeEach(async () => {
      await gotoPage(session.page, 'demux');
      await selectSource(session.page);
    }, 30000);

    it('hides the filters section while the video target is Copy', async () => {
      await expect.poll(() => session.page.locator('[data-testid="demux-video-target"]').count()).toBe(1);
      await expect.poll(() => session.page.locator('[data-testid="video-filters-section"]').count()).toBe(0);
    });

    it('reveals the filters section for a re-encoding video target', async () => {
      await chooseOption(session.page, 'demux-video-target', 'mkv');
      await expect.poll(() => session.page.locator('[data-testid="video-filters-section"]').count()).toBe(1);
    });

    it('applies a filter to the re-encoding target and reports it in the summary', async () => {
      await chooseOption(session.page, 'demux-video-target', 'mkv');
      await addCustomFilter(session.page, 'fps=24');
      await expect.poll(() => session.page.locator('[data-testid="filters-entry-0"]').textContent()).toContain('fps=24');
      await expect.poll(() => session.page.locator('[data-testid="demux-target"]').count()).toBeGreaterThan(0);
    });

    it('warns that filters are ignored when the target switches back to Copy', async () => {
      await chooseOption(session.page, 'demux-video-target', 'mkv');
      await addCustomFilter(session.page, 'fps=24');
      await expect.poll(() => session.page.locator('[data-testid="video-filters-section"]').count()).toBe(1);

      await chooseOption(session.page, 'demux-video-target', 'copy');
      await expect.poll(() => session.page.locator('[data-testid="video-filters-section"]').count()).toBe(0);
      await expect.poll(() => session.page.locator('[data-testid="demux-warning"]').first().textContent()).toContain('Copy');
    });
  });
});
