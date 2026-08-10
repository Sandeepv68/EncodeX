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
  /** Extra args passed to the Electron executable. */
  args?: string[];
  /** Extra environment variables merged into the child process env. */
  env?: NodeJS.ProcessEnv;
}

export function buildEnv(mock: boolean, extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (mock) {
    env.ENCODEX_TEST_MODE = '1';
  } else {
    delete env.ENCODEX_TEST_MODE;
  }
  return { ...env, ...extra };
}

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
  const { mock = true, args = [], env = {} } = options;
  ensureBuildExists();

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { _electron } = await import('playwright');

  const userDataDir = createUserDataDir();

  const app = await _electron.launch({
    args: [getBuildPaths().mainEntry, `--user-data-dir=${userDataDir}`, ...args],
    cwd: getBuildPaths().root,
    env: buildEnv(mock, env),
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

/** Best-effort close that also force-kills the app process and cleans temp data. */
export async function closeApp(app: ElectronApplication, userDataDir?: string): Promise<void> {
  if (!app) return;
  const pid = app.process().pid;
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
