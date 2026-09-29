/**
 * @fileoverview Shared Electron launch/teardown helpers for e2e specs.
 *
 * One Electron instance is launched per spec file (beforeAll) and torn down in
 * afterAll. `launchApp` builds the child env explicitly so the test-mode mock
 * preload is used for Tier A specs and the real preload for Tier B specs.
 */

import type { ElectronApplication, Page } from 'playwright';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ensureBuildExists, getBuildPaths } from '../helpers';

export interface AppSession {
  app: ElectronApplication;
  page: Page;
  userDataDir: string;
}

export interface LaunchOptions {
  /** Use the mock preload (Tier A). Defaults to true. */
  mock?: boolean;
  /**
   * Terms-of-use gate handling. 'accept' (default): when using the mock preload,
   * consent is pre-seeded into localStorage so the blocking gate never shows;
   * 'show': the gate renders on first launch (Tier A mock mode) - use it for the
   * terms spec. No effect when `mock: false` (the real preload never seeds).
   */
  terms?: 'accept' | 'show';
  /** Extra args passed to the Electron executable. */
  args?: string[];
  /** Extra environment variables merged into the child process env. */
  env?: NodeJS.ProcessEnv;
}

export function buildEnv(mock: boolean, extra: NodeJS.ProcessEnv = {}, terms: 'accept' | 'show' = 'accept'): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (mock) {
    env.ENCODEX_TEST_MODE = '1';
  } else {
    delete env.ENCODEX_TEST_MODE;
  }
  if (terms === 'show') {
    env.ENCODEX_TERMS_GATE = 'show';
  } else {
    delete env.ENCODEX_TERMS_GATE;
  }
  return { ...env, ...extra };
}

/**
 * Chromium switches forced for every GUI e2e launch. Canvas-heavy specs (e.g.
 * video-cut) route compositing through Chromium's GPU process, which crashes
 * randomly on headless Windows CI runners; the CLI harness already disables the
 * GPU for the same reason (see e2e/cli.spec.ts).
 *
 * The occlusion/backgrounding flags matter because the app window is never
 * shown during a test run. Without them Windows' native occlusion detection
 * reports the window as hidden, so Chromium backgrounds and throttles the
 * renderer - the same condition that shows up as a renderer that dies on the
 * next `page.reload()`.
 * @const {string[]} CHROMIUM_STABILITY_ARGS
 */
const CHROMIUM_STABILITY_ARGS = [
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-features=CalculateNativeWinOcclusion',
];

/** Creates a throwaway Chromium/Electron user data directory for isolation. */
export function createUserDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-e2e-'));
  return dir;
}

/**
 * Launches the packaged/built Electron app and resolves the main window (the
 * one exposing `window.electronAPI`).
 */
export async function launchApp(options: LaunchOptions = {}): Promise<AppSession> {
  const { mock = true, terms = 'accept', args = [], env = {} } = options;
  ensureBuildExists();

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { _electron } = await import('playwright');

  const userDataDir = createUserDataDir();

  const app = await _electron.launch({
    args: [getBuildPaths().mainEntry, `--user-data-dir=${userDataDir}`, ...CHROMIUM_STABILITY_ARGS, ...args],
    cwd: getBuildPaths().root,
    env: buildEnv(mock, env, terms),
  });

  await app.firstWindow();
  const page = await getMainWindow(app);
  return { app, page, userDataDir };
}

