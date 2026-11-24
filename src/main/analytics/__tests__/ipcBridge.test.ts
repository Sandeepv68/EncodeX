/**
 * @fileoverview Unit tests for the analytics IPC bridge.
 * Uses a captured-handler mock of `ipcMain.handle` to exercise the two
 * channels end-to-end: state reporting, consent persistence to disk, live
 * facade toggling, and coercion of non-boolean payloads to "off".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const handleSpy = vi.hoisted(() => vi.fn());
const appMock = vi.hoisted(() => ({ isPackaged: true }));

vi.mock('electron', () => ({
  app: appMock,
  ipcMain: { handle: handleSpy },
}));

const setEnabledMock = vi.hoisted(() => vi.fn());
const getBackendNameMock = vi.hoisted(() => vi.fn());
const getAllFeatureFlagsMock = vi.hoisted(() => vi.fn());
const trackRelayedMock = vi.hoisted(() => vi.fn());
const captureAnalyticsExceptionMock = vi.hoisted(() => vi.fn());

vi.mock('../../../shared/analytics/AnalyticsService', () => ({
  setAnalyticsEnabled: setEnabledMock,
  getAnalyticsBackendName: getBackendNameMock,
  getAllFeatureFlags: getAllFeatureFlagsMock,
  trackRelayedAnalyticsEvent: trackRelayedMock,
  captureAnalyticsException: captureAnalyticsExceptionMock,
}));

import { IPC } from '../../../shared/ipc-channels';
import { ANALYTICS_CONSENT_FILENAME } from '../consent';
import { registerAnalyticsIpcBridge } from '../ipcBridge';
import type { AnalyticsState } from '../../../shared/analytics/types';

describe('registerAnalyticsIpcBridge', () => {
  let dir: string;
  let handlers: Map<string, (...args: unknown[]) => unknown>;

  const readConsentFile = (): { enabled: boolean } | null =>
    JSON.parse(fs.readFileSync(path.join(dir, ANALYTICS_CONSENT_FILENAME), 'utf-8'));

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-analytics-ipcbridge-'));
    handlers = new Map();
    handleSpy.mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => handlers.set(channel, handler));
    setEnabledMock.mockResolvedValue(undefined);
    getBackendNameMock.mockReturnValue('aptabase');
    getAllFeatureFlagsMock.mockReturnValue({ automations_page: false });
    registerAnalyticsIpcBridge({ userDataDir: dir, consentEnabled: true });
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('registers exactly the five analytics channels', () => {
    expect([...handlers.keys()].sort()).toEqual(
      [
        IPC.ANALYTICS_GET_STATE,
        IPC.ANALYTICS_SET_ENABLED,
        IPC.ANALYTICS_TRACK_EVENT,
        IPC.ANALYTICS_CAPTURE_EXCEPTION,
        IPC.ANALYTICS_GET_POSTHOG_CONFIG,
      ].sort(),
    );
  });

  it('relays renderer events to the active backend', () => {
    const event = { schema: 2, name: 'tool_opened', props: { route: '/convert' } };
    handlers.get(IPC.ANALYTICS_TRACK_EVENT)!({}, event);
    expect(trackRelayedMock).toHaveBeenCalledWith(event);
  });

  it('relays renderer exceptions to the analytics facade', () => {
    handlers.get(IPC.ANALYTICS_CAPTURE_EXCEPTION)!(
      {},
      { name: 'TypeError', message: 'boom', stack: 'stack', context: { tags: { handler: 'window.error' } } },
    );
    expect(captureAnalyticsExceptionMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'TypeError', message: 'boom' }), {
      tags: { handler: 'window.error' },
    });
  });

  it('reports bootstrap consent and the active backend name', () => {
    const state = handlers.get(IPC.ANALYTICS_GET_STATE)!() as AnalyticsState;
    expect(state).toEqual({ enabled: true, backend: 'aptabase', featureFlags: { automations_page: false } });
  });

  it('forces automations off in packaged production builds even when the remote flag is on', () => {
    getAllFeatureFlagsMock.mockReturnValue({ automations_page: true });
    const state = handlers.get(IPC.ANALYTICS_GET_STATE)!() as AnalyticsState;
    expect(state.featureFlags).toMatchObject({ automations_page: false });
  });

  it('preserves the remote automations flag in unpackaged development builds', () => {
    getAllFeatureFlagsMock.mockReturnValue({ automations_page: true });
    appMock.isPackaged = false;
    try {
      const state = handlers.get(IPC.ANALYTICS_GET_STATE)!() as AnalyticsState;
      expect(state.featureFlags).toMatchObject({ automations_page: true });
    } finally {
      appMock.isPackaged = true;
    }
  });

  it('persists opt-out, toggles the facade, and reports the new state', async () => {
    const setter = handlers.get(IPC.ANALYTICS_SET_ENABLED)!;
    const state = (await setter({}, false)) as AnalyticsState;

    expect(readConsentFile()).toEqual({ enabled: false });
    expect(setEnabledMock).toHaveBeenCalledWith(false);
    expect(state).toEqual({ enabled: false, backend: 'aptabase', featureFlags: { automations_page: false } });
    expect(handlers.get(IPC.ANALYTICS_GET_STATE)!()).toEqual({
      enabled: false,
      backend: 'aptabase',
      featureFlags: { automations_page: false },
    });
  });

  it('round-trips back to enabled', async () => {
    const setter = handlers.get(IPC.ANALYTICS_SET_ENABLED)!;
    await setter({}, false);
    const state = (await setter({}, true)) as AnalyticsState;

    expect(readConsentFile()).toEqual({ enabled: true });
    expect(setEnabledMock).toHaveBeenLastCalledWith(true);
    expect(state.enabled).toBe(true);
  });

  it('coerces non-boolean truthiness to explicit boolean states', async () => {
    const setter = handlers.get(IPC.ANALYTICS_SET_ENABLED)!;
    await setter({}, 'yes');
    expect(readConsentFile()).toEqual({ enabled: false });
    expect(setEnabledMock).toHaveBeenLastCalledWith(false);

    await setter({}, true);
    expect(readConsentFile()).toEqual({ enabled: true });
    expect(setEnabledMock).toHaveBeenLastCalledWith(true);
  });

  it('reads PostHog config overrides and survey flags', () => {
    const originalSurveys = process.env.POSTHOG_SURVEYS_ENABLED;
    const originalToken = process.env.POSTHOG_PROJECT_TOKEN;
    const originalHost = process.env.POSTHOG_HOST;
    const originalNodeEnv = process.env.NODE_ENV;
    const originalAptabaseEnvironment = process.env.APTABASE_ENVIRONMENT;
    const readConfig = () =>
      handlers.get(IPC.ANALYTICS_GET_POSTHOG_CONFIG)!() as {
        projectToken?: string;
        host?: string;
        surveysEnabled?: boolean;
        environment?: string;
        channel?: string;
      };

    delete process.env.POSTHOG_SURVEYS_ENABLED;
    delete process.env.NODE_ENV;
    process.env.APTABASE_ENVIRONMENT = 'production';
    const fallback = readConfig();
    expect(fallback.surveysEnabled).toBe(false);
    expect(fallback.environment).toBe('production');
    expect(fallback.channel).toBe('prod');

    try {
      process.env.POSTHOG_PROJECT_TOKEN = 'runtime-token';
      process.env.POSTHOG_HOST = 'https://eu.i.posthog.com';
      process.env.POSTHOG_SURVEYS_ENABLED = ' TRUE ';
      process.env.NODE_ENV = 'development';
      process.env.APTABASE_ENVIRONMENT = 'development';
      const enabled = readConfig();
      expect(enabled.projectToken).toBe('runtime-token');
      expect(enabled.host).toBe('https://eu.i.posthog.com');
      expect(enabled.surveysEnabled).toBe(true);
      expect(enabled.environment).toBe('development');
      expect(enabled.channel).toBe('dev');

      process.env.POSTHOG_SURVEYS_ENABLED = '1';
      expect(readConfig().surveysEnabled).toBe(true);
      process.env.POSTHOG_SURVEYS_ENABLED = 'FALSE';
      expect(readConfig().surveysEnabled).toBe(false);
      process.env.POSTHOG_SURVEYS_ENABLED = '0';
      expect(readConfig().surveysEnabled).toBe(false);
      process.env.POSTHOG_SURVEYS_ENABLED = 'maybe';
      expect(readConfig().surveysEnabled).toBe(false);
    } finally {
      if (originalSurveys === undefined) delete process.env.POSTHOG_SURVEYS_ENABLED;
      else process.env.POSTHOG_SURVEYS_ENABLED = originalSurveys;
      if (originalToken === undefined) delete process.env.POSTHOG_PROJECT_TOKEN;
      else process.env.POSTHOG_PROJECT_TOKEN = originalToken;
      if (originalHost === undefined) delete process.env.POSTHOG_HOST;
      else process.env.POSTHOG_HOST = originalHost;
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
      if (originalAptabaseEnvironment === undefined) delete process.env.APTABASE_ENVIRONMENT;
      else process.env.APTABASE_ENVIRONMENT = originalAptabaseEnvironment;
    }
  });

  it('labels unpackaged runs as development even without NODE_ENV', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalAptabaseEnvironment = process.env.APTABASE_ENVIRONMENT;
    delete process.env.NODE_ENV;
    delete process.env.APTABASE_ENVIRONMENT;
    appMock.isPackaged = false;

    try {
      const config = handlers.get(IPC.ANALYTICS_GET_POSTHOG_CONFIG)!() as { environment?: string; channel?: string };
      expect(config.environment).toBe('development');
      expect(config.channel).toBe('dev');
    } finally {
      appMock.isPackaged = true;
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
      if (originalAptabaseEnvironment === undefined) delete process.env.APTABASE_ENVIRONMENT;
      else process.env.APTABASE_ENVIRONMENT = originalAptabaseEnvironment;
    }
  });
});
