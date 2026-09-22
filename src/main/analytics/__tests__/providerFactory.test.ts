/**
 * @fileoverview Unit tests for the main-process analytics provider factory.
 * Adapters are mocked so selection logic (env var precedence, app-key
 * auto-detection, invalid providers, case-insensitivity) can be verified in
 * isolation.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

const aptabaseMainProviderMock = vi.hoisted(() => ({ AptabaseMainProvider: vi.fn() }));
const noopProviderMock = vi.hoisted(() => ({ NoopProvider: vi.fn() }));

vi.mock('../aptabaseMainProvider', () => aptabaseMainProviderMock);
vi.mock('../../../shared/analytics/noopProvider', () => noopProviderMock);

const { resolveMainAnalyticsProvider, ANALYTICS_PROVIDER_ENV_VAR, APTABASE_APP_KEY_ENV_VAR } = await import('../providerFactory');
import type { AnalyticsConfig } from '../../../shared/analytics/types';

const baseConfig = (overrides: Partial<AnalyticsConfig> = {}): AnalyticsConfig => ({
  enabled: true,
  ...overrides,
});

describe('resolveMainAnalyticsProvider', () => {
  const ORIGINAL_PROVIDER = process.env[ANALYTICS_PROVIDER_ENV_VAR];
  const ORIGINAL_APP_KEY = process.env[APTABASE_APP_KEY_ENV_VAR];

  afterEach(() => {
    if (ORIGINAL_PROVIDER === undefined) {
      delete process.env[ANALYTICS_PROVIDER_ENV_VAR];
    } else {
      process.env[ANALYTICS_PROVIDER_ENV_VAR] = ORIGINAL_PROVIDER;
    }
    if (ORIGINAL_APP_KEY === undefined) {
      delete process.env[APTABASE_APP_KEY_ENV_VAR];
    } else {
      process.env[APTABASE_APP_KEY_ENV_VAR] = ORIGINAL_APP_KEY;
    }
    vi.clearAllMocks();
  });

  it('returns null when nothing is configured', () => {
    expect(resolveMainAnalyticsProvider(baseConfig())).toBeNull();
  });

  it('returns NoopProvider when env var is "noop"', () => {
    process.env[ANALYTICS_PROVIDER_ENV_VAR] = 'noop';
    noopProviderMock.NoopProvider.mockClear();
    const result = resolveMainAnalyticsProvider(baseConfig());
    expect(result).toBeInstanceOf(noopProviderMock.NoopProvider);
    expect(noopProviderMock.NoopProvider).toHaveBeenCalledWith(true);
  });

  it('returns AptabaseMainProvider when provider is "aptabase" and an app key is present', () => {
    aptabaseMainProviderMock.AptabaseMainProvider.mockClear();
    const result = resolveMainAnalyticsProvider(baseConfig({ provider: 'aptabase', appKey: 'A-US-key' }));
    expect(result).toBeInstanceOf(aptabaseMainProviderMock.AptabaseMainProvider);
  });

  it('auto-detects aptabase when provider is empty but an app key is in config', () => {
    aptabaseMainProviderMock.AptabaseMainProvider.mockClear();
    const result = resolveMainAnalyticsProvider(baseConfig({ appKey: 'A-US-key' }));
    expect(result).toBeInstanceOf(aptabaseMainProviderMock.AptabaseMainProvider);
  });

  it('auto-detects aptabase when provider is empty but the app key env var is set', () => {
    process.env[APTABASE_APP_KEY_ENV_VAR] = 'A-EU-key';
    aptabaseMainProviderMock.AptabaseMainProvider.mockClear();
    const result = resolveMainAnalyticsProvider(baseConfig());
    expect(result).toBeInstanceOf(aptabaseMainProviderMock.AptabaseMainProvider);
  });

  it('returns null when provider is aptabase but no app key is available', () => {
    const result = resolveMainAnalyticsProvider(baseConfig({ provider: 'aptabase' }));
    expect(result).toBeNull();
  });

  it('returns null for an unrecognized provider string', () => {
    const result = resolveMainAnalyticsProvider(baseConfig({ provider: 'posthog', appKey: 'phc_xyz' }));
    expect(result).toBeNull();
  });

  it('is case-insensitive on provider strings', () => {
    process.env[ANALYTICS_PROVIDER_ENV_VAR] = 'NOOP';
    noopProviderMock.NoopProvider.mockClear();
    const result = resolveMainAnalyticsProvider(baseConfig());
    expect(result).toBeInstanceOf(noopProviderMock.NoopProvider);
  });
});
