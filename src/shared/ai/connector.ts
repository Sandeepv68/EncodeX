/**
 * @fileoverview Transport contract for the AI connector layer (AI connector plan §4).
 *
 * A connector is the *transport* half of a provider: it sends a small,
 * provider-neutral conversation and returns text. It is deliberately tiny,
 * stateless, and fetch-injectable so every provider adapter is trivially
 * fakeable in tests. The *planner* half (`src/shared/ai/llm.ts`) builds the
 * prompt and parses the reply; it never knows which transport produced it.
 *
 * This module is Electron-free and Node-free (type-only imports) so it can be
 * imported by the renderer, preload and main process alike.
 */

import type { AIProviderId } from './types';

/**
 * One message in a connector conversation. Only `system` and `user` roles are
 * used: the model is asked once, with no follow-up turns.
 * @interface ConnectorMessage
 * @property {('system'|'user')} role - The message role.
 * @property {string} content - The message text.
 */
export interface ConnectorMessage {
  role: 'system' | 'user';
  content: string;
}

/**
 * A provider-neutral completion request.
 * @interface ConnectorRequest
 * @property {ConnectorMessage[]} messages - The conversation.
 * @property {boolean} [jsonMode] - Ask the provider for strict JSON output when
 *   its API supports it (OpenAI `response_format`, Gemini `responseMimeType`,
 *   Anthropic prefill). Providers that cannot honor it fall back to parsing.
 * @property {number} [temperature] - Sampling temperature; defaults to 0.
 * @property {AbortSignal} [signal] - Cancellation/timeout signal.
 */
export interface ConnectorRequest {
  messages: ConnectorMessage[];
  jsonMode?: boolean;
  temperature?: number;
  signal?: AbortSignal;
}

/**
 * A provider-neutral completion response.
 * @interface ConnectorResponse
 * @property {string} text - The model's raw text reply.
 * @property {string} model - The model id the provider actually used.
 */
export interface ConnectorResponse {
  text: string;
  model: string;
}

/**
 * The identifier a connector reports. It matches an {@link AIProviderId} except
 * for the OpenAI-compatible adapter, which uses the dedicated id below.
 * @typedef {AIProviderId | 'openai-compatible'} ConnectorId
 */
export type ConnectorId = AIProviderId | 'openai-compatible';

/**
 * A stateless text-completion transport for one AI service.
 * @interface AIConnector
 * @property {ConnectorId} id - The provider id this connector speaks.
 * @property {string} defaultModel - The model used when settings omit one.
 * @property {function(ConnectorRequest): Promise<ConnectorResponse>} complete -
 *   Sends the conversation and resolves the reply.
 */
export interface AIConnector {
  readonly id: ConnectorId;
  readonly defaultModel: string;
  complete(request: ConnectorRequest): Promise<ConnectorResponse>;
}
