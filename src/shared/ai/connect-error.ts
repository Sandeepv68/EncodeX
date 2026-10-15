/**
 * @fileoverview Classifies an AI provider connection failure into a stable,
 * machine-readable reason so the renderer can show a localized message instead
 * of the raw provider payload.
 *
 * The mapping is derived from the documented error shapes of the supported
 * providers:
 *  - OpenAI (and OpenAI-compatible hosts such as OpenRouter, Groq, Ollama and
 *    LM Studio) return `{ error: { message, type, param, code } }` and use
 *    codes like `invalid_api_key`, `insufficient_quota`, `model_not_found` and
 *    `rate_limit_exceeded`.
 *  - Anthropic returns `{ type: 'error', error: { type, message } }` with types
 *    such as `authentication_error`, `permission_error`, `not_found_error`,
 *    `rate_limit_error`, `overloaded_error` and `api_error`.
 *  - Google Gemini returns `{ error: { code, message, status } }` where `status`
 *    is a canonical gRPC status such as `INVALID_ARGUMENT`, `UNAUTHENTICATED`,
 *    `PERMISSION_DENIED`, `NOT_FOUND`, `RESOURCE_EXHAUSTED`, `INTERNAL` or
 *    `UNAVAILABLE`.
 *
 * Transport failures (the request never reaches a status response) are
 * classified from the thrown error's message/name.
 *
 * Electron-free and Node-free: this is a pure function shared by the main
 * process and (type-only) the renderer.
 */

import type { AIProviderId } from './types';

/**
 * The canonical reasons a connectivity test can fail. `offline` and `noKey`
 * are decided by the caller (they never reach a provider); the rest come from
 * a provider response or a transport failure.
 * @typedef {('invalidKey' | 'forbidden' | 'modelNotFound' | 'notFound' |
 *   'rateLimit' | 'quota' | 'badRequest' | 'serverError' | 'timeout' |
 *   'network' | 'emptyResponse' | 'noKey' | 'offline' | 'unknown')} AiConnectErrorReason
 */
export type AiConnectErrorReason =
  | 'invalidKey'
  | 'forbidden'
  | 'modelNotFound'
  | 'notFound'
  | 'rateLimit'
  | 'quota'
  | 'badRequest'
  | 'serverError'
  | 'timeout'
  | 'network'
  | 'emptyResponse'
  | 'noKey'
  | 'offline'
  | 'unknown';

/**
 * The classified outcome of a failed connection test.
 * @interface AiConnectErrorInfo
 * @property {AiConnectErrorReason} reason - The canonical failure reason.
 * @property {number} [status] - The HTTP status, when the provider answered.
 */
export interface AiConnectErrorInfo {
  reason: AiConnectErrorReason;
  status?: number;
}

/**
 * The normalized fields pulled out of a provider error body, regardless of the
 * provider's envelope shape.
 * @interface ProviderErrorFields
 * @property {string} [type] - OpenAI/Anthropic error type.
 * @property {string | number} [code] - OpenAI string code or Gemini numeric code.
 * @property {string} [status] - Gemini canonical status string.
 * @property {string} [message] - The provider's human message.
 */
interface ProviderErrorFields {
  type?: string;
  code?: string | number;
  status?: string;
  message?: string;
}

/**
 * Best-effort extraction of the interesting fields from a provider error body.
 * Accepts both the `{ error: { ... } }` envelope (OpenAI, Anthropic, Gemini)
 * and a flat object, and never throws on malformed input.
 * @param {string} body - The raw response body.
 * @returns {ProviderErrorFields} The normalized fields (empty when unparseable).
 */
function readProviderErrorFields(body: string): ProviderErrorFields {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object') return {};
  const root = parsed as Record<string, unknown>;
  const error = root.error && typeof root.error === 'object' ? (root.error as Record<string, unknown>) : root;
  const fields: ProviderErrorFields = {};
  if (typeof error.type === 'string') fields.type = error.type;
  if (typeof error.code === 'string' || typeof error.code === 'number') fields.code = error.code;
  if (typeof error.status === 'string') fields.status = error.status;
  if (typeof error.message === 'string') fields.message = error.message;
  return fields;
}

