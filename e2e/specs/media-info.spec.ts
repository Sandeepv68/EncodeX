import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { MediaInfo, ImageExifData } from '../../src/shared/types';
import { launchApp, closeApp, AppSession } from '../fixtures/app';
import { mockApi } from '../mocks/control';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

const VIDEO_INFO: MediaInfo = {
  file: '/media/video.mp4',
  format: 'mov,mp4,m4a,3gp,3g2,mj2',
  size: 1048576,
  duration: 12.5,
  bitrate: '2000k',
  streams: [
    { index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080, pixelFormat: 'yuv420p', frameRate: '25' },
    { index: 1, type: 'audio', codec: 'aac', channels: 2, sampleRate: 48000, bitrate: '192k', language: 'eng' },
  ],
};

const IMAGE_INFO: ImageExifData = {
  file: '/media/photo.jpg',
  exif: { Make: 'TestCamera', Model: 'X100' },
  histogram: null,
};

describe.runIf(IS_E2E)('Media Info page', () => {
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
    await page.locator('[data-testid="nav-item-media-info"]').waitFor({ timeout: 15000 });
    await page.locator('[data-testid="nav-item-media-info"]').click();
    await page.waitForFunction(() => location.hash.startsWith('#/media-info'));
    await page.locator('[data-testid="file-drop-zone"]').waitFor({ timeout: 15000 });
  }, 30000);

  it('shows the file dropzone while idle', async () => {
    await expect.poll(() => session.page.locator('[data-testid="file-drop-zone"]').count()).toBe(1);
  });

  it('analyzes a video and renders file summary and stream details', async () => {
    await mockApi.setSelectFile(session.page, '/media/video.mp4');
    await mockApi.setMediaInfo(session.page, VIDEO_INFO);
    await session.page.locator('[data-testid="file-drop-zone"]').click();

    await expect.poll(() => session.page.locator('body').textContent()).toContain('video.mp4');
    await expect.poll(() => session.page.locator('body').textContent()).toContain('h264');
    await expect.poll(() => session.page.locator('body').textContent()).toContain('aac');
    await expect.poll(() => session.page.locator('[role="alert"]').filter({ hasText: 'Media info loaded' }).count()).toBeGreaterThan(0);
  });

  it('analyzes an image and renders EXIF data', async () => {
    await mockApi.setSelectFile(session.page, '/media/photo.jpg');
    await mockApi.setMediaInfo(session.page, { ...VIDEO_INFO, file: '/media/photo.jpg', format: 'jpeg', duration: 0, streams: [] });
    await mockApi.setImageInfo(session.page, IMAGE_INFO);
    await session.page.locator('[data-testid="file-drop-zone"]').click();

    await expect.poll(() => session.page.locator('body').textContent()).toContain('TestCamera');
    await expect.poll(() => session.page.locator('body').textContent()).toContain('X100');
  });
});
