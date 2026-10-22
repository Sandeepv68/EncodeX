/**
 * @fileoverview Provider model-list fetchers (AI connector plan §6).
 *
 * The settings editor offers a live pick-list of model ids sourced from each
 * provider's own API instead of a hardcoded catalog, so a model a provider adds
 * appears without a code change. One lean, fetch-injectable function per
 * provider maps the neutral call onto its wire format, mirroring the connectors.
 *
 * Nothing here knows about Electron: the caller (the settings IPC bridge)
 * supplies the decrypted key and classifies any thrown {@link ProviderHttpError}
 * with {@link classifyAiConnectError}.
 */

import type { AiServerSettings } from './settings';
import { effectiveModel } from './settings';
import { ProviderHttpError, requestJson } from './connectors';
import type { FetchLike } from './connectors';

/** Default per-request timeout for a model-list call. @const {number} */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Default Anthropic page size for the models endpoint. @const {number} */
const ANTHROPIC_PAGE_SIZE = 100;

/**
 * GETs a JSON document, throwing a {@link ProviderHttpError} on a non-2xx status
 * so the caller can classify the failure exactly like a connection test.
 * Transient statuses share the connectors' retry budget.
 * @param {FetchLike} fetchImpl - The fetch implementation.
 * @param {string} url - The request URL.
 * @param {Record<string, string>} headers - Request headers.
 * @returns {Promise<unknown>} The parsed JSON body.
 */
async function getJson(fetchImpl: FetchLike, url: string, headers: Record<string, string>): Promise<unknown> {
  return requestJson(fetchImpl, url, { method: 'GET', headers }, AbortSignal.timeout(DEFAULT_TIMEOUT_MS));
}

/**
 * Whether an OpenAI model id is usable for chat completions. The `/v1/models`
 * endpoint lists every model (embeddings, audio, image, moderation, legacy
 * completions), so the non-chat families are filtered out of the pick-list.
 * @param {string} id - The model id.
 * @returns {boolean} True when the id looks like a chat model.
 */
function isOpenAiChatModel(id: string): boolean {
  const lower = id.toLowerCase();
  const nonChat = ['embedding', 'whisper', 'tts', 'dall-e', 'moderation', 'audio', 'transcribe', 'realtime'];
  if (nonChat.some((token) => lower.includes(token))) return false;
  // Legacy base models are superseded by the chat/instruct families.
  if (/^(davinci|babbage|curie|ada)(-|$)/.test(lower)) return false;
  return true;
}

/**
 * One model a provider reported, with the creation date it published (when the
 * provider reports one). The date is what orders the pick-list: the newest
 * model a provider offers is the one least likely to be retired, so it is the
 * safest automatic choice.
 * @interface ProviderModelEntry
 * @property {string} id - The model id.
 * @property {number} [created] - Epoch ms the model was created, when reported.
 */
export interface ProviderModelEntry {
  id: string;
  created?: number;
}

/**
 * Reads the model ids out of an OpenAI-compatible `/v1/models` body. Each row
 * carries a `created` unix timestamp, which the pick-list uses to lead with the
 * newest model.
 * @param {unknown} data - The parsed response body.
 * @returns {ProviderModelEntry[]} The chat-capable model entries.
 */
function openAiModels(data: unknown): ProviderModelEntry[] {
  const rows = (data as { data?: Array<{ id?: unknown; created?: unknown }> }).data;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const id = row && typeof row.id === 'string' ? row.id : '';
      if (!id || !isOpenAiChatModel(id)) return null;
      const created = row && typeof row.created === 'number' && Number.isFinite(row.created) ? row.created * 1000 : undefined;
      return created === undefined ? { id } : { id, created };
    })
    .filter((entry): entry is ProviderModelEntry => entry !== null);
}

/**
 * Reads the model ids out of an Anthropic `/v1/models` body. Each row carries a
 * `created_at` ISO timestamp.
 * @param {unknown} data - The parsed response body.
 * @returns {ProviderModelEntry[]} The model entries.
 */
