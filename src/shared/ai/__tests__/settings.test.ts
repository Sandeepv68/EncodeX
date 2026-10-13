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
  AI_PROVIDER_CHOICES,
  defaultAiSettings,
  isAiProviderId,
  keyHint,
  sanitizeAiSettings,
  toAiSettingsView,
} from '../settings';

describe('settings constants', () => {
  it('lists every provider and the default model for each remote provider', () => {
    expect(AI_PROVIDER_CHOICES).toContain('rules');
    expect(AI_PROVIDERS_REQUIRING_KEY.has('openai')).toBe(true);
    expect(AI_PROVIDERS_REQUIRING_KEY.has('rules')).toBe(false);
    expect(Object.keys(AI_DEFAULT_MODELS).sort()).toEqual(['anthropic', 'gemini', 'openai']);
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
    const long = 'a'.repeat(500);
    const sanitized = sanitizeAiSettings({ providerId: 'openai', model: long, baseUrl: long });
    expect(sanitized.model).toHaveLength(200);
    expect(sanitized.baseUrl).toHaveLength(500);
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
    });
  });
});
