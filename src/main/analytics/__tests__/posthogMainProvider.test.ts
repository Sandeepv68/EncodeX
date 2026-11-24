/**
 * @fileoverview Unit tests for the main-process PostHog adapter.
 *
 * The PostHog client and the OpenTelemetry log SDK are mocked so init, gating,
 * sanitization, AI privacy defaults, group analytics, feature flags, release
 * tracking, and flush/close semantics can be verified without network access.
 * The mock is configurable per test so the adapter's defensive paths (a client
 * without `identify`, a failing flag lookup, a throwing SDK) are exercised too.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { expectAppLog } from '../../../test-utils/crash-tripwire';

/** Knobs that let a single test reshape the mocked SDK. */
const knobs = vi.hoisted(() => ({
  ctorThrows: false,
  omitIdentify: false,
  omitGroupIdentify: false,
  omitGetAllFlags: false,
  logSdkThrows: false,
  getPathThrows: false,
  userDataDir: '',
}));

const capture = vi.hoisted(() => vi.fn());
const captureException = vi.hoisted(() => vi.fn());
const flush = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const shutdown = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const identify = vi.hoisted(() => vi.fn());
const groupIdentify = vi.hoisted(() => vi.fn());
const getAllFlags = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const getFeatureFlag = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const register = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const posthogCtor = vi.hoisted(() =>
  vi.fn(function () {
    if (knobs.ctorThrows) throw new Error('ctor boom');
    const client: Record<string, unknown> = { capture, captureException, flush, shutdown, register };
    if (!knobs.omitIdentify) client.identify = identify;
    if (!knobs.omitGroupIdentify) client.groupIdentify = groupIdentify;
    if (!knobs.omitGetAllFlags) {
      client.getAllFlags = getAllFlags;
      client.getFeatureFlag = getFeatureFlag;
    }
    return client;
  }),
);
const logEmit = vi.hoisted(() => vi.fn());
const logSdkStart = vi.hoisted(() => vi.fn());
const logSdkShutdown = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('electron', () => ({
  app: {
    getPath: () => {
      if (knobs.getPathThrows) throw new Error('path boom');
      return knobs.userDataDir;
    },
  },
}));

vi.mock('posthog-node', () => ({ PostHog: posthogCtor }));
vi.mock('@opentelemetry/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@opentelemetry/api')>();
  return { ...actual, logs: { getLogger: () => ({ emit: logEmit }) } };
});
vi.mock('@opentelemetry/exporter-logs-otlp-http', () => ({ OTLPLogExporter: vi.fn() }));
vi.mock('@opentelemetry/resources', () => ({ resourceFromAttributes: vi.fn(() => ({})) }));
vi.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: vi.fn(function () {
    if (knobs.logSdkThrows) throw new Error('log sdk boom');
    return { start: logSdkStart, shutdown: logSdkShutdown };
  }),
}));
vi.mock('@opentelemetry/sdk-logs', () => ({ BatchLogRecordProcessor: vi.fn() }));

const { PostHogMainProvider } = await import('../posthogMainProvider');
import { createAnalyticsEvent } from '../../../shared/analytics/events';
import type { AnalyticsConfig } from '../../../shared/analytics/types';
import { logHub } from '../../logs/log-hub';

const baseConfig = (overrides: Partial<AnalyticsConfig> = {}): AnalyticsConfig => ({
  enabled: true,
  projectToken: 'phc_test',
  posthogHost: 'https://us.i.posthog.com',
  ...overrides,
});

