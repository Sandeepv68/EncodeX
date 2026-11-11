/**
 * @fileoverview End-to-end coverage of the dedicated remux/demux mux queue.
 *
 * The suite drives the flow a user actually takes: configure a remux on the
 * Remux page, press **Add to Queue**, and watch the job appear in the Mux
 * Queue tab of the Batch Queue page. It also checks the deep link
 * (`/batch?tab=mux`), the queue's controls, and the status indicator the
 * operation pages show.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Page } from 'playwright';
import type { MediaInfo, MuxQueueJob } from '../../src/shared/types';
import { launchApp, closeApp, ensureLiveSession, reloadSession, AppSession } from '../fixtures/app';
import { mockApi } from '../mocks/control';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

const INPUT = '/media/video.mp4';

const VIDEO_INFO: MediaInfo = {
  file: INPUT,
  format: 'matroska',
  size: 4194304,
  duration: 30,
  bitrate: '2000k',
  streams: [
    { index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080, bitrate: '1800k' },
    { index: 1, type: 'audio', codec: 'aac', channels: 2, sampleRate: 48000, bitrate: '192k', language: 'eng' },
  ],
};

async function gotoPage(page: Page, route: 'remux' | 'demux' | 'batch'): Promise<void> {
  await page.locator(`[data-testid="nav-item-${route}"]`).click();
  await page.waitForFunction((r) => location.hash.startsWith(`#/${r}`), route);
}

async function selectSource(page: Page): Promise<void> {
  await mockApi.setSelectFile(page, INPUT);
  await mockApi.setMediaInfo(page, VIDEO_INFO);
  await page.locator('[data-testid="file-drop-zone"]').click();
  await expect.poll(() => page.locator('[data-testid="selected-video"]').textContent()).toContain('video.mp4');
}

describe.runIf(IS_E2E)('Mux queue', () => {
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
  }, 30000);

  it('shows the mux queue tab on the batch queue page with an empty state', async () => {
    const { page } = session;
    await gotoPage(page, 'batch');
    await page.locator('[data-testid="batch-queue-tab-mux"]').waitFor({ timeout: 15000 });
    await page.locator('[data-testid="batch-queue-tab-mux"]').click();
    await expect.poll(() => page.locator('[data-testid="mux-queue-empty"]').count()).toBe(1);
  });

  it('opens the mux tab from the ?tab=mux deep link', async () => {
    const { page } = session;
    await page.evaluate(() => {
      location.hash = '#/batch?tab=mux';
    });
    await page.waitForFunction(() => location.hash.includes('tab=mux'));
    await expect.poll(() => page.locator('[data-testid="batch-queue-tab-mux"]').getAttribute('aria-selected')).toBe('true');
  });

  it('enqueues a remux from the remux page and shows it in the mux tab', async () => {
    const { page } = session;
    await gotoPage(page, 'remux');
    await selectSource(page);

    await page.locator('[data-testid="remux-add-to-queue"]').click();
    await expect.poll(() => page.locator('[role="alert"]').filter({ hasText: 'Remux added to the mux queue' }).count()).toBeGreaterThan(0);

    await gotoPage(page, 'batch');
    await page.locator('[data-testid="batch-queue-tab-mux"]').click();
    await expect.poll(() => page.locator('[data-testid^="mux-queue-job-card-"]').count()).toBe(1);
    await expect.poll(() => page.getByText('video.mp4').count()).toBeGreaterThan(0);
  });

  it('enqueues a demux with one target per selected stream', async () => {
    const { page } = session;
    await gotoPage(page, 'demux');
    await selectSource(page);

    await page.locator('[data-testid="demux-add-to-queue"]').click();
    await expect
      .poll(() => page.locator('[role="alert"]').filter({ hasText: 'Streams added to the mux queue' }).count())
      .toBeGreaterThan(0);

    await gotoPage(page, 'batch');
    await page.locator('[data-testid="batch-queue-tab-mux"]').click();
    await expect.poll(() => page.locator('[data-testid^="mux-queue-job-card-"]').count()).toBe(1);
    await expect.poll(() => page.getByText('Demux').count()).toBeGreaterThan(0);
  });

  it('shows the queue status on the remux page and links to the queue', async () => {
    const { page } = session;
    await gotoPage(page, 'remux');
    await page.locator('[data-testid="mux-queue-status"]').waitFor({ timeout: 15000 });
    await expect.poll(() => page.getByRole('button', { name: 'View queue' }).count()).toBeGreaterThan(0);
  });

  it('drives the mux queue from its tab', async () => {
    const { page } = session;
    await gotoPage(page, 'batch');
    await page.locator('[data-testid="batch-queue-tab-mux"]').click();
    await page.locator('[data-testid="mux-queue-stats"]').waitFor({ timeout: 15000 });
    await expect.poll(() => page.getByRole('button', { name: 'Start' }).count()).toBeGreaterThan(0);
    await expect.poll(() => page.getByRole('button', { name: 'Cancel all' }).count()).toBeGreaterThan(0);
  });

  it('shows progress for a running mux job and pauses, resumes, and cancels it', async () => {
    const { page } = session;
    const job: MuxQueueJob = {
      id: 'mux-e2e-1',
      kind: 'remux',
      input: '/media/video.mp4',
      output: '/media/video.mkv',
      targets: [{ output: '/media/video.mkv', options: {} }],
      transcoder: 'FFMPEG',
      status: 'running',
      progress: 40,
      createdAt: 1,
    };
    await mockApi.emit(page, 'mux-queue-added', job);

    await gotoPage(page, 'batch');
    await page.locator('[data-testid="batch-queue-tab-mux"]').click();
    await expect.poll(() => page.locator('[data-testid="mux-queue-job-card-mux-e2e-1"]').count()).toBe(1);

    // A running job pauses the queue instead of offering Start.
    await expect.poll(() => page.getByRole('button', { name: 'Pause' }).count()).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Pause' }).click();

    // A paused queue offers Resume.
    await expect.poll(() => page.getByRole('button', { name: 'Resume' }).count()).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Resume' }).click();

    // Progress pushed from the main process reaches the card.
    await mockApi.emit(page, 'mux-queue-progress', {
      job: { ...job, progress: 75 },
      progress: { percent: 75, time: '00:00:10', fps: 30, speed: '2.0x', eta: '00:00:05', bitrate: '1500k' },
    });
    await expect.poll(() => page.getByText('75.0%').count()).toBeGreaterThan(0);

    // Cancel all clears the queue.
    await page.getByRole('button', { name: 'Cancel all' }).click();
    await expect.poll(() => page.locator('[data-testid="mux-queue-job-card-mux-e2e-1"]').count()).toBe(0);
    await expect.poll(() => page.locator('[data-testid="mux-queue-empty"]').count()).toBe(1);
  });

  it('removes a single mux job', async () => {
    const { page } = session;
    const job: MuxQueueJob = {
      id: 'mux-e2e-2',
      kind: 'demux',
      input: '/media/video.mp4',
      output: '/media/streams',
      targets: [{ output: '/media/streams/video.video.mp4', options: {} }],
      transcoder: 'FFMPEG',
      status: 'queued',
      progress: 0,
      createdAt: 1,
    };
    await mockApi.emit(page, 'mux-queue-added', job);

    await gotoPage(page, 'batch');
    await page.locator('[data-testid="batch-queue-tab-mux"]').click();
    await expect.poll(() => page.locator('[data-testid="mux-queue-job-card-mux-e2e-2"]').count()).toBe(1);
    await page.getByRole('button', { name: 'Remove' }).click();
    await expect.poll(() => page.locator('[data-testid="mux-queue-job-card-mux-e2e-2"]').count()).toBe(0);
  });
});