/**
 * Defensively reads a property off an unknown value (getters/Proxies may throw).
 * @param {unknown} value - The object to read from.
 * @param {string} key - The property name.
 * @returns {unknown} The value, or undefined when it cannot be read.
 */
function safeRead(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') return undefined;
  try {
    return (value as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}

/**
 * Classifies a provider failure for a given provider into a canonical reason.
 * Never throws: malformed inputs fall back to `unknown`.
 * @param {unknown} err - The thrown value (an AppError, a provider HTTP error, or a transport error).
 * @param {AIProviderId} provider - The provider that was being tested.
 * @returns {AiConnectErrorInfo} The classified reason and, when known, the HTTP status.
 */
export function classifyAiConnectError(err: unknown, provider: AIProviderId): AiConnectErrorInfo {
  const rawStatus = safeRead(err, 'status');
  const status = typeof rawStatus === 'number' && Number.isFinite(rawStatus) ? rawStatus : undefined;
  const rawBody = safeRead(err, 'body');
  const body = typeof rawBody === 'string' ? rawBody : '';
  const rawMessage = safeRead(err, 'message');
  const message = typeof rawMessage === 'string' ? rawMessage : '';
  const rawCode = safeRead(err, 'code');
  const appCode = typeof rawCode === 'string' ? rawCode : '';

  return classify({ provider, status, body, message, appCode });
}

/**
 * The pure classification core (see {@link classifyAiConnectError}).
 * @param {object} input - The inputs.
 * @param {AIProviderId} input.provider - The provider under test.
 * @param {number} [input.status] - The HTTP status, when the provider answered.
 * @param {string} [input.body] - The raw error body.
 * @param {string} [input.message] - The thrown error message.
 * @param {string} [input.appCode] - An application error code, when present.
 * @returns {AiConnectErrorInfo} The classified reason and status.
 */
function classify(input: {
  provider: AIProviderId;
  status?: number;
  body?: string;
  message?: string;
  appCode?: string;
}): AiConnectErrorInfo {
  const { provider, status } = input;
  const lower = (input.message ?? '').toLowerCase();
  const fields = input.body ? readProviderErrorFields(input.body) : {};
  const type = (fields.type ?? '').toLowerCase();
  const code = typeof fields.code === 'string' ? fields.code.toLowerCase() : fields.code;
  const gStatus = (fields.status ?? '').toLowerCase();
  const detail = (fields.message ?? '').toLowerCase();

  if (input.appCode === 'AI_RESPONSE_INVALID') return withStatus('emptyResponse', status);
  if (input.appCode === 'AI_NOT_CONFIGURED') return withStatus('unknown', status);

  // Transport failures never carry an HTTP status: classify from the message.
  if (status === undefined) {
    if (isTimeout(lower)) return { reason: 'timeout' };
    if (lower.includes('empty completion') || lower.includes('empty response')) return { reason: 'emptyResponse' };
    if (isNetwork(lower)) return { reason: 'network' };
    return { reason: 'unknown' };
  }

  if (provider === 'gemini') {
    const gemini = classifyGemini(gStatus, detail, lower);
    if (gemini) return withStatus(gemini, status);
  } else if (provider === 'anthropic') {
    const anthropic = classifyAnthropic(type);
    if (anthropic) return withStatus(anthropic, status);
  } else {
    const openai = classifyOpenAi(type, code, detail, lower);
    if (openai) return withStatus(openai, status);
  }

  // Generic fallback keyed off the HTTP status when the body was unhelpful.
  if (status === 401) return { reason: 'invalidKey', status };
  if (status === 403) return { reason: 'forbidden', status };
  if (status === 404) return withStatus(detail.includes('model') || lower.includes('model') ? 'modelNotFound' : 'notFound', status);
  if (status === 429) return { reason: 'rateLimit', status };
  if (status === 400 || status === 422) return { reason: 'badRequest', status };
  if (status >= 500) return { reason: 'serverError', status };
  return { reason: 'unknown', status };
}

/**
 * Attaches the HTTP status to a reason when one is known.
 * @param {AiConnectErrorReason} reason - The classified reason.
 * @param {number} [status] - The HTTP status.
 * @returns {AiConnectErrorInfo} The reason with its status.
 */
function withStatus(reason: AiConnectErrorReason, status?: number): AiConnectErrorInfo {
  return status === undefined ? { reason } : { reason, status };
}

/**
 * Whether a message describes a timeout or an aborted request.
 * @param {string} lower - The lowercased error message.
 * @returns {boolean} True when the failure looks like a timeout.
 */
function isTimeout(lower: string): boolean {
  return (
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes('etimedout') ||
    lower.includes('aborted') ||
    lower.includes('abort')
  );
}

/**
 * Whether a message describes a transport/network failure.
 * @param {string} lower - The lowercased error message.
 * @returns {boolean} True when the failure looks like a network error.
 */
function isNetwork(lower: string): boolean {
  return (
    lower.includes('fetch failed') ||
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('econnreset') ||
    lower.includes('eai_again') ||
    lower.includes('getaddrinfo') ||
    lower.includes('network') ||
    lower.includes('socket')
  );
}

/**
 * Maps a Gemini error (canonical gRPC status + message) to a reason.
 * @param {string} status - The lowercased Gemini status string.
 * @param {string} detail - The lowercased provider message.
 * @param {string} lower - The lowercased thrown message.
 * @returns {AiConnectErrorReason | null} The reason, or null when unmapped.
 */
function classifyGemini(status: string, detail: string, lower: string): AiConnectErrorReason | null {
  const apiKey = detail.includes('api key') || detail.includes('api_key') || lower.includes('api key');
  if (status === 'unauthenticated' || apiKey) return 'invalidKey';
  if (status === 'permission_denied') return 'forbidden';
  if (status === 'not_found' || detail.includes('is not found') || detail.includes('not supported') || detail.includes('not exist')) {
    return 'modelNotFound';
  }
  if (status === 'resource_exhausted') {
    return detail.includes('quota') || detail.includes('billing') ? 'quota' : 'rateLimit';
  }
  if (status === 'invalid_argument') return 'badRequest';
  if (status === 'internal' || status === 'unavailable' || status === 'deadline_exceeded' || status === 'unknown') {
    return 'serverError';
  }
  return null;
}

/**
 * Maps an Anthropic error type to a reason.
 * @param {string} type - The lowercased Anthropic error type.
 * @returns {AiConnectErrorReason | null} The reason, or null when unmapped.
 */
function classifyAnthropic(type: string): AiConnectErrorReason | null {
  if (type === 'authentication_error') return 'invalidKey';
  if (type === 'permission_error') return 'forbidden';
  if (type === 'not_found_error') return 'modelNotFound';
  if (type === 'rate_limit_error') return 'rateLimit';
  if (type === 'overloaded_error' || type === 'api_error') return 'serverError';
  if (type === 'invalid_request_error') return 'badRequest';
  return null;
}

/**
 * Maps an OpenAI (or OpenAI-compatible) error to a reason using its code, type
 * and message.
 * @param {string} type - The lowercased error `type`.
 * @param {string | number | undefined} code - The error `code`.
 * @param {string} detail - The lowercased provider message.
 * @param {string} lower - The lowercased thrown message.
 * @returns {AiConnectErrorReason | null} The reason, or null when unmapped.
 */
function classifyOpenAi(type: string, code: string | number | undefined, detail: string, lower: string): AiConnectErrorReason | null {
  if (
    code === 'invalid_api_key' ||
    code === 'invalid_authentication' ||
    lower.includes('incorrect api key') ||
    detail.includes('incorrect api key')
  ) {
    return 'invalidKey';
  }
  if (code === 'insufficient_quota' || code === 'billing_hard_limit_reached' || detail.includes('quota') || detail.includes('billing')) {
    return 'quota';
  }
  if (code === 'model_not_found' || code === 'model_not_available' || detail.includes('does not exist') || detail.includes('not found')) {
    return 'modelNotFound';
  }
  if (code === 'rate_limit_exceeded' || code === 'rate_limit' || type === 'rate_limit_error') return 'rateLimit';
  if (type === 'invalid_request_error' || code === 'invalid_request') {
    return detail.includes('model') ? 'modelNotFound' : 'badRequest';
  }
  if (type === 'server_error' || type === 'api_error') return 'serverError';
  return null;
}
