/**
 * @fileoverview Provider factory for the main process.
 *
 * Single place that decides which {@link MonitorProvider} adapter to activate
 * based on configuration and environment. Swapping monitoring backends in the
 * future means adding an adapter file and one branch here - no other code
 * changes.
 *
 * Selection rules:
 *  1. `MONITORING_PROVIDER` env var wins when set ('noop' | 'sentry' today).
 *  2. Otherwise 'sentry' is selected when a DSN is present in config/env.
 *  3. Anything unrecognized falls back to undefined -> facade uses noop.
 */

import { NoopProvider } from '../../shared/monitoring/noopProvider';
import type { MonitorProvider, MonitoringConfig } from '../../shared/monitoring/types';
import { SentryMainProvider } from './sentryMainProvider';

/**
 * Environment variable overriding automatic provider selection.
 * @const {string}
 */
export const MONITORING_PROVIDER_ENV_VAR = 'MONITORING_PROVIDER';

/**
 * Resolves the concrete main-process provider for the given configuration.
 * Consent (`config.enabled`) is enforced by the facade; this factory only
 * picks the backend type.
 * @param {MonitoringConfig} config - Startup configuration.
 * @returns {MonitorProvider | null} The adapter instance, or null to request
 *   the facade's no-op fallback (e.g. nothing configured).
 */
export function resolveMainMonitorProvider(config: MonitoringConfig): MonitorProvider | null {
  const requested = (process.env[MONITORING_PROVIDER_ENV_VAR] || config.provider || '').toLowerCase();

  if (requested === 'noop') {
    return new NoopProvider(true);
  }

  const dsn = config.dsn || process.env.SENTRY_DSN;
  if ((requested === 'sentry' || requested === '') && dsn) {
    return new SentryMainProvider();
  }

  return null;
}
