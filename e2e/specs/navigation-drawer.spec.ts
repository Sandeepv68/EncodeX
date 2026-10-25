/**
 * @fileoverview Navigation drawer E2E suite (Tier A, mock preload).
 *
 * The drawer is the only way to reach most tools, so this suite covers its
 * behaviour under the states users hit in practice:
 *  - every route is listed and the current route is marked selected,
 *  - the condense toggle switches between labelled and icon-only rows,
 *  - the Batch Queue count badge tracks outstanding jobs and clears when the
 *    batch drains,
 *  - the Convert activity blip appears while a conversion runs on any page and
 *    clears when it finishes.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Page } from 'playwright';
import { launchApp, closeApp, ensureLiveSession, reloadSession, AppSession } from '../fixtures/app';
import { mockApi, emitQueueStatusChange } from '../mocks/control';
import type { QueueJob } from '../../src/shared/types';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

const INPUT = '/media/video.mp4';
const OUTPUT = '/media/video_encodex_converted.mp4';

/** Every drawer row, keyed by its `data-testid` suffix and English label. */
const NAV_ROWS: { id: string; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'copilot', label: 'Copilot' },
  { id: 'convert', label: 'Convert' },
  { id: 'remux', label: 'Remux' },
  { id: 'demux', label: 'Demux' },
  { id: 'video-cut', label: 'Cut' },
  { id: 'audio-extract', label: 'Audio' },
  { id: 'image-compress', label: 'Image' },
  { id: 'batch', label: 'Batch Queue' },
  { id: 'media-info', label: 'Media Info' },
  { id: 'settings', label: 'Settings' },
  { id: 'about', label: 'About' },
  { id: 'logs', label: 'Logs' },
];

function navRow(page: Page, id: string) {
  return page.locator(`[data-testid="nav-item-${id}"]`);
}

async function clickRow(page: Page, id: string): Promise<void> {
  await navRow(page, id).waitFor({ timeout: 15000 });
  await navRow(page, id).click();
}

/**
 * The drawer is condensed (icon-only) by default and the choice persists. Labels
 * are only in the DOM when expanded, so tests that read labels expand it first.
 * @param {Page} page - The main window.
 */
async function ensureDrawerExpanded(page: Page): Promise<void> {
  await navRow(page, 'convert').waitFor({ timeout: 15000 });
  if (!(await navRow(page, 'convert').textContent())?.includes('Convert')) {
    await page.locator('[data-testid="drawer-condense-button"]').click();
  }
  await expect.poll(() => navRow(page, 'convert').textContent()).toContain('Convert');
}

/**
 * Opens the Batch Queue and waits for its empty state, which means the page has
 * mounted and subscribed to queue events. Events emitted before that are lost.
 * @param {Page} page - The main window.
 */
async function openBatchAndWait(page: Page): Promise<void> {
  await clickRow(page, 'batch');
  await page.getByText('Queue is empty. Add files to begin batch processing.').waitFor({ timeout: 15000 });
}

function makeJob(overrides: Partial<QueueJob>): QueueJob {
  return {
    id: 'job-1',
    input: '/media/clip_a.mp4',
    output: '/media/clip_a_converted.mp4',
    options: { videoCodec: 'libx264', audioCodec: 'aac', hardwareAcceleration: false, hwaccelMode: 'auto' },
    transcoder: 'FFMPEG',
    status: 'queued',
    progress: 0,
    createdAt: Date.now(),
    ...overrides,
  } as QueueJob;
}

/** Runs a convert from the Convert page so the drawer blip has a live job to show. */
async function startConversionOnConvertPage(page: Page): Promise<void> {
  await clickRow(page, 'convert');
  await page.waitForFunction(() => location.hash.startsWith('#/convert'));
  await mockApi.setSelectFile(page, INPUT);
  await page.locator('[data-testid="file-drop-zone"]').click();
  await expect.poll(() => page.locator('[data-testid="convert-output"] input').inputValue()).toBe(OUTPUT);
  await page.locator('[data-testid="convert-start"]').click();
  await expect.poll(() => page.locator('[data-testid="convert-pause"]').count()).toBe(1);
}

describe.runIf(IS_E2E)('Navigation drawer', () => {
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
    await clickRow(session.page, 'dashboard');
    await ensureDrawerExpanded(session.page);
  }, 30000);

  it('lists every route in the drawer with its label', async () => {
    const { page } = session;
    for (const row of NAV_ROWS) {
      await expect.poll(() => navRow(page, row.id).count()).toBe(1);
      await expect.poll(() => navRow(page, row.id).textContent()).toContain(row.label);
    }
  });

  it('marks the row for the current route as selected', async () => {
    const { page } = session;
    await clickRow(page, 'copilot');
    await page.waitForFunction(() => location.hash.startsWith('#/copilot'));
    await expect.poll(() => navRow(page, 'copilot').getAttribute('class')).toContain('Mui-selected');
    await expect.poll(() => navRow(page, 'dashboard').getAttribute('class')).not.toContain('Mui-selected');
  });

  it('hides row labels when condensed and restores them when expanded', async () => {
    const { page } = session;
    await page.locator('[data-testid="drawer-condense-button"]').click();
    await expect.poll(() => navRow(page, 'convert').textContent()).not.toContain('Convert');

    await page.locator('[data-testid="drawer-condense-button"]').click();
    await expect.poll(() => navRow(page, 'convert').textContent()).toContain('Convert');
  });

  it('shows a Batch Queue count badge while jobs are outstanding', async () => {
    const { page } = session;
    // The queue subscriptions are mounted by the Batch Queue page, so the job is
    // added while that page is open, as it is for real users.
    await openBatchAndWait(page);
    await mockApi.emit(page, 'queue-added', makeJob({ id: 'job-1' }));
    await expect.poll(() => page.locator('[data-testid="nav-batch-blip"]').count()).toBe(1);
    await expect.poll(() => page.locator('[data-testid="nav-batch-blip"]').textContent()).toBe('1');
  });

  it('clears the Batch Queue badge when a job finishes while another page is open', async () => {
    const { page } = session;
    await openBatchAndWait(page);
    await mockApi.emit(page, 'queue-added', makeJob({ id: 'job-1' }));
    await expect.poll(() => page.locator('[data-testid="nav-batch-blip"]').count()).toBe(1);

    await clickRow(page, 'dashboard');
    await emitQueueStatusChange(page, makeJob({ id: 'job-1', status: 'done', progress: 100 }));
    await expect.poll(() => page.locator('[data-testid="nav-batch-blip"]').count(), { timeout: 3000 }).toBe(0);
  });

  it('keeps the Convert activity blip visible on other pages until the conversion finishes', async () => {
    const { page } = session;
    await mockApi.setConvertBehavior(page, 'hold');
    await startConversionOnConvertPage(page);

    await clickRow(page, 'dashboard');
    await expect.poll(() => page.locator('[data-testid="nav-convert-blip"]').count()).toBe(1);

    await mockApi.resolveConvert(page);
    await expect.poll(() => page.locator('[data-testid="nav-convert-blip"]').count()).toBe(0);
  });
});
