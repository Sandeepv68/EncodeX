/**
 * @fileoverview PostHog adapter for the renderer process.
 *
 * The PostHog project token never enters the renderer. Renderer events are
 * relayed over IPC to the active main-process backend, which owns the token
 * and performs delivery. This mirrors the Aptabase rule that backend
 * credentials stay in the main process.
 */

import { Logger } from '../../shared/logger';
import { LOG_ANALYTICS_INIT_FAILED, LOG_ANALYTICS_TRACK_FAILED } from '../../shared/log-constants';
import { sanitizeAnalyticsProps } from '../../shared/analytics/sanitize';
import type { AnalyticsEvent } from '../../shared/analytics/events';
import type { AnalyticsConfig, AnalyticsProvider } from '../../shared/analytics/types';

/** Per-module logger for the renderer PostHog adapter. @const {Logger} */
const log = new Logger('renderer/analytics/posthogRendererProvider');

/**
 * PostHog-backed analytics provider for the renderer process.
 * @class PostHogRendererProvider
 * @implements {AnalyticsProvider}
 */
export class PostHogRendererProvider implements AnalyticsProvider {
  /** Adapter identifier. @readonly */
  readonly name = 'posthog';

  /** Whether the adapter is accepting events. @type {boolean} */
  private active = false;

  /**
   * Activates the relay. `config.enabled` is enforced by the facade; no
   * backend credentials are available in the renderer by design.
   * @param {AnalyticsConfig} config - Resolved config (only consent is read).
   * @returns {Promise<void>} Resolves once the adapter is ready.
   */
  async init(config: AnalyticsConfig): Promise<void> {
    try {
      if (!config.enabled) return;
      this.active = true;
    } catch (err) {
      log.error(LOG_ANALYTICS_INIT_FAILED, err);
      this.active = false;
    }
  }

  /**
   * @returns {boolean} Whether the adapter is accepting events.
   */
  isEnabled(): boolean {
    return this.active;
  }

  /**
   * Relays a typed event to the main process, where the active provider
   * delivers it. Fire-and-forget; failures are logged, never thrown.
   * @param {AnalyticsEvent} event - The typed event to record.
   * @returns {void}
   */
  track(event: AnalyticsEvent): void {
    if (!this.active) return;
    if (typeof window === 'undefined') return;
    const relay = window.electronAPI?.analyticsTrackEvent;
    if (!relay) return;
    const props = sanitizeAnalyticsProps(event.props) ?? {};
    try {
      void relay({ ...event, props } as AnalyticsEvent).catch((err) => {
        log.debug(LOG_ANALYTICS_TRACK_FAILED, err);
      });
    } catch (err) {
      log.debug(LOG_ANALYTICS_TRACK_FAILED, err);
    }
  }

  /**
   * Disables recording at runtime (consent off).
   * @param {boolean} enabled - Whether recording should occur.
   * @returns {void}
   */
  setEnabled(enabled: boolean): void {
    this.active = enabled;
  }
}
