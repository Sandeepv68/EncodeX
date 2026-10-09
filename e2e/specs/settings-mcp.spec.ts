/**
 * @fileoverview Tier A (mock preload) spec for the embedded MCP server
 * settings UI.
 *
 * Drives the real Settings page against the mock bridge and asserts both the
 * UI and the settings that reach the main process (`mcpSetCalls`). The mock
 * preload mirrors the main-process sanitation contract in
 * `src/shared/mcp-settings.ts` (out-of-range ports clamp to 8765) and the
 * store forwards the whole snapshot per change, so this spec locks in the
 * W7 plumbing without a real App::reconcile.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { launchApp, closeApp, ensureLiveSession, reloadSession, AppSession } from '../fixtures/app';
import { mockApi } from '../mocks/control';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

async function gotoSettings(page: import('playwright').Page): Promise<void> {
  await page.locator('[data-testid="nav-item-settings"]').waitFor({ timeout: 15000 });
  await page.locator('[data-testid="nav-item-settings"]').click();
  await page.waitForFunction(() => location.hash.startsWith('#/settings'));
}

describe.runIf(IS_E2E)('Settings page - embedded MCP server (Tier A)', () => {
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
    await gotoSettings(page);
    await page.locator('[data-testid="settings-theme-light"]').waitFor({ timeout: 15000 });
  }, 30000);

  it('renders the MCP server switch collapsed by default', async () => {
    const { page } = session;
    await expect.poll(() => page.locator('[data-testid="settings-mcp-server"]').isChecked()).toBe(false);
    await expect.poll(() => page.locator('[data-testid="settings-mcp-port"]').count()).toBe(0);
    await expect.poll(() => page.locator('[data-testid="settings-mcp-token"]').count()).toBe(0);
    await expect.poll(() => page.locator('[data-testid="settings-mcp-endpoint"]').count()).toBe(0);
    await expect.poll(() => page.locator('[data-testid="settings-mcp-ai-use-cases-link"]').count()).toBe(0);
  });

  it('enabling the switch forwards settings to the main process and reveals the endpoint', async () => {
    const { page } = session;
    await page.locator('[data-testid="settings-mcp-server"]').click();
    await expect.poll(() => page.locator('[data-testid="settings-mcp-server"]').isChecked()).toBe(true);
    await expect.poll(() => mockApi.getMcpSetCalls(page).then((calls) => calls.length)).toBeGreaterThan(0);
    const last = (await mockApi.getMcpSetCalls(page)).slice(-1)[0];
    expect(last).toMatchObject({ enabled: true, port: 8765, token: '' });
    await expect.poll(() => page.locator('[data-testid="settings-mcp-endpoint"] input').inputValue()).toBe('http://127.0.0.1:8765/mcp');
    await expect.poll(() => page.locator('[data-testid="settings-mcp-ai-use-cases-link"]').count()).toBe(1);
  });

  it('commits a valid port on Enter and updates the endpoint', async () => {
    const { page } = session;
    const portInput = page.locator('[data-testid="settings-mcp-port"] input');
    await page.locator('[data-testid="settings-mcp-server"]').click();
    await portInput.fill('9999');
    await expect.poll(() => portInput.inputValue()).toBe('9999');
    await portInput.press('Enter');
    await expect.poll(() => page.locator('[data-testid="settings-mcp-endpoint"] input').inputValue()).toBe('http://127.0.0.1:9999/mcp');
    const last = (await mockApi.getMcpSetCalls(page)).slice(-1)[0];
    expect(last.port).toBe(9999);
  });

  it('clamps out-of-range ports back to the canonical default', async () => {
    const { page } = session;
    const portInput = page.locator('[data-testid="settings-mcp-port"] input');
    await page.locator('[data-testid="settings-mcp-server"]').click();
    await portInput.fill('80');
    await expect.poll(() => portInput.inputValue()).toBe('80');
    await portInput.press('Enter');
    await expect.poll(() => portInput.inputValue()).toBe('8765');
    await expect.poll(() => page.locator('[data-testid="settings-mcp-endpoint"] input').inputValue()).toBe('http://127.0.0.1:8765/mcp');
    const last = (await mockApi.getMcpSetCalls(page)).slice(-1)[0];
    expect(last.port).toBe(8765);
  });

  it('generates a token, reveals it, and shows the authorization header', async () => {
    const { page } = session;
    await page.locator('[data-testid="settings-mcp-server"]').click();
    await page.locator('[data-testid="settings-mcp-generate-token"]').click();
    await expect.poll(() => page.locator('[data-testid="settings-mcp-token"]').count()).toBe(1);
    const tokenField = page.locator('[data-testid="settings-mcp-token"] input');
    await expect.poll(() => tokenField.getAttribute('type')).toBe('password');
    const tokenValue = await tokenField.inputValue();
    expect(tokenValue.length).toBeGreaterThanOrEqual(24);
    await expect.poll(() => page.locator('[data-testid="settings-mcp-authorization"] input').inputValue()).toBe(`Bearer ${tokenValue}`);
    const last = (await mockApi.getMcpSetCalls(page)).slice(-1)[0];
    expect(last.token).toBe(tokenValue);

    await page.locator('[data-testid="settings-mcp-token-visibility"]').click();
    await expect.poll(() => tokenField.getAttribute('type')).toBe('text');
  });

  it('clears the token and collapses the row back to the generate action', async () => {
    const { page } = session;
    await page.locator('[data-testid="settings-mcp-server"]').click();
    await page.locator('[data-testid="settings-mcp-generate-token"]').click();
    await expect.poll(() => page.locator('[data-testid="settings-mcp-token"]').count()).toBe(1);
    await page.locator('[data-testid="settings-mcp-clear-token"]').click();
    await expect.poll(() => page.locator('[data-testid="settings-mcp-token"]').count()).toBe(0);
    await expect.poll(() => page.locator('[data-testid="settings-mcp-authorization"]').count()).toBe(0);
    await expect.poll(() => page.locator('[data-testid="settings-mcp-generate-token"]').count()).toBe(1);
    const last = (await mockApi.getMcpSetCalls(page)).slice(-1)[0];
    expect(last.token).toBe('');
  });

  it('hydrates persisted settings from the main process on load', async () => {
    await mockApi.setMcpSettings(session.page, { enabled: true, port: 7000, token: 'persisted-token' });
    session = await reloadSession(session);
    const { page } = session;
    await gotoSettings(page);
    await expect.poll(() => page.locator('[data-testid="settings-mcp-server"]').isChecked()).toBe(true);
    await expect.poll(() => page.locator('[data-testid="settings-mcp-port"] input').inputValue()).toBe('7000');
    await expect.poll(() => page.locator('[data-testid="settings-mcp-token"] input').inputValue()).toBe('persisted-token');
    await expect.poll(() => page.locator('[data-testid="settings-mcp-endpoint"] input').inputValue()).toBe('http://127.0.0.1:7000/mcp');
    await expect.poll(() => page.locator('[data-testid="settings-mcp-authorization"] input').inputValue()).toBe('Bearer persisted-token');
  });
});
