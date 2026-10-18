/**
 * @fileoverview Tests for the AI settings contract shared between the main and
 * renderer processes (AI connector plan §6).
 *
 * `sanitizeAiSettings` is fed untyped JSON read off disk, so these specs hand it
 * values its own signature forbids - that is the behaviour under test. The view
 * projection and key hint are checked for both the keyed and keyless cases.
 */

import { describe, it, expect } from 'vitest';
import {
  AI_DEFAULT_MODELS,
  AI_PROVIDERS_REQUIRING_KEY,
  AI_PROVIDERS_REQUIRING_NETWORK,
  AI_PROVIDER_CHOICES,
  defaultAiSettings,
  isAiProviderId,
  keyHint,
  resolveAiProviderSettings,
  sanitizeAiSettings,
  toAiSettingsView,
  viewForProvider,
} from '../settings';
import type { AiServerSettings } from '../settings';

describe('settings constants', () => {
  it('lists every provider and the default model for each remote provider', () => {
    expect(AI_PROVIDER_CHOICES).toContain('rules');
    expect(AI_PROVIDERS_REQUIRING_KEY.has('openai')).toBe(true);
    expect(AI_PROVIDERS_REQUIRING_KEY.has('rules')).toBe(false);
    expect(Object.keys(AI_DEFAULT_MODELS).sort()).toEqual(['anthropic', 'gemini', 'openai']);
  });

  it('pins the default model ids, including the current Gemini GA model', () => {
    expect(AI_DEFAULT_MODELS.openai).toBe('gpt-4o-mini');
    expect(AI_DEFAULT_MODELS.anthropic).toBe('claude-3-5-haiku-latest');
    expect(AI_DEFAULT_MODELS.gemini).toBe('gemini-3.8-flash');
  });

  it('marks the remote providers as requiring a network connection', () => {
    for (const id of ['openai', 'anthropic', 'gemini'] as const) {
      expect(AI_PROVIDERS_REQUIRING_NETWORK.has(id)).toBe(true);
    }
    expect(AI_PROVIDERS_REQUIRING_NETWORK.has('rules')).toBe(false);
    expect(AI_PROVIDERS_REQUIRING_NETWORK.has('local')).toBe(false);
  });
});

describe('defaultAiSettings / isAiProviderId', () => {
  it('defaults to the offline rules provider with no key', () => {
    expect(defaultAiSettings()).toEqual({ providerId: 'rules', model: '', key: null });
  });

  it('accepts only known provider ids', () => {
    expect(isAiProviderId('openai')).toBe(true);
    expect(isAiProviderId('bogus')).toBe(false);
    expect(isAiProviderId(42)).toBe(false);
  });
});

