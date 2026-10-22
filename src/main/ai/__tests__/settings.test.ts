/**
 * @fileoverview Tests for the main-process AI settings policy (encryption, file
 * IO, sanitization) behind the Copilot provider editor.
 *
 * `safeStorage` is mocked so the tests never touch the real DPAPI/keychain, and
 * a real temp directory backs the file round-trips. Each failure path that logs
 * is declared with {@link expectAppLog} so the tripwire doubles as an assertion
 * on the diagnostic.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { safeStorage } from 'electron';
import { expectAppLog } from '../../../test-utils/crash-tripwire';
import {
  AI_SETTINGS_FILENAME,
  aiSettingsFilePath,
  applyAiSettingsUpdate,
  decryptApiKey,
  effectiveModel,
  isEncryptionAvailable,
  readAiSettings,
  recordAiConnection,
  writeAiSettings,
} from '../settings';
import type { AiServerSettings } from '../settings';

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(),
    encryptString: vi.fn(),
    decryptString: vi.fn(),
  },
}));

const storage = safeStorage as unknown as {
  isEncryptionAvailable: ReturnType<typeof vi.fn>;
  encryptString: ReturnType<typeof vi.fn>;
  decryptString: ReturnType<typeof vi.fn>;
};

/** A temp userData directory per test. @type {string} */
let userDataDir: string;

beforeEach(() => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-settings-'));
  storage.isEncryptionAvailable.mockReturnValue(true);
  storage.encryptString.mockImplementation((plain: string) => Buffer.from(`enc:${plain}`));
  storage.decryptString.mockImplementation((buf: Buffer) => buf.toString().replace(/^enc:/, ''));
});

afterEach(() => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
  vi.clearAllMocks();
});

describe('aiSettingsFilePath', () => {
  it('resolves the settings file under userData', () => {
    expect(aiSettingsFilePath(userDataDir)).toBe(path.join(userDataDir, AI_SETTINGS_FILENAME));
  });
});

describe('isEncryptionAvailable', () => {
  it('is true when safeStorage reports readiness', () => {
    expect(isEncryptionAvailable()).toBe(true);
  });

  it('is false when the probe throws', () => {
    storage.isEncryptionAvailable.mockImplementation(() => {
      throw new Error('no keychain');
    });
    expect(isEncryptionAvailable()).toBe(false);
  });
});

describe('readAiSettings / writeAiSettings', () => {
  it('returns the offline default when no file exists', () => {
    expect(readAiSettings(userDataDir)).toEqual({ providerId: 'rules', model: '', key: null });
  });

  it('round-trips a stored document and creates the directory', () => {
    const nested = path.join(userDataDir, 'missing', 'dir');
    const settings: AiServerSettings = { providerId: 'openai', model: 'gpt-4o', key: null };
    writeAiSettings(nested, settings);
    expect(readAiSettings(nested)).toEqual(settings);
  });

  it('falls back to defaults for a corrupt file and logs a warning', () => {
    expectAppLog('warn', 'main/ai/settings');
    fs.writeFileSync(aiSettingsFilePath(userDataDir), 'not json {{{');
    expect(readAiSettings(userDataDir)).toEqual({ providerId: 'rules', model: '', key: null });
  });

  it('swallows a write failure and logs a warning', () => {
    expectAppLog('warn', 'main/ai/settings');
    const file = path.join(userDataDir, 'not-a-dir');
    fs.writeFileSync(file, 'x');
    expect(() => writeAiSettings(path.join(file, 'sub'), { providerId: 'rules', model: '', key: null })).not.toThrow();
  });
});

