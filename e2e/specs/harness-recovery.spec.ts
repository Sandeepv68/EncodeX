/**
 * @fileoverview Self-tests for the GUI e2e harness's crash-recovery path.
 *
 * The Chromium renderer occasionally dies on Windows under sustained load. The
 * other specs depend on `ensureLiveSession` transparently relaunching the app
 * so one process crash costs a single test instead of failing every remaining
 * test in the file, so that behaviour is verified here directly rather than
 * being left to fail incidentally during a real suite run.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { launchApp, closeApp, ensureLiveSession, isPageAlive, AppSession } from '../fixtures/app';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

/**
 * Kills the renderer the way an OOM or GPU fault would.
 *
 * Driven from the main process via `forcefullyCrashRenderer` rather than CDP
 * `Page.crash`: crashing the target over CDP never answers the command, so the
 * `cdp.send` promise hangs for the rest of the run.
 */
async function crashRenderer(session: AppSession): Promise<void> {
  await session.app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.webContents.forcefullyCrashRenderer();
  });
}

describe.runIf(IS_E2E)('e2e harness renderer recovery', () => {
  let session: AppSession;

  beforeAll(async () => {
    session = await launchApp({ mock: true });
  }, 60000);

  afterAll(async () => {
    await closeApp(session.app, session.userDataDir);
  });

  it('reports a healthy renderer as alive and reuses the session', async () => {
    expect(await isPageAlive(session.page)).toBe(true);
    expect(await ensureLiveSession(session)).toBe(session);
  });

  it('relaunches a usable app after the renderer crashes', async () => {
    await crashRenderer(session);
    expect(await isPageAlive(session.page)).toBe(false);

    session = await ensureLiveSession(session);

    expect(await isPageAlive(session.page)).toBe(true);
    await session.page.locator('[data-testid="nav-item-batch"]').waitFor({ timeout: 15000 });
  });
});
