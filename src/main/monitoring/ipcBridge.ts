/**
 * @fileoverview IPC bridge between the renderer's monitoring consent UI and
 * the main-process monitoring subsystem.
 *
 * Registers two invoke handlers:
 *  - {@link IPC.MONITORING_GET_STATE} returns `{ enabled }` reflecting both
 *    user consent and whether a backend is actually active.
 *  - {@link IPC.MONITORING_SET_ENABLED} persists consent to
 *    `userData/monitoring-consent.json` and live-toggles the monitoring
 *    facade (close/re-init semantics).
 *
 * The handlers are intentionally thin: all policy lives in consent.ts and the
 * shared facade so future backends require no IPC changes.
 */

import { ipcMain } from 'electron';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import { LOG_IPC_MONITORING_GET_STATE, LOG_IPC_MONITORING_SET_ENABLED } from '../../shared/log-constants';
import { getMonitoringBackendName, setMonitoringEnabled } from '../../shared/monitoring/MonitoringService';
import type { MonitoringState } from './types';
import { writeMonitoringConsent } from './consent';

/** Per-module logger for the monitoring IPC bridge. @const {Logger} */
const log = new Logger('main/monitoring/ipcBridge');

/** Directory where consent is persisted (injected at registration time). @type {string | null} */
let userDataDir: string | null = null;

/** Whether consent was granted at bootstrap. @type {boolean} */
let bootConsent = true;

/**
 * Registers the monitoring IPC channels. Call once during app startup after
 * monitoring itself has been initialized.
 *
 * @param {object} options - Registration options.
 * @param {string} options.userDataDir - Electron `app.getPath('userData')` value.
 * @param {boolean} options.consentEnabled - Consent state used for bootstrap.
 * @returns {void}
 */
export function registerMonitoringIpcBridge(options: { userDataDir: string; consentEnabled: boolean }): void {
  userDataDir = options.userDataDir;
  bootConsent = options.consentEnabled;

  ipcMain.handle(IPC.MONITORING_GET_STATE, (): MonitoringState => {
    log.info(LOG_IPC_MONITORING_GET_STATE);
    return { enabled: bootConsent, backend: getMonitoringBackendName() };
  });

  ipcMain.handle(IPC.MONITORING_SET_ENABLED, async (_event, enabled: unknown): Promise<MonitoringState> => {
    const next = enabled === true;
    log.info(LOG_IPC_MONITORING_SET_ENABLED, String(next));
    bootConsent = next;
    if (userDataDir) {
      writeMonitoringConsent(userDataDir, next);
    }
    await setMonitoringEnabled(next);
    return { enabled: next, backend: getMonitoringBackendName() };
  });
}
