import { describe, it, expect, vi, beforeEach } from 'vitest';

const sentryRendererMock = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(() => 'exception-id'),
  captureMessage: vi.fn(() => 'message-id'),
  captureFeedback: vi.fn(() => 'feedback-id'),
  setTag: vi.fn(),
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
  flush: vi.fn(async () => true),
  close: vi.fn(async () => true),
}));

vi.mock('@sentry/electron/renderer', () => sentryRendererMock);

import { SentryRendererProvider } from '../sentryRendererProvider';
import type { MonitoringConfig } from '../../../shared/monitoring/types';

const baseConfig = (overrides: Partial<MonitoringConfig> = {}): MonitoringConfig => ({
  enabled: true,
  dsn: 'https://public@sentry.example/42',
  environment: 'test',
  release: 'encodex@1.0.0',
  debug: false,
  tracesSampleRate: 1.0,
  ...overrides,
});

describe('SentryRendererProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts inactive and name is sentry', () => {
    const provider = new SentryRendererProvider();
    expect(provider.isEnabled()).toBe(false);
    expect(provider.name).toBe('sentry');
  });

  it('assembles init options and activates', async () => {
    const provider = new SentryRendererProvider();
    await provider.init(baseConfig({ tracesSampleRate: 0.5, debug: true }));

    expect(provider.isEnabled()).toBe(true);
    expect(sentryRendererMock.init).toHaveBeenCalledTimes(1);

    const options = sentryRendererMock.init.mock.calls[0][0] as Record<string, unknown>;
    expect(options.debug).toBe(true);
    expect(options.tracesSampleRate).toBe(0.5);
    expect(options.attachStacktrace).toBe(true);

    // GlobalHandlers should be filtered out by the integrations function
    const integrations = options.integrations as (defaults: Array<Record<string, unknown>>) => unknown[];
    const result = integrations([{ name: 'GlobalHandlers' }, { name: 'OtherIntegration' }]);
    expect(result).toEqual([{ name: 'OtherIntegration' }]);
  });

  it('defaults debug and tracesSampleRate', async () => {
    const provider = new SentryRendererProvider();
    await provider.init(baseConfig({ debug: undefined, tracesSampleRate: undefined }));

    const options = sentryRendererMock.init.mock.calls[0][0] as Record<string, unknown>;
    expect(options.debug).toBe(false);
    expect(options.tracesSampleRate).toBe(1.0);
  });

  it('sets active=false when init throws', async () => {
    sentryRendererMock.init.mockImplementationOnce(() => { throw new Error('SDK load failed'); });
    const provider = new SentryRendererProvider();
    await provider.init(baseConfig());
    expect(provider.isEnabled()).toBe(false);
  });

  it('returns undefined for all captures while inactive', () => {
    const provider = new SentryRendererProvider();
    expect(provider.captureException(new Error('x'))).toBeUndefined();
    expect(provider.captureMessage('m')).toBeUndefined();
    expect(provider.captureFeedback({ message: 'f' })).toBeUndefined();
    provider.setTag('k', 'v');
    provider.setUser(null);
    provider.addBreadcrumb({ message: 'b' });
  });

  it('delegates captures with mapped context after init', async () => {
    const provider = new SentryRendererProvider();
    await provider.init(baseConfig());

    const id = provider.captureException(new Error('boom'), {
      tags: { page: 'settings' },
      extra: { attempts: 2 },
      user: { id: 'u1', email: 'u@example.com' },
    });
    expect(id).toBe('exception-id');
    expect(sentryRendererMock.captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: { page: 'settings' },
      extra: { attempts: 2 },
      user: { id: 'u1', email: 'u@example.com' },
    });

    expect(provider.captureMessage('hello', 'info')).toBe('message-id');
    expect(sentryRendererMock.captureMessage).toHaveBeenCalledWith('hello', 'info', undefined);

    expect(provider.captureFeedback({ message: 'broken', name: 'Ann' })).toBe('feedback-id');
    expect(sentryRendererMock.captureFeedback).toHaveBeenCalledWith({ message: 'broken', name: 'Ann', email: undefined }, undefined);
  });

  it('defaults missing message level to error', async () => {
    const provider = new SentryRendererProvider();
    await provider.init(baseConfig());
    provider.captureMessage('no level');
    expect(sentryRendererMock.captureMessage).toHaveBeenCalledWith('no level', 'error', undefined);
  });

  it('maps scope mutations to the SDK', async () => {
    const provider = new SentryRendererProvider();
    await provider.init(baseConfig());

    provider.setTag('release-channel', 'beta');
    expect(sentryRendererMock.setTag).toHaveBeenCalledWith('release-channel', 'beta');

    provider.setUser({ id: 'u9' });
    expect(sentryRendererMock.setUser).toHaveBeenCalledWith({ id: 'u9' });

    provider.setUser(null);
    expect(sentryRendererMock.setUser).toHaveBeenLastCalledWith(null);

    provider.addBreadcrumb({ message: 'step', category: 'ui', level: 'info', data: { n: 1 } });
    expect(sentryRendererMock.addBreadcrumb).toHaveBeenCalledWith({
      message: 'step',
      category: 'ui',
      level: 'info',
      data: { n: 1 },
    });
  });

  it('setUser with empty user maps to null', async () => {
    const provider = new SentryRendererProvider();
    await provider.init(baseConfig());
    provider.setUser({});
    expect(sentryRendererMock.setUser).toHaveBeenLastCalledWith(null);
  });

  it('addBreadcrumb only includes defined fields', async () => {
    const provider = new SentryRendererProvider();
    await provider.init(baseConfig());
    provider.addBreadcrumb({});
    expect(sentryRendererMock.addBreadcrumb).toHaveBeenCalledWith({});
  });

  it('flushes with the given timeout while active', async () => {
    const provider = new SentryRendererProvider();
    await provider.init(baseConfig());
    await expect(provider.flush(1234)).resolves.toBe(true);
    expect(sentryRendererMock.flush).toHaveBeenCalledWith(1234);
  });

  it('flush returns true when inactive', async () => {
    const provider = new SentryRendererProvider();
    await expect(provider.flush()).resolves.toBe(true);
    expect(sentryRendererMock.flush).not.toHaveBeenCalled();
  });

  it('flush returns false when SDK throws', async () => {
    sentryRendererMock.flush.mockRejectedValueOnce(new Error('flush failed'));
    const provider = new SentryRendererProvider();
    await provider.init(baseConfig());
    await expect(provider.flush()).resolves.toBe(false);
  });

  it('setEnabled(false) closes the client; re-enable re-initializes', async () => {
    const provider = new SentryRendererProvider();
    const config = baseConfig();
    await provider.init(config);

    await provider.setEnabled(false);
    expect(sentryRendererMock.close).toHaveBeenCalledTimes(1);
    expect(provider.isEnabled()).toBe(false);

    await provider.setEnabled(false); // no-op
    expect(sentryRendererMock.close).toHaveBeenCalledTimes(1);

    await provider.setEnabled(true);
    expect(sentryRendererMock.init).toHaveBeenCalledTimes(2);
    expect(provider.isEnabled()).toBe(true);
  });

  it('setEnabled no-op when already at requested state', async () => {
    const provider = new SentryRendererProvider();
    await provider.setEnabled(false); // already inactive
    expect(sentryRendererMock.close).not.toHaveBeenCalled();
  });

  it('close returns true when sdk is null', async () => {
    const provider = new SentryRendererProvider();
    await expect(provider.close()).resolves.toBe(true);
  });

  it('close returns false when SDK throws', async () => {
    sentryRendererMock.close.mockRejectedValueOnce(new Error('close failed'));
    const provider = new SentryRendererProvider();
    await provider.init(baseConfig());
    await expect(provider.close()).resolves.toBe(false);
    expect(provider.isEnabled()).toBe(false);
  });

  it('close resets active and sdk', async () => {
    const provider = new SentryRendererProvider();
    await provider.init(baseConfig());
    expect(provider.isEnabled()).toBe(true);
    await provider.close();
    expect(provider.isEnabled()).toBe(false);
    // After close, captures should return undefined
    expect(provider.captureException(new Error('x'))).toBeUndefined();
  });

  it('captures throw internally and return undefined', async () => {
    sentryRendererMock.captureException.mockImplementationOnce(() => { throw new Error('broken'); });
    sentryRendererMock.captureMessage.mockImplementationOnce(() => { throw new Error('broken'); });
    sentryRendererMock.captureFeedback.mockImplementationOnce(() => { throw new Error('broken'); });
    sentryRendererMock.setTag.mockImplementationOnce(() => { throw new Error('broken'); });
    sentryRendererMock.setUser.mockImplementationOnce(() => { throw new Error('broken'); });
    sentryRendererMock.addBreadcrumb.mockImplementationOnce(() => { throw new Error('broken'); });

    const provider = new SentryRendererProvider();
    await provider.init(baseConfig());

    expect(provider.captureException(new Error('x'))).toBeUndefined();
    expect(provider.captureMessage('m')).toBeUndefined();
    expect(provider.captureFeedback({ message: 'f' })).toBeUndefined();
    // These don't throw, they log internally
    provider.setTag('k', 'v');
    provider.setUser({ id: 'u' });
    provider.addBreadcrumb({ message: 'b' });
  });
});
