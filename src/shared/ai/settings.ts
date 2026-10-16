/**
 * @fileoverview AI provider settings contract (AI connector plan §6).
 *
 * The shape stored on disk in `userData/ai-settings.json` and the *sanitized*
 * view that crosses IPC to the renderer. The API key is encrypted with Electron
 * `safeStorage` before it is written, so the plaintext key never leaves the main
 * process; the renderer only ever sees {@link AiSettingsView} (`hasKey`,
 * `keyHint`).
 *
 * Electron-free and Node-free: the encryption and file IO live in
 * `src/main/ai/settings.ts`.
 */

import type { AIProviderId } from './types';
import type { AiConnectErrorReason } from './connect-error';

/**
 * The provider ids a user may select for Copilot planning. `rules` is the
 * offline default; `local` uses a local runtime; the rest are remote.
 * @const {readonly AIProviderId[]} AI_PROVIDER_CHOICES
 */
export const AI_PROVIDER_CHOICES: readonly AIProviderId[] = ['rules', 'openai', 'anthropic', 'gemini', 'local'] as const;

/**
 * Providers that require a user-supplied API key.
 * @const {ReadonlySet<AIProviderId>} AI_PROVIDERS_REQUIRING_KEY
 */
export const AI_PROVIDERS_REQUIRING_KEY: ReadonlySet<AIProviderId> = new Set(['openai', 'anthropic', 'gemini']);

/**
 * Providers that call a remote host and therefore need an active network
 * connection. The renderer disables these while the app is offline; the
 * built-in `rules` engine and a `local` runtime keep working without a network.
 * @const {ReadonlySet<AIProviderId>} AI_PROVIDERS_REQUIRING_NETWORK
 */
export const AI_PROVIDERS_REQUIRING_NETWORK: ReadonlySet<AIProviderId> = new Set(['openai', 'anthropic', 'gemini']);

/**
 * Default models per remote provider, used when the user leaves the model blank.
 * @const {Record<string, string>} AI_DEFAULT_MODELS
 */
export const AI_DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
  gemini: 'gemini-3.8-flash',
};

/**
 * The persisted AI settings document (written to `userData/ai-settings.json`).
 * @interface AiServerSettings
 * @property {AIProviderId} providerId - The selected provider.
 * @property {string} model - The model id (empty means "provider default").
 * @property {string} [baseUrl] - OpenAI-compatible base URL override.
 * @property {string | null} key - Encrypted (base64) key, or null when unset.
 * @property {number} [keySetAt] - Epoch ms the key was last set.
 * @property {boolean} [storedInsecurely] - True when the key is plaintext
 *   because `safeStorage` was unavailable and the user accepted the risk.
 * @property {number} [connectedAt] - Epoch ms of the last successful connection
 *   test. Cleared whenever the settings change.
 * @property {AIProviderId} [connectedProvider] - The provider verified by the
 *   last successful test.
 * @property {string} [connectedModel] - The model that answered the last
 *   successful test.
 */
export interface AiServerSettings {
  providerId: AIProviderId;
  model: string;
  baseUrl?: string;
  key: string | null;
  keySetAt?: number;
  storedInsecurely?: boolean;
  connectedAt?: number;
  connectedProvider?: AIProviderId;
  connectedModel?: string;
}

/**
 * The sanitized settings view sent to the renderer (never includes the key).
 * @interface AiSettingsView
 * @property {AIProviderId} providerId - The selected provider.
 * @property {string} model - The model id.
 * @property {string} [baseUrl] - Base URL override, if any.
 * @property {boolean} hasKey - Whether a key is stored.
 * @property {string} keyHint - A non-secret hint (e.g. `•••• 1234`).
 * @property {boolean} storedInsecurely - Whether the key is stored in plaintext.
 * @property {boolean} encryptionAvailable - Whether `safeStorage` is usable.
 * @property {boolean} connected - Whether the stored config passed a connection
 *   test (has a key, and the verified provider matches the selected provider).
 * @property {number} [connectedAt] - Epoch ms of the successful test, when connected.
 * @property {string} [connectedModel] - The verified model, when connected.
 */
export interface AiSettingsView {
  providerId: AIProviderId;
  model: string;
  baseUrl?: string;
  hasKey: boolean;
  keyHint: string;
  storedInsecurely: boolean;
  encryptionAvailable: boolean;
  connected: boolean;
  connectedAt?: number;
  connectedModel?: string;
}

/**
 * The renderer's request to update AI settings.
 * @interface AiSettingsUpdate
 * @property {AIProviderId} providerId - The selected provider.
 * @property {string} [model] - The model id.
 * @property {string} [baseUrl] - Base URL override.
 * @property {string} [apiKey] - A new plaintext key to store (encrypted at rest).
 * @property {boolean} [clearKey] - Remove any stored key.
 */
export interface AiSettingsUpdate {
  providerId: AIProviderId;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  clearKey?: boolean;
}

/**
 * The result of a connectivity test.
 * @interface AiConnectTestResult
 * @property {boolean} ok - Whether the connector answered.
 * @property {string} message - A human message (success detail or a fallback).
 * @property {AiConnectErrorReason} [reason] - The classified failure reason, so
 *   the renderer can show a localized message instead of the raw payload.
 * @property {number} [status] - The provider HTTP status, when it answered.
 * @property {string} [model] - The model that answered, on success.
 * @property {number} [latencyMs] - Round-trip time of the test, on success.
 * @property {AiSettingsView} [view] - The refreshed settings view after a
 *   successful test (the connection is recorded), so the renderer can show the
 *   persisted status without a second round-trip.
 */
