import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Page } from 'playwright';
import { launchApp, closeApp, ensureLiveSession, reloadSession, type AppSession } from '../fixtures/app';
import { mockApi, emitAutomationProgress } from '../mocks/control';
import type { AutomationDefinition } from '../../src/shared/automations/types';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;
const INPUT = '/media/e2e-input.mp4';
const OUTPUT = '/media/e2e-output.mp4';

function makeDefinition(id: string, name: string, backend: 'FFMPEG' | 'BMF'): AutomationDefinition {
  return {
    id,
    name,
    version: 1,
    createdAt: 1,
    updatedAt: 1,
    settings: {
      defaultBackend: 'FFMPEG',
      tempDirectoryMode: 'app-data',
      keepIntermediateFiles: false,
      conflictPolicy: 'unique-suffix',
    },
    graph: {
      nodes: [
        {
          id: 'input-1',
          kind: 'input',
          label: 'Input',
          position: { x: 0, y: 0 },
          data: { kind: 'input', path: INPUT, mediaKind: 'video' },
        },
        {
          id: 'transcode-1',
          kind: 'transcode',
          label: 'Transcode',
          position: { x: 1, y: 0 },
          data: { kind: 'transcode', backend, options: {} },
        },
        { id: 'output-1', kind: 'output', label: 'Output', position: { x: 2, y: 0 }, data: { kind: 'output', path: OUTPUT } },
      ],
      edges: [
        { id: 'input-1->transcode-1', source: 'input-1', target: 'transcode-1' },
        { id: 'transcode-1->output-1', source: 'transcode-1', target: 'output-1' },
      ],
    },
  };
}

async function gotoAutomations(page: Page): Promise<void> {
  const nav = page.locator('[data-testid="nav-item-automations"]');
  await nav.waitFor({ timeout: 15_000 });
  await nav.click();
  await page.waitForFunction(() => window.location.hash.startsWith('#/automations'), null, { timeout: 15_000 });
  await page.getByTestId('automation-canvas').waitFor({ timeout: 15_000 });
}

async function openDefinition(page: Page, id: string): Promise<void> {
  await page.getByTestId('automation-open-library').click();
  await page.getByTestId(`automation-library-open-${id}`).click();
  await page.getByTestId('automation-canvas').waitFor({ state: 'visible', timeout: 15_000 });
}

describe.runIf(IS_E2E)('Automations', () => {
  let session: AppSession;

  beforeAll(async () => {
    session = await launchApp({ mock: true });
  }, 60_000);

  afterAll(async () => {
    await closeApp(session.app, session.userDataDir);
  });

  beforeEach(async () => {
    session = await ensureLiveSession(session);
    session = await reloadSession(session);
    await mockApi.reset(session.page);
    await mockApi.setBmfStatus(session.page, { available: true, missing: [] });
    await mockApi.setAutomations(session.page, []);
  });

  it('builds an automation, saves it, and reopens it from the library', async () => {
    await gotoAutomations(session.page);

    await session.page.getByTestId('automation-palette-input').click();
    await expect.poll(() => session.page.locator('[data-testid^="automation-canvas-node-"]').count()).toBe(1);
    await session.page.getByTestId('automation-palette-output').click();
    await expect.poll(() => session.page.locator('[data-testid^="automation-canvas-node-"]').count()).toBe(2);
    await session.page.getByTestId('automation-name-input').fill('E2E Built');
    await session.page.getByTestId('automation-save').click();

    await expect
      .poll(async () => (await mockApi.get(session.page)).automations.map((definition) => definition.name))
      .toEqual(['E2E Built']);
    const saved = (await mockApi.get(session.page)).automations[0];
    await openDefinition(session.page, saved.id);
    await expect.poll(() => session.page.getByTestId('automation-name-input').inputValue()).toBe('E2E Built');
  });

  it('reruns an automation and announces live progress', async () => {
    await mockApi.setAutomations(session.page, [makeDefinition('seed', 'Seeded Run', 'FFMPEG')]);
    await gotoAutomations(session.page);
    await openDefinition(session.page, 'seed');
    await expect.poll(() => session.page.getByTestId('automation-name-input').inputValue()).toBe('Seeded Run');

    await mockApi.setAutomationStartRunId(session.page, 'run-e2e');
    await session.page.getByTestId('automation-run').click();
    const live = session.page.getByTestId('automation-run-status-live');
    await expect.poll(() => live.textContent()).toContain('Queued');

    await emitAutomationProgress(session.page, {
      runId: 'run-e2e',
      automationId: 'seed',
      nodeId: 'transcode-1',
      status: 'running',
      progress: 50,
      message: 'halfway',
    });
    await expect.poll(() => live.textContent()).toContain('Running');
    await expect.poll(() => session.page.getByTestId('automation-run-progress').getAttribute('aria-valuenow')).toBe('50');
    await expect.poll(() => session.page.getByTestId('automation-run-message').textContent()).toBe('halfway');

    await session.page.getByTestId('automation-rerun').click();
    await expect.poll(async () => (await mockApi.getAutomationStartCalls(session.page)).length).toBe(2);
  });

  it('blocks a run when the BMF backend is unavailable', async () => {
    await mockApi.setBmfStatus(session.page, { available: false, missing: ['bmf_ffmpeg', 'bmf_ffprobe'] });
    await mockApi.setAutomations(session.page, [makeDefinition('bmf', 'BMF Needed', 'BMF')]);
    await gotoAutomations(session.page);
    await openDefinition(session.page, 'bmf');

    await session.page.getByTestId('automation-run').click();
    await expect.poll(() => session.page.getByTestId('automation-issue-backend_unavailable').isVisible()).toBe(true);
    await expect.poll(async () => (await mockApi.getAutomationStartCalls(session.page)).length).toBe(0);
  });
});
