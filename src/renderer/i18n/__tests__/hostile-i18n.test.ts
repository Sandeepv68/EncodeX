/**
 * @fileoverview Phase 5.1 - i18n resilience under hostile localStorage.
 *
 * The renderer loads `i18n` at module import time (`src/renderer/i18n/config.ts`).
 * Phase 4.4 already fixed a module-scope `localStorage.getItem` throw by routing
 * through `loadString` (which guards against thrown getters). This suite goes
 * further: hostile localStorage values must not prevent boot or leave an unhandled
 * rejection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const DEFAULT_LANGUAGE = 'en-US';

function resetI18nModules() {
  vi.resetModules();
}

describe('i18next initialization - hostile environment', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('importing i18n does not throw when localStorage.getItem throws at boot', async () => {
    const getItem = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('quota exceeded at boot');
    });
    let err = '';
    try {
      await import('../config');
    } catch (e: any) {
      err = e?.message ?? String(e);
    }
    expect(err).toBe('');
    getItem.mockRestore();
  });

  it('falls back to default when saved language is corrupted', async () => {
    resetI18nModules();
    localStorage.setItem('encodex.language', '\u0000' as unknown as string);
    const mod = await import('../config');
    expect(mod.default.language).toBe(DEFAULT_LANGUAGE);
  });

  it('falls back to navigator.language if saved language is empty string', async () => {
    resetI18nModules();
    localStorage.setItem('encodex.language', '');
    const mod = await import('../config');
    expect(typeof mod.default.language).toBe('string');
    expect(mod.default.language.length).toBeGreaterThan(0);
  });

  it('navigator.language missing does not prevent import', async () => {
    resetI18nModules();
    const nav = Object.getOwnPropertyDescriptor(window.navigator, 'language');
    Object.defineProperty(window.navigator, 'language', { value: undefined, configurable: true });
    try {
      const mod = await import('../config');
      expect(mod.default.language).toBe(DEFAULT_LANGUAGE);
    } finally {
      if (nav) Object.defineProperty(window.navigator, 'language', nav);
      else delete (window.navigator as any).language;
    }
  });
});
