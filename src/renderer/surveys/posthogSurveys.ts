/**
 * @fileoverview PostHog browser SDK initialization for renderer error tracking
 * and optional surveys.
 *
 * Exception autocapture uses the SDK's built-in global handlers. Existing
 * product analytics continues to flow through the main-process relay, so
 * autocapture and pageview capture remain disabled here. The public project
 * token is fetched from the main process over IPC and is never baked into the
 * renderer bundle.
 */

import posthog from 'posthog-js';
import { Logger } from '../../shared/logger';

const log = new Logger('renderer/surveys/posthogSurveys');

let initialised = false;

/**
 * Boots the survey SDK when consent is on and a public token is available.
 * Idempotent. Never throws.
 * @param {boolean} consent - Whether telemetry consent is on.
 * @returns {Promise<void>}
 */
export async function initPosthogSurveys(consent: boolean): Promise<void> {
  if (initialised || !consent) return;
  if (typeof window === 'undefined' || !window.electronAPI?.analyticsGetPosthogConfig) return;
  try {
    const { projectToken, host } = await window.electronAPI.analyticsGetPosthogConfig();
    if (!projectToken || !host) return;
    posthog.init(projectToken, {
      api_host: host,
      autocapture: false,
      capture_pageview: false,
      capture_exceptions: true,
      persistence: 'memory',
    });
    initialised = true;
  } catch (err) {
    log.debug('posthog surveys init failed', err);
  }
}
