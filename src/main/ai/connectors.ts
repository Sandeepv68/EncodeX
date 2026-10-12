/**
 * @fileoverview AI provider connectors (AI connector plan §5).
 *
 * One lean, stateless, fetch-injectable transport per provider. Each connector
 * maps the provider-neutral {@link ConnectorRequest} onto its wire format, POSTs
 * with Node's global `fetch` (no HTTP dependency), and returns the assistant
 * text. Nothing provider-specific leaks past this file: the planner
 * (`src/shared/ai/llm.ts`) only ever sees `{ text, model }`.
 *
 * Connectors must never upload file bytes — only the prompt text (goal + probe
 * facts) is sent, matching the `dataEgress: 'metadata'` descriptor.
 */

import type { AIConnector, ConnectorId, ConnectorRequest, ConnectorResponse } from '../../shared/ai/connector';
import type { AIProviderId } from '../../shared/ai/types';
import { AI_DEFAULT_MODELS } from '../../shared/ai/settings';
import { createError, ErrorCode } from '../../shared/errors';
import { effectiveModel } from './settings';
import type { AiServerSettings } from './settings';

/** The fetch signature connectors depend on (injectable for tests). */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Default per-request timeout. @const {number} */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Reads the assistant text out of an OpenAI-compatible chat completion body.
 * @param {unknown} data - The parsed response body.
 * @returns {string} The assistant message content.
 */
function openAiText(data: unknown): string {
  const choices = (data as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  const content = choices?.[0]?.message?.content;
  return typeof content === 'string' ? content : '';
}

/**
 * Reads the assistant text out of an Anthropic messages body.
 * @param {unknown} data - The parsed response body.
 * @returns {string} The concatenated text blocks.
 */
function anthropicText(data: unknown): string {
  const content = (data as { content?: Array<{ type?: string; text?: unknown }> }).content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('');
}

/**
 * Reads the assistant text out of a Gemini generateContent body.
 * @param {unknown} data - The parsed response body.
 * @returns {string} The candidate text.
 */
function geminiText(data: unknown): string {
  const parts = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> }).candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('');
}

/**
 * POSTs a JSON request and returns the parsed body, throwing a concise error on
 * a non-2xx status so the caller can surface a readable message.
 * @param {FetchLike} fetchImpl - The fetch implementation.
 * @param {string} url - The request URL.
 * @param {Record<string, string>} headers - Request headers.
 * @param {unknown} body - The JSON request body.
 * @param {AbortSignal} [signal] - Cancellation/timeout signal.
 * @returns {Promise<unknown>} The parsed JSON body.
 */
