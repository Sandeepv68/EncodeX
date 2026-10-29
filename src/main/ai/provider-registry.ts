/**
 * @fileoverview Resolves the active Copilot operation router from AI settings
 * (AI connector plan §7).
 *
 * Returns the LLM-backed router when a remote provider with a stored key is
 * configured, and `null` otherwise so the Copilot IPC handler falls back to the
 * deterministic {@link routeOperationDeterministic}. Everything here is
 * best-effort: a missing key, an unreadable settings file or a missing Electron
 * binding resolves to `null` (offline behavior) rather than throwing.
 */

import { app } from 'electron';
import { createLLMOperationRouter } from '../../shared/ai/llm';
import { createConnectorFromSettings, isRemoteProvider } from './connectors';
import { resolveProviderModel } from './model-resolution';
import { decryptApiKey, effectiveModel, persistProviderModel, readAiSettings } from './settings';
import type { OperationRouter } from './types';

export type { OperationRouter };

/**
 * Builds the operation router for the currently configured provider.
 *
 * No model is hardcoded: the configured model is used, and when the user never
 * chose one, a model is resolved from the provider's own model list and
 * persisted, so the next request needs no extra round-trip.
 * @returns {Promise<OperationRouter | null>} The router, or null for offline planning.
 */
export async function resolveLLMOperationRouter(): Promise<OperationRouter | null> {
  try {
    const userDataDir = app.getPath('userData');
    const settings = readAiSettings(userDataDir);
    if (!isRemoteProvider(settings.providerId)) return null;
    const apiKey = decryptApiKey(settings);
    if (!apiKey) return null;
    const configured = effectiveModel(settings);
    const model = configured || (await resolveProviderModel(settings, apiKey));
    if (!configured) persistProviderModel(userDataDir, settings.providerId, model);
    const connector = createConnectorFromSettings({ ...settings, model }, apiKey);
    return createLLMOperationRouter(connector, settings.providerId);
  } catch {
    return null;
  }
}
