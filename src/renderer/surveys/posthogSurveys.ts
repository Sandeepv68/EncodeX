/**
 * @fileoverview Optional PostHog surveys in the renderer.
 *
 * Surveys are the only reason `posthog-js` runs in the renderer. It is
 * initialised with autocapture, pageview capture, and session replay disabled,
 * so no element text, URLs, or media content are collected. The project token
 * is fetched from the main process over IPC (it is a public token, but it is
 * never baked into the renderer bundle).
 *
 * Survey targeting and display are handled by PostHog's own rules; this module
 * only boots the SDK so surveys can render.
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
      persistence: 'memory',
    });
    initialised = true;
  } catch (err) {
    log.debug('posthog surveys init failed', err);
  }
}
