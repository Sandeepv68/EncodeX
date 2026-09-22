/**
 * @fileoverview Provider factory for main-process analytics.
 *
 * Single place that decides which {@link AnalyticsProvider} adapter to activate
 * based on configuration and environment. Swapping analytics backends in the
 * future means adding an adapter file and one branch here - no other code
 * changes.
 *
 * Selection rules:
 *  1. `ANALYTICS_PROVIDER` env var wins when set ('noop' | 'aptabase' today).
 *  2. Otherwise 'aptabase' is selected when an App Key is present in
 *     config/env.
 *  3. Anything unrecognized falls back to null -> facade uses noop.
 */

import { NoopProvider } from '../../shared/analytics/noopProvider';
import type { AnalyticsProvider, AnalyticsConfig } from '../../shared/analytics/types';
import { AptabaseMainProvider } from './aptabaseMainProvider';

/**
 * Environment variable overriding automatic provider selection.
 * @const {string}
 */
export const ANALYTICS_PROVIDER_ENV_VAR = 'ANALYTICS_PROVIDER';

/**
 * Environment variable carrying the Aptabase App Key (`A-{US|EU|DEV|SH}-...`).
 * @const {string}
 */
export const APTABASE_APP_KEY_ENV_VAR = 'APTABASE_APP_KEY';

/**
 * Regions the Aptabase SDK accepts, mirroring its `A-{US|EU|DEV|SH}-...` key
 * guard so an invalid key degrades to the no-op backend instead of advertising
 * an `aptabase` transport that was never registered.
 * @const {ReadonlySet<string>}
 */
const APTABASE_REGIONS = new Set(['US', 'EU', 'DEV', 'SH']);

/**
 * True when the key has the exact shape the Aptabase SDK accepts: three
 * dash-separated segments with a known region (`A-<REGION>-<suffix>`). Mirrors
 * the SDK's internal check (avoiding its side-effect-free self-disable path).
 * @param {string} appKey - The candidate App Key.
 * @returns {boolean} Whether the SDK would accept the key at initialize time.
 */
export function isValidAptabaseAppKey(appKey: string): boolean {
  const parts = appKey.split('-');
  return parts.length === 3 && APTABASE_REGIONS.has(parts[1]);
}

/**
 * Resolves the concrete main-process provider for the given configuration.
 * Consent (`config.enabled`) is enforced by the facade; this factory only
 * picks the backend type.
 * @param {AnalyticsConfig} config - Startup configuration.
 * @returns {AnalyticsProvider | null} The adapter instance, or null to request
 *   the facade's no-op fallback (e.g. nothing configured).
 */
export function resolveMainAnalyticsProvider(config: AnalyticsConfig): AnalyticsProvider | null {
  const requested = (process.env[ANALYTICS_PROVIDER_ENV_VAR] || config.provider || '').toLowerCase();

  if (requested === 'noop') {
    return new NoopProvider(true);
  }

  const appKey = config.appKey || process.env[APTABASE_APP_KEY_ENV_VAR];
  if ((requested === 'aptabase' || requested === '') && appKey && isValidAptabaseAppKey(appKey)) {
    return new AptabaseMainProvider();
  }

  return null;
}