async function postJson(
  fetchImpl: FetchLike,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.text()).slice(0, 300);
    } catch {
      /* ignore */
    }
    throw createError(ErrorCode.AI_CONNECTOR_FAILED, `Provider responded with HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
  }
  return response.json();
}

/**
 * The messages common to every provider, split into a system and user turn.
 * @param {ConnectorRequest} request - The neutral request.
 * @returns {{ system: string; user: string }} The split messages.
 */
function splitMessages(request: ConnectorRequest): { system: string; user: string } {
  const system = request.messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n\n');
  const user = request.messages.filter((message) => message.role === 'user').map((message) => message.content).join('\n\n');
  return { system, user };
}

/**
 * Creates an OpenAI (or OpenAI-compatible) connector. When `baseUrl` is set the
 * request targets that host instead (OpenRouter, Groq, Ollama, LM Studio, ...).
 * @param {object} options - Configuration.
 * @param {string} options.apiKey - The API key.
 * @param {string} [options.model] - The model id.
 * @param {string} [options.baseUrl] - OpenAI-compatible base URL override.
 * @param {FetchLike} [options.fetchImpl] - Injectable fetch.
 * @returns {AIConnector} The connector.
 */
export function createOpenAICompatibleConnector(options: {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
}): AIConnector {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchLike);
  const model = options.model || AI_DEFAULT_MODELS.openai;
  const baseUrl = (options.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const id: ConnectorId = options.baseUrl ? 'openai-compatible' : 'openai';
  return {
    id,
    defaultModel: model,
    async complete(request: ConnectorRequest): Promise<ConnectorResponse> {
      const { system, user } = splitMessages(request);
      const messages = [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: user },
      ];
      const body: Record<string, unknown> = { model, messages, temperature: request.temperature ?? 0 };
      if (request.jsonMode) body.response_format = { type: 'json_object' };
      const signal = request.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
      const data = await postJson(fetchImpl, `${baseUrl}/chat/completions`, { authorization: `Bearer ${options.apiKey}` }, body, signal);
      const text = openAiText(data);
      if (!text) throw createError(ErrorCode.AI_RESPONSE_INVALID, 'Provider returned an empty completion.');
      return { text, model };
    },
  };
}

/**
 * Creates an Anthropic Claude connector. Text blocks are concatenated; strict
 * JSON is requested via the prompt (the planner extracts the object).
 * @param {object} options - Configuration.
 * @param {string} options.apiKey - The API key.
 * @param {string} [options.model] - The model id.
 * @param {FetchLike} [options.fetchImpl] - Injectable fetch.
 * @returns {AIConnector} The connector.
 */
export function createAnthropicConnector(options: { apiKey: string; model?: string; fetchImpl?: FetchLike }): AIConnector {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchLike);
  const model = options.model || AI_DEFAULT_MODELS.anthropic;
  return {
    id: 'anthropic',
    defaultModel: model,
    async complete(request: ConnectorRequest): Promise<ConnectorResponse> {
      const { system, user } = splitMessages(request);
      const body: Record<string, unknown> = {
        model,
        max_tokens: 1024,
        temperature: request.temperature ?? 0,
        messages: [{ role: 'user', content: user }],
      };
      if (system) body.system = system;
      const signal = request.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
      const data = await postJson(
        fetchImpl,
        'https://api.anthropic.com/v1/messages',
        { 'x-api-key': options.apiKey, 'anthropic-version': '2023-06-01' },
        body,
        signal,
      );
      const text = anthropicText(data);
      if (!text) throw createError(ErrorCode.AI_RESPONSE_INVALID, 'Provider returned an empty completion.');
      return { text, model };
    },
  };
}

/**
 * Creates a Google Gemini connector. `jsonMode` sets `responseMimeType` so the
 * model returns a JSON object directly.
 * @param {object} options - Configuration.
 * @param {string} options.apiKey - The API key.
 * @param {string} [options.model] - The model id.
 * @param {FetchLike} [options.fetchImpl] - Injectable fetch.
 * @returns {AIConnector} The connector.
 */
export function createGeminiConnector(options: { apiKey: string; model?: string; fetchImpl?: FetchLike }): AIConnector {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchLike);
  const model = options.model || AI_DEFAULT_MODELS.gemini;
  return {
    id: 'gemini',
    defaultModel: model,
    async complete(request: ConnectorRequest): Promise<ConnectorResponse> {
      const { system, user } = splitMessages(request);
      const body: Record<string, unknown> = {
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          temperature: request.temperature ?? 0,
          ...(request.jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
      };
      if (system) body.systemInstruction = { parts: [{ text: system }] };
      const signal = request.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
      const data = await postJson(
        fetchImpl,
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        { 'x-goog-api-key': options.apiKey },
        body,
        signal,
      );
      const text = geminiText(data);
      if (!text) throw createError(ErrorCode.AI_RESPONSE_INVALID, 'Provider returned an empty completion.');
      return { text, model };
    },
  };
}

/**
 * Builds the connector named by the stored settings. `openai` becomes an
 * OpenAI-compatible connector when a `baseUrl` override is present.
 * @param {AiServerSettings} settings - The stored settings.
 * @param {string} apiKey - The decrypted API key.
 * @param {FetchLike} [fetchImpl] - Injectable fetch (tests).
 * @returns {AIConnector} The connector for the configured provider.
 */
export function createConnectorFromSettings(
  settings: AiServerSettings,
  apiKey: string,
  fetchImpl?: FetchLike,
): AIConnector {
  const model = effectiveModel(settings);
  switch (settings.providerId) {
    case 'anthropic':
      return createAnthropicConnector({ apiKey, model, ...(fetchImpl ? { fetchImpl } : {}) });
    case 'gemini':
      return createGeminiConnector({ apiKey, model, ...(fetchImpl ? { fetchImpl } : {}) });
    case 'openai':
      return createOpenAICompatibleConnector({ apiKey, model, ...(settings.baseUrl ? { baseUrl: settings.baseUrl } : {}), ...(fetchImpl ? { fetchImpl } : {}) });
    default:
      throw createError(ErrorCode.AI_NOT_CONFIGURED, `Provider "${settings.providerId}" does not use a network connector.`);
  }
}

/**
 * Whether a provider id maps to a network connector this build implements.
 * @param {AIProviderId} id - The provider id.
 * @returns {boolean} True for openai/anthropic/gemini.
 */
export function isRemoteProvider(id: AIProviderId): boolean {
  return id === 'openai' || id === 'anthropic' || id === 'gemini';
}
