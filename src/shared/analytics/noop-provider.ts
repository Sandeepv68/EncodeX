/**
 * @fileoverview No-op analytics provider.
 * Used as the default fallback when analytics is disabled by the user,
 * when no app key is configured, or during testing. All methods are silent
 * no-ops so callers never need to guard their track calls.
 */

import type { AnalyticsProvider, AnalyticsConfig } from './types';

/**
 * No-op implementation of AnalyticsProvider.
 * Every method is a silent no-op so callers can invoke track() unconditionally.
 * @class NoopProvider
 * @implements {AnalyticsProvider}
 */
export class NoopProvider implements AnalyticsProvider {
  /**
   * No-op. Does nothing.
   * @param {AnalyticsConfig} _config - Ignored.
   */
  initialize(_config: AnalyticsConfig): void {
    // intentionally empty
  }

  /**
   * No-op. Does nothing.
   * @param {string} _eventName - Ignored.
   * @param {Record<string, string | number>} [_properties] - Ignored.
   */
  track(_eventName: string, _properties?: Record<string, string | number>): void {
    // intentionally empty
  }

  /**
   * No-op. Does nothing.
   */
  shutdown(): void {
    // intentionally empty
  }
}
