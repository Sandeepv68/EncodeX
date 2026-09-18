/**
 * @fileoverview IPC bridge between the renderer's MCP settings UI and the
 * main-process embedded MCP server.
 *
 * Registers two invoke handlers:
 *  - {@link IPC.MCP_SETTINGS_GET} returns the current {@link McpSettings}.
 *  - {@link IPC.MCP_SETTINGS_SET} persists a sanitized snapshot to
 *    `userData/mcp-settings.json` and invokes a live `apply` callback so the
 *    HTTP server can be started/stopped/reconfigured immediately (no restart).
 *
 * The handlers are intentionally thin: policy lives in settings.ts and the
 * startup wiring in index.ts.
 */

import { ipcMain } from 'electron';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import { LOG_FAILED_TO_PERSIST_MCP_SETTINGS, LOG_IPC_MCP_SETTINGS_GET, LOG_IPC_MCP_SETTINGS_SET } from '../../shared/log-constants';
import { readMcpSettings, sanitizeMcpSettings, writeMcpSettings } from './settings';
import type { McpSettings } from './settings';

/** Per-module logger for the MCP settings IPC bridge. @const {Logger} */
const log = new Logger('main/mcp/settings-ipc');

/** Directory where settings are persisted (injected at registration time). @type {string | null} */
let userDataDir: string | null = null;

/** Live callback invoked after every successful SET so the server can react. @type {((s: McpSettings) => void) | null} */
let apply: ((settings: McpSettings) => void) | null = null;

/**
 * Registers the MCP settings IPC channels. Call once during app startup in the
 * GUI branch (the CLI `--mcp` branch never registers this bridge).
 * @param {object} options - Registration options.
 * @param {string} options.userDataDir - Electron `app.getPath('userData')` value.
 * @param {(settings: McpSettings) => void} [options.apply] - Called with the
 *   stored settings after every SET (never on GET).
 * @returns {void}
 */
export function registerMcpSettingsIpc(options: { userDataDir: string; apply?: (settings: McpSettings) => void }): void {
  userDataDir = options.userDataDir;
  apply = options.apply ?? null;

  ipcMain.handle(IPC.MCP_SETTINGS_GET, (): McpSettings => {
    log.info(LOG_IPC_MCP_SETTINGS_GET);
    if (!userDataDir) return { enabled: false, port: 8765, token: '' };
    return readMcpSettings(userDataDir);
  });

  ipcMain.handle(IPC.MCP_SETTINGS_SET, (_event, candidate: unknown): McpSettings => {
    log.info(LOG_IPC_MCP_SETTINGS_SET);
    if (!userDataDir) return { enabled: false, port: 8765, token: '' };
    const next = sanitizeMcpSettings(typeof candidate === 'object' && candidate !== null ? (candidate as Record<string, unknown>) : {});
    writeMcpSettings(userDataDir, next);
    if (apply) {
      try {
        apply(next);
      } catch (err) {
        log.warn(LOG_FAILED_TO_PERSIST_MCP_SETTINGS, 'apply failed:', err);
      }
    }
    return next;
  });
}
