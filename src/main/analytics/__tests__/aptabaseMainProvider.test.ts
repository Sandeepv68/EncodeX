/**
 * @fileoverview Unit tests for the main-process Aptabase adapter.
 * `@aptabase/electron/main` is replaced with spies so the adapter's lazy SDK
 * loading, app-key guarding, host forwarding, group gating, consent
 * transitions, and inflight-flush semantics can be verified without a real
 * backend.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AptabaseMainProvider, ANALYTICS_GROUPS_ENV_VAR } from '../aptabaseMainProvider';
import { createAnalyticsEvent } from '../../../shared/analytics/events';
import type { AnalyticsConfig } from '../../../shared/analytics/types';

const aptabaseMainMock = vi.hoisted(() => ({
  initialize: vi.fn(async () => undefined),
  trackEvent: vi.fn(async () => undefined),
}));

const electronMock = vi.hoisted(() => ({
  protocol: { isProtocolHandled: vi.fn(() => true) },
}));

vi.mock('@aptabase/electron/main', () => aptabaseMainMock);
vi.mock('electron', () => electronMock);

const baseConfig = (overrides: Partial<AnalyticsConfig> = {}): AnalyticsConfig => ({
  enabled: true,
  appKey: 'A-DEV-0000000000',
  environment: 'test',
  ...overrides,
});

describe('AptabaseMainProvider', () => {
  const ORIGINAL_APP_KEY = process.env.APTABASE_APP_KEY;
  const ORIGINAL_GROUPS = process.env[ANALYTICS_GROUPS_ENV_VAR];

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.APTABASE_APP_KEY;
    delete process.env[ANALYTICS_GROUPS_ENV_VAR];
  });

  afterEach(() => {
    if (ORIGINAL_APP_KEY === undefined) {
      delete process.env.APTABASE_APP_KEY;
    } else {
      process.env.APTABASE_APP_KEY = ORIGINAL_APP_KEY;
    }
    if (ORIGINAL_GROUPS === undefined) {
      delete process.env[ANALYTICS_GROUPS_ENV_VAR];
    } else {
      process.env[ANALYTICS_GROUPS_ENV_VAR] = ORIGINAL_GROUPS;
    }
    vi.clearAllMocks();
  });

  it('stays inactive when no app key is available', async () => {
    const provider = new AptabaseMainProvider();
    await provider.init(baseConfig({ appKey: undefined }));
    expect(provider.isEnabled()).toBe(false);
    expect(aptabaseMainMock.initialize).not.toHaveBeenCalled();
  });

  it('stays inactive when consent is off', async () => {
    const provider = new AptabaseMainProvider();
    await provider.init(baseConfig({ enabled: false }));
    expect(provider.isEnabled()).toBe(false);
    expect(aptabaseMainMock.initialize).not.toHaveBeenCalled();
  });

  it('initializes the SDK with the app key and activates tracking', async () => {
    const provider = new AptabaseMainProvider();
    await provider.init(baseConfig());
    expect(provider.isEnabled()).toBe(true);
    expect(aptabaseMainMock.initialize).toHaveBeenCalledTimes(1);
    expect(aptabaseMainMock.initialize).toHaveBeenCalledWith('A-DEV-0000000000', undefined);
  });

  it('forwards the host option when configured (self-hosted keys)', async () => {
    const provider = new AptabaseMainProvider();
    await provider.init(baseConfig({ host: 'https://analytics.internal' }));
    expect(aptabaseMainMock.initialize).toHaveBeenCalledWith('A-DEV-0000000000', {
      host: 'https://analytics.internal',
    });
  });

  it('reads the app key from the environment as a fallback', async () => {
    process.env.APTABASE_APP_KEY = 'A-EU-ENVKEY';
    const provider = new AptabaseMainProvider();
    await provider.init(baseConfig({ appKey: undefined }));
    expect(provider.isEnabled()).toBe(true);
    expect(aptabaseMainMock.initialize).toHaveBeenCalledWith('A-EU-ENVKEY', undefined);
  });

  it('survives SDK init failure and stays inactive', async () => {
    aptabaseMainMock.initialize.mockRejectedValueOnce(new Error('init boom'));
    const provider = new AptabaseMainProvider();
    await provider.init(baseConfig());
    expect(provider.isEnabled()).toBe(false);
  });

  it('stays inactive when the SDK self-disables without registering the transport', async () => {
    electronMock.protocol.isProtocolHandled.mockReturnValueOnce(false);
    const provider = new AptabaseMainProvider();
    await provider.init(baseConfig());
    expect(aptabaseMainMock.initialize).toHaveBeenCalledTimes(1);
    expect(electronMock.protocol.isProtocolHandled).toHaveBeenCalledWith('aptabase-ipc');
    expect(provider.isEnabled()).toBe(false);
  });

  it('delegates typed events to the SDK with sanitized props', async () => {
    const provider = new AptabaseMainProvider();
    await provider.init(baseConfig());
    provider.track(createAnalyticsEvent('hwaccel_toggled', { enabled: true }));
    provider.track(createAnalyticsEvent('app_launched', { version: '1.0.0', arch: 'x64', platform: 'win32' }));
    expect(aptabaseMainMock.trackEvent).toHaveBeenCalledTimes(2);
    expect(aptabaseMainMock.trackEvent).toHaveBeenCalledWith('hwaccel_toggled', { enabled: true });
    expect(aptabaseMainMock.trackEvent).toHaveBeenCalledWith('app_launched', {
      version: '1.0.0',
      arch: 'x64',
      platform: 'win32',
    });
  });

  it('drops empty strings and non-serializable props', async () => {
    const provider = new AptabaseMainProvider();
    await provider.init(baseConfig());
    aptabaseMainMock.trackEvent.mockClear();
    const event = createAnalyticsEvent('app_launched', { version: '1', arch: 'x64', platform: 'win32' });
    // Simulate a payload carrying non-categorical extra fields by feeding a raw object.
    provider.track({
      ...event,
      props: { ...event.props, emptyString: '' } as event['props'],
    });
    expect(aptabaseMainMock.trackEvent).toHaveBeenCalledWith('app_launched', { version: '1', arch: 'x64', platform: 'win32' });
  });

  it('tracks nothing before init', () => {
    const provider = new AptabaseMainProvider();
    provider.track(createAnalyticsEvent('app_launched', { version: '1', arch: 'x64', platform: 'win32' }));
    expect(aptabaseMainMock.trackEvent).not.toHaveBeenCalled();
  });

  it('respects the ANALYTICS_GROUPS emission gate when set', async () => {
    process.env[ANALYTICS_GROUPS_ENV_VAR] = 'settings';
    const provider = new AptabaseMainProvider();
    await provider.init(baseConfig());
    provider.track(createAnalyticsEvent('hwaccel_toggled', { enabled: true }));
    expect(aptabaseMainMock.trackEvent).toHaveBeenCalledTimes(1);

    aptabaseMainMock.trackEvent.mockClear();
    const gated = new AptabaseMainProvider();
    process.env[ANALYTICS_GROUPS_ENV_VAR] = 'lifecycle';
    await gated.init(baseConfig());
    gated.track(createAnalyticsEvent('hwaccel_toggled', { enabled: true }));
    expect(aptabaseMainMock.trackEvent).not.toHaveBeenCalled();
  });

  it('setEnabled(false) stops tracking; true re-enables', async () => {
    const provider = new AptabaseMainProvider();
    await provider.init(baseConfig());
    expect(provider.isEnabled()).toBe(true);

    provider.setEnabled(false);
    expect(provider.isEnabled()).toBe(false);
    provider.track(createAnalyticsEvent('app_launched', { version: '1', arch: 'x64', platform: 'win32' }));
    expect(aptabaseMainMock.trackEvent).not.toHaveBeenCalled();

    provider.setEnabled(true);
    expect(provider.isEnabled()).toBe(true);
  });

  it('flush returns true when nothing is in flight', async () => {
    const provider = new AptabaseMainProvider();
    expect(await provider.flush()).toBe(true);
  });

  it('close drains in-flight requests and deactivates', async () => {
    const provider = new AptabaseMainProvider();
    await provider.init(baseConfig());
    const result = await provider.close();
    expect(result).toBe(true);
    expect(provider.isEnabled()).toBe(false);
  });
});
