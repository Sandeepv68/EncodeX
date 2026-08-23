/**
 * @fileoverview Provider factory for the renderer process.
 *
 * Mirrors the main-process factory but for renderer-side adapters. The
 * backend decision itself is made in main (which owns the DSN); the renderer
 * simply mirrors whichever adapter name main reports via
 * `window.electronAPI.monitoringGetState()`. Adding a future backend means
 * adding its renderer counterpart (if any) and one branch here.
 */

import { NoopProvider } from '../../shared/monitoring/noopProvider';
import type { MonitorProvider, MonitoringConfig } from '../../shared/monitoring/types';
import { SentryRendererProvider } from './sentryRendererProvider';

/**
 * Resolves the concrete renderer provider for the given configuration.
 * @param {MonitoringConfig} config - Config whose `provider` field mirrors the
 *   active main-process backend ('sentry' | 'noop').
 * @returns {MonitorProvider | null} The adapter instance, or null to request
 *   the facade's no-op fallback.
 */
export function resolveRendererMonitorProvider(config: MonitoringConfig): MonitorProvider | null {
  const requested = (config.provider || '').toLowerCase();
  if (requested === 'sentry') {
    return new SentryRendererProvider();
  }
  return null;
}
