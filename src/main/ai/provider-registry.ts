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
import { AI_PROVIDERS_REQUIRING_KEY } from '../../shared/ai/settings';
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
    // `local` is served by an on-device HTTP runtime, so it uses the connector
    // path without a key. Everything else must be a keyed remote provider.
    if (!isRemoteProvider(settings.providerId) && settings.providerId !== 'local') return null;
    const apiKey = decryptApiKey(settings) ?? '';
    if (!apiKey && AI_PROVIDERS_REQUIRING_KEY.has(settings.providerId)) return null;
    const configured = effectiveModel(settings);
    const model = configured || (await resolveProviderModel(settings, apiKey));
    if (!configured) persistProviderModel(userDataDir, settings.providerId, model);
    const connector = createConnectorFromSettings({ ...settings, model }, apiKey);
    return createLLMOperationRouter(connector, settings.providerId);
  } catch {
    return null;
  }
}
