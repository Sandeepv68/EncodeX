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
});

describe('effectiveModel', () => {
  it('prefers the user model, then the built-in default, then empty', () => {
    expect(effectiveModel({ providerId: 'openai', model: 'custom', key: null })).toBe('custom');
    expect(effectiveModel({ providerId: 'openai', model: '', key: null })).toBe('gpt-4o-mini');
    expect(effectiveModel({ providerId: 'rules', model: '', key: null })).toBe('');
  });
});
