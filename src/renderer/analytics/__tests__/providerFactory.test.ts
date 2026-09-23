/**
 * @fileoverview Unit tests for the renderer analytics provider factory.
 * The renderer simply mirrors whichever backend name main reported via
 * `analyticsGetState()`; adapters are mocked so the branch logic can be
 * verified in isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const aptabaseRendererProviderMock = vi.hoisted(() => ({ AptabaseRendererProvider: vi.fn() }));

vi.mock('../aptabaseRendererProvider', () => aptabaseRendererProviderMock);

const { resolveRendererAnalyticsProvider } = await import('../providerFactory');
import type { AnalyticsConfig } from '../../../shared/analytics/types';

const baseConfig = (overrides: Partial<AnalyticsConfig> = {}): AnalyticsConfig => ({
  enabled: true,
  ...overrides,
});

describe('resolveRendererAnalyticsProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns AptabaseRendererProvider when provider is "aptabase"', () => {
    aptabaseRendererProviderMock.AptabaseRendererProvider.mockClear();
    const result = resolveRendererAnalyticsProvider(baseConfig({ provider: 'aptabase' }));
    expect(result).toBeInstanceOf(aptabaseRendererProviderMock.AptabaseRendererProvider);
  });

  it('returns null when provider is empty', () => {
    const result = resolveRendererAnalyticsProvider(baseConfig());
    expect(result).toBeNull();
  });

  it('returns null for an unrecognized provider', () => {
    const result = resolveRendererAnalyticsProvider(baseConfig({ provider: 'posthog' }));
    expect(result).toBeNull();
  });

  it('is case-insensitive', () => {
    aptabaseRendererProviderMock.AptabaseRendererProvider.mockClear();
    const result = resolveRendererAnalyticsProvider(baseConfig({ provider: 'APTABASE' }));
    expect(result).toBeInstanceOf(aptabaseRendererProviderMock.AptabaseRendererProvider);
  });
});
