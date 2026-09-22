/**
 * @fileoverview Default no-op analytics provider.
 *
 * Used whenever no backend is configured (no App Key, `ANALYTICS_PROVIDER=noop`,
 * or consent withdrawn). It implements {@link AnalyticsProvider} with safe
 * empty behavior so the rest of the application never needs to branch on
 * whether analytics is active. Because it has zero dependencies it lives in
 * `src/shared` and is usable from both the main and renderer processes.
 */

import type { AnalyticsEvent } from './events';
import type { AnalyticsConfig, AnalyticsProvider } from './types';

/**
 * Provider that discards everything.
 * @class NoopProvider
 * @implements {AnalyticsProvider}
 */
export class NoopProvider implements AnalyticsProvider {
  /** Adapter identifier. @readonly */
  readonly name = 'noop';

  /** Consent state; always reports disabled because nothing is recorded. */
  private enabled: boolean;

  /**
   * Creates a noop provider. Optionally remembers an enabled flag so
   * {@link isEnabled} reflects what the app asked for, though tracks remain
   * discarded regardless.
   * @param {boolean} [enabled] - Initial consent state; defaults to false.
   */
  constructor(enabled = false) {
    this.enabled = enabled;
  }

  /**
   * Accepts configuration without side effects.
   * @param {AnalyticsConfig} _config - Ignored configuration.
   * @returns {void}
   */
  init(_config: AnalyticsConfig): void {
    /* intentionally empty - nothing to initialize */
  }

  /**
   * Discards the event.
   * @param {AnalyticsEvent} _event - Ignored event.
   * @returns {void}
   */
  track(_event: AnalyticsEvent): void {
    /* intentionally empty */
  }

  /**
   * Records the requested consent state (tracks stay discarded either way).
   * @param {boolean} enabled - Requested consent state.
   * @returns {void}
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Reports whether recording was requested via setEnabled/init.
   * @returns {boolean} The stored consent state.
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
