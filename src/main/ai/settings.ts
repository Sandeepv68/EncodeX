/**
 * @fileoverview AI provider settings persistence + API-key encryption for the
 * Electron main process (AI connector plan §6).
 *
 * Mirrors the proven `src/main/mcp/settings.ts` pattern: a single JSON file
 * (`userData/ai-settings.json`) is the source of truth, read leniently so a
 * corrupt file can never block boot. The one departure is the API key: it is
 * encrypted with Electron `safeStorage` (DPAPI on Windows) before it is written,
 * so the plaintext key never touches disk. When `safeStorage` is unavailable
 * the key is stored in plaintext and flagged `storedInsecurely` so the UI can
 * warn the user.
 */

import * as fs from 'fs';
import * as path from 'path';
import { safeStorage } from 'electron';
import { Logger } from '../../shared/logger';
import { LOG_FAILED_TO_PERSIST_MCP_SETTINGS, LOG_FAILED_TO_READ_STORED_MCP_SETTINGS } from '../../shared/log-constants';
import { AI_DEFAULT_MODELS, defaultAiSettings, sanitizeAiSettings, toAiSettingsView } from '../../shared/ai/settings';
import { isBlankProviderConfig, toAiProviderConfig } from '../../shared/ai/settings';
import type { AiProviderConfig, AiServerSettings, AiSettingsUpdate, AiSettingsView } from '../../shared/ai/settings';
import type { AIProviderId } from '../../shared/ai/types';

/** Per-module logger for AI settings. @const {Logger} */
const log = new Logger('main/ai/settings');

export { defaultAiSettings, sanitizeAiSettings, toAiSettingsView };
export type { AiProviderConfig, AiServerSettings, AiSettingsUpdate, AiSettingsView };

/**
 * File name of the AI settings document inside userData.
 * @const {string}
 */
export const AI_SETTINGS_FILENAME = 'ai-settings.json';

/**
 * Resolves the absolute path of the AI settings file.
 * @param {string} userDataDir - Electron `app.getPath('userData')` value.
 * @returns {string} Absolute file path.
 */
export function aiSettingsFilePath(userDataDir: string): string {
  return path.join(userDataDir, AI_SETTINGS_FILENAME);
}

/**
 * Whether Electron can encrypt a secret on this machine.
 * @returns {boolean} True when `safeStorage` is present and ready.
 */
