import { afterEach, describe, expect, it, vi } from 'vitest';

describe('feature flags', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.resetModules();
  });

  it('has defaults for all flags', async () => {
    const { FEATURE_FLAGS, FEATURE_FLAG_DEFAULTS } = await import('../flags');
    for (const flag of FEATURE_FLAGS) {
      expect(FEATURE_FLAG_DEFAULTS[flag.name]).toBe(flag.defaultValue);
    }
  });

  it('enables automations_page by default in development', async () => {
    process.env.NODE_ENV = 'development';
    vi.resetModules();
    const { FEATURE_FLAG_DEFAULTS } = await import('../flags');
    expect(FEATURE_FLAG_DEFAULTS.automations_page).toBe(true);
  });

  it('disables automations_page by default in production', async () => {
    process.env.NODE_ENV = 'production';
    vi.resetModules();
    const { FEATURE_FLAG_DEFAULTS } = await import('../flags');
    expect(FEATURE_FLAG_DEFAULTS.automations_page).toBe(false);
  });

  it('flag names are unique', async () => {
    const { FEATURE_FLAGS } = await import('../flags');
    const names = FEATURE_FLAGS.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