export interface AiConnectTestResult {
  ok: boolean;
  message: string;
  reason?: AiConnectErrorReason;
  status?: number;
  model?: string;
  latencyMs?: number;
  view?: AiSettingsView;
}

/**
 * The result of listing the available models from a provider's own API, so the
 * settings editor can offer a live pick-list instead of a hardcoded catalog.
 * @interface AiModelsListResult
 * @property {boolean} ok - Whether the provider answered with a model list.
 * @property {string[]} models - The model ids the provider reported (empty on failure).
 * @property {AiConnectErrorReason} [reason] - The classified failure reason, so the
 *   renderer can show a localized message instead of the raw payload.
 * @property {number} [status] - The provider HTTP status, when it answered.
 */
export interface AiModelsListResult {
  ok: boolean;
  models: string[];
  reason?: AiConnectErrorReason;
  status?: number;
}

/**
 * Builds the default (offline) settings document.
 * @returns {AiServerSettings} `providerId: 'rules'`, no key.
 */
export function defaultAiSettings(): AiServerSettings {
  return { providerId: 'rules', model: '', key: null };
}

/**
 * Whether a value is a selectable provider id.
 * @param {unknown} value - The candidate.
 * @returns {boolean} True when `value` is an {@link AIProviderId}.
 */
export function isAiProviderId(value: unknown): value is AIProviderId {
  return typeof value === 'string' && (AI_PROVIDER_CHOICES as readonly string[]).includes(value);
}

/**
 * Coerces a candidate `baseUrl` into a safe value, or `undefined` when there is
 * none. The value is trimmed, any CR/LF is stripped (a base URL is later
 * concatenated into a request URL and a header-bearing newline must never
 * survive), and only `http:`/`https:` schemes are accepted so a hostile
 * `javascript:` (or any other) scheme can never reach `fetch`.
 * @param {unknown} value - The candidate base URL.
 * @returns {string | undefined} A safe base URL, or undefined.
 */
function sanitizeBaseUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.replace(/[\r\n]+/g, '').trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return undefined;
  return trimmed.slice(0, 500);
}

/**
 * Coerces arbitrary input into a valid, complete settings document. Unknown
 * providers fall back to `rules`; the key is preserved verbatim (already
 * encrypted by the caller) or dropped.
 * @param {unknown} input - The candidate document.
 * @returns {AiServerSettings} A sanitized document.
 */
export function sanitizeAiSettings(input: unknown): AiServerSettings {
  const record = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const providerId = isAiProviderId(record.providerId) ? record.providerId : 'rules';
  const model = typeof record.model === 'string' ? record.model.trim().slice(0, 200) : '';
  const baseUrl = sanitizeBaseUrl(record.baseUrl);
  const key = typeof record.key === 'string' && record.key.length > 0 ? record.key : null;
  const keySetAt = typeof record.keySetAt === 'number' && Number.isFinite(record.keySetAt) ? record.keySetAt : undefined;
  const storedInsecurely = record.storedInsecurely === true;
  const connectedAt =
    typeof record.connectedAt === 'number' && Number.isFinite(record.connectedAt) ? record.connectedAt : undefined;
  const connectedProvider = isAiProviderId(record.connectedProvider) ? record.connectedProvider : undefined;
  const connectedModel =
    typeof record.connectedModel === 'string' && record.connectedModel.trim()
      ? record.connectedModel.trim().slice(0, 200)
      : undefined;
  return {
    providerId,
    model,
    ...(baseUrl ? { baseUrl } : {}),
    key,
    ...(keySetAt !== undefined ? { keySetAt } : {}),
    ...(storedInsecurely ? { storedInsecurely: true } : {}),
    ...(connectedAt !== undefined ? { connectedAt } : {}),
    ...(connectedProvider !== undefined ? { connectedProvider } : {}),
    ...(connectedModel !== undefined ? { connectedModel } : {}),
  };
}

/**
 * Derives a non-secret hint from a stored key. Because the key is encrypted at
 * rest, the hint is a fixed mask rather than the real trailing characters.
 * @param {string | null} _key - The stored (encrypted) key.
 * @returns {string} A masked hint, or an empty string when no key is stored.
 */
export function keyHint(_key: string | null): string {
  return _key ? '••••••••' : '';
}

/**
 * Projects a stored document into the renderer-safe view.
 * @param {AiServerSettings} settings - The stored settings.
 * @param {boolean} encryptionAvailable - Whether `safeStorage` is usable.
 * @returns {AiSettingsView} The sanitized view.
 */
export function toAiSettingsView(settings: AiServerSettings, encryptionAvailable: boolean): AiSettingsView {
  const connected =
    settings.key !== null && settings.connectedAt !== undefined && settings.connectedProvider === settings.providerId;
  return {
    providerId: settings.providerId,
    model: settings.model,
    ...(settings.baseUrl ? { baseUrl: settings.baseUrl } : {}),
    hasKey: settings.key !== null,
    keyHint: keyHint(settings.key),
    storedInsecurely: settings.storedInsecurely === true,
    encryptionAvailable,
    connected,
    ...(connected && settings.connectedAt !== undefined ? { connectedAt: settings.connectedAt } : {}),
    ...(connected && settings.connectedModel !== undefined ? { connectedModel: settings.connectedModel } : {}),
  };
}
