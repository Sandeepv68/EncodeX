/**
 * @fileoverview IPC bridge for the Copilot's AI provider settings (AI connector
 * plan §6).
 *
 * Four invoke handlers, all main-process only (the key never crosses IPC):
 *  - {@link IPC.AI_SETTINGS_GET} returns the sanitized {@link AiSettingsView}.
 *  - {@link IPC.AI_SETTINGS_SET} persists a provider/model/baseUrl/key change.
 *  - {@link IPC.AI_CONNECT_TEST} builds the connector and sends a one-token ping.
 *  - {@link IPC.AI_MODELS_LIST} lists the models the provider's API reports.
 *
 * Policy (sanitization, encryption, file IO) lives in `settings.ts`; this module
 * stays thin.
 */

import { app, ipcMain } from 'electron';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import { LOG_AI_CONNECT_TEST_FAILED, LOG_AI_MODEL_LIST_FAILED } from '../../shared/log-constants';
import { formatError } from '../../shared/errors';
import { isAiProviderId } from '../../shared/ai/settings';
import type { AiConnectTestResult, AiModelsListResult, AiSettingsUpdate, AiSettingsView } from '../../shared/ai/settings';
import { classifyAiConnectError } from '../../shared/ai/connect-error';
import {
  applyAiSettingsUpdate,
  decryptApiKey,
  isEncryptionAvailable,
  readAiSettings,
  recordAiConnection,
  sanitizeAiSettings,
  toAiSettingsView,
} from './settings';
import { createConnectorFromSettings, isRemoteProvider } from './connectors';
import { listProviderModels } from './models';

/** Per-module logger for the AI settings IPC bridge. @const {Logger} */
const log = new Logger('main/ai/settings-ipc');

/**
 * Builds the warn arguments for a failed provider call: the thrown error plus,
 * when the provider answered with an HTTP error, its own response body — the
 * status code alone never says *why* the provider refused. The body is read
 * structurally (like {@link classifyAiConnectError}) so it survives mocks.
 * @param {unknown} err - The thrown value.
 * @returns {unknown[]} Arguments for {@link Logger.warn}.
 */
function providerFailureLogArgs(err: unknown): unknown[] {
  const body = err && typeof err === 'object' && 'body' in err ? (err as { body?: unknown }).body : undefined;
  return typeof body === 'string' && body ? [err, `provider response: ${body}`] : [err];
}

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
      return { ok: false, reason: 'offline', message: 'The selected provider runs offline and needs no connection test.' };
    }
    const apiKey = typeof record.apiKey === 'string' && record.apiKey ? record.apiKey : decryptApiKey(stored);
    if (!apiKey) return { ok: false, reason: 'noKey', message: 'No API key is available to test.' };
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
      const view = recordAiConnection(userDataDir, { providerId, model: response.model });
      return { ok: true, message: `Connected to ${providerId}.`, model: response.model, latencyMs: Date.now() - startedAt, view };
    } catch (err) {
      log.warn(LOG_AI_CONNECT_TEST_FAILED, ...providerFailureLogArgs(err));
      const { reason, status } = classifyAiConnectError(err, providerId);
      return { ok: false, message: formatError(err).message, reason, ...(status !== undefined ? { status } : {}) };
    }
  });

  ipcMain.handle(IPC.AI_MODELS_LIST, async (_event, candidate: unknown): Promise<AiModelsListResult> => {
    const stored = readAiSettings(app.getPath('userData'));
    const record = candidate && typeof candidate === 'object' ? (candidate as Record<string, unknown>) : {};
    const providerId = isAiProviderId(record.providerId) ? record.providerId : stored.providerId;
    if (!isRemoteProvider(providerId)) return { ok: false, models: [], reason: 'offline' };
    const apiKey = typeof record.apiKey === 'string' && record.apiKey ? record.apiKey : decryptApiKey(stored);
    if (!apiKey) return { ok: false, models: [], reason: 'noKey' };
    const merged = sanitizeAiSettings({
      ...stored,
      providerId,
      baseUrl: typeof record.baseUrl === 'string' ? record.baseUrl : stored.baseUrl,
    });
    try {
      const models = await listProviderModels(merged, apiKey);
      return { ok: true, models };
    } catch (err) {
      log.warn(LOG_AI_MODEL_LIST_FAILED, ...providerFailureLogArgs(err));
      const { reason, status } = classifyAiConnectError(err, providerId);
      return { ok: false, models: [], reason, ...(status !== undefined ? { status } : {}) };
    }
  });
}