describe('sanitizeAiSettings', () => {
  it('normalizes a fully-specified document', () => {
    expect(
      sanitizeAiSettings({
        providerId: 'anthropic',
        model: '  claude  ',
        baseUrl: '  https://x/v1  ',
        key: 'enc',
        keySetAt: 123,
        storedInsecurely: true,
      }),
    ).toEqual({
      providerId: 'anthropic',
      model: 'claude',
      baseUrl: 'https://x/v1',
      key: 'enc',
      keySetAt: 123,
      storedInsecurely: true,
    });
  });

  it('drops unknown providers and malformed fields', () => {
    expect(sanitizeAiSettings({ providerId: 'bogus', model: 42, baseUrl: 7, key: '', keySetAt: 'x', storedInsecurely: 'yes' })).toEqual({
      providerId: 'rules',
      model: '',
      key: null,
    });
  });

  it('treats non-object input as the offline default', () => {
    expect(sanitizeAiSettings(null)).toEqual({ providerId: 'rules', model: '', key: null });
    expect(sanitizeAiSettings(['openai'])).toEqual({ providerId: 'rules', model: '', key: null });
  });

  it('truncates an over-long model and base URL', () => {
    const longModel = 'a'.repeat(500);
    const longUrl = `https://x/v1/${'a'.repeat(500)}`;
    const sanitized = sanitizeAiSettings({ providerId: 'openai', model: longModel, baseUrl: longUrl });
    expect(sanitized.model).toHaveLength(200);
    expect(sanitized.baseUrl).toHaveLength(500);
  });

  it('accepts only http(s) base URLs, dropping other schemes', () => {
    expect(sanitizeAiSettings({ providerId: 'openai', baseUrl: 'javascript:alert(1)' }).baseUrl).toBeUndefined();
    expect(sanitizeAiSettings({ providerId: 'openai', baseUrl: 'data:text/html,x' }).baseUrl).toBeUndefined();
    expect(sanitizeAiSettings({ providerId: 'openai', baseUrl: 'file:///etc/passwd' }).baseUrl).toBeUndefined();
    expect(sanitizeAiSettings({ providerId: 'openai', baseUrl: 'HTTP://x/v1' }).baseUrl).toBe('HTTP://x/v1');
    expect(sanitizeAiSettings({ providerId: 'openai', baseUrl: 'http://localhost:11434' }).baseUrl).toBe('http://localhost:11434');
  });

  it('strips CR/LF from a base URL so a header newline cannot survive', () => {
    expect(sanitizeAiSettings({ providerId: 'openai', baseUrl: 'https://x/v1\r\nX-Injected: 1' }).baseUrl).toBe(
      'https://x/v1X-Injected: 1',
    );
  });

  it('drops a whitespace-only base URL and a non-string one', () => {
    expect(sanitizeAiSettings({ providerId: 'openai', baseUrl: '   ' }).baseUrl).toBeUndefined();
    expect(sanitizeAiSettings({ providerId: 'openai', baseUrl: 7 }).baseUrl).toBeUndefined();
  });

  it('drops a non-string key and a non-finite keySetAt', () => {
    expect(sanitizeAiSettings({ providerId: 'openai', key: 7 }).key).toBeNull();
    expect(sanitizeAiSettings({ providerId: 'openai', key: null, keySetAt: Number.POSITIVE_INFINITY }).keySetAt).toBeUndefined();
    expect(sanitizeAiSettings({ providerId: 'openai', key: null, keySetAt: Number.NaN }).keySetAt).toBeUndefined();
    expect(sanitizeAiSettings({ providerId: 'openai', key: 'enc', keySetAt: 123 }).keySetAt).toBe(123);
  });

  it('strips a leading BOM from the model and base URL', () => {
    expect(sanitizeAiSettings({ providerId: 'openai', model: '\uFEFFgpt-4o' }).model).toBe('gpt-4o');
    expect(sanitizeAiSettings({ providerId: 'openai', baseUrl: '\uFEFFhttps://x/v1' }).baseUrl).toBe('https://x/v1');
  });

  it('preserves a recorded connection and drops malformed connection fields', () => {
    expect(
      sanitizeAiSettings({ providerId: 'openai', key: 'enc', connectedAt: 5, connectedProvider: 'openai', connectedModel: '  gpt-4o  ' }),
    ).toMatchObject({ connectedAt: 5, connectedProvider: 'openai', connectedModel: 'gpt-4o' });
    const malformed = sanitizeAiSettings({ providerId: 'openai', connectedAt: 'x', connectedProvider: 'bogus', connectedModel: 7 });
    expect(malformed).not.toHaveProperty('connectedAt');
    expect(malformed).not.toHaveProperty('connectedProvider');
    expect(malformed).not.toHaveProperty('connectedModel');
  });

  it('is not vulnerable to prototype pollution from a hostile document', () => {
    const hostile = JSON.parse('{"__proto__":{"polluted":true},"constructor":"x","prototype":"y"}') as unknown;
    const sanitized = sanitizeAiSettings(hostile) as unknown as Record<string, unknown>;
    expect(sanitized.polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(sanitized).toEqual({ providerId: 'rules', model: '', key: null });
  });
});

describe('keyHint / toAiSettingsView', () => {
  it('masks a stored key and returns an empty hint otherwise', () => {
    expect(keyHint('enc')).toBe('••••••••');
    expect(keyHint(null)).toBe('');
  });

  it('projects a keyed, insecure document into the renderer view', () => {
    const view = toAiSettingsView(
      { providerId: 'openai', model: 'gpt-4o', baseUrl: 'https://x/v1', key: 'enc', storedInsecurely: true },
      false,
    );
    expect(view).toEqual({
      providerId: 'openai',
      model: 'gpt-4o',
      baseUrl: 'https://x/v1',
      hasKey: true,
      keyHint: '••••••••',
      storedInsecurely: true,
      encryptionAvailable: false,
      connected: false,
    });
  });

  it('projects a keyless document without a base URL', () => {
    const view = toAiSettingsView({ providerId: 'rules', model: '', key: null }, true);
    expect(view).toEqual({
      providerId: 'rules',
      model: '',
      hasKey: false,
      keyHint: '',
      storedInsecurely: false,
      encryptionAvailable: true,
      connected: false,
    });
  });

  it('reports connected only when a key exists and the verified provider matches', () => {
    const connected = toAiSettingsView(
      { providerId: 'openai', model: 'gpt-4o', key: 'enc', connectedAt: 111, connectedProvider: 'openai', connectedModel: 'gpt-4o' },
      true,
    );
    expect(connected.connected).toBe(true);
    expect(connected.connectedAt).toBe(111);
    expect(connected.connectedModel).toBe('gpt-4o');

    // A connection verified for a different provider does not count.
    const stale = toAiSettingsView({ providerId: 'anthropic', model: '', key: 'enc', connectedAt: 1, connectedProvider: 'openai' }, true);
    expect(stale.connected).toBe(false);
    expect(stale).not.toHaveProperty('connectedAt');

    // A missing key can never be "connected".
    expect(
      toAiSettingsView({ providerId: 'openai', model: '', key: null, connectedAt: 1, connectedProvider: 'openai' }, true).connected,
    ).toBe(false);
  });

  it('exposes the global active connection even when a different provider is selected', () => {
    const view = toAiSettingsView(
      { providerId: 'anthropic', model: '', key: null, connectedAt: 2, connectedProvider: 'openai', connectedModel: 'gpt-4o-mini' },
      true,
    );
    expect(view.connected).toBe(false);
    expect(view.activeConnection).toEqual({ providerId: 'openai', model: 'gpt-4o-mini', at: 2 });
  });

  it('summarizes the non-selected providers for the editor', () => {
    const view = toAiSettingsView(
      {
        providerId: 'openai',
        model: 'gpt-4o',
        key: 'enc',
        providers: {
          openai: { model: 'gpt-4o', key: 'enc' },
          anthropic: { model: 'claude-x', key: 'enc2' },
          gemini: { model: '', key: null },
        },
      },
      true,
    );
    expect(view.hasKey).toBe(true);
    expect(view.keyHint).toBe('••••••••');
    expect(view.providerSummaries).toEqual({
      anthropic: { model: 'claude-x', hasKey: true, keyHint: '••••••••', storedInsecurely: false },
      gemini: { model: '', hasKey: false, keyHint: '', storedInsecurely: false },
    });
  });
});

describe('viewForProvider', () => {
  const base = toAiSettingsView(
    {
      providerId: 'openai',
      model: 'gpt-4o',
      key: 'enc',
      providers: { anthropic: { model: 'claude-x', key: 'enc2', baseUrl: 'https://api.anthropic.com', storedInsecurely: true } },
    },
    true,
  );

  it('returns the base view unchanged for the selected provider', () => {
    expect(viewForProvider(base, 'openai')).toBe(base);
  });

  it('projects another provider own summary onto a flat view', () => {
    const resolved = viewForProvider(base, 'anthropic');
    expect(resolved).toMatchObject({
      providerId: 'anthropic',
      model: 'claude-x',
      baseUrl: 'https://api.anthropic.com',
      hasKey: true,
      keyHint: '••••••••',
      storedInsecurely: true,
      encryptionAvailable: true,
      connected: false,
    });
  });

  it('yields a blank view for a provider with no stored config', () => {
    const resolved = viewForProvider(base, 'gemini');
    expect(resolved).toMatchObject({ providerId: 'gemini', model: '', hasKey: false, keyHint: '', connected: false });
    expect(resolved).not.toHaveProperty('baseUrl');
  });

  it('carries the active connection through to the resolved view', () => {
    const connected = toAiSettingsView(
      { providerId: 'openai', model: 'gpt-4o', key: 'enc', connectedAt: 7, connectedProvider: 'openai', connectedModel: 'gpt-4o' },
      true,
    );
    expect(viewForProvider(connected, 'anthropic').activeConnection).toEqual({ providerId: 'openai', model: 'gpt-4o', at: 7 });
  });
});

describe('resolveAiProviderSettings', () => {
  const stored: AiServerSettings = {
    providerId: 'openai',
    model: 'gpt-4o',
    key: 'enc-openai',
    baseUrl: 'https://api.openai.com/v1',
    keySetAt: 111,
    providers: {
      anthropic: {
        model: 'claude-x',
        key: 'enc-anthropic',
        baseUrl: 'https://api.anthropic.com',
        keySetAt: 222,
        storedInsecurely: true,
      },
      gemini: { model: '', key: null },
    },
  };

  it('returns the document unchanged for the selected provider', () => {
    expect(resolveAiProviderSettings(stored, 'openai')).toBe(stored);
  });

  it('projects a stored slot onto a flat document, carrying every optional field', () => {
    expect(resolveAiProviderSettings(stored, 'anthropic')).toEqual({
      providerId: 'anthropic',
      model: 'claude-x',
      key: 'enc-anthropic',
      baseUrl: 'https://api.anthropic.com',
      keySetAt: 222,
      storedInsecurely: true,
    });
  });

  it('omits optional fields the slot does not carry', () => {
    expect(resolveAiProviderSettings(stored, 'gemini')).toEqual({ providerId: 'gemini', model: '', key: null });
  });

  it('yields a blank document for a provider with no stored slot', () => {
    expect(resolveAiProviderSettings(stored, 'local')).toEqual({ providerId: 'local', model: '', key: null });
  });

  it('tolerates a document with no providers map at all', () => {
    expect(resolveAiProviderSettings({ providerId: 'rules', model: '', key: null }, 'openai')).toEqual({
      providerId: 'openai',
      model: '',
      key: null,
    });
  });
});
