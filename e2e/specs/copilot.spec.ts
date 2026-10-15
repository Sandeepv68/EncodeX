/**
 * @fileoverview Stage 4a - Copilot E2E suite (Tier A, mock preload).
 *
 * Drives the `/copilot` page end to end against the mock bridge: choosing a
 * folder, planning a goal, rendering the returned summary (actions, skips,
 * routed operation), and committing the plan to the Batch Queue. It also walks
 * the degradation paths the page owns - an empty goal, no inputs, a rejecting
 * `copilotPlan`, and a malformed payload - each of which must surface as an
 * inline error rather than a page error (the launch tripwire fails the suite on
 * any unhandled exception, so "no pageerror" is asserted by the harness).
 *
 * The final cell scans the page with the full axe rule set, empty and populated,
 * because the unit tier cannot run `color-contrast`.
 *
 * @see plans/COPILOT_AI_PROVIDER_TEST_PLAN.md, Stage 4a
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Page } from 'playwright';
import { launchApp, closeApp, ensureLiveSession, reloadSession, AppSession } from '../fixtures/app';
import { mockApi } from '../mocks/control';
import { runAxeOnPage, type AxePageResult } from '../fixtures/axe-browser';
import type { CopilotPlan } from '../../src/shared/copilot';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

/** The transient MUI tooltip popper carried over from the nav click that left focus behind. */
const ALLOWED_ARTIFACTS = new Set(['.MuiTooltip-popper']);

/**
 * axe context for the conversation scan. Scoped to the transcript rather than
 * the whole document: the plan's Stage 4a cell is about the conversation (empty
 * and populated), and the composer/document-level rules are not part of it.
 */
const CONVERSATION_CONTEXT = '[data-testid="copilot-conversation"]';

/**
 * A two-action, one-skip plan shaped like the real planner output. `plan` is a
 * minimal-but-valid `WorkflowPlan`; the page only requires `actions` and `skips`
 * to be arrays to accept the payload.
 */
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
    {
      id: 'convert_1',
      operation: 'convert',
      input: 'C:/media/two.mkv',
      output: 'C:/media/two_web.mkv',
      confidence: 0.7,
      rationale: ['Re-encodes to a web-friendly size.'],
      estimatedSizeBytes: 1_000_000,
      estimatedSavings: 0.6,
      options: { videoCodec: 'libx265' },
    },
  ],
  results: [],
  skips: [{ input: 'C:/media/broken.mov', reason: 'read failed' }],
  rationale: ['Planned 2 conversion(s) toward "shrink these for the web".'],
  notes: [],
  plan: { valid: true, order: ['convert_0', 'convert_1'], steps: [], issues: [], summary: '2 steps' },
  providerId: 'rules',
  isEstimated: true,
};

const FOLDER_FILES = ['C:/media/one.mp4', 'C:/media/two.mkv'];

/** Navigates to `/copilot` through the drawer and waits for the route to mount. */
async function gotoCopilot(page: Page): Promise<void> {
  await page.locator('[data-testid="nav-item-copilot"]').waitFor({ timeout: 15000 });
  await page.locator('[data-testid="nav-item-copilot"]').click();
  await page.waitForFunction(() => location.hash.startsWith('#/copilot'));
}

/** Focuses the Lexical editor and types a goal into it. */
async function typeGoal(page: Page, goal: string): Promise<void> {
  const editor = page.locator('[contenteditable="true"]');
  await editor.click();
  await page.keyboard.type(goal);
}

/** Picks a folder by seeding the dialog result, then clicking "Choose folder". */
async function chooseFolder(page: Page, files: string[]): Promise<void> {
  await mockApi.setSelectFolderFiles(page, files);
  await page.locator('[data-testid="copilot-choose-folder"]').click();
  await expect.poll(() => page.locator('[data-testid="copilot-choose-folder"]').isDisabled()).toBe(false);
}

/**
 * Asserts zero axe violations, ignoring the transient tooltip popper's `region`
 * nodes (the same carve-out the committed a11y matrix uses).
 * @param {AxePageResult} result - The page run to check.
 * @param {string} label - Human-readable cell label for failure messages.
 */
function assertAxeClean(result: AxePageResult, label: string): void {
  const realViolations = result.violations
    .map((v) => ({
      ...v,
      nodes: v.nodes.filter((n) => !(v.id === 'region' && n.target.some((t) => [...ALLOWED_ARTIFACTS].some((sel) => t.includes(sel))))),
    }))
    .filter((v) => v.nodes.length > 0);
  expect(realViolations, `${label} must have zero axe violations`).toEqual([]);
}

