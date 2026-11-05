/**
 * @fileoverview Unit tests for the analytics event taxonomy and facade.
 * Verifies that the taxonomy is complete, payloads are JSON-serializable
 * (privacy+IPC safe), events delegate to the active provider, the facade
 * never throws before init, consent-off gives a no-op, and the journey badge
 * is stamped onto outgoing events.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ANALYTICS_SCHEMA_VERSION, createAnalyticsEvent } from '../events';
import type { AnalyticsEvent } from '../events';
import type { AnalyticsProvider, AiGeneration } from '../types';

import {
  AnalyticsService,
  recordAnalyticsEvent,
  initAnalytics,
  setAnalyticsEnabled,
  resetAnalyticsForTests,
  getActiveAnalyticsProviderForTests,
  setAnalyticsContext,
  isAnalyticsEnabled,
  getAnalyticsBackendName,
  trackRelayedAnalyticsEvent,
  captureAiGeneration,
  isFeatureFlagEnabled,
  getAllFeatureFlags,
} from '../AnalyticsService';

/** Minimal trackable fake provider asserting delegation. */
class FakeProvider implements AnalyticsProvider {
  readonly name = 'fake';
  enabled = true;
  tracks: AnalyticsEvent[] = [];
  inits = 0;
  closes = 0;
  generations: AiGeneration[] = [];
  flags: Record<string, boolean | string | number> = { alpha: true, beta: 'x' };

  init(): void {
    this.inits += 1;
  }

  track(event: AnalyticsEvent): void {
    this.tracks.push(event);
  }

  captureAiGeneration(generation: AiGeneration): void {
    this.generations.push(generation);
  }

  isFeatureFlagEnabled(flag: string): boolean | undefined {
    const value = this.flags[flag];
    return typeof value === 'boolean' ? value : undefined;
  }

