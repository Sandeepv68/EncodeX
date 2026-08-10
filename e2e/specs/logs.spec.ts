import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { launchApp, closeApp, AppSession } from '../fixtures/app';
import { mockApi, emitLogMessage } from '../mocks/control';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

async function gotoLogs(page: import('playwright').Page): Promise<void> {
  await page.locator('[data-testid="nav-item-logs"]').waitFor({ timeout: 15000 });
  await page.locator('[data-testid="nav-item-logs"]').click();
  await page.waitForFunction(() => location.hash.startsWith('#/logs'));
}

describe.runIf(IS_E2E)('Logs page', () => {
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
    await gotoLogs(page);
    await page.locator('[data-testid="logs-filter"] [role="combobox"]').waitFor({ timeout: 15000 });
  }, 30000);

  it('shows emitted log entries alongside the renderer startup entries', async () => {
    const { page } = session;
    await emitLogMessage(page, { text: 'hello from main', level: 'INFO', source: 'main' });
    await emitLogMessage(page, { text: 'conversion started', level: 'INFO', source: 'renderer' });

    await expect.poll(() => page.getByText('hello from main').count()).toBeGreaterThan(0);
    await expect.poll(() => page.getByText('conversion started').count()).toBeGreaterThan(0);
    await expect.poll(() => page.getByText('[INFO]').count()).toBeGreaterThan(0);
    await expect.poll(() => page.getByText('[main]').count()).toBeGreaterThan(0);
  });

  it('filters entries by log level', async () => {
    const { page } = session;
    await emitLogMessage(page, { text: 'info message', level: 'INFO' });
    await emitLogMessage(page, { text: 'warning message', level: 'WARN' });
    await emitLogMessage(page, { text: 'error message', level: 'ERROR' });

    await page.locator('[data-testid="logs-filter"] [role="combobox"]').waitFor({ timeout: 10000 });
    await page.locator('[data-testid="logs-filter"] [role="combobox"]').click();
    const option = page.getByRole('option', { name: 'ERROR' });
    await option.waitFor({ timeout: 5000 });
    await option.click();

    await expect.poll(() => page.getByText('error message').count()).toBeGreaterThan(0);
    await expect.poll(() => page.getByText('info message').count()).toBe(0);
    await expect.poll(() => page.getByText('warning message').count()).toBe(0);
  });

  it('clears all entries', async () => {
    const { page } = session;
    await emitLogMessage(page, { text: 'temporary entry' });
    await expect.poll(() => page.getByText('temporary entry').count()).toBeGreaterThan(0);

    await page.locator('[data-testid="logs-clear"]').click();
    await expect.poll(() => page.getByText('No log entries yet.').count()).toBeGreaterThan(0);
    await expect.poll(() => page.getByText('temporary entry').count()).toBe(0);
  });

  it('downloads the log file and shows a success toast', async () => {
    const { page } = session;
    await emitLogMessage(page, { text: 'export me' });
    await expect.poll(() => page.getByText('export me').count()).toBeGreaterThan(0);

    await page.locator('[data-testid="logs-download"]').click();
    await expect
      .poll(() => page.locator('[role="alert"]').filter({ hasText: 'Logs downloaded' }).count())
      .toBeGreaterThan(0);
  });
});
