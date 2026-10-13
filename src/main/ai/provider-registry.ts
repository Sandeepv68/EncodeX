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
import type { OperationRoutingRequest, RoutedOperation } from '../../shared/ai/llm';
import { createConnectorFromSettings, isRemoteProvider } from './connectors';
import { decryptApiKey, readAiSettings } from './settings';

/**
 * The router seam the Copilot handler consumes: resolves a routed operation, or
 * `undefined` to fall back to the deterministic router.
 * @typedef {function(OperationRoutingRequest): Promise<RoutedOperation | undefined>} OperationRouter
 */
export type OperationRouter = (request: OperationRoutingRequest) => Promise<RoutedOperation | undefined>;

/**
 * Builds the operation router for the currently configured provider.
 * @returns {OperationRouter | null} The router, or null for offline planning.
 */
export function resolveLLMOperationRouter(): OperationRouter | null {
  try {
    const userDataDir = app.getPath('userData');
    const settings = readAiSettings(userDataDir);
    if (!isRemoteProvider(settings.providerId)) return null;
    const apiKey = decryptApiKey(settings);
    if (!apiKey) return null;
    const connector = createConnectorFromSettings(settings, apiKey);
    return createLLMOperationRouter(connector, settings.providerId);
  } catch {
    return null;
  }
}
