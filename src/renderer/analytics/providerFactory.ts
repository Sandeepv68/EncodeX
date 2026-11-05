/**
 * @fileoverview Provider factory for the renderer process.
 *
 * Mirrors the main-process factory but for renderer-side adapters. The
 * backend decision itself is made in main (which owns the App Key); the
 * renderer simply mirrors whichever adapter name main reports via
 * `window.electronAPI.analyticsGetState()`. Adding a future backend means
 * adding its renderer counterpart (if any) and one branch here.
 */

import type { AnalyticsProvider, AnalyticsConfig } from '../../shared/analytics/types';
import { AptabaseRendererProvider } from './aptabaseRendererProvider';
import { PostHogRendererProvider } from './posthogRendererProvider';

/**
 * Resolves the concrete renderer provider for the given configuration.
 * @param {AnalyticsConfig} config - Config whose `provider` field mirrors the
 *   active main-process backend ('posthog' | 'aptabase' | 'noop').
 * @returns {AnalyticsProvider | null} The adapter instance, or null to request
 *   the facade's no-op fallback.
 */
export function resolveRendererAnalyticsProvider(config: AnalyticsConfig): AnalyticsProvider | null {
  const requested = (config.provider || '').toLowerCase();
  if (requested === 'posthog') {
    return new PostHogRendererProvider();
  }
  if (requested === 'aptabase') {
    return new AptabaseRendererProvider();
  }
  return null;
}
