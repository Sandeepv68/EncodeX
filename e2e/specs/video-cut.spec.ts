import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { MediaInfo } from '../../src/shared/types';
import { launchApp, closeApp, ensureLiveSession, reloadSession, AppSession } from '../fixtures/app';
import { mockApi, emitConversionProgress } from '../mocks/control';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

/**
 * `Locator.boundingBox()` resolves to `null` when the element is not laid out,
 * and this spec then does arithmetic straight off the result - so a handle that
 * failed to render produced `TypeError: Cannot read properties of null` instead
 * of a sentence naming the handle. Assert instead.
 * @param {import('playwright').Locator} locator - The handle to measure.
 * @param {string} label - Human-readable name used in the failure message.
 * @returns {Promise<NonNullable<Awaited<ReturnType<import('playwright').Locator['boundingBox']>>>>} Its box.
 */
async function boxOf(locator: import('playwright').Locator, label: string) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${label} has no layout box: the timeline handle did not render.`);
  return box;
}

const VIDEO_INFO: MediaInfo = {
  file: '/media/clip.mp4',
  format: 'mov,mp4,m4a,3gp,3g2,mj2',
  size: 4194304,
  duration: 60,
  bitrate: '2400k',
  streams: [
    { index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080, frameRate: '30/1' },
    { index: 1, type: 'audio', codec: 'aac', channels: 2, sampleRate: 48000, bitrate: '192k', language: 'eng' },
  ],
};

const INPUT = '/media/clip.mp4';
const OUTPUT = '/media/clip_cut.mp4';

async function gotoVideoCut(page: import('playwright').Page): Promise<void> {
  await page.locator('[data-testid="nav-item-video-cut"]').waitFor({ timeout: 15000 });
  await page.locator('[data-testid="nav-item-video-cut"]').click();
  await page.waitForFunction(() => location.hash.startsWith('#/video-cut'));
}

async function selectVideo(page: import('playwright').Page): Promise<void> {
  await mockApi.setSelectFile(page, INPUT);
  await mockApi.setMediaInfo(page, VIDEO_INFO);
  await mockApi.setWaveform(page, {
    sampleRate: 48000,
    samplesPerBucket: 4800,
    buckets: Array.from({ length: 60 }, () => ({ min: -1, max: 1 })),
  });
  await mockApi.setThumbnails(page, {
    dataUrl: 'data:image/png;base64,AAAA',
    cols: 6,
    rows: 1,
    thumbWidth: 160,
    thumbHeight: 90,
    interval: 10,
    count: 6,
  });
  await page.locator('[data-testid="file-drop-zone"]').click();
  await page.locator('[data-testid="video-cut-change"]').waitFor({ timeout: 15000 });
  await page.locator('[data-testid="timeline-video-track"]').waitFor({ timeout: 15000 });
}

async function setOutput(page: import('playwright').Page): Promise<void> {
  await mockApi.setSelectOutput(page, OUTPUT);
  await page.locator('[data-testid="video-cut-output"] button').click();
  await expect.poll(() => page.locator('[data-testid="video-cut-output"] input').inputValue()).toBe(OUTPUT);
}

describe.runIf(IS_E2E)('Video Cut page', () => {
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
    const { page } = session;
    await gotoVideoCut(page);
    await page.locator('[data-testid="file-drop-zone"]').waitFor({ timeout: 15000 });
  }, 30000);

  it('starts with a drop zone and a disabled cut button', async () => {
    await expect.poll(() => session.page.locator('[data-testid="video-cut-cut"]').isDisabled()).toBe(true);
    await expect.poll(() => session.page.locator('[data-testid="video-cut-start"] input').inputValue()).toBe('00:00:00');
  });

  it('selects a video, loads the timeline, and enables the cut button once output is set', async () => {
    const { page } = session;
    await selectVideo(page);
    await expect.poll(() => page.locator('[data-testid="timeline-video-track"]').count()).toBe(1);
    await setOutput(page);
    await expect.poll(() => page.locator('[data-testid="video-cut-cut"]').isEnabled()).toBe(true);
  });

  it('toggles the use-duration switch to swap end time for duration', async () => {
    const { page } = session;
    await selectVideo(page);
    await page.locator('[data-testid="video-cut-use-duration"]').click();
    await page.locator('[data-testid="video-cut-duration"] input').waitFor({ timeout: 10000 });
    await expect.poll(() => page.locator('[data-testid="video-cut-end"]').count()).toBe(0);
    await page.locator('[data-testid="video-cut-duration"] input').fill('00:00:15');
    await expect.poll(() => page.locator('[data-testid="video-cut-duration"] input').inputValue()).toBe('00:00:15');
  });

  it('scrubs the playhead and drags the start handle on the timeline', async () => {
    const { page } = session;
    await session.app.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      if (wins.length) {
        wins[wins.length - 1].setMinimumSize(400, 300);
        wins[wins.length - 1].setContentSize(1000, 600);
      }
    });
    await page.waitForTimeout(500);
    await selectVideo(page);
    const scroller = page.locator('[data-testid="timeline-scroller"]');
    const box = await boxOf(scroller, 'timeline scroller');
    const startHandle = page.locator('[data-testid="timeline-start-handle"]');
    const endHandle = page.locator('[data-testid="timeline-end-handle"]');
    await startHandle.waitFor({ timeout: 10000 });
    await endHandle.waitFor({ timeout: 10000 });
    await scroller.scrollIntoViewIfNeeded();
    await startHandle.scrollIntoViewIfNeeded();
    await endHandle.scrollIntoViewIfNeeded();
    const startBox = await boxOf(startHandle, 'timeline start handle');
    const endBox = await boxOf(endHandle, 'timeline end handle');
    const zoom = (endBox.x - startBox.x) / 60;

    const dragX = startBox.x + startBox.width - 1;
    await page.mouse.move(dragX, startBox.y + startBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 10 * zoom, startBox.y + startBox.height / 2, { steps: 8 });
    await page.mouse.up();

    await expect.poll(() => page.locator('[data-testid="video-cut-start"] input').inputValue()).toBe('00:00:10');
    await expect.poll(() => page.locator('[data-testid="timeline-start-time"]').innerText()).toContain('00:00:10');

    await page.mouse.move(box.x + 5 * zoom, startBox.y + startBox.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await expect.poll(() => page.locator('[data-testid="timeline-current-time"]').innerText()).toContain('00:00:05');
  });

  it('cuts the clip and shows a success toast', async () => {
    const { page } = session;
    await selectVideo(page);
    await setOutput(page);
    await page.locator('[data-testid="video-cut-cut"]').click();
    await expect.poll(() => page.locator('[role="alert"]').filter({ hasText: 'Video cut successfully' }).count()).toBeGreaterThan(0);
  });

  it('shows live progress and cancels the running cut via the confirm dialog', async () => {
    const { page } = session;
    await mockApi.setConvertBehavior(page, 'hold');
    await selectVideo(page);
    await setOutput(page);

    await page.locator('[data-testid="video-cut-cut"]').click();
    await expect.poll(() => page.locator('[data-testid="video-cut-pause"]').count()).toBe(1);
    await expect.poll(() => page.locator('[data-testid="video-cut-cut"]').isDisabled()).toBe(true);

    await emitConversionProgress(page, INPUT, OUTPUT, { percent: 37.5 });
    await expect.poll(() => page.locator('body').innerText()).toContain('37.5%');

    await page.locator('[data-testid="video-cut-cancel"]').click();
    await page.locator('[data-testid="confirm-dialog"]').waitFor({ timeout: 10000 });
    await page.locator('[data-testid="confirm-confirm"]').click();

    await expect.poll(() => page.locator('[data-testid="file-drop-zone"]').count()).toBe(1);
    await expect.poll(() => page.locator('[data-testid="video-cut-output"] input').inputValue()).toBe('');
  });

  it('clears the form from the cancel-job confirm dialog', async () => {
    const { page } = session;
    await selectVideo(page);
    await setOutput(page);
    await page.locator('[data-testid="video-cut-cancel-job"]').click();
    await page.locator('[data-testid="confirm-dialog"]').waitFor({ timeout: 10000 });
    await page.locator('[data-testid="confirm-confirm"]').click();

    await expect.poll(() => page.locator('[data-testid="file-drop-zone"]').count()).toBe(1);
    await expect.poll(() => page.locator('[data-testid="video-cut-output"] input').inputValue()).toBe('');
  });
});