function anthropicModels(data: unknown): ProviderModelEntry[] {
  const rows = (data as { data?: Array<{ id?: unknown; created_at?: unknown }> }).data;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const id = row && typeof row.id === 'string' ? row.id : '';
      if (!id) return null;
      const raw = row && typeof row.created_at === 'string' ? row.created_at : '';
      const created = raw ? Date.parse(raw) : Number.NaN;
      return Number.isFinite(created) ? { id, created } : { id };
    })
    .filter((entry): entry is ProviderModelEntry => entry !== null);
}

/**
 * Reads the model ids out of a Gemini `models.list` body. Only models that
 * advertise `generateContent` are kept; the `models/` path prefix is stripped.
 * Gemini reports no creation date, so these entries stay in name order.
 * @param {unknown} data - The parsed response body.
 * @returns {ProviderModelEntry[]} The model entries.
 */
function geminiModels(data: unknown): ProviderModelEntry[] {
  const rows = (data as { models?: Array<{ name?: unknown; supportedGenerationMethods?: unknown }> }).models;
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => {
      if (!row || typeof row.name !== 'string') return false;
      const methods = row.supportedGenerationMethods;
      return Array.isArray(methods) && methods.includes('generateContent');
    })
    .map((row) => ({ id: (row.name as string).replace(/^models\//, '') }));
}

/**
 * Orders two model entries: dated models come first (newest first), undated
 * ones keep their name order.
 * @param {ProviderModelEntry} a - The first entry.
 * @param {ProviderModelEntry} b - The second entry.
 * @returns {number} The sort order.
 */
function compareEntries(a: ProviderModelEntry, b: ProviderModelEntry): number {
  if (a.created !== undefined && b.created !== undefined) return b.created - a.created;
  if (a.created !== undefined) return -1;
  if (b.created !== undefined) return 1;
  return a.id.localeCompare(b.id);
}

/**
 * Orders the provider's model ids for the pick-list: the provider's newest
 * models first (the ones least likely to be retired), with the configured
 * model leading when the provider reports it.
 * @param {ProviderModelEntry[]} entries - The model entries.
 * @param {string} preferred - The configured model id to lead with.
 * @returns {ProviderModelEntry[]} The de-duplicated, ordered entries.
 */
function orderModels(entries: ProviderModelEntry[], preferred: string): ProviderModelEntry[] {
  const unique = Array.from(new Map(entries.map((entry) => [entry.id, entry])).values()).sort(compareEntries);
  if (preferred) {
    const index = unique.findIndex((entry) => entry.id === preferred);
    if (index >= 0) return [unique[index], ...unique.filter((_, position) => position !== index)];
  }
  return unique;
}

/**
 * Fetches the model ids a provider's API reports for the configured settings.
 * Throws a {@link ProviderHttpError} on a non-2xx answer and lets a transport
 * error propagate; the caller classifies both.
 * @param {AiServerSettings} settings - The stored settings (provider/base URL).
 * @param {string} apiKey - The decrypted API key.
 * @param {FetchLike} [fetchImpl] - Injectable fetch (tests).
 * @returns {Promise<string[]>} The ordered model ids.
 */
export async function listProviderModels(
  settings: AiServerSettings,
  apiKey: string,
  fetchImpl: FetchLike = globalThis.fetch as FetchLike,
): Promise<string[]> {
  const preferred = effectiveModel(settings);
  switch (settings.providerId) {
    case 'openai': {
      const baseUrl = (settings.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
      const data = await getJson(fetchImpl, `${baseUrl}/models`, { authorization: `Bearer ${apiKey}` });
      return orderModels(openAiModels(data), preferred).map((entry) => entry.id);
    }
    case 'anthropic': {
      const data = await getJson(fetchImpl, `https://api.anthropic.com/v1/models?limit=${ANTHROPIC_PAGE_SIZE}`, {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      });
      return orderModels(anthropicModels(data), preferred).map((entry) => entry.id);
    }
    case 'gemini': {
      const data = await getJson(fetchImpl, 'https://generativelanguage.googleapis.com/v1beta/models', {
        'x-goog-api-key': apiKey,
      });
      return orderModels(geminiModels(data), preferred).map((entry) => entry.id);
    }
    default:
      return [];
  }
}
