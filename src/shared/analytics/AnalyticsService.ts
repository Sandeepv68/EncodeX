/**
 * @fileoverview Privacy-safe product analytics facade (singleton).
 *
 * The ONLY surface application code uses to record product-analytics events.
 * The taxonomy lives in {@link events.ts}; this module routes typed events to
 * the monitoring backend's breadcrumb stream (category `analytics`).
 *
 * Design decisions (documented in `plans/PRODUCT_LAUNCH_GROWTH_PLAN.md`
 * Checkpoint 10 and `plans/SENTRY_MONITORING_PLAN.md`):
 *  - **No new network endpoints.** Events ride the already-disclosed Sentry
 *    breadcrumb channel instead of a second telemetry backend. This keeps the
 *    "your files never leave you" promise intact and avoids double tracking:
 *    Sentry is used for error/session scope only; our events are discrete,
 *    typed markers inside that scope.
 *  - **Consent comes from the monitoring facade.** When the user disabled
 *    telemetry (`monitoring-consent.json` -> `{"enabled": false}`) every
 *    capture is a no-op, so `recordAnalyticsEvent` emits nothing. There is no
 *    separate analytics consent to keep in sync.
 *  - **Zero PII by construction.** Payloads are constrained by the taxonomy in
 *    `events.ts` (categorical values only) and are JSON-serializable.
 *  - **Never throws.** Analytics must never take the app down; all failures are
 *    swallowed and logged at debug level.
 *
 * The class form is used to keep `AnalyticsService` a stable, mockable unit in
 * tests while the module also exports a shared default instance.
 */

import { Logger } from '../logger';
import { addMonitoringBreadcrumb } from '../monitoring/MonitoringService';
import type { AnalyticsEvent } from './events';

/** Per-module logger for the analytics facade. @const {Logger} */
const log = new Logger('shared/analytics');

/**
 * Breadcrumb category under which every analytics event is recorded so it can
 * be filtered/aggregated in the monitoring UI.
 * @const {string}
 */
export const ANALYTICS_BREADCRUMB_CATEGORY = 'analytics';

/**
 * The product-analytics facade. Application code should use the exported
 * singleton {@link analyticsService} instead of constructing its own instance.
 */
export class AnalyticsService {
  /**
   * Records a typed product event through the monitoring breadcrumb channel.
   * Respects telemetry consent implicitly (disabled => no-op). Never throws.
   *
   * @param {AnalyticsEvent} event - A taxa-validated event (see `events.ts`).
   * @returns {void}
   */
  recordEvent(event: AnalyticsEvent): void {
    try {
      addMonitoringBreadcrumb({
        category: ANALYTICS_BREADCRUMB_CATEGORY,
        message: event.name,
        level: 'info',
        data: { ...event.props, schema: event.schema },
      });
      log.debug('analytics event:', event.name, JSON.stringify(event.props));
    } catch (err) {
      log.debug('analytics record failed:', err);
    }
  }
}

/** Shared analytics facade instance used across the application. @type {AnalyticsService} */
export const analyticsService = new AnalyticsService();

/**
 * Convenience helper for call sites that want a one-liner:
 * `recordAnalyticsEvent(createAnalyticsEvent('app_launched', {...}))`.
 * @param {AnalyticsEvent} event - The typed event to record.
 * @returns {void}
 */
export function recordAnalyticsEvent(event: AnalyticsEvent): void {
  analyticsService.recordEvent(event);
}
