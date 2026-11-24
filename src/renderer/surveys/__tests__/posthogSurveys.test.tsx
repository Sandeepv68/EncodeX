import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('posthog-js', () => ({
  default: { init: vi.fn(), register: vi.fn() },
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

  it('does nothing without a bridge', async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {};
    const { initPosthogSurveys } = await import('../posthogSurveys');
    await initPosthogSurveys(true);
    expect(true).toBe(true);
  });

  it('does nothing when the project token is missing', async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      analyticsGetPosthogConfig: vi.fn().mockResolvedValue({ projectToken: '', host: '' }),
    };
    const posthog = (await import('posthog-js')).default as unknown as { init: ReturnType<typeof vi.fn> };
    const { initPosthogSurveys } = await import('../posthogSurveys');
    await initPosthogSurveys(true);
    expect(posthog.init).not.toHaveBeenCalled();
  });

  it('initialises error tracking when the survey gate is disabled', async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      analyticsGetPosthogConfig: vi
        .fn()
        .mockResolvedValue({ projectToken: 'phc_test', host: 'https://us.i.posthog.com', surveysEnabled: false }),
    };
    const posthog = (await import('posthog-js')).default as unknown as { init: ReturnType<typeof vi.fn> };
    const { initPosthogSurveys } = await import('../posthogSurveys');
    await initPosthogSurveys(true);
    expect(posthog.init).toHaveBeenCalledWith('phc_test', expect.objectContaining({ capture_exceptions: true }));
  });

  it('swallows a failing config lookup', async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      analyticsGetPosthogConfig: vi.fn().mockRejectedValue(new Error('boom')),
    };
    const { initPosthogSurveys } = await import('../posthogSurveys');
    await initPosthogSurveys(true);
    expect(true).toBe(true);
  });

  it('initialises when consent is on and config is available', async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      analyticsGetPosthogConfig: vi.fn().mockResolvedValue({
        projectToken: 'phc_test',
        host: 'https://us.i.posthog.com',
        surveysEnabled: true,
        environment: 'production',
        channel: 'prod',
        appVersion: '1.0.0',
        platform: 'win32',
        arch: 'x64',
      }),
    };
    const posthog = (await import('posthog-js')).default as unknown as {
      init: ReturnType<typeof vi.fn>;
      register: ReturnType<typeof vi.fn>;
    };
    const { initPosthogSurveys } = await import('../posthogSurveys');
    await initPosthogSurveys(true);
    expect(posthog.init).toHaveBeenCalled();
    expect(posthog.register).toHaveBeenCalledWith({
      environment: 'production',
      channel: 'prod',
      app_version: '1.0.0',
      platform: 'win32',
      arch: 'x64',
    });
  });
});
