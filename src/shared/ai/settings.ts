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
 * Default models per remote provider, used when the user leaves the model blank.
 * @const {Record<string, string>} AI_DEFAULT_MODELS
 */
export const AI_DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
  gemini: 'gemini-2.0-flash',
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
 */
export interface AiServerSettings {
  providerId: AIProviderId;
  model: string;
  baseUrl?: string;
  key: string | null;
  keySetAt?: number;
  storedInsecurely?: boolean;
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
 */
export interface AiSettingsView {
  providerId: AIProviderId;
  model: string;
  baseUrl?: string;
  hasKey: boolean;
  keyHint: string;
  storedInsecurely: boolean;
  encryptionAvailable: boolean;
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
 */
export interface AiConnectTestResult {
  ok: boolean;
  message: string;
  reason?: AiConnectErrorReason;
  status?: number;
  model?: string;
  latencyMs?: number;
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
  const baseUrl = typeof record.baseUrl === 'string' && record.baseUrl.trim() ? record.baseUrl.trim().slice(0, 500) : undefined;
  const key = typeof record.key === 'string' && record.key.length > 0 ? record.key : null;
  const keySetAt = typeof record.keySetAt === 'number' && Number.isFinite(record.keySetAt) ? record.keySetAt : undefined;
  const storedInsecurely = record.storedInsecurely === true;
  return {
    providerId,
    model,
    ...(baseUrl ? { baseUrl } : {}),
    key,
    ...(keySetAt !== undefined ? { keySetAt } : {}),
    ...(storedInsecurely ? { storedInsecurely: true } : {}),
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
  return {
    providerId: settings.providerId,
    model: settings.model,
    ...(settings.baseUrl ? { baseUrl: settings.baseUrl } : {}),
    hasKey: settings.key !== null,
    keyHint: keyHint(settings.key),
    storedInsecurely: settings.storedInsecurely === true,
    encryptionAvailable,
  };
}
