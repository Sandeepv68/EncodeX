/**
 * @fileoverview MCP embedded-server settings persistence for the Electron
 * main process.
 *
 * Stores the Phase-2 MCP server preferences (`enabled`, `port`, `token`) in a
 * small JSON file under the Electron `userData` directory
 * (`mcp-settings.json`). The file is the single source of truth readable by
 * the main process before any renderer exists, mirroring the monitoring-consent
 * persistence pattern.
 *
 * Security note: the token is persisted in plaintext next to the app's other
 * userData files. It only gates a loopback-bound, single-user interface, so a
 * bearer token here is equivalent to the app's own trust boundary (the same
 * user who can read the file can launch the app).
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../shared/logger';
import { LOG_FAILED_TO_PERSIST_MCP_SETTINGS, LOG_FAILED_TO_READ_STORED_MCP_SETTINGS } from '../../shared/log-constants';
import {
  MCP_DEFAULT_PORT,
  MCP_MAX_PORT,
  MCP_MIN_PORT,
  clampMcpPort,
  defaultMcpSettings,
  sanitizeMcpSettings,
} from '../../shared/mcp-settings';
import type { McpSettings } from '../../shared/mcp-settings';

/** Per-module logger for MCP settings. @const {Logger} */
const log = new Logger('main/mcp/settings');

export { MCP_DEFAULT_PORT, MCP_MAX_PORT, MCP_MIN_PORT, clampMcpPort, defaultMcpSettings, sanitizeMcpSettings };
export type { McpSettings };

/**
 * File name of the MCP settings document inside userData.
 * @const {string}
 */
export const MCP_SETTINGS_FILENAME = 'mcp-settings.json';

/**
 * Resolves the absolute path of the settings file.
 * @param {string} userDataDir - Electron `app.getPath('userData')` value.
 * @returns {string} Absolute file path.
 */
export function mcpSettingsFilePath(userDataDir: string): string {
  return path.join(userDataDir, MCP_SETTINGS_FILENAME);
}

/**
 * Reads stored MCP server settings.
 *
 * Missing or corrupt files yield {@link defaultMcpSettings} (server off);
 * reading must never crash boot or block the main window.
 *
 * @param {string} userDataDir - Electron `app.getPath('userData')` value.
 * @returns {McpSettings} The stored (or default) settings.
 */
export function readMcpSettings(userDataDir: string): McpSettings {
  try {
    const filePath = mcpSettingsFilePath(userDataDir);
    if (!fs.existsSync(filePath)) return defaultMcpSettings();
    const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
    const parsed = JSON.parse(raw) as Partial<McpSettings>;
    return sanitizeMcpSettings(parsed);
  } catch (err) {
    log.warn(LOG_FAILED_TO_READ_STORED_MCP_SETTINGS, err);
    return defaultMcpSettings();
  }
}

/**
 * Persists MCP server settings (single utf-8 JSON write, matching the repo's
 * other userData persistence modules). Failures are logged and swallowed.
 * @param {string} userDataDir - Electron `app.getPath('userData')` value.
 * @param {McpSettings} settings - The settings to store.
 * @returns {void}
 */
export function writeMcpSettings(userDataDir: string, settings: McpSettings): void {
  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    const payload = sanitizeMcpSettings(settings);
    fs.writeFileSync(mcpSettingsFilePath(userDataDir), JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    log.warn(LOG_FAILED_TO_PERSIST_MCP_SETTINGS, err);
  }
}
