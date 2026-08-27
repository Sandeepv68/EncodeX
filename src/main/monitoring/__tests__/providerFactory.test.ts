import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sentryMainProviderMock = vi.hoisted(() => ({ SentryMainProvider: vi.fn() }));
const noopProviderMock = vi.hoisted(() => ({ NoopProvider: vi.fn() }));

vi.mock('../sentryMainProvider', () => sentryMainProviderMock);
vi.mock('../../../shared/monitoring/noopProvider', () => noopProviderMock);

const { resolveMainMonitorProvider, MONITORING_PROVIDER_ENV_VAR } = await import('../providerFactory');
import type { MonitoringConfig } from '../../../shared/monitoring/types';

const baseConfig = (overrides: Partial<MonitoringConfig> = {}): MonitoringConfig => ({
  enabled: true,
  ...overrides,
});

describe('resolveMainMonitorProvider', () => {
  const ORIGINAL_ENV = process.env[MONITORING_PROVIDER_ENV_VAR];

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env[MONITORING_PROVIDER_ENV_VAR];
    } else {
      process.env[MONITORING_PROVIDER_ENV_VAR] = ORIGINAL_ENV;
    }
    delete process.env.SENTRY_DSN;
    vi.clearAllMocks();
  });

  it('returns null when no provider or DSN is configured', () => {
    expect(resolveMainMonitorProvider(baseConfig())).toBeNull();
  });

  it('returns NoopProvider when env var is "noop"', () => {
    process.env[MONITORING_PROVIDER_ENV_VAR] = 'noop';
    noopProviderMock.NoopProvider.mockClear();
    const result = resolveMainMonitorProvider(baseConfig());
    expect(result).toBeInstanceOf(noopProviderMock.NoopProvider);
    expect(noopProviderMock.NoopProvider).toHaveBeenCalledWith(true);
  });

  it('returns SentryMainProvider when provider is "sentry" and DSN is present', () => {
    sentryMainProviderMock.SentryMainProvider.mockClear();
    const result = resolveMainMonitorProvider(baseConfig({ provider: 'sentry', dsn: 'https://pub@sentry.io/1' }));
    expect(result).toBeInstanceOf(sentryMainProviderMock.SentryMainProvider);
  });

  it('returns SentryMainProvider when provider is empty but DSN is in config', () => {
    sentryMainProviderMock.SentryMainProvider.mockClear();
    const result = resolveMainMonitorProvider(baseConfig({ dsn: 'https://pub@sentry.io/1' }));
    expect(result).toBeInstanceOf(sentryMainProviderMock.SentryMainProvider);
  });

  it('returns SentryMainProvider when provider is empty but SENTRY_DSN env is set', () => {
    process.env.SENTRY_DSN = 'https://pub@sentry.io/env';
    sentryMainProviderMock.SentryMainProvider.mockClear();
    const result = resolveMainMonitorProvider(baseConfig());
    expect(result).toBeInstanceOf(sentryMainProviderMock.SentryMainProvider);
  });

  it('returns null when provider is sentry but no DSN is available', () => {
    const result = resolveMainMonitorProvider(baseConfig({ provider: 'sentry' }));
    expect(result).toBeNull();
  });

  it('returns null for an unrecognized provider string', () => {
    const result = resolveMainMonitorProvider(baseConfig({ provider: 'datadog' }));
    expect(result).toBeNull();
  });

  it('is case-insensitive on provider strings', () => {
    noopProviderMock.NoopProvider.mockClear();
    process.env[MONITORING_PROVIDER_ENV_VAR] = 'NOOP';
    const result = resolveMainMonitorProvider(baseConfig());
    expect(result).toBeInstanceOf(noopProviderMock.NoopProvider);
  });
});