export function isEncryptionAvailable(): boolean {
  try {
    return Boolean(safeStorage) && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

/**
 * Reads the stored AI settings, falling back to the offline default when the
 * file is missing or corrupt.
 * @param {string} userDataDir - Electron `app.getPath('userData')` value.
 * @returns {AiServerSettings} The stored (or default) settings.
 */
export function readAiSettings(userDataDir: string): AiServerSettings {
  try {
    const filePath = aiSettingsFilePath(userDataDir);
    if (!fs.existsSync(filePath)) return defaultAiSettings();
    const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
    return sanitizeAiSettings(JSON.parse(raw));
  } catch (err) {
    log.warn(LOG_FAILED_TO_READ_STORED_MCP_SETTINGS, err);
    return defaultAiSettings();
  }
}

/**
 * Persists the AI settings document (single utf-8 JSON write). Failures are
 * logged and swallowed so a read-only userData directory never breaks the app.
 * @param {string} userDataDir - Electron `app.getPath('userData')` value.
 * @param {AiServerSettings} settings - The document to store.
 * @returns {void}
 */
export function writeAiSettings(userDataDir: string, settings: AiServerSettings): void {
  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.writeFileSync(aiSettingsFilePath(userDataDir), JSON.stringify(sanitizeAiSettings(settings), null, 2), 'utf-8');
  } catch (err) {
    log.warn(LOG_FAILED_TO_PERSIST_MCP_SETTINGS, err);
  }
}

/**
 * Encrypts a plaintext API key for storage. Returns the stored form and whether
 * it had to be written in plaintext.
 * @param {string} plain - The plaintext key.
 * @returns {{ key: string; storedInsecurely: boolean }} The stored key + flag.
 */
function encryptApiKey(plain: string): { key: string; storedInsecurely: boolean } {
  if (isEncryptionAvailable()) {
    try {
      return { key: safeStorage.encryptString(plain).toString('base64'), storedInsecurely: false };
    } catch (err) {
      log.warn(LOG_FAILED_TO_PERSIST_MCP_SETTINGS, 'encrypt failed:', err);
    }
  }
  return { key: plain, storedInsecurely: true };
}

/**
 * Decrypts the stored API key, or returns null when none is set or it cannot be
 * read. Never throws.
 * @param {AiServerSettings} settings - The stored settings.
 * @returns {string | null} The plaintext key, if available.
 */
export function decryptApiKey(settings: AiServerSettings): string | null {
  if (!settings.key) return null;
  if (settings.storedInsecurely) return settings.key;
  try {
    if (!isEncryptionAvailable()) return null;
    return safeStorage.decryptString(Buffer.from(settings.key, 'base64'));
  } catch (err) {
    log.warn(LOG_FAILED_TO_READ_STORED_MCP_SETTINGS, 'decrypt failed:', err);
    return null;
  }
}

/**
 * Applies a renderer update: merges provider/model/baseUrl, encrypts a new key
 * (or clears it), persists, and returns the sanitized view.
 *
 * The flat fields of the stored document always describe the *selected*
 * provider, so switching selection moves the outgoing provider's config into
 * its own slot and loads the incoming one. A pure provider switch therefore
 * never overwrites another provider's key/model/endpoint, and never clears the
 * recorded connection: that is only dropped when the connected provider's own
 * config actually changes.
 * @param {string} userDataDir - Electron `app.getPath('userData')` value.
 * @param {AiSettingsUpdate} update - The requested change.
 * @returns {AiSettingsView} The resulting renderer-safe view.
 */
export function applyAiSettingsUpdate(userDataDir: string, update: AiSettingsUpdate): AiSettingsView {
  const current = readAiSettings(userDataDir);
  const selected = update.providerId;

  // The non-selected providers keep their own slots.
  const others: Partial<Record<AIProviderId, AiProviderConfig>> = { ...(current.providers ?? {}) };
  const incoming = selected === current.providerId ? toAiProviderConfig(current) : (others[selected] ?? { model: '', key: null });

  // Stash the outgoing provider's config so its key survives the switch.
  if (selected !== current.providerId) {
    const previous = toAiProviderConfig(current);
    if (!isBlankProviderConfig(previous)) others[current.providerId] = previous;
  }
  delete others[selected];

  const next: AiServerSettings = { providerId: selected, model: incoming.model, key: incoming.key };
  if (incoming.baseUrl) next.baseUrl = incoming.baseUrl;
  if (incoming.keySetAt !== undefined) next.keySetAt = incoming.keySetAt;
  if (incoming.storedInsecurely === true) next.storedInsecurely = true;

  if (update.model !== undefined) next.model = update.model.trim();
  if (update.baseUrl !== undefined) {
    const trimmed = update.baseUrl.trim();
    if (trimmed) next.baseUrl = trimmed;
    else delete next.baseUrl;
  }
  if (update.clearKey) {
    next.key = null;
    delete next.keySetAt;
    delete next.storedInsecurely;
  } else if (typeof update.apiKey === 'string' && update.apiKey.length > 0) {
    const { key, storedInsecurely } = encryptApiKey(update.apiKey);
    next.key = key;
    next.keySetAt = Date.now();
    if (storedInsecurely) next.storedInsecurely = true;
    else delete next.storedInsecurely;
  }

  // The connection pointer is global and survives a provider switch; it is
  // only invalidated when the connected provider's own configuration changes.
  const configChanged =
    update.model !== undefined ||
    update.baseUrl !== undefined ||
    update.clearKey === true ||
    (typeof update.apiKey === 'string' && update.apiKey.length > 0);
  const connectedProviderChanged = configChanged && current.connectedProvider === selected;
  if (!connectedProviderChanged && current.connectedAt !== undefined && current.connectedProvider !== undefined) {
    next.connectedAt = current.connectedAt;
    next.connectedProvider = current.connectedProvider;
    if (current.connectedModel !== undefined) next.connectedModel = current.connectedModel;
  }

  if (Object.keys(others).length > 0) next.providers = others;
  writeAiSettings(userDataDir, next);
  return toAiSettingsView(next, isEncryptionAvailable());
}

/**
 * Records a successful connection test so the UI can show an accurate
 * "connected" status after a restart. Any change to the config clears this
 * again via {@link applyAiSettingsUpdate}.
 * @param {string} userDataDir - Electron `app.getPath('userData')` value.
 * @param {{ providerId: AIProviderId; model: string }} info - The verified provider and model.
 * @returns {AiSettingsView} The resulting renderer-safe view (now connected).
 */
export function recordAiConnection(userDataDir: string, info: { providerId: AIProviderId; model: string }): AiSettingsView {
  const current = readAiSettings(userDataDir);
  const next: AiServerSettings = {
    ...current,
    connectedAt: Date.now(),
    connectedProvider: info.providerId,
  };
  const model = info.model.trim();
  if (model) next.connectedModel = model;
  else delete next.connectedModel;
  writeAiSettings(userDataDir, next);
  return toAiSettingsView(next, isEncryptionAvailable());
}

/**
 * Resolves the model to use for a provider: the user's model, else the built-in
 * default, else an empty string.
 * @param {AiServerSettings} settings - The stored settings.
 * @returns {string} The effective model id.
 */
export function effectiveModel(settings: AiServerSettings): string {
  return settings.model || AI_DEFAULT_MODELS[settings.providerId] || '';
}
