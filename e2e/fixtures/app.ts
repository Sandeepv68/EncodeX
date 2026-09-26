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
 * @const {string[]} CHROMIUM_STABILITY_ARGS
 */
const CHROMIUM_STABILITY_ARGS = ['--disable-gpu', '--disable-software-rasterizer'];

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

/** Best-effort close that also force-kills the app process and cleans temp data. */
export async function closeApp(app: ElectronApplication, userDataDir?: string): Promise<void> {
  if (!app) return;
  let pid: number | undefined;
  try {
    pid = app.process().pid;
  } catch {
    // ElectronApplication connection already closed (app exited / crashed)
  }
  await Promise.race([app.close(), new Promise((resolve) => setTimeout(resolve, 5000))]);
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
  if (userDataDir) {
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  }
}