describe('decryptApiKey', () => {
  it('returns null when no key is stored', () => {
    expect(decryptApiKey({ providerId: 'openai', model: '', key: null })).toBeNull();
  });

  it('returns a plaintext (insecure) key verbatim', () => {
    expect(decryptApiKey({ providerId: 'openai', model: '', key: 'plain', storedInsecurely: true })).toBe('plain');
  });

  it('decrypts an encrypted key when encryption is available', () => {
    const key = Buffer.from('enc:secret').toString('base64');
    expect(decryptApiKey({ providerId: 'openai', model: '', key })).toBe('secret');
  });

  it('returns null when encryption is unavailable', () => {
    storage.isEncryptionAvailable.mockReturnValue(false);
    expect(decryptApiKey({ providerId: 'openai', model: '', key: 'abc' })).toBeNull();
  });

  it('returns null and logs when decryption fails', () => {
    expectAppLog('warn', 'main/ai/settings');
    storage.decryptString.mockImplementation(() => {
      throw new Error('bad ciphertext');
    });
    expect(decryptApiKey({ providerId: 'openai', model: '', key: 'abc' })).toBeNull();
  });
});

describe('applyAiSettingsUpdate', () => {
  it('stores an encrypted key and reports encryption availability', () => {
    const view = applyAiSettingsUpdate(userDataDir, { providerId: 'openai', model: 'gpt-4o-mini', apiKey: 'sk-1' });
    expect(view).toMatchObject({ providerId: 'openai', model: 'gpt-4o-mini', hasKey: true, encryptionAvailable: true });
    const stored = readAiSettings(userDataDir);
    expect(stored.key).toBe(Buffer.from('enc:sk-1').toString('base64'));
    expect(stored.storedInsecurely).toBeUndefined();
  });

  it('flags an insecure key when encryption is unavailable', () => {
    storage.isEncryptionAvailable.mockReturnValue(false);
    const view = applyAiSettingsUpdate(userDataDir, { providerId: 'anthropic', apiKey: 'plain' });
    expect(view.storedInsecurely).toBe(true);
    expect(readAiSettings(userDataDir)).toMatchObject({ key: 'plain', storedInsecurely: true });
  });

  it('falls back to insecure storage when encryption throws', () => {
    expectAppLog('warn', 'main/ai/settings');
    storage.encryptString.mockImplementation(() => {
      throw new Error('encrypt failed');
    });
    const view = applyAiSettingsUpdate(userDataDir, { providerId: 'openai', apiKey: 'plain' });
    expect(view.storedInsecurely).toBe(true);
  });

  it('sets a trimmed model and base URL, and clears them via an update', () => {
    applyAiSettingsUpdate(userDataDir, { providerId: 'openai', model: '  gpt-4o  ', baseUrl: '  https://x/v1  ' });
    expect(readAiSettings(userDataDir)).toMatchObject({ model: 'gpt-4o', baseUrl: 'https://x/v1' });
    applyAiSettingsUpdate(userDataDir, { providerId: 'openai', baseUrl: '   ' });
    expect(readAiSettings(userDataDir).baseUrl).toBeUndefined();
  });

  it('clears a stored key on request', () => {
    applyAiSettingsUpdate(userDataDir, { providerId: 'openai', apiKey: 'sk-1' });
    applyAiSettingsUpdate(userDataDir, { providerId: 'openai', clearKey: true });
    const stored = readAiSettings(userDataDir);
    expect(stored.key).toBeNull();
    expect(stored.keySetAt).toBeUndefined();
    expect(stored.storedInsecurely).toBeUndefined();
  });

  it('clears a previously recorded connection on any config change', () => {
    applyAiSettingsUpdate(userDataDir, { providerId: 'openai', model: 'gpt-4o-mini', apiKey: 'sk-1' });
    expect(recordAiConnection(userDataDir, { providerId: 'openai', model: 'gpt-4o-mini' }).connected).toBe(true);
    // Re-saving (even the same values) invalidates the verified connection.
    const view = applyAiSettingsUpdate(userDataDir, { providerId: 'openai', model: 'gpt-4o-mini' });
    expect(view.connected).toBe(false);
    expect(readAiSettings(userDataDir)).not.toHaveProperty('connectedAt');
    expect(readAiSettings(userDataDir)).not.toHaveProperty('connectedProvider');
    expect(readAiSettings(userDataDir)).not.toHaveProperty('connectedModel');
  });

  it('keeps a provider own key/model when the selection switches away and back', () => {
    // Connect OpenAI first so it becomes the selected provider.
    applyAiSettingsUpdate(userDataDir, { providerId: 'openai', model: 'gpt-4o', apiKey: 'sk-oa' });
    // A pure provider switch (no config change) stashes OpenAI's own config.
    const switched = applyAiSettingsUpdate(userDataDir, { providerId: 'anthropic', model: 'claude-x', apiKey: 'sk-an' });
    const stored = readAiSettings(userDataDir);
    expect(stored.providerId).toBe('anthropic');
    expect(switched.hasKey).toBe(true);
    expect(stored.key).toBeTruthy();
    expect(stored.providers?.openai).toMatchObject({ model: 'gpt-4o' });
    // Switching back restores OpenAI's model so the editor shows it again.
    const back = applyAiSettingsUpdate(userDataDir, { providerId: 'openai' });
    expect(back.providerId).toBe('openai');
    expect(back.model).toBe('gpt-4o');
    expect(back.hasKey).toBe(true);
    expect(readAiSettings(userDataDir).providers?.anthropic).toMatchObject({ model: 'claude-x' });
  });

  it('preserves a verified connection across a provider switch', () => {
    applyAiSettingsUpdate(userDataDir, { providerId: 'openai', model: 'gpt-4o-mini', apiKey: 'sk-1' });
    recordAiConnection(userDataDir, { providerId: 'openai', model: 'gpt-4o-mini' });
    // Selecting another provider does not touch the global connection pointer.
    const view = applyAiSettingsUpdate(userDataDir, { providerId: 'rules' });
    expect(readAiSettings(userDataDir)).toMatchObject({ connectedProvider: 'openai', connectedModel: 'gpt-4o-mini' });
    expect(view.activeConnection).toEqual(expect.objectContaining({ providerId: 'openai', model: 'gpt-4o-mini' }));
  });

  it('summarizes the other providers so the editor can scope the saved key', () => {
    applyAiSettingsUpdate(userDataDir, { providerId: 'openai', model: 'gpt-4o', apiKey: 'sk-1' });
    applyAiSettingsUpdate(userDataDir, { providerId: 'anthropic', model: '', apiKey: 'sk-2' });
    const view = applyAiSettingsUpdate(userDataDir, { providerId: 'gemini', model: '' });
    expect(view.providerSummaries).toEqual(
      expect.objectContaining({
        openai: expect.objectContaining({ model: 'gpt-4o', hasKey: true }),
        anthropic: expect.objectContaining({ model: '', hasKey: true }),
      }),
    );
  });

  it('records the selection without activating the provider', () => {
    applyAiSettingsUpdate(userDataDir, { providerId: 'openai', model: 'gpt-4o', apiKey: 'sk-1' });
    const view = applyAiSettingsUpdate(userDataDir, { providerId: 'gemini', activate: false });
    expect(view.providerId).toBe('openai');
    expect(view.selectedProviderId).toBe('gemini');
    const stored = readAiSettings(userDataDir);
    expect(stored.providerId).toBe('openai');
    expect(stored.selectedProviderId).toBe('gemini');
    // The active provider keeps its own model and key.
    expect(stored.model).toBe('gpt-4o');
    expect(stored.key).toBe(Buffer.from('enc:sk-1').toString('base64'));
  });

  it('keeps the active provider and its connection when only the selection changes', () => {
    applyAiSettingsUpdate(userDataDir, { providerId: 'openai', model: 'gpt-4o-mini', apiKey: 'sk-1' });
    recordAiConnection(userDataDir, { providerId: 'openai', model: 'gpt-4o-mini' });
    const view = applyAiSettingsUpdate(userDataDir, { providerId: 'anthropic', activate: false });
    expect(view.providerId).toBe('openai');
    expect(view.activeConnection).toEqual(expect.objectContaining({ providerId: 'openai', model: 'gpt-4o-mini' }));
    expect(readAiSettings(userDataDir)).toMatchObject({ connectedProvider: 'openai', connectedModel: 'gpt-4o-mini' });
  });

  it('stores a config change for a non-active provider in its own slot', () => {
    applyAiSettingsUpdate(userDataDir, { providerId: 'openai', model: 'gpt-4o', apiKey: 'sk-1' });
    applyAiSettingsUpdate(userDataDir, { providerId: 'gemini', model: 'gemini-x', apiKey: 'sk-g', activate: false });
    const stored = readAiSettings(userDataDir);
    expect(stored.providerId).toBe('openai');
    expect(stored.providers?.gemini).toMatchObject({ model: 'gemini-x' });
    expect(stored.providers?.gemini?.key).toBe(Buffer.from('enc:sk-g').toString('base64'));
  });

  it('clears the key of a non-active provider without touching the active one', () => {
    applyAiSettingsUpdate(userDataDir, { providerId: 'openai', model: 'gpt-4o', apiKey: 'sk-1' });
    applyAiSettingsUpdate(userDataDir, { providerId: 'gemini', apiKey: 'sk-g', activate: false });
    const view = applyAiSettingsUpdate(userDataDir, { providerId: 'gemini', clearKey: true, activate: false });
    const stored = readAiSettings(userDataDir);
    // The now-empty slot is dropped, the active provider keeps its own key.
    expect(stored.providers?.gemini).toBeUndefined();
    expect(stored.key).toBe(Buffer.from('enc:sk-1').toString('base64'));
    expect(view.providerId).toBe('openai');
    expect(view.hasKey).toBe(true);
  });

  it('drops the connection when the connected provider own config changes', () => {
    applyAiSettingsUpdate(userDataDir, { providerId: 'openai', model: 'gpt-4o-mini', apiKey: 'sk-1' });
    recordAiConnection(userDataDir, { providerId: 'openai', model: 'gpt-4o-mini' });
    // The active (and connected) provider is edited, so the connection is stale.
    const view = applyAiSettingsUpdate(userDataDir, { providerId: 'openai', model: 'gpt-4o', activate: false });
    expect(view.connected).toBe(false);
    expect(readAiSettings(userDataDir)).not.toHaveProperty('connectedAt');
  });
});

