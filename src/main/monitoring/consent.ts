/**
 * @fileoverview Consent persistence for error monitoring.
 *
 * Stores the user's telemetry consent in a small JSON file under the Electron
 * `userData` directory (`monitoring-consent.json`). The file is the single
 * source of truth readable by BOTH bootstrap paths (GUI and CLI) before any
 * renderer exists, which localStorage cannot provide.
 *
 * Semantics:
 *  - Missing file  => consent granted (on-by-default decision, D1).
 *  - Corrupt file  => treated as missing (consent granted), never crashes boot.
 *  - `{"enabled": false}` => telemetry disabled until re-consented.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../shared/logger';
import { LOG_FAILED_TO_PERSIST_MONITORING_CONSENT, LOG_FAILED_TO_READ_STORED_MONITORING_CONSENT } from '../../shared/log-constants';

/** Per-module logger for consent handling. @const {Logger} */
const log = new Logger('main/monitoring/consent');

/**
 * File name of the consent document inside userData.
 * @const {string}
 */
export const MONITORING_CONSENT_FILENAME = 'monitoring-consent.json';

/** In-memory shape of the consent file. */
interface MonitoringConsentFile {
  /** Whether the user consents to error reporting. */
  enabled: boolean;
}

/**
 * Resolves the absolute path of the consent file.
 * @param {string} userDataDir - Electron `app.getPath('userData')` value.
 * @returns {string} Absolute file path.
 */
function consentFilePath(userDataDir: string): string {
  return path.join(userDataDir, MONITORING_CONSENT_FILENAME);
}

/**
 * Reads stored monitoring consent.
 *
 * @param {string} userDataDir - Electron `app.getPath('userData')` value.
 * @returns {boolean} True (default) when the file is absent, unreadable, or
 *   explicitly says `"enabled": true`; false only for an explicit opt-out.
 */
export function readMonitoringConsent(userDataDir: string): boolean {
  try {
    const filePath = consentFilePath(userDataDir);
    if (!fs.existsSync(filePath)) return true;
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<MonitoringConsentFile>;
    return parsed.enabled !== false;
  } catch (err) {
    log.warn(LOG_FAILED_TO_READ_STORED_MONITORING_CONSENT, err);
    return true;
  }
}

/**
 * Persists monitoring consent atomically-ish (write temp then rename is over-
 * kill here; a single writeFileSync with utf-8 JSON matches the repo's other
 * persistence modules).
 *
 * @param {string} userDataDir - Electron `app.getPath('userData')` value.
 * @param {boolean} enabled - Whether the user consents to reporting.
 * @returns {void}
 */
export function writeMonitoringConsent(userDataDir: string, enabled: boolean): void {
  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    const payload: MonitoringConsentFile = { enabled };
    fs.writeFileSync(consentFilePath(userDataDir), JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    log.warn(LOG_FAILED_TO_PERSIST_MONITORING_CONSENT, err);
  }
}
