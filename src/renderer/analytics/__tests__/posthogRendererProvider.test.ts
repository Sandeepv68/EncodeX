/**
 * @fileoverview Unit tests for the renderer PostHog adapter. Verifies that
 * events are relayed over IPC (never sent directly) and that the adapter
 * respects consent and sanitizes props.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { PostHogRendererProvider } = await import('../posthogRendererProvider');
import { createAnalyticsEvent } from '../../../shared/analytics/events';

const relay = vi.fn().mockResolvedValue(undefined);

describe('PostHogRendererProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    relay.mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { electronAPI: { analyticsTrackEvent: relay } },
    });
  });

  it('does not activate when consent is off', async () => {
    const provider = new PostHogRendererProvider();
    await provider.init({ enabled: false });
    expect(provider.isEnabled()).toBe(false);
  });

  it('relays sanitized events over IPC', async () => {
    const provider = new PostHogRendererProvider();
    await provider.init({ enabled: true });
    provider.track(
      createAnalyticsEvent('tool_opened', {
        route: '/convert',
        empty: '',
        nested: { path: '/secret' },
      } as never),
    );

    expect(relay).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'tool_opened',
        props: { route: '/convert' },
      }),
    );
  });

  it('drops events after setEnabled(false)', async () => {
    const provider = new PostHogRendererProvider();
    await provider.init({ enabled: true });
    provider.setEnabled(false);
    provider.track(createAnalyticsEvent('tool_opened', { route: '/convert' }));
    expect(relay).not.toHaveBeenCalled();
  });
});
