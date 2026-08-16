import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { launchApp, closeApp, AppSession } from '../fixtures/app';
import { mockApi } from '../mocks/control';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

const NAV_ROUTES = [
  ['dashboard', '/'],
  ['convert', '/convert'],
  ['media-info', '/media-info'],
  ['image-compress', '/image-compress'],
  ['audio-extract', '/audio-extract'],
  ['video-cut', '/video-cut'],
  ['batch', '/batch'],
  ['logs', '/logs'],
  ['settings', '/settings'],
  ['about', '/about'],
] as const;

describe.runIf(IS_E2E)('Shell', () => {
  let session: AppSession;

  beforeAll(async () => {
    session = await launchApp({ mock: true });
    await mockApi.reset(session.page);
  }, 60000);

  afterAll(async () => {
    await closeApp(session.app, session.userDataDir);
  });

  it('opens a window with the correct title', async () => {
    await expect.poll(() => session.page.title()).toBe('EncodeX');
  });

  it('renders the dashboard on load', async () => {
    await session.page.waitForLoadState('load');
    const bodyText = await session.page.textContent('body');
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(0);
  });

  it('exposes electronAPI on window', async () => {
    const hasAPI = await session.page.evaluate(() => typeof (window as any).electronAPI !== 'undefined');
    expect(hasAPI).toBe(true);
  });

  it('exposes all expected electronAPI method names', async () => {
    const methods: string[] = await session.page.evaluate(() => Object.keys((window as any).electronAPI).sort());
    const expected = [
      'selectFile',
      'selectFiles',
      'selectOutput',
      'getMediaInfo',
      'convertFile',
      'cancelConversion',
      'queueAdd',
      'queueRemove',
      'queueList',
      'queueCancelAll',
      'playerOpen',
      'playerSeek',
      'playerClose',
      'playerGetFrame',
      'onConversionProgress',
      'onQueueAdded',
      'onQueueRemoved',
      'onQueueStatusChange',
      'onQueueProgress',
      'onQueueCancelled',
      'onPlayerFrame',
    ];
    for (const name of expected) expect(methods).toContain(name);
  });

  it('has a functioning contextBridge', async () => {
    const isFunction = await session.page.evaluate(() => typeof (window as any).electronAPI.selectFile === 'function');
    expect(isFunction).toBe(true);
  });

  it('shows all 10 drawer navigation items', async () => {
    for (const [id] of NAV_ROUTES) {
      await expect.poll(() => session.page.locator(`[data-testid="nav-item-${id}"]`).count()).toBe(1);
    }
  });

  it.each(NAV_ROUTES)('navigates to /%s route', async (id, route) => {
    await session.page.locator(`[data-testid="nav-item-${id}"]`).click();
    await session.page.waitForTimeout(300);
    const url = session.page.url();
    expect(url).toContain(`#${route}`);
    await session.page.waitForFunction(() => !document.body.textContent?.includes('Something went wrong'));
  });

  it('does not show the error boundary on initial load', async () => {
    const hasError = await session.page.evaluate(() => document.body.textContent?.includes('Something went wrong') ?? false);
    expect(hasError).toBe(false);
  });

  it('has working title bar window controls', async () => {
    await session.page.locator('button[aria-label="Minimize"]').click();
    await session.page.locator('button[aria-label="Maximize"]').click();
    const snapshot = await mockApi.get(session.page);
    expect(snapshot.windowCalls).toContain('minimize');
    expect(snapshot.windowCalls).toContain('maximize-toggle');
  });

  it('opens the language menu from the drawer', async () => {
    await session.page.locator('[data-testid="language-menu-button"]').click();
    const menuItems = session.page.locator('.MuiMenu-root [role="menuitem"]');
    await menuItems.first().waitFor({ timeout: 5000 });
    expect(await menuItems.count()).toBeGreaterThan(1);
  });
});
