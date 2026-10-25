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
 * One provider's own configuration (API key, model, endpoint). Kept separate
 * from {@link AiServerSettings}'s flat fields so every provider remembers its
 * own key instead of sharing a single global one.
 * @interface AiProviderConfig
 * @property {string} model - The model id (empty means "not chosen yet": the
 *   app resolves one from the provider's own model list).
 * @property {string} [baseUrl] - OpenAI-compatible base URL override.
 * @property {string | null} key - Encrypted (base64) key, or null when unset.
 * @property {number} [keySetAt] - Epoch ms the key was last set.
 * @property {boolean} [storedInsecurely] - True when the key is plaintext
 *   because `safeStorage` was unavailable and the user accepted the risk.
 */
export interface AiProviderConfig {
  model: string;
  baseUrl?: string;
  key: string | null;
  keySetAt?: number;
  storedInsecurely?: boolean;
}

/**
 * The single active connection: which provider answered the last successful
 * connectivity test and with which model. Independent of the *selected*
 * provider, so switching the editor's selection never clears it.
 * @interface AiActiveConnection
 * @property {AIProviderId} providerId - The provider that answered.
 * @property {string} [model] - The model that answered.
 * @property {number} at - Epoch ms of the successful test.
 */
export interface AiActiveConnection {
  providerId: AIProviderId;
  model?: string;
  at: number;
}

/**
 * The persisted AI settings document (written to `userData/ai-settings.json`).
 *
 * The flat fields always describe the **selected** provider so existing
 * consumers (`decryptApiKey`, `effectiveModel`, `createConnectorFromSettings`)
 * keep working unchanged. Every *other* provider's config lives in
 * {@link AiServerSettings.providers}; the selected provider is never duplicated
 * there, and the connection pointer below is global (one active connection).
 *
 * `providerId` is the **active** provider (the one the Copilot plans with),
 * while {@link AiServerSettings.selectedProviderId} is the provider the user
 * last picked in the Settings editor. The two are kept apart so browsing to
 * another provider never silently changes the active one, while the editor can
 * still restore the tile the user left selected on the next start.
 * @interface AiServerSettings
 * @property {AIProviderId} providerId - The active provider.
 * @property {string} model - The model id (empty means "not chosen yet": the
 *   app resolves one from the provider's own model list).
 * @property {string} [baseUrl] - OpenAI-compatible base URL override.
 * @property {string | null} key - Encrypted (base64) key, or null when unset.
 * @property {number} [keySetAt] - Epoch ms the key was last set.
 * @property {boolean} [storedInsecurely] - True when the key is plaintext
 *   because `safeStorage` was unavailable and the user accepted the risk.
 * @property {Partial<Record<AIProviderId, AiProviderConfig>>} [providers] -
 *   Configs of the providers that are *not* active.
 * @property {AIProviderId} [selectedProviderId] - The provider the user last
 *   selected in the Settings editor. Restored on the next start so the
 *   previously selected (and connected) provider is auto-selected.
 * @property {number} [connectedAt] - Epoch ms of the last successful connection
 *   test. Cleared only when the connected provider's own config changes.
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
  providers?: Partial<Record<AIProviderId, AiProviderConfig>>;
  selectedProviderId?: AIProviderId;
  connectedAt?: number;
  connectedProvider?: AIProviderId;
  connectedModel?: string;
}

/**
 * A non-secret summary of one provider's stored config, so the renderer can
 * show the correct saved-key/model/endpoint for a provider the user selects in
 * the editor without a round-trip (the selected provider's own config is the
 * flat {@link AiSettingsView} fields; every other provider is summarized here).
 * @interface AiProviderSummary
 * @property {string} model - The model id (empty means "not chosen yet").
 * @property {string} [baseUrl] - Base URL override, if any.
 * @property {boolean} hasKey - Whether a key is stored for this provider.
 * @property {string} keyHint - A non-secret hint (e.g. `••••••••`).
 * @property {boolean} storedInsecurely - Whether the key is stored in plaintext.
 */
export interface AiProviderSummary {
  model: string;
  baseUrl?: string;
  hasKey: boolean;
  keyHint: string;
  storedInsecurely: boolean;
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
 * @property {AiActiveConnection} [activeConnection] - The single active
 *   connection, when one is recorded. Present regardless of which provider is
 *   currently selected, so the UI can show a connection that lives elsewhere.
 * @property {AIProviderId} [selectedProviderId] - The provider the user last
 *   selected in the Settings editor. Always present in a view; it falls back
 *   to `providerId` for documents written before the selection was persisted.
 * @property {Partial<Record<AIProviderId, AiProviderSummary>>} [providerSummaries] -
 *   Non-secret summaries of the providers that are *not* active, so the editor
 *   can show each provider's own saved key/model/endpoint the instant it is
 *   selected, without persisting the selection or a round-trip.
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
  activeConnection?: AiActiveConnection;
  selectedProviderId?: AIProviderId;
  providerSummaries?: Partial<Record<AIProviderId, AiProviderSummary>>;
}

/**
 * The renderer's request to update AI settings.
 * @interface AiSettingsUpdate
 * @property {AIProviderId} providerId - The provider the update targets.
 * @property {string} [model] - The model id.
 * @property {string} [baseUrl] - Base URL override.
 * @property {string} [apiKey] - A new plaintext key to store (encrypted at rest).
 * @property {boolean} [clearKey] - Remove any stored key.
 * @property {boolean} [activate] - Whether the targeted provider becomes the
 *   *active* one (the provider the Copilot plans with). Defaults to true;
 *   `false` applies the change to the targeted provider's own stored config
 *   without touching the active provider (used when the user only browses to
 *   another provider in the editor).
 */
export interface AiSettingsUpdate {
  providerId: AIProviderId;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  clearKey?: boolean;
  activate?: boolean;
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
 * Coerces an arbitrary candidate into one provider's config, or null when the
 * result would be indistinguishable from the blank default (so a persisted
 * document never grows empty slots).
 * @param {unknown} input - The candidate config.
 * @returns {AiProviderConfig | null} A sanitized config, or null when blank.
 */
function sanitizeProviderConfig(input: unknown): AiProviderConfig | null {
  const record = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const model = typeof record.model === 'string' ? record.model.trim().slice(0, 200) : '';
  const baseUrl = sanitizeBaseUrl(record.baseUrl);
  const key = typeof record.key === 'string' && record.key.length > 0 ? record.key : null;
  const keySetAt = typeof record.keySetAt === 'number' && Number.isFinite(record.keySetAt) ? record.keySetAt : undefined;
  const storedInsecurely = record.storedInsecurely === true;
  const config: AiProviderConfig = { model, key };
  if (baseUrl) config.baseUrl = baseUrl;
  if (keySetAt !== undefined) config.keySetAt = keySetAt;
  if (storedInsecurely) config.storedInsecurely = true;
  return isBlankProviderConfig(config) ? null : config;
}

/**
 * Whether a provider config carries nothing but defaults (no key, no model, no
 * endpoint), so it does not need a slot in the persisted map.
 * @param {AiProviderConfig} config - The candidate config.
 * @returns {boolean} True when the config is effectively empty.
 */
export function isBlankProviderConfig(config: AiProviderConfig): boolean {
  return config.model === '' && config.key === null && config.baseUrl === undefined;
}

/**
 * Projects the flat (selected-provider) fields of a document onto a standalone
 * provider config, dropping the global connection pointer.
 * @param {AiServerSettings} settings - The stored settings.
 * @returns {AiProviderConfig} The selected provider's config.
 */
export function toAiProviderConfig(settings: AiServerSettings): AiProviderConfig {
  const config: AiProviderConfig = { model: settings.model, key: settings.key };
  if (settings.baseUrl) config.baseUrl = settings.baseUrl;
  if (settings.keySetAt !== undefined) config.keySetAt = settings.keySetAt;
  if (settings.storedInsecurely === true) config.storedInsecurely = true;
  return config;
}

/**
 * Builds the flat settings document for one provider, reading the selected
 * provider's own flat fields or the stored slot for any other provider. The
 * returned document never carries the connection pointer (that stays global)
 * and never carries the `providers` map.
 * @param {AiServerSettings} settings - The stored settings document.
 * @param {AIProviderId} providerId - The provider whose config is wanted.
 * @returns {AiServerSettings} A flat document for that provider.
 */
export function resolveAiProviderSettings(settings: AiServerSettings, providerId: AIProviderId): AiServerSettings {
  if (providerId === settings.providerId) return settings;
  const config = settings.providers?.[providerId];
  if (!config) return { providerId, model: '', key: null };
  const resolved: AiServerSettings = { providerId, model: config.model, key: config.key };
  if (config.baseUrl) resolved.baseUrl = config.baseUrl;
  if (config.keySetAt !== undefined) resolved.keySetAt = config.keySetAt;
  if (config.storedInsecurely === true) resolved.storedInsecurely = true;
  return resolved;
}

/**
 * Coerces arbitrary input into a valid, complete settings document. Unknown
 * providers fall back to `rules`; the key is preserved verbatim (already
 * encrypted by the caller) or dropped. The `providers` map is normalized to
 * known ids only and never duplicates the selected provider.
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
  const selectedProviderId = isAiProviderId(record.selectedProviderId) ? record.selectedProviderId : undefined;
  const connectedAt = typeof record.connectedAt === 'number' && Number.isFinite(record.connectedAt) ? record.connectedAt : undefined;
  const connectedProvider = isAiProviderId(record.connectedProvider) ? record.connectedProvider : undefined;
  const connectedModel =
    typeof record.connectedModel === 'string' && record.connectedModel.trim() ? record.connectedModel.trim().slice(0, 200) : undefined;

  // Normalize the per-provider slots. Iterating the known choices (instead of
  // the input's own keys) keeps prototype-polluting names out.
  const source =
    record.providers && typeof record.providers === 'object' && !Array.isArray(record.providers)
      ? (record.providers as Record<string, unknown>)
      : null;
  let providers: Partial<Record<AIProviderId, AiProviderConfig>> | undefined;
  if (source) {
    for (const candidate of AI_PROVIDER_CHOICES) {
      if (candidate === providerId) continue;
      if (!Object.prototype.hasOwnProperty.call(source, candidate)) continue;
      const config = sanitizeProviderConfig(source[candidate]);
      if (config) (providers ??= {})[candidate] = config;
    }
  }

  return {
    providerId,
    model,
    ...(baseUrl ? { baseUrl } : {}),
    key,
    ...(keySetAt !== undefined ? { keySetAt } : {}),
    ...(storedInsecurely ? { storedInsecurely: true } : {}),
    ...(providers ? { providers } : {}),
    ...(selectedProviderId !== undefined ? { selectedProviderId } : {}),
    ...(connectedAt !== undefined ? { connectedAt } : {}),
    ...(connectedProvider !== undefined ? { connectedProvider } : {}),
    ...(connectedModel !== undefined ? { connectedModel } : {}),
  };
}

/**
 * Derives the renderer-safe view for a provider the user selected in the editor,
 * without persisting the selection. When the provider is the one the view
 * already describes the view is returned unchanged; otherwise the provider's
 * own non-secret summary is projected onto a flat view (its connection status is
 * false, because the single active connection always lives on the base view and
 * is surfaced separately via {@link AiActiveConnection}).
 *
 * The projection reports the projected provider as the editor's selection, so
 * the view always describes the provider it was asked for.
 * @param {AiSettingsView} view - The server-provided view (the selected provider's).
 * @param {AIProviderId} providerId - The provider the editor now shows.
 * @returns {AiSettingsView} The view for that provider.
 */
export function viewForProvider(view: AiSettingsView, providerId: AIProviderId): AiSettingsView {
  if (providerId === view.providerId) {
    // The active provider's own config lives in the flat fields, so the base
    // view is the projection; only the reported selection changes.
    return providerId === view.selectedProviderId ? view : { ...view, selectedProviderId: providerId };
  }
  const summary = view.providerSummaries?.[providerId];
  return {
    providerId,
    model: summary?.model ?? '',
    ...(summary?.baseUrl ? { baseUrl: summary.baseUrl } : {}),
    hasKey: summary?.hasKey ?? false,
    keyHint: summary?.keyHint ?? '',
    storedInsecurely: summary?.storedInsecurely ?? false,
    encryptionAvailable: view.encryptionAvailable,
    connected: false,
    ...(view.activeConnection ? { activeConnection: view.activeConnection } : {}),
    selectedProviderId: providerId,
  };
}

/**
 * Reads the provider the editor should show as selected: the persisted
 * selection, falling back to the active provider for documents written before
 * the selection was stored.
 * @param {AiSettingsView | null} view - The settings view, or null.
 * @returns {AIProviderId | null} The provider to select, or null when there is no view.
 */
export function selectedProviderOf(view: AiSettingsView | null): AIProviderId | null {
  if (!view) return null;
  return isAiProviderId(view.selectedProviderId) ? view.selectedProviderId : view.providerId;
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
  // The built-in rules engine needs no key, so it can be connected keylessly.
  const hasCredentials = settings.key !== null || settings.providerId === 'rules';
  const connected = hasCredentials && settings.connectedAt !== undefined && settings.connectedProvider === settings.providerId;
  // The active connection is global: it reports whichever provider answered the
  // last test, even when a different provider is currently selected.
  const activeConnection =
    settings.connectedAt !== undefined && settings.connectedProvider !== undefined
      ? {
          providerId: settings.connectedProvider,
          ...(settings.connectedModel !== undefined ? { model: settings.connectedModel } : {}),
          at: settings.connectedAt,
        }
      : undefined;
  // Summarize the non-selected providers so the editor can show the correct
  // saved-key/model/endpoint immediately when the user switches selection.
  let providerSummaries: Partial<Record<AIProviderId, AiProviderSummary>> | undefined;
  if (settings.providers) {
    for (const candidate of AI_PROVIDER_CHOICES) {
      if (candidate === settings.providerId) continue;
      const config = settings.providers[candidate];
      if (!config) continue;
      (providerSummaries ??= {})[candidate] = {
        model: config.model,
        ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
        hasKey: config.key !== null,
        keyHint: keyHint(config.key),
        storedInsecurely: config.storedInsecurely === true,
      };
    }
  }
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
    ...(activeConnection ? { activeConnection } : {}),
    // The editor restores this tile on the next start; documents written
    // before the selection was persisted fall back to the active provider.
    selectedProviderId: settings.selectedProviderId ?? settings.providerId,
    ...(providerSummaries ? { providerSummaries } : {}),
  };
}
