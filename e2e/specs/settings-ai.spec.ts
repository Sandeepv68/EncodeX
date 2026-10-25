/**
 * @fileoverview Stage 4b - AI-provider settings E2E suite (Tier A, mock preload).
 *
 * Exercises the AI provider editor on the Settings page: expanding it loads the
 * stored view, selecting a remote provider reveals the key field, and a failed
 * connection test is rendered as the *classified, localized* message (keyed off
 * the `reason` the service returns) rather than the raw provider payload.
 *
 * It also guards the key boundary: the plaintext key the user pastes is never
 * rendered back into the DOM, and switching to the offline `rules` provider
 * persists that choice.
 *
 * @see plans/COPILOT_AI_PROVIDER_TEST_PLAN.md, Stage 4b
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Page } from 'playwright';
import { launchApp, closeApp, ensureLiveSession, reloadSession, AppSession } from '../fixtures/app';
import { mockApi } from '../mocks/control';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

/** A plaintext key that must never be rendered back to the DOM after Connect. */
const SECRET_KEY = 'sk-e2e-super-secret-1234567890';

/** Navigates to `/settings` through the drawer and waits for the route to mount. */
async function gotoSettings(page: Page): Promise<void> {
  await page.locator('[data-testid="nav-item-settings"]').waitFor({ timeout: 15000 });
  await page.locator('[data-testid="nav-item-settings"]').click();
  await page.waitForFunction(() => location.hash.startsWith('#/settings'));
}

/** Expands the AI-provider editor and waits for its well to render. */
async function openAiEditor(page: Page): Promise<void> {
  await page.locator('[data-testid="settings-ai-toggle"]').click();
  await page.locator('[data-testid="settings-ai"]').waitFor({ timeout: 15000 });
}

describe.runIf(IS_E2E)('Settings page - AI provider editor', () => {
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
    await page.locator('[data-testid="settings-ai-toggle"]').waitFor({ timeout: 15000 });
  }, 30000);

  it('expands, selects a provider, and renders a failed connect as a classified localized error', async () => {
    const { page } = session;
    // The mock connectivity test returns this classified failure; the raw
    // `message` must NOT be shown - the page localizes off `reason`.
    await mockApi.setAiConnectResult(page, { ok: false, message: 'RAW_PROVIDER_PAYLOAD', reason: 'invalidKey', status: 401 });

    await openAiEditor(page);
    await page.locator('[data-testid="settings-ai-provider-openai"]').click();
    await page.locator('[data-testid="settings-ai-key"] input').waitFor({ timeout: 10000 });
    await page.locator('[data-testid="settings-ai-key"] input').fill(SECRET_KEY);
    await page.locator('[data-testid="settings-ai-connect"]').click();

    await page.locator('[data-testid="settings-ai-error"]').waitFor({ timeout: 15000 });
    const errorText = await page.locator('[data-testid="settings-ai-error"]').innerText();
    expect(errorText).toContain('API key was rejected');
    expect(errorText).not.toContain('RAW_PROVIDER_PAYLOAD');

    // The pasted secret must never be echoed back into the page.
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain(SECRET_KEY);
  });

  it('records a successful connection and shows the persisted status after a reload', async () => {
    let { page } = session;
    // The default mock connectivity test succeeds.
    await mockApi.setAiSettingsView(page, { providerId: 'openai', hasKey: true, keyHint: '••••••••' });

    await openAiEditor(page);
    await page.locator('[data-testid="settings-ai-provider-openai"]').click();
    await page.locator('[data-testid="settings-ai-connect"]').click();
    await page.locator('[data-testid="settings-ai-connected"]').waitFor({ timeout: 15000 });

    // Reloading the window re-reads the stored view: the status must persist.
    session = await reloadSession(session);
    page = session.page;
    await gotoSettings(page);
    await openAiEditor(page);
    await expect.poll(() => page.locator('[data-testid="settings-ai-connected"]').count()).toBe(1);
  });

  it('persists a switch to the offline rules provider and never renders a stored key', async () => {
    // Start from a stored remote selection so selecting `rules` is a real change.
    // Seed it through the *current* page before reloading: the renderer hydrates
    // its session cache from this file at startup, so seeding after the reload
    // races that hydration and the editor can restore a stale provider.
    await mockApi.setAiSettingsView(session.page, { providerId: 'openai', hasKey: true, keyHint: '••••••••' });
    session = await reloadSession(session);
    const { page } = session;
    await gotoSettings(page);

    await openAiEditor(page);
    await expect.poll(() => page.locator('[data-testid="settings-ai-provider-openai"]').getAttribute('aria-pressed')).toBe('true');

    await page.locator('[data-testid="settings-ai-provider-rules"]').click();
    await expect.poll(() => page.locator('[data-testid="settings-ai-provider-rules"]').getAttribute('aria-pressed')).toBe('true');

    await expect.poll(() => mockApi.getAiSetCalls(page).then((calls) => calls.some((call) => call.providerId === 'rules'))).toBe(true);
    // `rules` is offline: no key field, and no plaintext key anywhere in the DOM.
    await expect.poll(() => page.locator('[data-testid="settings-ai-key"]').count()).toBe(0);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain(SECRET_KEY);
  });
});
