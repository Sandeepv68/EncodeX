/**
 * @fileoverview Unit tests for the analytics event taxonomy and facade.
 * Verifies that the taxonomy is complete, payloads are JSON-serializable
 * (privacy+IPC safe), events map to the expected breadcrumb category, and the
 * facade never throws even when the monitoring layer is unavailable.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ANALYTICS_SCHEMA_VERSION, createAnalyticsEvent } from '../events';

// Mock the monitoring facade BEFORE importing the service so the breadcrumb
// contract can be asserted without wiring up the real backend.
const addMonitoringBreadcrumbMock = vi.fn();

vi.mock('../../monitoring/MonitoringService', () => ({
  addMonitoringBreadcrumb: (...args: unknown[]) => addMonitoringBreadcrumbMock(...args),
}));

import { AnalyticsService, recordAnalyticsEvent } from '../AnalyticsService';

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
    const event = createAnalyticsEvent('profile_applied', { profileId: 'web' });
    expect(JSON.parse(JSON.stringify(event))).toEqual(event);
  });
});

describe('AnalyticsService', () => {
  beforeEach(() => {
    addMonitoringBreadcrumbMock.mockClear();
  });

  it('routes an event to the analytics breadcrumb category', () => {
    const service = new AnalyticsService();
    service.recordEvent(createAnalyticsEvent('app_launched', { version: '1', platform: 'win32', arch: 'x64' }));
    expect(addMonitoringBreadcrumbMock).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'analytics', message: 'app_launched', level: 'info' }),
    );
  });

  it('recordAnalyticsEvent helper never throws when monitoring is inert', () => {
    expect(() => recordAnalyticsEvent(createAnalyticsEvent('telemetry_opt_in', { version: '1' }))).not.toThrow();
  });
});