describe.runIf(IS_E2E)('Copilot page', () => {
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
    await page.locator('[data-testid="copilot-conversation"]').waitFor({ timeout: 15000 });
  }, 30000);

  it('shows the empty-state welcome and an inert composer', async () => {
    const { page } = session;
    await expect.poll(() => page.locator('[data-testid="copilot-plan"]').isDisabled()).toBe(true);
    await expect.poll(() => page.locator('[data-testid="copilot-send"]').isDisabled()).toBe(true);
    await expect.poll(() => page.locator('[data-testid="copilot-conversation"]').innerText()).toContain('How can I help?');
  });

  it('reports an inline error when planning with an empty goal', async () => {
    const { page } = session;
    const editor = page.locator('[contenteditable="true"]');
    await editor.click();
    await page.keyboard.press('Enter');
    await page.locator('[data-testid="copilot-error"]').waitFor({ timeout: 5000 });
    await expect.poll(() => page.locator('[data-testid="copilot-error"]').innerText()).toContain('Enter a goal');
  });

  it('reports an inline error when a goal has no inputs', async () => {
    const { page } = session;
    await typeGoal(page, 'shrink these');
    await page.keyboard.press('Enter');
    await page.locator('[data-testid="copilot-error"]').waitFor({ timeout: 5000 });
    await expect.poll(() => page.locator('[data-testid="copilot-error"]').innerText()).toContain('Choose a folder');
  });

  it('plans a goal and enqueues the plan through the Batch Queue', async () => {
    const { page } = session;
    await chooseFolder(page, FOLDER_FILES);
    await mockApi.setCopilotPlan(page, PLAN);
    await typeGoal(page, PLAN.goal);
    await page.locator('[data-testid="copilot-plan"]').click();

    await page.locator('[data-testid="copilot-plan-summary"]').waitFor({ timeout: 15000 });
    await expect.poll(() => page.locator('[data-testid="copilot-action-convert_0"]').count()).toBe(1);
    await expect.poll(() => page.locator('[data-testid="copilot-action-convert_1"]').count()).toBe(1);
    await expect.poll(() => page.locator('[data-testid="copilot-skip"]').count()).toBe(1);
    await expect.poll(() => page.locator('[data-testid="copilot-routed-as"]').innerText()).toContain('Convert');

    await page.locator('[data-testid="copilot-add-to-queue"]').click();
    await page.waitForFunction(() => location.hash.startsWith('#/batch'), undefined, { timeout: 15000 });
    await expect.poll(() => mockApi.get(page).then((s) => s.queueJobs.length)).toBe(PLAN.actions.length);
  });

  it('surfaces a rejecting planner as an inline error without a pageerror', async () => {
    const { page } = session;
    await chooseFolder(page, FOLDER_FILES);
    await mockApi.setCopilotPlanBehavior(page, 'reject');
    await typeGoal(page, PLAN.goal);
    await page.locator('[data-testid="copilot-plan"]').click();

    await page.locator('[data-testid="copilot-error"]').waitFor({ timeout: 15000 });
    await expect.poll(() => page.locator('[data-testid="copilot-plan-summary"]').count()).toBe(0);
    await expect.poll(() => page.locator('[data-testid="copilot-conversation"]').count()).toBe(1);
  });

  it('degrades a malformed plan payload to an inline error', async () => {
    const { page } = session;
    await chooseFolder(page, FOLDER_FILES);
    await mockApi.setCopilotPlan(page, { goal: PLAN.goal } as unknown as CopilotPlan);
    await typeGoal(page, PLAN.goal);
    await page.locator('[data-testid="copilot-plan"]').click();

    await page.locator('[data-testid="copilot-error"]').waitFor({ timeout: 15000 });
    await expect.poll(() => page.locator('[data-testid="copilot-error"]').innerText()).toContain('could not build a plan');
    await expect.poll(() => page.locator('[data-testid="copilot-plan-summary"]').count()).toBe(0);
  });

  it('passes the full axe rule set on an empty and a populated conversation', async () => {
    const { page } = session;
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
    await page.mouse.move(1, 1);
    await page.waitForTimeout(200);
    assertAxeClean(await runAxeOnPage(page, { context: CONVERSATION_CONTEXT }), 'copilot empty conversation');

    await chooseFolder(page, FOLDER_FILES);
    await mockApi.setCopilotPlan(page, PLAN);
    await typeGoal(page, PLAN.goal);
    await page.locator('[data-testid="copilot-plan"]').click();
    await page.locator('[data-testid="copilot-plan-summary"]').waitFor({ timeout: 15000 });
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
    await page.mouse.move(1, 1);
    await page.waitForTimeout(200);
    assertAxeClean(await runAxeOnPage(page, { context: CONVERSATION_CONTEXT }), 'copilot populated conversation');
  });
});
