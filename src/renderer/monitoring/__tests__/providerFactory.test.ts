import { describe, it, expect, vi, beforeEach } from 'vitest';

const sentryRendererProviderMock = vi.hoisted(() => ({ SentryRendererProvider: vi.fn() }));

vi.mock('../sentryRendererProvider', () => sentryRendererProviderMock);

const { resolveRendererMonitorProvider } = await import('../providerFactory');
import type { MonitoringConfig } from '../../../shared/monitoring/types';

const baseConfig = (overrides: Partial<MonitoringConfig> = {}): MonitoringConfig => ({
  enabled: true,
  ...overrides,
});

describe('resolveRendererMonitorProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns SentryRendererProvider when provider is "sentry"', () => {
    sentryRendererProviderMock.SentryRendererProvider.mockClear();
    const result = resolveRendererMonitorProvider(baseConfig({ provider: 'sentry' }));
    expect(result).toBeInstanceOf(sentryRendererProviderMock.SentryRendererProvider);
  });

  it('returns null when provider is empty', () => {
    const result = resolveRendererMonitorProvider(baseConfig());
    expect(result).toBeNull();
  });

  it('returns null for an unrecognized provider', () => {
    const result = resolveRendererMonitorProvider(baseConfig({ provider: 'datadog' }));
    expect(result).toBeNull();
  });

  it('is case-insensitive', () => {
    sentryRendererProviderMock.SentryRendererProvider.mockClear();
    const result = resolveRendererMonitorProvider(baseConfig({ provider: 'SENTRY' }));
    expect(result).toBeInstanceOf(sentryRendererProviderMock.SentryRendererProvider);
  });
});
