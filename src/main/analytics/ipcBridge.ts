/**
 * @fileoverview IPC bridge between the renderer's analytics consent UI and
 * the main-process analytics subsystem.
 *
 * Registers two invoke handlers:
 *  - {@link IPC.ANALYTICS_GET_STATE} returns `{ enabled, backend }` reflecting
 *    both user consent and whether a backend is actually active.
 *  - {@link IPC.ANALYTICS_SET_ENABLED} persists consent to
 *    `userData/analytics-consent.json` and live-toggles the analytics facade
 *    (close/re-init semantics).
 *
 * The handlers are intentionally thin: all policy lives in consent.ts and the
 * shared facade so future backends require no IPC changes.
 */

import { ipcMain } from 'electron';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import { LOG_IPC_ANALYTICS_GET_STATE, LOG_IPC_ANALYTICS_SET_ENABLED } from '../../shared/log-constants';
import { getAnalyticsBackendName, setAnalyticsEnabled } from '../../shared/analytics/AnalyticsService';
import type { AnalyticsState } from '../../shared/analytics/types';
import { writeAnalyticsConsent } from './consent';

/** Per-module logger for the analytics IPC bridge. @const {Logger} */
const log = new Logger('main/analytics/ipcBridge');

/** Directory where consent is persisted (injected at registration time). @type {string | null} */
let userDataDir: string | null = null;

/** Whether consent was granted at bootstrap. @type {boolean} */
let bootConsent = true;

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
}
