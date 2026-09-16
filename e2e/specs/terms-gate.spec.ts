/**
 * @fileoverview End-to-end automation for the Terms & Conditions gate.
 *
 * Tier A (mock preload, controlled by `ENCODEX_TERMS_GATE=show`): the gate
 * renders on first launch, blocks the app until accepted, persists consent,
 * stays closed across reloads, opens read-only from About, and records the
 * reject request.
 *
 * Tier B (real preload, `E2E_REAL=1` only): rejecting through the real IPC
 * bridge terminates the app. The same file also serves accept-gate coverage for
 * the real preload path (used by real-convert.spec.ts).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Page } from 'playwright';
import { launchApp, closeApp, AppSession } from '../fixtures/app';
import { mockApi } from '../mocks/control';
import { TERMS_ACCEPTED_STORAGE_KEY } from '../../src/shared/constants';
import { TERMS_VERSION } from '../../src/shared/terms';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;
const IS_REAL = process.env.E2E_REAL === '1';

describe.runIf(IS_E2E)('Terms and Conditions gate (Tier A)', () => {
  let session: AppSession;

  beforeAll(async () => {
    session = await launchApp({ mock: true, terms: 'show' });
    await mockApi.reset(session.page);
  }, 60000);

  afterAll(async () => {
    await closeApp(session.app, session.userDataDir);
  });

  async function waitForGate(page: Page, timeout = 15000): Promise<void> {
    await page.locator('[data-testid="terms-dialog"]').waitFor({ timeout });
  }

  it('shows the blocking gate on first run with Accept and Reject actions', async () => {
    const { page } = session;
    await waitForGate(page);
    await expect.poll(() => page.locator('[data-testid="terms-accept"]').count()).toBe(1);
    await expect.poll(() => page.locator('[data-testid="terms-reject"]').count()).toBe(1);
    await expect.poll(() => page.locator('[data-testid="terms-close"]').count()).toBe(0);
  });

  it('does not dismiss the gate via Escape', async () => {
    const { page } = session;
    await waitForGate(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    expect(await page.locator('[data-testid="terms-dialog"]').count()).toBe(1);
  });

  it('keeps the application inert behind the gate until accepted', async () => {
    const { page } = session;
    await waitForGate(page);
    const nav = page.locator('[data-testid="nav-item-convert"]');
    await nav.waitFor({ timeout: 5000 });
    await expect.poll(() => nav.count()).toBe(1);
    await nav.click({ timeout: 1500 }).catch(() => {});
    const hash = await page.evaluate(() => location.hash);
    expect(hash).not.toContain('#/convert');
  });

  it('accepts the terms, persists consent, and unlocks the app', async () => {
    const { page } = session;
    await waitForGate(page);
    await page.locator('[data-testid="terms-accept"]').click();
    await page.locator('[data-testid="terms-dialog"]').waitFor({ state: 'hidden', timeout: 10000 });

    const stored = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? 'null') as { version: string; acceptedAt: string } | null,
      TERMS_ACCEPTED_STORAGE_KEY,
    );
    expect(stored?.version).toBe(TERMS_VERSION);
    expect(typeof stored?.acceptedAt).toBe('string');

    await page.locator('[data-testid="nav-item-convert"]').click();
    await page.waitForFunction(() => location.hash.startsWith('#/convert'));
  });

  it('does not re-show the gate after a reload once accepted', async () => {
    const { page } = session;
    await page.reload();
    await page.locator('[data-testid="nav-item-dashboard"]').waitFor({ timeout: 15000 });
    expect(await page.locator('[data-testid="terms-dialog"]').count()).toBe(0);
  });

  it('opens the read-only Terms viewer from the About page', async () => {
    const { page } = session;
    await page.locator('[data-testid="nav-item-about"]').click();
    await page.waitForFunction(() => location.hash.startsWith('#/about'));
    await page.locator('[data-testid="about-read-terms"]').click();
    await waitForGate(page);

    expect(await page.locator('[data-testid="terms-close"]').count()).toBe(1);
    expect(await page.locator('[data-testid="terms-accept"]').count()).toBe(0);
    expect(await page.locator('[data-testid="terms-reject"]').count()).toBe(0);

    await page.locator('[data-testid="terms-close"]').click();
    await page.locator('[data-testid="terms-dialog"]').waitFor({ state: 'hidden', timeout: 10000 });
  });

  it('rejecting requests the app to quit', async () => {
    const { page } = session;
    // Clear consent so the gate re-appears; the mock preload is in 'show' mode
    // so it will not re-seed on reload.
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForGate(page);

    await page.locator('[data-testid="terms-reject"]').click();
    await expect.poll(() => mockApi.get(page).then((s) => s.termsRejectCalls), { timeout: 5000 }).toBeGreaterThan(0);
    // The mock records the request instead of quitting; the gate stays up.
    expect(await page.locator('[data-testid="terms-dialog"]').count()).toBe(1);
  });
});

describe.runIf(IS_REAL)('Terms gate reject quits the app (Tier B)', () => {
  let session: AppSession;

  beforeAll(async () => {
    session = await launchApp({ mock: false });
  }, 120000);

  afterAll(async () => {
    await closeApp(session.app, session.userDataDir);
  });

  it('quits the app when the user rejects the terms', async () => {
    const { page, app } = session;
    await page.locator('[data-testid="terms-dialog"]').waitFor({ timeout: 30000 });
    await page.locator('[data-testid="terms-reject"]').click();

    const isGone = () => {
      const child = app.process();
      if (child.exitCode !== null) return true;
      try {
        return app.windows().length === 0;
      } catch {
        return true;
      }
    };
    await expect.poll(isGone, { timeout: 15000 }).toBe(true);
  }, 60000);
});
