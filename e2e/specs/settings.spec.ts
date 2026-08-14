import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { launchApp, closeApp, AppSession } from '../fixtures/app';
import { mockApi } from '../mocks/control';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

const THEME_IDS = ['light', 'ocean', 'sunset', 'forest', 'lavender', 'rose', 'slate', 'dark'];

async function gotoSettings(page: import('playwright').Page): Promise<void> {
  await page.locator('[data-testid="nav-item-settings"]').waitFor({ timeout: 15000 });
  await page.locator('[data-testid="nav-item-settings"]').click();
  await page.waitForFunction(() => location.hash.startsWith('#/settings'));
}

describe.runIf(IS_E2E)('Settings page', () => {
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
    await gotoSettings(page);
    await page.locator('[data-testid="settings-theme-light"]').waitFor({ timeout: 15000 });
  }, 30000);

  it('renders all theme cards and switches with hardware selects shown by default', async () => {
    const { page } = session;
    for (const id of THEME_IDS) {
      await expect.poll(() => page.locator(`[data-testid="settings-theme-${id}"]`).count()).toBe(1);
    }
    await expect.poll(() => page.locator('[data-testid="settings-theme-light"]').getAttribute('aria-pressed')).toBe('true');
    await expect.poll(() => page.locator('[data-testid="settings-always-on-top"]').isChecked()).toBe(false);
    await expect.poll(() => page.locator('[data-testid="settings-launch-at-login"]').isChecked()).toBe(false);
    await expect.poll(() => page.locator('[data-testid="settings-hardware-acceleration"]').isChecked()).toBe(true);
    await expect.poll(() => page.locator('[data-testid="settings-hwaccel-mode"] input').inputValue()).toBe('auto');
    await expect.poll(() => page.locator('[data-testid="settings-encoder-type"] input').inputValue()).toBe('auto');
  });

  it('switches the active theme card', async () => {
    const { page } = session;
    await page.locator('[data-testid="settings-theme-forest"]').click();
    await expect.poll(() => page.locator('[data-testid="settings-theme-forest"]').getAttribute('aria-pressed')).toBe('true');
    await expect.poll(() => page.locator('[data-testid="settings-theme-light"]').getAttribute('aria-pressed')).toBe('false');
  });

  it('toggles always on top and forwards it to the main process', async () => {
    const { page } = session;
    await page.locator('[data-testid="settings-always-on-top"]').click();
    await expect.poll(() => page.locator('[data-testid="settings-always-on-top"]').isChecked()).toBe(true);
    await expect.poll(() => mockApi.get(page).then((s) => s.windowCalls)).toContain('always-on-top:true');
  });

  it('toggles launch at startup and forwards it to the main process', async () => {
    const { page } = session;
    await page.locator('[data-testid="settings-launch-at-login"]').click();
    await expect.poll(() => page.locator('[data-testid="settings-launch-at-login"]').isChecked()).toBe(true);
    await expect.poll(() => mockApi.get(page).then((s) => s.loginCalls)).toContain(true);
  });

  it('persists hardware acceleration mode and encoder type', async () => {
    const { page } = session;
    await expect.poll(() => page.locator('[data-testid="settings-hwaccel-mode"]').count()).toBe(1);
    await expect.poll(() => page.locator('[data-testid="settings-encoder-type"]').count()).toBe(1);

    await page.locator('[data-testid="settings-hwaccel-mode"] [role="combobox"]').click();
    const modeOption = page.getByRole('option', { name: 'Encode only' });
    await modeOption.waitFor({ timeout: 5000 });
    await modeOption.click();
    await expect.poll(() => page.locator('[data-testid="settings-hwaccel-mode"] input').inputValue()).toBe('encode');

    await page.locator('[data-testid="settings-encoder-type"] [role="combobox"]').click();
    const encoderOption = page.getByRole('option', { name: 'Hardware' });
    await encoderOption.waitFor({ timeout: 5000 });
    await encoderOption.click();
    await expect.poll(() => page.locator('[data-testid="settings-encoder-type"] input').inputValue()).toBe('hardware');

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('encodex-hwaccel') ?? '{}'));
    expect(stored).toMatchObject({ hardwareAcceleration: true, hwaccelMode: 'encode', encoderType: 'hardware' });
  });

  it('hides hardware selects when disabled and restores persisted values on re-enable', async () => {
    const { page } = session;
    await page.locator('[data-testid="settings-hardware-acceleration"]').click();
    await expect.poll(() => page.locator('[data-testid="settings-hwaccel-mode"]').count()).toBe(0);
    await expect.poll(() => page.locator('[data-testid="settings-encoder-type"]').count()).toBe(0);

    await page.locator('[data-testid="settings-hardware-acceleration"]').click();
    await expect.poll(() => page.locator('[data-testid="settings-hwaccel-mode"]').count()).toBe(1);
    await expect.poll(() => page.locator('[data-testid="settings-hwaccel-mode"] input').inputValue()).toBe('encode');
    await expect.poll(() => page.locator('[data-testid="settings-encoder-type"] input').inputValue()).toBe('hardware');
  });
});
