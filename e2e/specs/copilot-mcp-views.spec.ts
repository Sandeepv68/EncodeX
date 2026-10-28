/**
 * @fileoverview Drives the MCP App views rendered inside the Copilot.
 *
 * The Copilot renders the same React components an external MCP Apps host
 * renders. This spec plans a goal whose plan carries a view, checks that the
 * view really mounts in the transcript, and checks that the view can call a
 * tool back - the cancel button of the queue view must reach the MCP server
 * through the in-app host.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Page } from 'playwright';
import { launchApp, closeApp, ensureLiveSession, reloadSession, type AppSession } from '../fixtures/app';
import { mockApi } from '../mocks/control';
import type { CopilotPlan } from '../../src/shared/copilot';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

/** A plan that carries the queue view, the way a queue-backed operation does. */
const PLAN: CopilotPlan = {
  goal: 'shrink these for the web',
  operation: 'convert',
  actions: [
    {
      id: 'convert_0',
      operation: 'convert',
      input: 'C:/media/one.mp4',
      output: 'C:/media/one_web.mp4',
      confidence: 0.8,
      rationale: ['Re-encodes to a web-friendly size.'],
      estimatedSizeBytes: 500_000,
      estimatedSavings: 0.5,
      options: { videoCodec: 'libx264', videoBitrate: '1000k' },
    },
  ],
  results: [],
  skips: [],
  rationale: ['Planned 1 conversion(s).'],
  notes: [],
  plan: { valid: true, order: ['convert_0'], steps: [], issues: [], summary: '1 step' },
  providerId: 'rules',
  isEstimated: true,
  views: [
    {
      viewId: 'queue',
      uri: 'ui://encodex/queue',
      toolName: 'list_jobs',
      structuredContent: {
        jobs: [{ id: 'job-1', input: 'C:/media/one.mp4', output: 'C:/media/one_web.mp4', status: 'running', progress: 25 }],
        count: 1,
        generatedAt: 0,
      },
    },
  ],
};

const FOLDER_FILES = ['C:/media/one.mp4'];

/**
 * Navigates to `/copilot` through the drawer and waits for the route to mount.
 * @param {Page} page - The page under test.
 * @returns {Promise<void>} Resolves once the transcript is visible.
 */
async function gotoCopilot(page: Page): Promise<void> {
  await page.locator('[data-testid="nav-item-copilot"]').waitFor({ timeout: 15000 });
  await page.locator('[data-testid="nav-item-copilot"]').click();
  await page.waitForFunction(() => location.hash.startsWith('#/copilot'));
  await page.locator('[data-testid="copilot-conversation"]').waitFor({ timeout: 15000 });
}

/**
 * Picks the folder, types a goal and sends it.
 * @param {Page} page - The page under test.
 * @returns {Promise<void>} Resolves once the plan was requested.
 */
async function planGoal(page: Page): Promise<void> {
  await mockApi.setSelectFolderFiles(page, FOLDER_FILES);
  await page.locator('[data-testid="copilot-choose-folder"]').click();
  await expect.poll(() => page.locator('[data-testid="copilot-choose-folder"]').isDisabled()).toBe(false);
  await page.locator('[contenteditable="true"]').click();
  await page.keyboard.type('shrink these for the web');
  await page.keyboard.press('Enter');
}

describe.runIf(IS_E2E)('Copilot MCP App views', () => {
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
    await gotoCopilot(page);
  }, 30000);

  it('renders the view the plan carries inside the transcript', async () => {
    const { page } = session;
    await mockApi.setCopilotPlan(page, PLAN);
    await planGoal(page);

    await page.locator('[data-testid="copilot-mcp-views"]').waitFor({ timeout: 15000 });
    await expect.poll(() => page.locator('[data-testid="mcp-view-queue"]').innerText()).toContain('one_web.mp4');
  });

  it('lets the view call a tool back through the in-app host', async () => {
    const { page } = session;
    await mockApi.setCopilotPlan(page, PLAN);
    await planGoal(page);
    await page.locator('[data-testid="mcp-view-queue-cancel-job-1"]').waitFor({ timeout: 15000 });

    // The first click only arms the button; the second one issues the call.
    await page.locator('[data-testid="mcp-view-queue-cancel-job-1"]').click();
    await expect.poll(() => mockApi.get(page).then((s) => s.mcpUiToolCalls.length)).toBe(0);
    await page.locator('[data-testid="mcp-view-queue-cancel-job-1"]').click();
    await expect.poll(() => mockApi.get(page).then((s) => s.mcpUiToolCalls.length)).toBeGreaterThan(0);
    const calls = await mockApi.get(page).then((s) => s.mcpUiToolCalls);
    expect(calls.some((call) => call.name === 'cancel_job')).toBe(true);
  });
});
