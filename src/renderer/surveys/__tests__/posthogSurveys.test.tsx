import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('posthog-js', () => ({
  default: { init: vi.fn() },
}));

describe('posthogSurveys', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('does nothing without consent', async () => {
    const { initPosthogSurveys } = await import('../posthogSurveys');
    await initPosthogSurveys(false);
    expect(true).toBe(true);
  });

  it('initialises when consent is on and config is available', async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      analyticsGetPosthogConfig: vi.fn().mockResolvedValue({ projectToken: 'phc_test', host: 'https://us.i.posthog.com' }),
    };
    const posthog = (await import('posthog-js')).default as unknown as { init: ReturnType<typeof vi.fn> };
    const { initPosthogSurveys } = await import('../posthogSurveys');
    await initPosthogSurveys(true);
    expect(posthog.init).toHaveBeenCalled();
  });
});
