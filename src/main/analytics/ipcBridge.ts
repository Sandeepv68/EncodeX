/**
 * @fileoverview IPC bridge between the renderer's analytics consent UI and
 * the main-process analytics subsystem.
 *
 * Registers three invoke handlers:
 *  - {@link IPC.ANALYTICS_GET_STATE} returns `{ enabled, backend }` reflecting
 *    both user consent and whether a backend is actually active.
 *  - {@link IPC.ANALYTICS_SET_ENABLED} persists consent to
 *    `userData/analytics-consent.json` and live-toggles the analytics facade
 *    (close/re-init semantics).
 *  - {@link IPC.ANALYTICS_TRACK_EVENT} relays a renderer-side event to the
 *    active main-process backend so backend keys stay out of the renderer.
 *
 * The handlers are intentionally thin: all policy lives in consent.ts and the
 * shared facade so future backends require no IPC changes.
 */

import { ipcMain } from 'electron';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import {
  LOG_ANALYTICS_EXCEPTION_CAPTURE_FAILED,
  LOG_IPC_ANALYTICS_CAPTURE_EXCEPTION,
  LOG_IPC_ANALYTICS_GET_STATE,
  LOG_IPC_ANALYTICS_SET_ENABLED,
  LOG_IPC_ANALYTICS_TRACK_EVENT,
} from '../../shared/log-constants';
import {
  captureAnalyticsException,
  getAnalyticsBackendName,
  setAnalyticsEnabled,
  trackRelayedAnalyticsEvent,
} from '../../shared/analytics/AnalyticsService';
import { createErrorFromAnalyticsExceptionPayload, parseAnalyticsExceptionPayload } from '../../shared/analytics/sanitize';
import type { AnalyticsState } from '../../shared/analytics/types';
import { writeAnalyticsConsent } from './consent';
import { POSTHOG_BUILD_CONFIG } from '../generated/posthogBuildConfig';

/** Per-module logger for the analytics IPC bridge. @const {Logger} */
const log = new Logger('main/analytics/ipcBridge');

/** Directory where consent is persisted (injected at registration time). @type {string | null} */
let userDataDir: string | null = null;

/** Whether consent was granted at bootstrap. @type {boolean} */
let bootConsent = true;

function resolveSurveysEnabled(): boolean {
  const value = process.env.POSTHOG_SURVEYS_ENABLED;
  if (value === undefined) return POSTHOG_BUILD_CONFIG.surveysEnabled;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return POSTHOG_BUILD_CONFIG.surveysEnabled;
}

/**
 * Registers the analytics IPC channels. Call once during app startup after
 * analytics itself has been initialized.
 *
 * @param {object} options - Registration options.
 * @param {string} options.userDataDir - Electron `app.getPath('userData')` value.
 * @param {boolean} options.consentEnabled - Consent state used for bootstrap.
 * @returns {void}
 */
export function registerAnalyticsIpcBridge(options: { userDataDir: string; consentEnabled: boolean }): void {
  userDataDir = options.userDataDir;
  bootConsent = options.consentEnabled;

  ipcMain.handle(IPC.ANALYTICS_GET_STATE, (): AnalyticsState => {
    log.info(LOG_IPC_ANALYTICS_GET_STATE);
    return { enabled: bootConsent, backend: getAnalyticsBackendName() };
  });

  ipcMain.handle(IPC.ANALYTICS_SET_ENABLED, async (_event, enabled: unknown): Promise<AnalyticsState> => {
    const next = enabled === true;
    log.info(LOG_IPC_ANALYTICS_SET_ENABLED, String(next));
    bootConsent = next;
    if (userDataDir) {
      writeAnalyticsConsent(userDataDir, next);
    }
    await setAnalyticsEnabled(next);
    return { enabled: next, backend: getAnalyticsBackendName() };
  });

  ipcMain.handle(IPC.ANALYTICS_TRACK_EVENT, (_event, event: unknown): void => {
    log.debug(LOG_IPC_ANALYTICS_TRACK_EVENT);
    trackRelayedAnalyticsEvent(event);
  });

  ipcMain.handle(IPC.ANALYTICS_CAPTURE_EXCEPTION, (_event, payload: unknown): void => {
    log.debug(LOG_IPC_ANALYTICS_CAPTURE_EXCEPTION);
    try {
      const parsed = parseAnalyticsExceptionPayload(payload);
      if (!parsed) return;
      captureAnalyticsException(createErrorFromAnalyticsExceptionPayload(parsed), parsed.context);
    } catch (err) {
      log.debug(LOG_ANALYTICS_EXCEPTION_CAPTURE_FAILED, err);
    }
  });

  ipcMain.handle(
    IPC.ANALYTICS_GET_POSTHOG_CONFIG,
    (): {
      projectToken?: string;
      host?: string;
      surveysEnabled?: boolean;
      environment?: string;
      channel?: string;
      appVersion?: string;
      platform?: string;
      arch?: string;
      hwAccelAvailable?: boolean;
    } => {
      const token = process.env.POSTHOG_PROJECT_TOKEN ?? POSTHOG_BUILD_CONFIG.projectToken;
      const host = process.env.POSTHOG_HOST ?? POSTHOG_BUILD_CONFIG.host;
      return {
        projectToken: token,
        host,
        surveysEnabled: resolveSurveysEnabled(),
        environment: process.env.NODE_ENV === 'development' ? 'development' : 'production',
        channel: process.env.NODE_ENV === 'development' ? 'dev' : 'prod',
        appVersion: process.env.npm_package_version,
        platform: process.platform,
        arch: process.arch,
      };
    },
  );
}
