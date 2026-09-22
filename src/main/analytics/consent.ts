/**
 * @fileoverview Consent persistence for usage analytics.
 *
 * Stores the user's telemetry consent in a small JSON file under the Electron
 * `userData` directory (`analytics-consent.json`). The file is the single
 * source of truth readable by BOTH bootstrap paths (GUI and CLI) before any
 * renderer exists, which localStorage cannot provide.
 *
 * Semantics (D1 - single telemetry switch shared with monitoring):
 *  - Missing file  => seeded from the monitoring consent value (absent =>
 *    default `true`), so one opt-out propagates to both layers.
 *  - Corrupt file  => treated as missing (seed from monitoring), never crashes boot.
 *  - `{"enabled": false}` => usage analytics disabled until re-consented.
 *
 * When writing, this file stays the authoritative store for the analytics
 * layer; the monitoring file is left untouched (the Settings switch writes
 * both through its own IPC paths).
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../shared/logger';
import { LOG_FAILED_TO_PERSIST_ANALYTICS_CONSENT, LOG_FAILED_TO_READ_STORED_ANALYTICS_CONSENT } from '../../shared/log-constants';
import { readMonitoringConsent } from '../monitoring/consent';

/** Per-module logger for consent handling. @const {Logger} */
const log = new Logger('main/analytics/consent');

/**
 * File name of the analytics consent document inside userData.
 * @const {string}
 */
export const ANALYTICS_CONSENT_FILENAME = 'analytics-consent.json';

/** In-memory shape of the consent file. */
interface AnalyticsConsentFile {
  /** Whether the user consents to usage analytics. */
  enabled: boolean;
}

/**
 * Resolves the absolute path of the consent file.
 * @param {string} userDataDir - Electron `app.getPath('userData')` value.
 * @returns {string} Absolute file path.
 */
function consentFilePath(userDataDir: string): string {
  return path.join(userDataDir, ANALYTICS_CONSENT_FILENAME);
}

/**
 * Reads stored analytics consent.
 *
 * @param {string} userDataDir - Electron `app.getPath('userData')` value.
 * @returns {boolean} True (default) when the file is absent, unreadable, or
 *   explicitly says `"enabled": true`; false only for an explicit opt-out. A
 *   missing file is seeded from the monitoring consent file so both layers
 *   share the same default and any prior opt-out carries over.
 */
export function readAnalyticsConsent(userDataDir: string): boolean {
  try {
    const filePath = consentFilePath(userDataDir);
    if (!fs.existsSync(filePath)) return readMonitoringConsent(userDataDir);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AnalyticsConsentFile>;
    return parsed.enabled !== false;
  } catch (err) {
    log.warn(LOG_FAILED_TO_READ_STORED_ANALYTICS_CONSENT, err);
    return readMonitoringConsent(userDataDir);
  }
}

/**
 * Persists analytics consent atomically-ish (write temp then rename is over-
 * kill here; a single writeFileSync with utf-8 JSON matches the repo's other
 * persistence modules, including the monitoring consent writer).
 *
 * @param {string} userDataDir - Electron `app.getPath('userData')` value.
 * @param {boolean} enabled - Whether the user consents to usage analytics.
 * @returns {void}
 */
export function writeAnalyticsConsent(userDataDir: string, enabled: boolean): void {
  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    const payload: AnalyticsConsentFile = { enabled };
    fs.writeFileSync(consentFilePath(userDataDir), JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    log.warn(LOG_FAILED_TO_PERSIST_ANALYTICS_CONSENT, err);
  }
}
