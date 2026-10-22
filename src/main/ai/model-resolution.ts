/**
 * @fileoverview Resolves the model id a provider request uses (AI connector plan §6).
 *
 * The app never ships a model name. When the user configured a model, that id
 * is used as-is. When they left the field blank, the model is resolved from the
 * provider's *own* model list (`/models`), whose entries are ordered with the
 * provider's newest model first — the one least likely to be retired. The
 * resolved id is then persisted by the caller, so the choice becomes explicit,
 * visible in the settings and user-overridable.
 *
 * When the provider reports no usable model at all, the resolution fails with
 * an {@link ErrorCode.AI_NOT_CONFIGURED} error the settings bridge classifies
 * as `noModel` ("pick a model id yourself").
 */

import { createError, ErrorCode } from '../../shared/errors';
import { effectiveModel } from './settings';
import type { AiServerSettings } from './settings';
import { listProviderModels } from './models';
import type { FetchLike } from './connectors';

/**
 * Resolves the model id to send to a provider.
 *
 * Prefers the configured model; falls back to the provider's own model list
 * (newest first). Throws when neither yields a model, and lets a provider
 * failure (invalid key, network error) propagate so the caller can classify it.
 * @param {AiServerSettings} settings - The stored settings (provider/model/base URL).
 * @param {string} apiKey - The decrypted API key.
 * @param {FetchLike} [fetchImpl] - Injectable fetch (tests).
 * @returns {Promise<string>} The model id to use.
 */
export async function resolveProviderModel(settings: AiServerSettings, apiKey: string, fetchImpl?: FetchLike): Promise<string> {
  const configured = effectiveModel(settings);
  if (configured) return configured;
  const models = await listProviderModels(settings, apiKey, fetchImpl);
  const picked = models[0];
  if (!picked) {
    throw createError(ErrorCode.AI_NOT_CONFIGURED, 'No model is configured and the provider reported no usable model to pick.');
  }
  return picked;
}