  getAllFeatureFlags(): Record<string, boolean | string | number> | undefined {
    return { ...this.flags };
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

/** Provider whose every call throws, to exercise the facade's catch paths. */
class ThrowingProvider implements AnalyticsProvider {
  readonly name = 'throwing';
  init(): void {}
  track(): void {
    throw new Error('track boom');
  }
  captureAiGeneration(): void {
    throw new Error('generation boom');
  }
  isFeatureFlagEnabled(): boolean | undefined {
    throw new Error('flag boom');
  }
  getAllFeatureFlags(): Record<string, boolean | string | number> | undefined {
    throw new Error('flags boom');
  }
  setEnabled(): void {}
  isEnabled(): boolean {
    return true;
  }
}

describe('analytics event taxonomy', () => {
  it('every event carries the current schema version', () => {
    const event = createAnalyticsEvent('app_launched', {
      version: '1.0.0',
      platform: 'darwin',
      arch: 'arm64',
    });
    expect(event.schema).toBe(ANALYTICS_SCHEMA_VERSION);
    expect(event.name).toBe('app_launched');
  });

  it('all taxonomy payloads are JSON-serializable (no PII-capable shapes)', () => {
    const events = [
      createAnalyticsEvent('app_installed', { version: '1.0.0', platform: 'win32', arch: 'x64' }),
      createAnalyticsEvent('conversion_started', { jobKind: 'single', transcoder: 'FFMPEG', hwAccel: true }),
      createAnalyticsEvent('conversion_completed', { jobKind: 'batch', transcoder: 'FFMPEG', hwAccel: false }),
      createAnalyticsEvent('conversion_failed', { jobKind: 'single', transcoder: 'FFMPEG', code: 'CODEC_ERROR' }),
      createAnalyticsEvent('batch_completed', { completed: 9, failed: 1 }),
      createAnalyticsEvent('onboarding_goal_selected', { goal: 'compress' }),
      createAnalyticsEvent('hw_accel_detected', { mode: 'auto', encoderType: 'nvenc' }),
      createAnalyticsEvent('cli_invoked', { version: '1.0.0', platform: 'linux', arch: 'x64', subcommand: 'convert' }),
    ];
    for (const event of events) {
      const payload = JSON.parse(JSON.stringify(event));
      expect(payload.schema).toBe(ANALYTICS_SCHEMA_VERSION);
    }
  });

  it('serializing an event round-trips name and props without functions', () => {
    const event = createAnalyticsEvent('profile_applied', { profileId: 'web', category: 'video' });
    expect(JSON.parse(JSON.stringify(event))).toEqual(event);
  });
});

describe('AnalyticsService', () => {
  let provider: FakeProvider;

  beforeEach(() => {
    resetAnalyticsForTests();
    provider = new FakeProvider();
  });

  afterEach(() => {
    resetAnalyticsForTests();
  });

  it('records nothing before init (no-op facade)', () => {
    const service = new AnalyticsService();
    expect(() => service.recordEvent(createAnalyticsEvent('app_launched', { version: '1', platform: 'win32', arch: 'x64' }))).not.toThrow();
    expect(getActiveAnalyticsProviderForTests().name).toBe('noop');
  });

  it('recordAnalyticsEvent helper never throws when uninitialized', () => {
    expect(() => recordAnalyticsEvent(createAnalyticsEvent('telemetry_opt_in', { version: '1' }))).not.toThrow();
  });

  it('delegates typed events to the resolved provider', async () => {
    resetAnalyticsForTests();
    await initAnalytics({ enabled: true, provider: 'fake' }, () => provider);
    const service = new AnalyticsService();
    service.recordEvent(createAnalyticsEvent('app_launched', { version: '1', platform: 'win32', arch: 'x64' }));
    expect(provider.tracks).toHaveLength(1);
    expect(provider.tracks[0].name).toBe('app_launched');
  });

  it('stamps the active journey badge onto outgoing events as ctx.route/ctx.jobKind', async () => {
    resetAnalyticsForTests();
    await initAnalytics({ enabled: true, provider: 'fake' }, () => provider);
    setAnalyticsContext({ route: '/convert', jobKind: 'single' });
    recordAnalyticsEvent(createAnalyticsEvent('conversion_started', { jobKind: 'single', transcoder: 'FFMPEG', hwAccel: false }));
    expect(provider.tracks).toHaveLength(1);
    expect(provider.tracks[0].props).toMatchObject({
      jobKind: 'single',
      'ctx.route': '/convert',
      'ctx.jobKind': 'single',
    });
  });

  it('does not stamp the badge when none is set', async () => {
    resetAnalyticsForTests();
    await initAnalytics({ enabled: true, provider: 'fake' }, () => provider);
    recordAnalyticsEvent(createAnalyticsEvent('app_launched', { version: '1', platform: 'win32', arch: 'x64' }));
    expect(provider.tracks[0].props).not.toHaveProperty('ctx.route');
    expect(provider.tracks[0].props).not.toHaveProperty('ctx.jobKind');
  });

  it('records nothing when consent is off', async () => {
    resetAnalyticsForTests();
    await initAnalytics({ enabled: false, provider: 'fake' }, () => provider);
    recordAnalyticsEvent(createAnalyticsEvent('app_launched', { version: '1', platform: 'win32', arch: 'x64' }));
    expect(provider.tracks).toHaveLength(0);
    expect(getActiveAnalyticsProviderForTests().name).toBe('noop');
  });

  it('buffers pre-bootstrap events and replays them after init', async () => {
    resetAnalyticsForTests();
    recordAnalyticsEvent(createAnalyticsEvent('cli_invoked', { version: '1', platform: 'win32', arch: 'x64', subcommand: 'convert' }));
    expect(provider.tracks).toHaveLength(0);
    await initAnalytics({ enabled: true, provider: 'fake' }, () => provider);
    expect(provider.tracks).toHaveLength(1);
    expect(provider.tracks[0].name).toBe('cli_invoked');
  });

  it('never replays events recorded while consent was off', async () => {
    resetAnalyticsForTests();
    await initAnalytics({ enabled: false, provider: 'fake' }, () => provider);
    recordAnalyticsEvent(createAnalyticsEvent('app_launched', { version: '1', platform: 'win32', arch: 'x64' }));
    await setAnalyticsEnabled(true);
    expect(provider.tracks).toHaveLength(0);
  });

  it('re-enabling consent re-runs the stored factory', async () => {
    resetAnalyticsForTests();
    await initAnalytics({ enabled: true, provider: 'fake' }, () => provider);
    await setAnalyticsEnabled(false);
    expect(getActiveAnalyticsProviderForTests().name).toBe('noop');
    expect(isAnalyticsEnabled()).toBe(false);
    await setAnalyticsEnabled(true);
    expect(getActiveAnalyticsProviderForTests().name).toBe('fake');
    expect(isAnalyticsEnabled()).toBe(true);
    expect(getAnalyticsBackendName()).toBe('fake');
  });

  it('forwards relayed renderer events without re-stamping the main badge', async () => {
    resetAnalyticsForTests();
    await initAnalytics({ enabled: true, provider: 'fake' }, () => provider);
    setAnalyticsContext({ route: '/main', jobKind: 'single' });
    const event = createAnalyticsEvent('tool_opened', { route: '/convert' });
    trackRelayedAnalyticsEvent(event);
    expect(provider.tracks).toHaveLength(1);
    expect(provider.tracks[0]).toEqual(event);
  });

  it('drops relayed events with an unknown event name', async () => {
    resetAnalyticsForTests();
    await initAnalytics({ enabled: true, provider: 'fake' }, () => provider);
    trackRelayedAnalyticsEvent({ schema: 2, name: 'not_a_real_event', props: {} });
    expect(provider.tracks).toHaveLength(0);
  });

  it('drops relayed events with non-object props', async () => {
    resetAnalyticsForTests();
    await initAnalytics({ enabled: true, provider: 'fake' }, () => provider);
    trackRelayedAnalyticsEvent({ schema: 2, name: 'tool_opened', props: null });
    trackRelayedAnalyticsEvent({ schema: 2, name: 'tool_opened', props: 'x' });
    expect(provider.tracks).toHaveLength(0);
  });

  it('drops relayed events with non-string name', async () => {
    resetAnalyticsForTests();
    await initAnalytics({ enabled: true, provider: 'fake' }, () => provider);
    trackRelayedAnalyticsEvent({ schema: 2, name: 42, props: {} });
    expect(provider.tracks).toHaveLength(0);
  });
  it('drops relayed events when consent is off', async () => {
    resetAnalyticsForTests();
    await initAnalytics({ enabled: false, provider: 'fake' }, () => provider);
    trackRelayedAnalyticsEvent(createAnalyticsEvent('tool_opened', { route: '/convert' }));
    expect(provider.tracks).toHaveLength(0);
  });

  it('forwards AI generations to the provider', async () => {
    resetAnalyticsForTests();
    await initAnalytics({ enabled: true, provider: 'fake' }, () => provider);
    const generation: AiGeneration = {
      traceId: 't1',
      provider: 'openai',
      model: 'gpt',
      input: [{ role: 'user', content: 'hi' }],
      latency: 1,
    };
    captureAiGeneration(generation);
    expect(provider.generations).toEqual([generation]);
  });

  it('ignores AI generations when consent is off', async () => {
    resetAnalyticsForTests();
    await initAnalytics({ enabled: false, provider: 'fake' }, () => provider);
    captureAiGeneration({
      traceId: 't1',
      provider: 'openai',
      model: 'gpt',
      input: [],
      latency: 1,
    });
    expect(provider.generations).toHaveLength(0);
  });

  it('resolves feature flags through the provider', async () => {
    resetAnalyticsForTests();
    await initAnalytics({ enabled: true, provider: 'fake' }, () => provider);
    expect(isFeatureFlagEnabled('alpha')).toBe(true);
    expect(isFeatureFlagEnabled('beta')).toBeUndefined();
    expect(getAllFeatureFlags()).toEqual({ alpha: true, beta: 'x' });
  });

  it('returns undefined for flags when consent is off', async () => {
    resetAnalyticsForTests();
    await initAnalytics({ enabled: false, provider: 'fake' }, () => provider);
    expect(isFeatureFlagEnabled('alpha')).toBeUndefined();
    expect(getAllFeatureFlags()).toBeUndefined();
  });

  it('never throws when the provider fails', async () => {
    resetAnalyticsForTests();
    await initAnalytics({ enabled: true, provider: 'throwing' }, () => new ThrowingProvider());
    expect(() => trackRelayedAnalyticsEvent(createAnalyticsEvent('tool_opened', { route: '/convert' }))).not.toThrow();
    expect(() => captureAiGeneration({ traceId: 't', provider: 'p', model: 'm', input: [], latency: 1 })).not.toThrow();
    expect(() => isFeatureFlagEnabled('alpha')).not.toThrow();
    expect(() => getAllFeatureFlags()).not.toThrow();
  });
});