/** Finds the BrowserWindow that exposes the preload bridge. */
export async function getMainWindow(app: ElectronApplication): Promise<Page> {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    for (const win of app.windows()) {
      try {
        const hasApi = await win.evaluate(() => typeof (window as any).electronAPI !== 'undefined');
        if (hasApi) return win;
      } catch {
        // window may have closed; skip it
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Main window (with electronAPI) was not found');
}

/**
 * Accepts the Terms & Conditions gate and waits for the modal to close. Used by
 * real-preload (Tier B) specs, where the gate is never pre-seeded and must be
 * dismissed before the app UI is usable.
 * @param {Page} page - The main application window's page.
 * @returns {Promise<void>} Resolves once the gate is gone.
 */
export async function acceptTermsGate(page: Page): Promise<void> {
  await page.locator('[data-testid="terms-dialog"]').waitFor({ timeout: 15000 });
  await page.locator('[data-testid="terms-accept"]').click();
  await page.locator('[data-testid="terms-dialog"]').waitFor({ state: 'hidden', timeout: 10000 });
}

/**
 * Probes whether the page's renderer is still usable.
 *
 * A crashed renderer leaves the `Page` object itself open, so `page.isClosed()`
 * is false and every later call fails with an opaque "Target crashed". A cheap
 * round-trip is the only reliable liveness signal.
 * @param {Page} page - The page to probe.
 * @returns {Promise<boolean>} True when the renderer still evaluates.
 */
export async function isPageAlive(page: Page): Promise<boolean> {
  try {
    await page.evaluate(() => 0);
    return true;
  } catch {
    return false;
  }
}

/** Tears down a dead session and launches a replacement with the same options. */
async function relaunch(session: AppSession, options: LaunchOptions): Promise<AppSession> {
  await closeApp(session.app, session.userDataDir);
  return launchApp(options);
}

/**
 * Returns a session whose renderer is alive, relaunching the app when needed.
 *
 * Specs reload the page in `beforeEach` to reset renderer state. The Chromium
 * renderer occasionally dies on Windows under sustained load, and without this
 * helper the dead page poisons every remaining test in the file - one process
 * crash turned into 6-9 failures. Reassigning the result in `beforeEach` keeps a
 * single crash scoped to the test that hit it:
 *
 * ```ts
 * beforeEach(async () => {
 *   session = await ensureLiveSession(session);
 *   ...
 * });
 * ```
 *
 * @param {AppSession} session - The current session; may be returned unchanged.
 * @param {LaunchOptions} [options] - Launch options used if a relaunch is needed.
 * @returns {Promise<AppSession>} The same session when healthy, else a fresh one.
 */
export async function ensureLiveSession(session: AppSession, options: LaunchOptions = {}): Promise<AppSession> {
  if (await isPageAlive(session.page)) return session;
  return relaunch(session, options);
}

/**
 * Reloads the page, relaunching the app if the renderer is or becomes dead.
 *
 * Complements {@link ensureLiveSession}: that guard only covers a renderer that
 * was *already* dead, but the crash more often lands on the reload itself, so
 * the reload has to be guarded too. Specs that reload for isolation should use
 * this in place of a bare `page.reload()` and must read the page from the
 * returned session, since the app may have been swapped:
 *
 * ```ts
 * beforeEach(async () => {
 *   session = await reloadSession(session);
 *   const { page } = session;
 *   ...
 * });
 * ```
 *
 * @param {AppSession} session - The session to reload.
 * @param {LaunchOptions} [options] - Launch options used if a relaunch is needed.
 * @returns {Promise<AppSession>} The same session if the reload stuck, else a fresh one.
 */
export async function reloadSession(session: AppSession, options: LaunchOptions = {}): Promise<AppSession> {
  if (await isPageAlive(session.page)) {
    try {
      await session.page.reload();
      return session;
    } catch {
      // The renderer died during the reload itself; fall through and relaunch.
    }
  }
  return relaunch(session, options);
}

/**
 * Removes a throwaway user data directory, retrying until Windows lets go.
 *
 * Chromium's GPU and utility child processes keep handles on the profile for a
 * few hundred ms after the parent is killed, so the first removal loses the
 * race. `fs.rmSync`'s own `maxRetries` does not help: on Windows it does not
 * retry the `EPERM` raised for a locked directory, it just throws straight
 * away, which orphaned a profile per spec file on every run.
 * @param {string} userDataDir - Directory to remove.
 */
async function removeUserDataDir(userDataDir: string): Promise<void> {
  const deadline = Date.now() + 5000;
  for (let attempt = 0; Date.now() <= deadline; attempt += 1) {
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100 + attempt * 150));
    }
  }
}

/** Best-effort close that also force-kills the app process and cleans temp data. */
export async function closeApp(app: ElectronApplication, userDataDir?: string): Promise<void> {
  if (!app) return;
  let pid: number | undefined;
  try {
    pid = app.process().pid;
  } catch {
    // ElectronApplication connection already closed (app exited / crashed)
  }
  // Kill the tree before closing: once the main process exits, its Chromium
  // GPU/utility children are re-parented and `taskkill /T` can no longer reach
  // them, so a survivor keeps its handle on the profile and the directory is
  // orphaned even though the test believes the app was cleaned up.
  if (pid) {
    try {
      if (process.platform === 'win32') {
        require('child_process').execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
      } else {
        process.kill(pid, 'SIGKILL');
      }
    } catch {
      /* already dead */
    }
  }
  await Promise.race([app.close().catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 5000))]);
  if (userDataDir) {
    await removeUserDataDir(userDataDir);
  }
}
