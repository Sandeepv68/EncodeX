/**
 * @fileoverview Unit tests for the renderer Aptabase adapter.
 * `@aptabase/electron/renderer` is replaced with spies so the adapter's lazy
 * SDK loading, consent transitions, and prop sanitization can be verified
 * without a real backend or IPC round-trip.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AptabaseRendererProvider } from '../aptabaseRendererProvider';
import { createAnalyticsEvent } from '../../../shared/analytics/events';
import type { AnalyticsConfig } from '../../../shared/analytics/types';

const aptabaseRendererMock = vi.hoisted(() => ({
  trackEvent: vi.fn(async () => undefined),
}));

vi.mock('@aptabase/electron/renderer', () => aptabaseRendererMock);

const baseConfig = (overrides: Partial<AnalyticsConfig> = {}): AnalyticsConfig => ({
  enabled: true,
  ...overrides,
});

describe('AptabaseRendererProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stays inactive when consent is off', async () => {
    const provider = new AptabaseRendererProvider();
    await provider.init(baseConfig({ enabled: false }));
    expect(provider.isEnabled()).toBe(false);
  });

  it('activates after a successful init', async () => {
    const provider = new AptabaseRendererProvider();
    await provider.init(baseConfig());
    expect(provider.isEnabled()).toBe(true);
  });

  it('never throws when the SDK rejects a track (fire-and-forget)', async () => {
    aptabaseRendererMock.trackEvent.mockRejectedValueOnce(new Error('renderer sdk boom'));
    const provider = new AptabaseRendererProvider();
    await provider.init(baseConfig());
    expect(() => provider.track(createAnalyticsEvent('tool_opened', { route: '/convert' }))).not.toThrow();
  });

  it('delegates typed events to the renderer SDK', async () => {
    const provider = new AptabaseRendererProvider();
    await provider.init(baseConfig());
    provider.track(createAnalyticsEvent('tool_opened', { route: '/convert' }));
    expect(aptabaseRendererMock.trackEvent).toHaveBeenCalledTimes(1);
    expect(aptabaseRendererMock.trackEvent).toHaveBeenCalledWith('tool_opened', { route: '/convert' });
  });

  it('drops empty strings and non-serializable props', async () => {
    const provider = new AptabaseRendererProvider();
    await provider.init(baseConfig());
    provider.track(createAnalyticsEvent('tool_opened', { route: '/convert' }));
    aptabaseRendererMock.trackEvent.mockClear();
    const event = createAnalyticsEvent('tool_opened', { route: '/convert' });
    provider.track({
      ...event,
      props: { ...event.props, emptyString: '', object: { nested: 1 } } as typeof event.props,
    });
    expect(aptabaseRendererMock.trackEvent).toHaveBeenCalledWith('tool_opened', { route: '/convert' });
  });

  it('tracks nothing before init', () => {
    const provider = new AptabaseRendererProvider();
    provider.track(createAnalyticsEvent('tool_opened', { route: '/convert' }));
    expect(aptabaseRendererMock.trackEvent).not.toHaveBeenCalled();
  });

  it('setEnabled(false) stops tracking; true re-enables', async () => {
    const provider = new AptabaseRendererProvider();
    await provider.init(baseConfig());
    provider.setEnabled(false);
    expect(provider.isEnabled()).toBe(false);
    provider.track(createAnalyticsEvent('tool_opened', { route: '/convert' }));
    expect(aptabaseRendererMock.trackEvent).not.toHaveBeenCalled();

    provider.setEnabled(true);
    expect(provider.isEnabled()).toBe(true);
  });
});
