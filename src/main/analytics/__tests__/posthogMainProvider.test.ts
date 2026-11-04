/**
 * @fileoverview Unit tests for the main-process PostHog adapter.
 * The PostHog client and OpenTelemetry log SDK are mocked so init, gating,
 * sanitization, AI privacy defaults, and flush/close semantics can be verified
 * without network access.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { expectAppLog } from '../../../test-utils/crash-tripwire';

const capture = vi.hoisted(() => vi.fn());
const flush = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const shutdown = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const posthogCtor = vi.hoisted(() =>
  vi.fn(function () {
    return { capture, flush, shutdown, identify: vi.fn(), groupIdentify: vi.fn(), getAllFlags: vi.fn().mockResolvedValue({}) };
  }),
);
const logEmit = vi.hoisted(() => vi.fn());
const logSdkStart = vi.hoisted(() => vi.fn());
const logSdkShutdown = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('posthog-node', () => ({ PostHog: posthogCtor }));
vi.mock('@opentelemetry/api-logs', () => ({ logs: { getLogger: () => ({ emit: logEmit }) } }));
vi.mock('@opentelemetry/exporter-logs-otlp-http', () => ({ OTLPLogExporter: vi.fn() }));
vi.mock('@opentelemetry/resources', () => ({ resourceFromAttributes: vi.fn(() => ({})) }));
vi.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: vi.fn(function () {
    return { start: logSdkStart, shutdown: logSdkShutdown };
  }),
}));
vi.mock('@opentelemetry/sdk-logs', () => ({ BatchLogRecordProcessor: vi.fn() }));

const { PostHogMainProvider } = await import('../posthogMainProvider');
import { createAnalyticsEvent } from '../../../shared/analytics/events';
import type { AnalyticsConfig } from '../../../shared/analytics/types';

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
    delete process.env.ANALYTICS_GROUPS;
    delete process.env.POSTHOG_AI_CAPTURE_CONTENT;
    vi.clearAllMocks();
    flush.mockResolvedValue(undefined);
    shutdown.mockResolvedValue(undefined);
    logSdkShutdown.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (ORIGINAL_GROUPS === undefined) {
      delete process.env.ANALYTICS_GROUPS;
    } else {
      process.env.ANALYTICS_GROUPS = ORIGINAL_GROUPS;
    }
    if (ORIGINAL_CAPTURE === undefined) {
      delete process.env.POSTHOG_AI_CAPTURE_CONTENT;
    } else {
      process.env.POSTHOG_AI_CAPTURE_CONTENT = ORIGINAL_CAPTURE;
    }
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

  it('constructs a privacy-first client with the configured token and host', async () => {
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    expect(posthogCtor).toHaveBeenCalledWith('phc_test', {
      host: 'https://us.i.posthog.com',
      privacyMode: true,
    });
    expect(provider.isEnabled()).toBe(true);
  });

  it('uses the stable anonymous install id as the distinct id', async () => {
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig({ installId: 'install-123' }));
    provider.track(createAnalyticsEvent('tool_opened', { route: '/convert' }));
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ distinctId: 'install-123', event: 'tool_opened' }));
  });

  it('drops props that are not strings, numbers, or booleans', async () => {
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    provider.track(
      createAnalyticsEvent('tool_opened', {
        route: '/convert',
        empty: '',
        missing: undefined,
        nested: { path: '/secret' },
        fn: () => 'x',
      } as never),
    );
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ properties: expect.objectContaining({ route: '/convert' }) }));
  });

  it('honors the ANALYTICS_GROUPS gate', async () => {
    process.env.ANALYTICS_GROUPS = 'settings';
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());

    provider.track(
      createAnalyticsEvent('conversion_started', {
        jobKind: 'single',
        transcoder: 'ffmpeg',
        hwAccel: false,
      }),
    );
    expect(capture).not.toHaveBeenCalled();

    provider.track(createAnalyticsEvent('theme_changed', { themeId: 'dark' }));
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ event: 'theme_changed' }));
  });

  it('omits AI prompt/completion content by default', async () => {
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    provider.captureAiGeneration({
      traceId: 'trace-1',
      provider: 'openai',
      model: 'gpt-x',
      input: [{ role: 'user', content: 'hello secret' }],
      output: 'world secret',
      latency: 1.2,
    });

    const properties = capture.mock.calls[0][0].properties as Record<string, unknown>;
    expect(properties.$ai_input).toBeUndefined();
    expect(properties.$ai_output_choices).toBeUndefined();
    expect(properties.$ai_model).toBe('gpt-x');
    expect(properties.$ai_latency).toBe(1.2);
  });

  it('includes AI content only when explicitly opted in', async () => {
    process.env.POSTHOG_AI_CAPTURE_CONTENT = 'true';
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    provider.captureAiGeneration({
      traceId: 'trace-1',
      provider: 'openai',
      model: 'gpt-x',
      input: [{ role: 'user', content: 'hello' }],
      output: 'world',
      latency: 1.2,
    });

    expect(posthogCtor).toHaveBeenCalledWith('phc_test', expect.objectContaining({ privacyMode: false }));
    const properties = capture.mock.calls[0][0].properties as Record<string, unknown>;
    expect(properties.$ai_input).toEqual([{ role: 'user', content: 'hello' }]);
    expect(properties.$ai_output_choices).toEqual([{ role: 'assistant', content: 'world' }]);
  });

  it('drops events after setEnabled(false)', async () => {
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig());
    provider.setEnabled(false);
    provider.track(createAnalyticsEvent('tool_opened', { route: '/convert' }));
    expect(capture).not.toHaveBeenCalled();
  });

  it('attaches super properties and groups', async () => {
    const provider = new PostHogMainProvider();
    await provider.init(baseConfig({ appVersion: '1.0.0', channel: 'prod', mode: 'gui', locale: 'en', hwAccelAvailable: true }));
    provider.track(createAnalyticsEvent('profile_applied', { profileId: 'p1', category: 'web' }));
    provider.track(createAnalyticsEvent('hw_accel_detected', { mode: 'auto', encoderType: 'gpu' }));
    expect(capture).toHaveBeenCalled();
    expect(provider.isFeatureFlagEnabled('analytics_group_convert')).toBe(true);
    expect(provider.getAllFeatureFlags()).toBeDefined();
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
});
