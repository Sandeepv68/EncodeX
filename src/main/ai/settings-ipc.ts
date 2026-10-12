/**
 * @fileoverview IPC bridge for the Copilot's AI provider settings (AI connector
 * plan §6).
 *
 * Three invoke handlers, all main-process only (the key never crosses IPC):
 *  - {@link IPC.AI_SETTINGS_GET} returns the sanitized {@link AiSettingsView}.
 *  - {@link IPC.AI_SETTINGS_SET} persists a provider/model/baseUrl/key change.
 *  - {@link IPC.AI_CONNECT_TEST} builds the connector and sends a one-token ping.
 *
 * Policy (sanitization, encryption, file IO) lives in `settings.ts`; this module
 * stays thin.
 */

import { app, ipcMain } from 'electron';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import { LOG_FAILED_TO_PERSIST_MCP_SETTINGS } from '../../shared/log-constants';
import { formatError } from '../../shared/errors';
import { isAiProviderId } from '../../shared/ai/settings';
import type { AiConnectTestResult, AiSettingsUpdate, AiSettingsView } from '../../shared/ai/settings';
import { applyAiSettingsUpdate, decryptApiKey, isEncryptionAvailable, readAiSettings, sanitizeAiSettings, toAiSettingsView } from './settings';
import { createConnectorFromSettings, isRemoteProvider } from './connectors';

/** Per-module logger for the AI settings IPC bridge. @const {Logger} */
const log = new Logger('main/ai/settings-ipc');

/**
 * Coerces an IPC payload into a validated {@link AiSettingsUpdate}.
 * @param {unknown} candidate - The raw payload.
 * @returns {AiSettingsUpdate} The sanitized update.
 */
function sanitizeUpdate(candidate: unknown): AiSettingsUpdate {
  const record = candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? (candidate as Record<string, unknown>) : {};
  return {
    providerId: isAiProviderId(record.providerId) ? record.providerId : 'rules',
    ...(typeof record.model === 'string' ? { model: record.model } : {}),
    ...(typeof record.baseUrl === 'string' ? { baseUrl: record.baseUrl } : {}),
    ...(typeof record.apiKey === 'string' ? { apiKey: record.apiKey } : {}),
    ...(record.clearKey === true ? { clearKey: true } : {}),
  };
}

/**
 * Registers the AI settings IPC channels. Call once during app startup.
 * @returns {void}
 */
export function registerAiSettingsIpc(): void {
  ipcMain.handle(IPC.AI_SETTINGS_GET, (): AiSettingsView => {
    return toAiSettingsView(readAiSettings(app.getPath('userData')), isEncryptionAvailable());
  });

  ipcMain.handle(IPC.AI_SETTINGS_SET, (_event, candidate: unknown): AiSettingsView => {
    return applyAiSettingsUpdate(app.getPath('userData'), sanitizeUpdate(candidate));
  });

  ipcMain.handle(IPC.AI_CONNECT_TEST, async (_event, candidate: unknown): Promise<AiConnectTestResult> => {
    const userDataDir = app.getPath('userData');
    const stored = readAiSettings(userDataDir);
    const record = candidate && typeof candidate === 'object' ? (candidate as Record<string, unknown>) : {};
    const providerId = isAiProviderId(record.providerId) ? record.providerId : stored.providerId;
    if (!isRemoteProvider(providerId)) {
      return { ok: false, message: 'The selected provider runs offline and needs no connection test.' };
    }
    const apiKey = typeof record.apiKey === 'string' && record.apiKey ? record.apiKey : decryptApiKey(stored);
    if (!apiKey) return { ok: false, message: 'No API key is available to test.' };
    const merged = sanitizeAiSettings({
      ...stored,
      providerId,
      model: typeof record.model === 'string' ? record.model : stored.model,
      baseUrl: typeof record.baseUrl === 'string' ? record.baseUrl : stored.baseUrl,
    });
    try {
      const connector = createConnectorFromSettings(merged, apiKey);
      const startedAt = Date.now();
      const response = await connector.complete({
        messages: [
          { role: 'system', content: 'You are a connectivity check. Reply with the single word OK.' },
          { role: 'user', content: 'ping' },
        ],
        temperature: 0,
      });
      return { ok: true, message: `Connected to ${providerId}.`, model: response.model, latencyMs: Date.now() - startedAt };
    } catch (err) {
      log.warn(LOG_FAILED_TO_PERSIST_MCP_SETTINGS, 'connect test failed:', err);
      return { ok: false, message: formatError(err).message };
    }
  });
}
