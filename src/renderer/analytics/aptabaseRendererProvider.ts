/**
 * @fileoverview Aptabase adapter for the renderer process implementing the
 * provider-agnostic {@link AnalyticsProvider} contract.
 *
 * This is the ONLY module in the renderer allowed to import
 * `@aptabase/electron/renderer`. The App Key never enters the renderer: the
 * renderer adapter only forwards `{ eventName, props }` over the SDK's
 * `aptabase-ipc` scheme, which the main-process `initialize` registers.
 * The backend decision is made in main (which owns the App Key); the renderer
 * simply mirrors whichever adapter name main reports via
 * `window.electronAPI.analyticsGetState()`.
 */

import { Logger } from '../../shared/logger';
import { LOG_ANALYTICS_INIT_FAILED, LOG_ANALYTICS_TRACK_FAILED } from '../../shared/log-constants';
import type { AnalyticsEvent } from '../../shared/analytics/events';
import type { AnalyticsConfig, AnalyticsProvider } from '../../shared/analytics/types';

/** Per-module logger for the renderer Aptabase adapter. @const {Logger} */
const log = new Logger('renderer/analytics/aptabaseRendererProvider');

/**
 * Minimal structural type of the `@aptabase/electron/renderer` module surface
 * used by this adapter. Keeps the file free of static imports (the real
 * module loads lazily inside {@link init}) while retaining type safety.
 */
interface AptabaseRendererSdk {
  trackEvent(eventName: string, props?: Record<string, string | number | boolean>): Promise<void>;
}

/**
 * Aptabase-backed analytics provider for the renderer process.
 * @class AptabaseRendererProvider
 * @implements {AnalyticsProvider}
 */
export class AptabaseRendererProvider implements AnalyticsProvider {
  /** Adapter identifier. @readonly */
  readonly name = 'aptabase';

  /** Lazily loaded SDK module; null until init succeeds. @type {AptabaseRendererSdk | null} */
  private sdk: AptabaseRendererSdk | null = null;

  /** Whether the adapter is accepting events. @type {boolean} */
  private active: boolean;

  /**
   * Creates the provider in inactive state.
   */
  constructor() {
    this.active = false;
  }

  /**
   * Loads the renderer SDK and activates the adapter. `config.enabled` is
   * enforced by the facade; `appKey` is intentionally unavailable here.
   * @param {AnalyticsConfig} config - Resolved config (ignored; only used to
   *   honor the consent/master switch defensively).
   * @returns {Promise<void>} Resolves once the adapter is ready.
   */
  async init(config: AnalyticsConfig): Promise<void> {
    try {
      if (!config.enabled) return;
      const mod = (await import('@aptabase/electron/renderer')) as unknown as AptabaseRendererSdk;
      this.sdk = mod;
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
   * Records a typed event over the SDK's renderer transport. Fire-and-forget.
   * @param {AnalyticsEvent} event - The typed event to record.
   * @returns {void}
   */
  track(event: AnalyticsEvent): void {
    if (!this.active || !this.sdk) return;
    const props = sanitizeProps(event.props);
    try {
      void this.sdk.trackEvent(event.name, props).catch((err) => {
        log.debug(LOG_ANALYTICS_TRACK_FAILED, err);
      });
    } catch (err) {
      log.debug(LOG_ANALYTICS_TRACK_FAILED, err);
    }
  }

  /**
   * Disables recording at runtime (consent off). Events are dropped while
   * inactive; a later `init` reactivates the adapter.
   * @param {boolean} enabled - Whether recording should occur.
   * @returns {void}
   */
  setEnabled(enabled: boolean): void {
    this.active = enabled;
  }
}

/**
 * Reduces raw taxonomy props to the shape the SDK accepts: keys whose values
 * are strings (non-empty), numbers, or booleans survive; everything else is
 * dropped. Mirrors the main adapter's sanitizer.
 * @param {Record<string, unknown>} props - Raw event props.
 * @returns {Record<string, string | number | boolean> | undefined} Sanitized props.
 */
function sanitizeProps(props: Record<string, unknown>): Record<string, string | number | boolean> | undefined {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string') {
      if (value.length > 0) out[key] = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
