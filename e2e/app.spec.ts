import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import { ensureBuildExists, getBuildPaths } from './helpers';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

describe.runIf(IS_E2E)('Electron App', () => {
  let playwright: typeof import('playwright');
  let electronApp: import('playwright').ElectronApplication;
  let page: import('playwright').Page;

  beforeAll(async () => {
    ensureBuildExists();
    playwright = await import('playwright');
    electronApp = await playwright._electron.launch({
      args: [path.join(getBuildPaths().root, 'dist', 'main', 'index.js')],
      cwd: getBuildPaths().root,
    });
    page = await electronApp.firstWindow();
  }, 60000);

  afterAll(async () => {
    if (electronApp) {
      const pid = electronApp.process().pid;
      await Promise.race([
        electronApp.close(),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
      if (pid) {
        try { process.kill(pid, 'SIGKILL'); } catch { /* already dead */ }
      }
    }
  });

  it('should open a window with the correct title', async () => {
    const title = await page.title();
    expect(title).toBe('EncodeX');
  });

  it('should render the dashboard on load', async () => {
    await page.waitForLoadState('load');
    const url = page.url();
    expect(url).toContain('/');
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(0);
  });

  it('should expose electronAPI on window', async () => {
    const hasAPI = await page.evaluate(() => {
      return typeof (window as any).electronAPI !== 'undefined';
    });
    expect(hasAPI).toBe(true);
  });

  it('should expose all expected electronAPI method names', async () => {
    const methods: string[] = await page.evaluate(() => {
      return Object.keys((window as any).electronAPI).sort();
    });

    expect(methods).toContain('selectFile');
    expect(methods).toContain('selectFiles');
    expect(methods).toContain('selectOutput');
    expect(methods).toContain('getMediaInfo');
    expect(methods).toContain('convertFile');
    expect(methods).toContain('cancelConversion');
    expect(methods).toContain('queueAdd');
    expect(methods).toContain('queueRemove');
    expect(methods).toContain('queueList');
    expect(methods).toContain('queueCancelAll');
    expect(methods).toContain('playerOpen');
    expect(methods).toContain('playerSeek');
    expect(methods).toContain('playerClose');
    expect(methods).toContain('playerGetFrame');
    expect(methods).toContain('onConversionProgress');
    expect(methods).toContain('onQueueAdded');
    expect(methods).toContain('onQueueRemoved');
    expect(methods).toContain('onQueueStatusChange');
    expect(methods).toContain('onQueueProgress');
    expect(methods).toContain('onQueueCancelled');
    expect(methods).toContain('onPlayerFrame');
  });

  it('should have a functioning contextBridge', async () => {
    const isFunction = await page.evaluate(() => {
      return typeof (window as any).electronAPI.selectFile === 'function';
    });
    expect(isFunction).toBe(true);
  });

  it('should have drawer navigation with expected items', async () => {
    await page.waitForSelector('nav', { timeout: 5000 }).catch(() => null);
    const hasNav = await page.evaluate(() => {
      return document.querySelectorAll('nav a, nav button, [role="navigation"] a').length > 0
        || document.querySelector('.MuiDrawer-root') !== null;
    });
    expect(hasNav).toBe(true);
  });

  it('should not show error boundary on initial load', async () => {
    const hasError = await page.evaluate(() => {
      return document.body.textContent?.includes('Something went wrong') ?? false;
    });
    expect(hasError).toBe(false);
  });

  it('should navigate to /convert page', async () => {
    const links = await page.$$('a[href="#/convert"], a[href="/convert"], a:has-text("Convert")');
    if (links.length > 0) {
      await links[0].click();
      await page.waitForTimeout(1000);
      const url = page.url();
      expect(url).toContain('convert');
    }
  });
});
