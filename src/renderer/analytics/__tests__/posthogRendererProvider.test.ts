/**
 * @fileoverview Unit tests for the renderer PostHog adapter. Verifies that
 * events are relayed over IPC (never sent directly) and that the adapter
 * respects consent and sanitizes props.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { expectAppLog } from '../../../test-utils/crash-tripwire';

const { PostHogRendererProvider } = await import('../posthogRendererProvider');
import { createAnalyticsEvent } from '../../../shared/analytics/events';
import type { AnalyticsConfig } from '../../../shared/analytics/types';

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

  it('does nothing when no relay is available', async () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { electronAPI: {} },
    });
    const provider = new PostHogRendererProvider();
    await provider.init({ enabled: true });
    provider.track(createAnalyticsEvent('tool_opened', { route: '/convert' }));
    expect(relay).not.toHaveBeenCalled();
  });

  it('does nothing when window is undefined', async () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error
    delete globalThis.window;
    const provider = new PostHogRendererProvider();
    await provider.init({ enabled: true });
    provider.track(createAnalyticsEvent('tool_opened', { route: '/convert' }));
    expect(relay).not.toHaveBeenCalled();
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  });
  it('swallows relay rejections', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('boom'));
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { electronAPI: { analyticsTrackEvent: failing } },
    });
    const provider = new PostHogRendererProvider();
    await provider.init({ enabled: true });
    provider.track(createAnalyticsEvent('tool_opened', { route: '/convert' }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(failing).toHaveBeenCalled();
  });

  it('swallows a relay that throws synchronously', async () => {
    const throwing = vi.fn(() => {
      throw new Error('sync boom');
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { electronAPI: { analyticsTrackEvent: throwing } },
    });
    const provider = new PostHogRendererProvider();
    await provider.init({ enabled: true });
    provider.track(createAnalyticsEvent('tool_opened', { route: '/convert' }));
    expect(throwing).toHaveBeenCalled();
  });

  it('stays inactive when init throws', async () => {
    expectAppLog('error', 'renderer/analytics/posthogRendererProvider');
    const hostile = {
      get enabled(): boolean {
        throw new Error('init boom');
      },
    } as unknown as AnalyticsConfig;
    const provider = new PostHogRendererProvider();
    await provider.init(hostile);
    expect(provider.isEnabled()).toBe(false);
  });

  it('drops events after setEnabled(false)', async () => {
    const provider = new PostHogRendererProvider();
    await provider.init({ enabled: true });
    provider.setEnabled(false);
    provider.track(createAnalyticsEvent('tool_opened', { route: '/convert' }));
    expect(relay).not.toHaveBeenCalled();
  });
});