describe('recordAiConnection', () => {
  it('persists the verified provider/model and returns a connected view', () => {
    applyAiSettingsUpdate(userDataDir, { providerId: 'openai', model: '', apiKey: 'sk-1' });
    const view = recordAiConnection(userDataDir, { providerId: 'openai', model: 'gpt-4o-mini' });
    expect(view.connected).toBe(true);
    expect(view.connectedModel).toBe('gpt-4o-mini');
    expect(typeof view.connectedAt).toBe('number');
    expect(readAiSettings(userDataDir)).toMatchObject({ connectedProvider: 'openai', connectedModel: 'gpt-4o-mini' });
  });

  it('does not report connected while no key is stored', () => {
    const view = recordAiConnection(userDataDir, { providerId: 'openai', model: 'gpt-4o-mini' });
    expect(view.connected).toBe(false);
    expect(view).not.toHaveProperty('connectedAt');
  });

  it('drops an empty model id from the recorded connection', () => {
    applyAiSettingsUpdate(userDataDir, { providerId: 'openai', apiKey: 'sk-1' });
    const view = recordAiConnection(userDataDir, { providerId: 'openai', model: '   ' });
    expect(view.connected).toBe(true);
    expect(view).not.toHaveProperty('connectedModel');
  });
});

describe('effectiveModel', () => {
  it('returns the configured model when set', () => {
    expect(effectiveModel({ providerId: 'openai', model: 'custom', key: null })).toBe('custom');
  });

  it('returns an empty string when the model is blank', () => {
    expect(effectiveModel({ providerId: 'openai', model: '', key: null })).toBe('');
    expect(effectiveModel({ providerId: 'rules', model: '', key: null })).toBe('');
  });
});
