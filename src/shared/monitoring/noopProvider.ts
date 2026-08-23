/**
 * @fileoverview Default no-op monitoring provider.
 *
 * Used whenever no backend is configured (no DSN, `MONITORING_PROVIDER=noop`,
 * or consent withdrawn). It implements {@link MonitorProvider} with safe
 * empty behavior so the rest of the application never needs to branch on
 * whether monitoring is active. Because it has zero dependencies it lives in
 * `src/shared` and is usable from both the main and renderer processes.
 */

import type {
  MonitorBreadcrumb,
  MonitorContext,
  MonitorFeedback,
  MonitoringConfig,
  MonitoringLevel,
  MonitorProvider,
  MonitorUser,
} from './types';

/**
 * Provider that discards everything.
 * @class NoopProvider
 * @implements {MonitorProvider}
 */
export class NoopProvider implements MonitorProvider {
  /** Adapter identifier. @readonly */
  readonly name = 'noop';

  /** Consent state; always reports disabled because nothing is captured. */
  private enabled: boolean;

  /**
   * Creates a noop provider. Optionally remembers an enabled flag so
   * {@link isEnabled} reflects what the app asked for, though captures remain
   * discarded regardless.
   * @param {boolean} [enabled] - Initial consent state; defaults to false.
   */
  constructor(enabled = false) {
    this.enabled = enabled;
  }

  /**
   * Accepts configuration without side effects.
   * @param {MonitoringConfig} _config - Ignored configuration.
   * @returns {void}
   */
  init(_config: MonitoringConfig): void {
    /* intentionally empty - nothing to initialize */
  }

  /**
   * Discards the exception.
   * @param {unknown} _error - Ignored error value.
   * @param {MonitorContext} [_context] - Ignored context.
   * @returns {undefined} Always undefined (no backend event id).
   */
  captureException(_error: unknown, _context?: MonitorContext): undefined {
    return undefined;
  }

  /**
   * Discards the message.
   * @param {string} _message - Ignored message text.
   * @param {MonitoringLevel} [_level] - Ignored severity.
   * @param {MonitorContext} [_context] - Ignored context.
   * @returns {undefined} Always undefined (no backend event id).
   */
  captureMessage(_message: string, _level?: MonitoringLevel, _context?: MonitorContext): undefined {
    return undefined;
  }

  /**
   * Discards the feedback report.
   * @param {MonitorFeedback} _feedback - Ignored user feedback.
   * @param {MonitorContext} [_context] - Ignored context.
   * @returns {undefined} Always undefined (no backend id).
   */
  captureFeedback(_feedback: MonitorFeedback, _context?: MonitorContext): undefined {
    return undefined;
  }

  /**
   * Ignores tag updates.
   * @param {string} _key - Ignored key.
   * @param {string} _value - Ignored value.
   * @returns {void}
   */
  setTag(_key: string, _value: string): void {
    /* intentionally empty */
  }

  /**
   * Ignores user identity changes.
   * @param {MonitorUser | null} _user - Ignored user info.
   * @returns {void}
   */
  setUser(_user: MonitorUser | null): void {
    /* intentionally empty */
  }

  /**
   * Ignores breadcrumb entries.
   * @param {MonitorBreadcrumb} _breadcrumb - Ignored breadcrumb.
   * @returns {void}
   */
  addBreadcrumb(_breadcrumb: MonitorBreadcrumb): void {
    /* intentionally empty */
  }

  /**
   * Records the requested consent state (captures stay discarded either way).
   * @param {boolean} enabled - Requested consent state.
   * @returns {void}
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Reports whether capturing was requested via setEnabled/init.
   * @returns {boolean} The stored consent state.
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
