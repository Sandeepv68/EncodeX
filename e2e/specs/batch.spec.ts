import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { QueueJob } from '../../src/shared/types';
import { launchApp, closeApp, AppSession } from '../fixtures/app';
import { mockApi, emitQueueStatusChange, emitQueueProgress } from '../mocks/control';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

function makeJob(overrides: Partial<QueueJob>): QueueJob {
  return {
    id: 'job-1',
    input: '/media/clip_a.mp4',
    output: '/media/clip_a_converted.mp4',
    options: { videoCodec: 'libx264', audioCodec: 'aac', hardwareAcceleration: false, hwaccelMode: 'none' },
    transcoder: 'FFMPEG',
    status: 'queued',
    progress: 0,
    createdAt: Date.now(),
    ...overrides,
  };
}

async function gotoBatch(page: import('playwright').Page): Promise<void> {
  await page.locator('[data-testid="nav-item-batch"]').waitFor({ timeout: 15000 });
  await page.locator('[data-testid="nav-item-batch"]').click();
  await page.waitForFunction(() => location.hash.startsWith('#/batch'));
}

async function seedJobs(page: import('playwright').Page, jobs: QueueJob[]): Promise<void> {
  for (const job of jobs) {
    await mockApi.emit(page, 'queue-added', job);
  }
}

