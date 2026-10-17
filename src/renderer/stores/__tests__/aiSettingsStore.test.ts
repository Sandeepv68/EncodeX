import { describe, it, expect, beforeEach } from 'vitest';
import { useAiSettingsStore } from '../aiSettingsStore';
import type { AiSettingsView } from '../../../shared/ai/settings';

const openAiView: AiSettingsView = {
  providerId: 'openai',
  model: 'gpt-4o-mini',
  hasKey: true,
  keyHint: '••••••••',
  storedInsecurely: false,
  encryptionAvailable: true,
  connected: true,
  connectedAt: 2,
  connectedModel: 'gpt-4o-mini',
};

describe('aiSettingsStore', () => {
  beforeEach(() => {
    useAiSettingsStore.getState().reset();
  });

  it('starts with the offline default snapshot', () => {
    const state = useAiSettingsStore.getState();
    expect(state.view).toBeNull();
    expect(state.providerId).toBe('rules');
    expect(state.model).toBe('');
    expect(state.baseUrl).toBe('');
  });

  it('patch merges a partial snapshot without dropping the other fields', () => {
    useAiSettingsStore.getState().patch({ providerId: 'openai', model: 'gpt-4o-mini' });
    const state = useAiSettingsStore.getState();
    expect(state.providerId).toBe('openai');
    expect(state.model).toBe('gpt-4o-mini');
    expect(state.baseUrl).toBe('');
    expect(state.view).toBeNull();
  });

  it('patch stores the loaded view and base URL', () => {
    useAiSettingsStore.getState().patch({ view: openAiView, baseUrl: 'https://proxy.example/v1' });
    const state = useAiSettingsStore.getState();
    expect(state.view).toEqual(openAiView);
    expect(state.baseUrl).toBe('https://proxy.example/v1');
  });

  it('patch keeps the selected provider independent of the cached view', () => {
    useAiSettingsStore.getState().patch({ view: openAiView, providerId: 'anthropic' });
    const state = useAiSettingsStore.getState();
    expect(state.view?.providerId).toBe('openai');
    expect(state.providerId).toBe('anthropic');
  });

  it('reset restores the initial snapshot after edits', () => {
    useAiSettingsStore.getState().patch({ view: openAiView, providerId: 'gemini', model: 'gemini-3.8-flash', baseUrl: 'https://x/v1' });
    useAiSettingsStore.getState().reset();
    const state = useAiSettingsStore.getState();
    expect(state.view).toBeNull();
    expect(state.providerId).toBe('rules');
    expect(state.model).toBe('');
    expect(state.baseUrl).toBe('');
  });
});
