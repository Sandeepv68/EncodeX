import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { MediaInfo } from '../../src/shared/types';
import { launchApp, closeApp, AppSession } from '../fixtures/app';
import { mockApi } from '../mocks/control';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

const VIDEO_INFO: MediaInfo = {
  file: '/media/video.mp4',
  format: 'mov,mp4,m4a,3gp,3g2,mj2',
  size: 1048576,
  duration: 12.5,
  bitrate: '2000k',
  streams: [{ index: 0, type: 'audio', codec: 'aac', channels: 2, sampleRate: 48000, bitrate: '192k', language: 'eng' }],
};

describe.runIf(IS_E2E)('Audio Extract page', () => {
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
    await page.locator('[data-testid="nav-item-audio-extract"]').waitFor({ timeout: 15000 });
    await page.locator('[data-testid="nav-item-audio-extract"]').click();
    await page.waitForFunction(() => location.hash.startsWith('#/audio-extract'));
    await page.locator('[data-testid="file-drop-zone"]').waitFor({ timeout: 15000 });
  }, 30000);

  it('starts with a disabled extract button', async () => {
    await expect.poll(() => session.page.locator('[data-testid="audio-extract-extract"]').isDisabled()).toBe(true);
  });

  it('selects a video, lists its audio streams, and sets an output', async () => {
    await mockApi.setSelectFile(session.page, '/media/video.mp4');
    await mockApi.setVideoPreview(session.page, 'data:image/png;base64,AAAA');
    await mockApi.setMediaInfo(session.page, VIDEO_INFO);
    await session.page.locator('[data-testid="file-drop-zone"]').click();

    await expect.poll(() => session.page.locator('[data-testid="selected-video"]').textContent()).toContain('video.mp4');
    await expect.poll(() => session.page.locator('[data-testid="audio-stream-info"]').count()).toBe(1);

    await mockApi.setSelectOutput(session.page, '/media/video_audio');
    await session.page.locator('[data-testid="audio-extract-output"] button').click();
    await expect.poll(() => session.page.locator('[data-testid="audio-extract-output"] input').inputValue()).toContain('video_audio');
    await expect.poll(() => session.page.locator('[data-testid="audio-extract-extract"]').isEnabled()).toBe(true);
  });

  it('changes the audio codec to MP3', async () => {
    await mockApi.setSelectFile(session.page, '/media/video.mp4');
    await mockApi.setMediaInfo(session.page, VIDEO_INFO);
    await session.page.locator('[data-testid="file-drop-zone"]').click();
    await session.page.locator('[data-testid="audio-extract-codec"] [role="combobox"]').waitFor({ timeout: 10000 });

    await session.page.locator('[data-testid="audio-extract-codec"] [role="combobox"]').click();
    const option = session.page.locator('[role="option"][data-value="libmp3lame"]');
    await option.waitFor({ timeout: 5000 });
    await option.click();
    await expect.poll(() => session.page.locator('[data-testid="audio-extract-codec"] [role="combobox"]').innerText()).toContain('MP3');
  });

  it('extracts audio and shows a success toast', async () => {
    await mockApi.setSelectFile(session.page, '/media/video.mp4');
    await mockApi.setMediaInfo(session.page, VIDEO_INFO);
    await session.page.locator('[data-testid="file-drop-zone"]').click();
    await session.page.locator('[data-testid="selected-video"]').waitFor({ timeout: 10000 });

    await mockApi.setSelectOutput(session.page, '/media/video_audio');
    await session.page.locator('[data-testid="audio-extract-output"] button').click();
    await expect.poll(() => session.page.locator('[data-testid="audio-extract-extract"]').isEnabled()).toBe(true);

    await session.page.locator('[data-testid="audio-extract-extract"]').click();
    await expect
      .poll(() => session.page.locator('[role="alert"]').filter({ hasText: 'Audio extracted successfully' }).count())
      .toBeGreaterThan(0);
  });
});
