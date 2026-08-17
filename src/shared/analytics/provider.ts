/**
 * @fileoverview Analytics provider singleton and factory.
 *
 * Manages the active AnalyticsProvider instance shared across the process.
 * Each Electron process (main, renderer) calls setAnalyticsProvider() once
 * at startup with the concrete provider created for that process. All other
 * modules read the provider via getAnalytics().
 *
 * An enabled flag gates all track calls: when disabled, getAnalytics() returns
 * a NoopProvider regardless of the registered concrete provider.
 *
 * To swap analytics backends in the future, only the initialization callsite
 * and the concrete provider files need to change. The factory switch in
 * createAnalyticsProvider() is the single place that maps a provider type
 * string to a concrete class.
 */

import { Logger } from '../logger';
import { NoopProvider } from './noop-provider';
import type { AnalyticsProvider } from './types';

/**
 * Logger instance scoped to the analytics provider module.
 * @const {Logger} log
 */
const log = new Logger('shared/analytics/provider');

/**
 * The active analytics provider, or null when not yet initialized.
 * @type {AnalyticsProvider | null}
 */
let provider: AnalyticsProvider | null = null;

/**
 * Whether analytics tracking is enabled. Respects the user's opt-out choice
 * persisted in localStorage. Defaults to true.
 * @type {boolean}
 */
let enabled = true;

/**
 * Returns the active analytics provider, falling back to NoopProvider when
 * analytics is disabled or no provider has been registered yet.
 * @returns {AnalyticsProvider} The active provider or a no-op instance.
 */
export function getAnalytics(): AnalyticsProvider {
  if (!enabled) return new NoopProvider();
  if (!provider) {
    log.warn('Analytics provider not initialized; returning no-op provider');
    return new NoopProvider();
  }
  return provider;
}

/**
 * Registers the active analytics provider. Called once per process at startup.
 * @param {AnalyticsProvider} p - The concrete provider instance.
 */
export function setAnalyticsProvider(p: AnalyticsProvider): void {
  provider = p;
}

/**
 * Enables or disables analytics tracking. When disabled, getAnalytics()
 * returns a NoopProvider so all track calls become silent no-ops.
 * @param {boolean} flag - true to enable, false to disable.
 */
export function setAnalyticsEnabled(flag: boolean): void {
  enabled = flag;
  log.debug('Analytics', flag ? 'enabled' : 'disabled');
}

/**
 * Returns whether analytics tracking is currently enabled.
 * @returns {boolean} true when analytics is enabled.
 */
export function isAnalyticsEnabled(): boolean {
  return enabled;
}