describe('PostHogMainProvider', () => {
  const ORIGINAL_GROUPS = process.env.ANALYTICS_GROUPS;
  const ORIGINAL_CAPTURE = process.env.POSTHOG_AI_CAPTURE_CONTENT;

  beforeEach(() => {
    vi.clearAllMocks();
    knobs.ctorThrows = false;
    knobs.omitIdentify = false;
    knobs.omitGroupIdentify = false;
    knobs.omitGetAllFlags = false;
    knobs.logSdkThrows = false;
    knobs.getPathThrows = false;
    knobs.userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-posthog-'));
    capture.mockImplementation(() => undefined);
    captureException.mockImplementation(() => undefined);
    logEmit.mockImplementation(() => undefined);
    flush.mockResolvedValue(undefined);
    shutdown.mockResolvedValue(undefined);
    identify.mockImplementation(() => undefined);
    groupIdentify.mockImplementation(() => undefined);
    register.mockResolvedValue(undefined);
    getAllFlags.mockResolvedValue({});
    getFeatureFlag.mockResolvedValue(undefined);
    delete process.env.ANALYTICS_GROUPS;
    delete process.env.POSTHOG_AI_CAPTURE_CONTENT;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (ORIGINAL_GROUPS === undefined) delete process.env.ANALYTICS_GROUPS;
    else process.env.ANALYTICS_GROUPS = ORIGINAL_GROUPS;
    if (ORIGINAL_CAPTURE === undefined) delete process.env.POSTHOG_AI_CAPTURE_CONTENT;
    else process.env.POSTHOG_AI_CAPTURE_CONTENT = ORIGINAL_CAPTURE;
    fs.rmSync(knobs.userDataDir, { recursive: true, force: true });
  });

  it('does not construct a client when consent is off', async () => {
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig({ enabled: false }));
    expect(posthogCtor).not.toHaveBeenCalled();
    expect(provider.isEnabled()).toBe(false);
  });

  it('does not construct a client without a token or host', async () => {
    expectAppLog('warn', 'main/analytics/posthogMainProvider');
    const noToken = new PostHogMainProvider();
    await noToken.init(baseConfig({ projectToken: undefined, enabled: true }));
    expect(posthogCtor).not.toHaveBeenCalled();

    const noHost = new PostHogMainProvider();
    await noHost.init(baseConfig({ posthogHost: undefined, enabled: true }));
    expect(posthogCtor).not.toHaveBeenCalled();
  });

  it('does not construct a client when the host is not a URL', async () => {
    expectAppLog('warn', 'main/analytics/posthogMainProvider');
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig({ posthogHost: '709196' }));
    expect(posthogCtor).not.toHaveBeenCalled();
    expect(provider.isEnabled()).toBe(false);
  });

  it('constructs a privacy-first client with GeoIP enabled', async () => {
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    expect(posthogCtor).toHaveBeenCalledWith('phc_test', {
      host: 'https://us.i.posthog.com',
      privacyMode: true,
      enableExceptionAutocapture: true,
      disableGeoip: false,
    });
    expect(provider.isEnabled()).toBe(true);
  });

  it('stays inactive when the client constructor throws', async () => {
    expectAppLog('error', 'main/analytics/posthogMainProvider');
    knobs.ctorThrows = true;
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    expect(provider.isEnabled()).toBe(false);
  });

  it('keeps working when the OpenTelemetry log SDK fails to start', async () => {
    expectAppLog('warn', 'main/analytics/posthogMainProvider');
    knobs.logSdkThrows = true;
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    expect(provider.isEnabled()).toBe(true);
  });

  it('uses the stable anonymous install id as the distinct id', async () => {
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig({ installId: 'install-123' }));
    provider.track(createAnalyticsEvent('tool_opened', { route: '/convert' }));
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ distinctId: 'install-123', event: 'tool_opened' }));
  });

  it('attaches environment details as super properties', async () => {
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig({ appVersion: '1.0.0', channel: 'prod', mode: 'gui', locale: 'en', environment: 'production' }));
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({
        app_version: '1.0.0',
        channel: 'prod',
        mode: 'gui',
        locale: 'en',
        environment: 'production',
        platform: process.platform,
        arch: process.arch,
      }),
    );
    provider.track(createAnalyticsEvent('tool_opened', { route: '/convert' }));
    const properties = capture.mock.calls[0][0].properties as Record<string, unknown>;
    expect(properties).toMatchObject({
      app_version: '1.0.0',
      channel: 'prod',
      mode: 'gui',
      locale: 'en',
      environment: 'production',
      platform: process.platform,
      arch: process.arch,
    });
    expect(properties.$session_id).toEqual(expect.any(String));
    expect(properties.os_version).toEqual(expect.any(String));
    expect(properties.node_version).toEqual(expect.any(String));
    // `electron_version` is only present when running inside Electron.
    if (process.versions.electron) {
      expect(properties.electron_version).toEqual(expect.any(String));
    }
  });

  it('maps page_viewed to PostHog page and screen events', async () => {
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    capture.mockClear();
    provider.track(createAnalyticsEvent('page_viewed', { path: '/convert' }));
    expect(capture).toHaveBeenCalledTimes(2);
    const expectedProperties = expect.objectContaining({
      path: '/convert',
      $current_url: 'electron://encodex/convert',
      $pathname: '/convert',
      $host: 'encodex.app',
      $screen_name: '/convert',
      $browser: 'Electron',
      $device_type: 'Desktop',
      $os: process.platform,
      $session_id: expect.any(String),
    });
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ event: '$pageview', properties: expectedProperties }));
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ event: '$screen', properties: expectedProperties }));
    expect(capture.mock.calls.some((call) => call[0].event === 'page_viewed')).toBe(false);
  });

  it('identifies the person once with allowlisted properties', async () => {
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig({ appVersion: '1.0.0', channel: 'prod', mode: 'gui', locale: 'en', environment: 'production' }));
    const identifyCall = capture.mock.calls.find((call) => call[0].event === '$identify');
    expect(identifyCall).toBeTruthy();
    const payload = identifyCall![0] as {
      properties: Record<string, unknown> & { $set: Record<string, unknown>; $set_once: Record<string, unknown> };
    };
    expect(payload.properties).toMatchObject({
      app_version: '1.0.0',
      channel: 'prod',
      mode: 'gui',
      locale: 'en',
      environment: 'production',
      platform: process.platform,
      arch: process.arch,
    });
    expect(payload.properties.$set).toMatchObject({ app_version: '1.0.0', os: process.platform });
    expect(payload.properties.$set_once).toEqual({ first_seen_version: '1.0.0' });
  });

  it('survives a client whose identify capture throws', async () => {
    capture.mockImplementation((payload: { event?: string }) => {
      if (payload.event === '$identify') throw new Error('identify boom');
    });
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig({ appVersion: '1.0.0' }));
    expect(provider.isEnabled()).toBe(true);
  });

  it('drops props that are not strings, numbers, or booleans', async () => {
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    provider.track(
      createAnalyticsEvent('tool_opened', {
        route: '/convert',
        nested: { path: '/secret' },
        fn: () => 'x',
      } as never),
    );
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ properties: expect.objectContaining({ route: '/convert' }) }));
  });

  it('honors the ANALYTICS_GROUPS gate', async () => {
    process.env.ANALYTICS_GROUPS = 'lifecycle,settings';
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    capture.mockClear();

    provider.track(createAnalyticsEvent('conversion_started', { jobKind: 'single', transcoder: 'ffmpeg', hwAccel: false }));
    expect(capture).not.toHaveBeenCalled();

    provider.track(createAnalyticsEvent('theme_changed', { themeId: 'dark' }));
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ event: 'theme_changed' }));
  });

  it('gates off a group when the remote flag is false', async () => {
    getAllFlags.mockResolvedValue({ analytics_group_nav: false });
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    await (provider as unknown as { refreshFlags: () => Promise<void> }).refreshFlags();
    capture.mockClear();
    provider.track(createAnalyticsEvent('tool_opened', { route: '/convert' }));
    expect(capture).not.toHaveBeenCalled();
  });

  it('rotates the session after 30 minutes of inactivity', async () => {
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig({ appVersion: '1.0.0' }));
    const before = (provider as unknown as { sessionId: string }).sessionId;
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 31 * 60 * 1000);
    provider.track(createAnalyticsEvent('tool_opened', { route: '/convert' }));
    const after = (provider as unknown as { sessionId: string }).sessionId;
    expect(after).not.toBe(before);
    vi.restoreAllMocks();
  });

  it('attaches group analytics and identifies each group once', async () => {
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig({ hwAccelAvailable: true }));
    provider.track(createAnalyticsEvent('profile_applied', { profileId: 'p1', category: 'web' }));
    provider.track(createAnalyticsEvent('profile_applied', { profileId: 'p2', category: 'web' }));
    provider.track(createAnalyticsEvent('hw_accel_detected', { mode: 'auto', encoderType: 'gpu' }));
    expect(groupIdentify).toHaveBeenCalledTimes(2);
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ groups: { profile_kind: 'web' } }));
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ groups: { hardware_class: 'gpu_hw' } }));
  });

  it('skips group analytics when the client does not support groupIdentify', async () => {
    knobs.omitGroupIdentify = true;
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    provider.track(createAnalyticsEvent('profile_applied', { profileId: 'p1', category: 'web' }));
    expect(groupIdentify).not.toHaveBeenCalled();
    expect(capture).toHaveBeenCalled();
  });

  it('survives a client whose groupIdentify throws', async () => {
    groupIdentify.mockImplementation(() => {
      throw new Error('group boom');
    });
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    provider.track(createAnalyticsEvent('profile_applied', { profileId: 'p1', category: 'web' }));
    expect(capture).toHaveBeenCalled();
  });

  it('survives a client whose capture throws', async () => {
    capture.mockImplementation(() => {
      throw new Error('capture boom');
    });
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    provider.track(createAnalyticsEvent('tool_opened', { route: '/convert' }));
    expect(provider.isEnabled()).toBe(true);
  });

  it('resolves flags from the remote source', async () => {
    getAllFlags.mockResolvedValue({ alpha: true, beta: 3 });
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    await (provider as unknown as { refreshFlags: () => Promise<void> }).refreshFlags();
    expect(provider.isFeatureFlagEnabled('alpha')).toBe(true);
    expect(provider.getAllFeatureFlags()).toMatchObject({ alpha: true, beta: 3 });
  });

  it('sends exposure events for declared flags', async () => {
    getFeatureFlag.mockResolvedValue(false);
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig({ appVersion: '1.0.0', channel: 'dev', mode: 'gui', locale: 'en', environment: 'development' }));
    getAllFlags.mockClear();
    getFeatureFlag.mockClear();
    await (provider as unknown as { refreshFlags: () => Promise<void> }).refreshFlags();
    const personProperties = expect.objectContaining({
      app_version: '1.0.0',
      channel: 'dev',
      mode: 'gui',
      locale: 'en',
      environment: 'development',
      platform: process.platform,
      arch: process.arch,
      os_version: os.release(),
      node_version: process.versions.node,
      $session_id: expect.any(String),
    });
    expect(getAllFlags).toHaveBeenCalledWith(expect.any(String), { personProperties });
    expect(getFeatureFlag).toHaveBeenCalledWith('analytics_group_convert', expect.any(String), {
      sendFeatureFlagEvents: true,
      personProperties,
    });
    expect(getFeatureFlag).toHaveBeenCalledWith('analytics_group_queue', expect.any(String), {
      sendFeatureFlagEvents: true,
      personProperties,
    });
    expect(getFeatureFlag).toHaveBeenCalledWith('mcp_server_default_on', expect.any(String), {
      sendFeatureFlagEvents: true,
      personProperties,
    });
    expect(provider.isFeatureFlagEnabled('mcp_server_default_on')).toBe(false);
  });

  it('uses the cached flags when the remote lookup fails', async () => {
    fs.writeFileSync(path.join(knobs.userDataDir, 'analytics-flags.json'), JSON.stringify({ alpha: false }));
    getAllFlags.mockRejectedValue(new Error('flags boom'));
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    expect(provider.isFeatureFlagEnabled('alpha')).toBe(false);
  });

  it('skips the flag lookup when the client does not support it', async () => {
    knobs.omitGetAllFlags = true;
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    expect(getAllFlags).not.toHaveBeenCalled();
    expect(getFeatureFlag).not.toHaveBeenCalled();
    expect(provider.isFeatureFlagEnabled('analytics_group_convert')).toBe(true);
  });

  it('returns defaults for flags while inactive', () => {
    const provider = new PostHogMainProvider();
    expect(provider.isFeatureFlagEnabled('mcp_server_default_on')).toBe(false);
    expect(provider.getAllFeatureFlags()).toMatchObject({ mcp_server_default_on: false });
  });

  it('emits app_release once per version', async () => {
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig({ appVersion: '9.9.9' }));
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ event: 'app_release' }));

    capture.mockClear();
    const second = new PostHogMainProvider();
    await second.init(baseConfig({ appVersion: '9.9.9' }));
    expect(capture).not.toHaveBeenCalledWith(expect.objectContaining({ event: 'app_release' }));
  });

  it('omits AI prompt and completion content by default', async () => {
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    capture.mockClear();
    provider.captureAiGeneration({
      traceId: 't1',
      provider: 'openai',
      model: 'gpt',
      input: [{ role: 'user', content: 'hello' }],
      output: 'world',
      latency: 1.2,
    });
    const properties = capture.mock.calls[0][0].properties as Record<string, unknown>;
    expect(properties.$ai_input).toBeUndefined();
    expect(properties.$ai_output_choices).toBeUndefined();
    expect(properties.$ai_model).toBe('gpt');
  });

  it('includes AI content only when explicitly opted in', async () => {
    process.env.POSTHOG_AI_CAPTURE_CONTENT = 'true';
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    capture.mockClear();
    provider.captureAiGeneration({
      traceId: 't1',
      provider: 'openai',
      model: 'gpt',
      input: [{ role: 'user', content: 'hello' }],
      output: 'world',
      latency: 1.2,
    });
    expect(posthogCtor).toHaveBeenCalledWith('phc_test', expect.objectContaining({ privacyMode: false }));
    const properties = capture.mock.calls[0][0].properties as Record<string, unknown>;
    expect(properties.$ai_input).toEqual([{ role: 'user', content: 'hello' }]);
    expect(properties.$ai_output_choices).toEqual([{ role: 'assistant', content: 'world' }]);
  });

  it('includes span hierarchy metadata on AI generations', async () => {
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    capture.mockClear();
    provider.captureAiGeneration({
      traceId: 't1',
      spanId: 'g1',
      parentSpanId: 's1',
      provider: 'openai',
      model: 'gpt',
      input: [],
      latency: 1.2,
    });
    const properties = capture.mock.calls[0][0].properties as Record<string, unknown>;
    expect(properties.$ai_trace_id).toBe('t1');
    expect(properties.$ai_span_id).toBe('g1');
    expect(properties.$ai_span_name).toBe('llm_generation');
    expect(properties.$ai_parent_id).toBe('s1');
  });

  it('captures metadata-only AI spans', async () => {
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    provider.captureAiSpan({
      traceId: 't1',
      spanId: 's1',
      parentSpanId: 'root',
      name: 'copilot.route',
      latency: 0.25,
      isError: true,
    });
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({
        event: '$ai_span',
        properties: expect.objectContaining({
          $ai_trace_id: 't1',
          $ai_session_id: expect.any(String),
          $ai_span_id: 's1',
          $ai_span_name: 'copilot.route',
          $ai_parent_id: 'root',
          $ai_latency: 0.25,
          $ai_is_error: true,
        }),
      }),
    );
  });

  it('captures exceptions with sanitized context props', async () => {
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    const error = new Error('boom');
    provider.captureException(error, {
      tags: { handler: 'window.error', path: '/secret', email: 'user@example.com' },
      extra: { process: 'renderer', file: 'a.mp4', nested: { secret: true }, reason: 'clean-exit' },
    });
    expect(captureException).toHaveBeenCalledWith(error, expect.any(String), {
      'error_tag.handler': 'window.error',
      'error_extra.process': 'renderer',
      'error_extra.reason': 'clean-exit',
    });
  });

  it('survives a client whose captureException throws', async () => {
    captureException.mockImplementation(() => {
      throw new Error('exception capture boom');
    });
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    expect(() => provider.captureException(new Error('boom'))).not.toThrow();
  });

  it('ignores AI generations and spans while inactive', () => {
    const provider = new PostHogMainProvider();
    provider.captureAiGeneration({ traceId: 't', provider: 'p', model: 'm', input: [], latency: 1 });
    provider.captureAiSpan({ traceId: 't', spanId: 's', name: 'copilot.route', latency: 1 });
    expect(capture).not.toHaveBeenCalled();
  });

  it('drops events after setEnabled(false)', async () => {
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    capture.mockClear();
    provider.setEnabled(false);
    provider.track(createAnalyticsEvent('tool_opened', { route: '/convert' }));
    expect(capture).not.toHaveBeenCalled();
  });

  it('marks ui_error_shown so it does not update the person profile', async () => {
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    provider.track(createAnalyticsEvent('ui_error_shown', { category: 'conversion' }));
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ properties: expect.objectContaining({ $process_person_profile: false }) }),
    );
  });

  it('identifies the person only once', async () => {
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig({ appVersion: '1.0.0' }));
    const before = capture.mock.calls.filter((call) => call[0].event === '$identify').length;
    await (provider as unknown as { identifyPerson: (config: AnalyticsConfig) => void }).identifyPerson(
      baseConfig({ appVersion: '1.0.0' }),
    );
    const after = capture.mock.calls.filter((call) => call[0].event === '$identify').length;
    expect(before).toBe(1);
    expect(after).toBe(1);
  });

  it('falls back to the cached flags when the remote lookup times out', async () => {
    vi.useFakeTimers();
    getAllFlags.mockImplementation(() => new Promise(() => {}));
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    const refresh = (provider as unknown as { refreshFlags: () => Promise<void> }).refreshFlags();
    await vi.advanceTimersByTimeAsync(2100);
    await refresh;
    expect(provider.getAllFeatureFlags()).toBeDefined();
    vi.useRealTimers();
  });

  it('survives a release marker that cannot be read', async () => {
    knobs.getPathThrows = true;
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig({ appVersion: '1.0.0' }));
    expect(provider.isEnabled()).toBe(true);
  });

  it('survives AI events that cannot be captured', async () => {
    capture.mockImplementation(() => {
      throw new Error('capture boom');
    });
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    provider.captureAiGeneration({ traceId: 't', provider: 'p', model: 'm', input: [], latency: 1 });
    provider.captureAiSpan({ traceId: 't', spanId: 's', name: 'copilot.route', latency: 1 });
    expect(provider.isEnabled()).toBe(true);
  });

  it('flushes and shuts the client down on close', async () => {
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    await expect(provider.flush()).resolves.toBe(true);
    expect(flush).toHaveBeenCalled();

    await expect(provider.close()).resolves.toBe(true);
    expect(shutdown).toHaveBeenCalled();
    expect(logSdkShutdown).toHaveBeenCalled();
    expect(provider.isEnabled()).toBe(false);
  });

  it('reports a failed flush and close without throwing', async () => {
    expectAppLog('warn', 'main/analytics/posthogMainProvider');
    flush.mockRejectedValue(new Error('flush boom'));
    shutdown.mockRejectedValue(new Error('shutdown boom'));
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    await expect(provider.flush()).resolves.toBe(false);
    await expect(provider.close()).resolves.toBe(false);
  });

  it('forwards real log hub entries through OpenTelemetry', async () => {
    const addObserver = vi.spyOn(logHub, 'addObserver').mockReturnValue(42);
    const removeObserver = vi.spyOn(logHub, 'removeObserver');
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig({ appVersion: '1.2.3', environment: 'test' }));
    expect(addObserver).toHaveBeenCalledTimes(1);

    logEmit.mockClear();
    const observer = addObserver.mock.calls[0][0];
    observer({
      timestamp: '2026-01-01T00:00:00.000Z',
      level: 'ERROR',
      text: 'first line\nsecond line',
      source: 'renderer',
      seq: 7,
    });

    expect(logEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        severityText: 'error',
        body: 'first line second line',
        attributes: expect.objectContaining({
          'app.version': '1.2.3',
          'app.environment': 'test',
          posthogDistinctId: expect.any(String),
          sessionId: expect.any(String),
          'log.source': 'renderer',
          'log.seq': 7,
          'log.timestamp': '2026-01-01T00:00:00.000Z',
        }),
      }),
    );

    await provider.close();
    expect(removeObserver).toHaveBeenCalledWith(42);
  });

  it('survives an app log exporter that throws', async () => {
    const addObserver = vi.spyOn(logHub, 'addObserver').mockReturnValue(11);
    const removeObserver = vi.spyOn(logHub, 'removeObserver');
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    logEmit.mockImplementation(() => {
      throw new Error('log export boom');
    });
    const observer = addObserver.mock.calls[0][0];
    expect(() =>
      observer({
        timestamp: '2026-01-01T00:00:00.000Z',
        level: 'INFO',
        text: 'hello',
        source: 'main',
      }),
    ).not.toThrow();
    expect(logEmit).toHaveBeenCalled();
    await provider.close();
    expect(removeObserver).toHaveBeenCalledWith(11);
  });

  it('does not capture app logs when log capture is disabled', async () => {
    const addObserver = vi.spyOn(logHub, 'addObserver');
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig({ posthogLogsEnabled: false }));
    expect(addObserver).not.toHaveBeenCalled();
    expect(logEmit).not.toHaveBeenCalled();
    await provider.close();
  });

  it('detaches the log observer when consent is turned off and reattaches it when restored', async () => {
    const addObserver = vi.spyOn(logHub, 'addObserver').mockReturnValueOnce(1).mockReturnValueOnce(2);
    const removeObserver = vi.spyOn(logHub, 'removeObserver');
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    expect(addObserver).toHaveBeenCalledTimes(1);

    provider.setEnabled(false);
    expect(removeObserver).toHaveBeenCalledWith(1);

    provider.setEnabled(true);
    expect(addObserver).toHaveBeenCalledTimes(2);
    await provider.close();
  });

  it('truncates oversized app log bodies', async () => {
    const addObserver = vi.spyOn(logHub, 'addObserver').mockReturnValue(7);
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    logEmit.mockClear();
    const observer = addObserver.mock.calls[0][0];
    observer({
      timestamp: '2026-01-01T00:00:00.000Z',
      level: 'INFO',
      text: 'x'.repeat(5000),
      source: 'main',
    });
    expect(logEmit.mock.calls[0][0].body).toHaveLength(4000);
    await provider.close();
  });
});