describe.runIf(IS_E2E)('Batch Queue page', () => {
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
    await gotoBatch(page);
    await page.getByText('Queue is empty. Add files to begin batch processing.').waitFor({ timeout: 15000 });
  }, 30000);

  it('shows the empty state with no job cards', async () => {
    await expect.poll(() => session.page.getByRole('button', { name: 'Remove' }).count()).toBe(0);
  });

  it('adds files through the review dialog and shows an enqueued toast', async () => {
    const { page } = session;
    await mockApi.setSelectFiles(page, ['/media/clip_a.mp4', '/media/clip_b.mp4']);
    await page.getByRole('button', { name: 'Add Files' }).click();
    await page.getByRole('button', { name: 'Add 2 files' }).waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: 'Add 2 files' }).click();

    await expect.poll(() => page.getByRole('button', { name: 'Remove' }).count()).toBe(2);
    await expect.poll(() => page.getByText('clip_a.mp4').count()).toBeGreaterThan(0);
    await expect.poll(() => page.getByText('clip_b.mp4').count()).toBeGreaterThan(0);
    await expect
      .poll(() => page.locator('[role="alert"]').filter({ hasText: 'Added 2 file(s) to the queue' }).count())
      .toBeGreaterThan(0);
  });

  it('renders jobs pushed through queue-added events', async () => {
    const { page } = session;
    await seedJobs(page, [makeJob({}), makeJob({ id: 'job-2', input: '/media/clip_c.mkv', output: '/media/clip_c_converted.mkv' })]);
    await expect.poll(() => page.getByRole('button', { name: 'Remove' }).count()).toBe(2);
    await expect.poll(() => page.getByText('clip_c.mkv').count()).toBeGreaterThan(0);
  });

  it('shows live progress and a batch-finished toast when a job completes', async () => {
    const { page } = session;
    await seedJobs(page, [makeJob({})]);

    const running = { ...makeJob({ status: 'running', progress: 42.5 }) };
    await emitQueueStatusChange(page, running);
    await emitQueueProgress(page, running, { percent: 42.5 });
    await expect.poll(() => page.locator('body').innerText()).toContain('42.5%');

    await emitQueueStatusChange(page, { ...makeJob({ status: 'done', progress: 100 }) });
    await expect
      .poll(() => page.locator('[role="alert"]').filter({ hasText: 'Batch finished: 1 succeeded, 0 failed' }).count())
      .toBeGreaterThan(0);
  });

  it('cancels all jobs from the confirm dialog and returns to the empty state', async () => {
    const { page } = session;
    await seedJobs(page, [makeJob({})]);
    await expect.poll(() => page.getByRole('button', { name: 'Remove' }).count()).toBe(1);

    await page.getByRole('button', { name: 'Cancel All' }).click();
    await page.locator('[data-testid="confirm-dialog"]').waitFor({ timeout: 10000 });
    await page.locator('[data-testid="confirm-confirm"]').click();

    await expect.poll(() => page.getByRole('button', { name: 'Remove' }).count()).toBe(0);
    await expect
      .poll(() => page.locator('[role="alert"]').filter({ hasText: 'All jobs cancelled' }).count())
      .toBeGreaterThan(0);
  });

  it('filters the job list by status', async () => {
    const { page } = session;
    await seedJobs(page, [
      makeJob({}),
      makeJob({ id: 'job-2', input: '/media/clip_d.mp4', output: '/media/clip_d_converted.mp4', status: 'done', progress: 100 }),
    ]);
    await expect.poll(() => page.getByRole('button', { name: 'Remove' }).count()).toBe(2);

    await page.getByText('Done (1)').click();
    await expect.poll(() => page.getByRole('button', { name: 'Remove' }).count()).toBe(1);
    await expect.poll(() => page.getByText('clip_a.mp4').count()).toBe(0);
    await expect.poll(() => page.getByText('clip_d.mp4').count()).toBeGreaterThan(0);
  });

  it('removes a single job with the Remove button', async () => {
    const { page } = session;
    await seedJobs(page, [
      makeJob({}),
      makeJob({ id: 'job-2', input: '/media/clip_b.mp4', output: '/media/clip_b_converted.mp4' }),
    ]);
    await expect.poll(() => page.getByRole('button', { name: 'Remove' }).count()).toBe(2);

    await page.getByRole('button', { name: 'Remove' }).first().click();
    await expect.poll(() => page.getByRole('button', { name: 'Remove' }).count()).toBe(1);
    await expect.poll(() => page.getByText('clip_a.mp4').count()).toBe(0);
    await expect.poll(() => page.getByText('clip_b.mp4').count()).toBeGreaterThan(0);
  });

  it('reorders queued jobs with the drag handle', async () => {
    const { page } = session;
    await seedJobs(page, [
      makeJob({ id: 'job-a', input: '/media/clip_a.mp4' }),
      makeJob({ id: 'job-b', input: '/media/clip_b.mp4' }),
    ]);
    await expect.poll(() => page.getByRole('button', { name: 'Drag to reorder' }).count()).toBe(2);

    const handle = page.getByRole('button', { name: 'Drag to reorder' }).first();
    await handle.focus();
    await page.keyboard.press('Space');

    // dnd-kit's keyboard sensor attaches its document keydown listener on a
    // timer once the drag starts, so an ArrowDown dispatched immediately can be
    // dropped on slow runners. Wait for the drag to activate, then re-press
    // ArrowDown until the sibling card actually shifts up (proof the move
    // registered) before dropping.
    await expect.poll(() => handle.getAttribute('aria-pressed'), { timeout: 10000 }).toBe('true');
    const bBefore = (await page.getByText('clip_b.mp4').boundingBox())?.y ?? 0;
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      await page.keyboard.press('ArrowDown');
      // dnd-kit animates the sibling card into its new slot over a 250ms
      // transform transition, and its drop-sensor `over` state only becomes
      // stable once that animation has finished. Dropping mid-animation can
      // read a stale `over` and silently no-op the reorder, so let the move
      // fully settle before confirming it registered.
      await page.waitForTimeout(350);
      const b = await page.getByText('clip_b.mp4').boundingBox();
      if (b && b.y < bBefore - 10) break;
    }
    await page.keyboard.press('Space');

    await expect
      .poll(async () => {
        const a = await page.getByText('clip_a.mp4').boundingBox();
        const b = await page.getByText('clip_b.mp4').boundingBox();
        return (a?.y ?? 0) > (b?.y ?? 0);
      })
      .toBe(true);
  });

  it('cancels or confirms the window close while jobs are queued', async () => {
    const { page } = session;
    await seedJobs(page, [makeJob({})]);
    await expect.poll(() => page.getByRole('button', { name: 'Remove' }).count()).toBe(1);

    await mockApi.emit(page, 'window-close-requested', {});
    await page.locator('[data-testid="confirm-dialog"]').waitFor({ timeout: 10000 });
    await page.locator('[data-testid="confirm-cancel"]').click();
    await expect.poll(() => page.locator('[data-testid="confirm-dialog"]').count()).toBe(0);
    await expect.poll(() => mockApi.get(page).then((s) => s.windowCalls)).not.toContain('close-confirmed');
    await expect.poll(() => page.getByRole('button', { name: 'Remove' }).count()).toBe(1);

    await mockApi.emit(page, 'window-close-requested', {});
    await page.locator('[data-testid="confirm-dialog"]').waitFor({ timeout: 10000 });
    await page.locator('[data-testid="confirm-confirm"]').click();
    await expect.poll(() => mockApi.get(page).then((s) => s.windowCalls)).toContain('close-confirmed');
  });

  it('confirms the window close immediately when no work is pending', async () => {
    const { page } = session;
    await mockApi.emit(page, 'window-close-requested', {});
    await expect.poll(() => page.locator('[data-testid="confirm-dialog"]').count()).toBe(0);
    await expect.poll(() => mockApi.get(page).then((s) => s.windowCalls)).toContain('close-confirmed');
  });
});
