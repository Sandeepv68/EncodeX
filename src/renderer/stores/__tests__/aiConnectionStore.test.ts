import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { activeConnectionOf, useAiConnectionStore } from '../aiConnectionStore';
import type { AiSettingsView } from '../../../shared/ai/settings';
import { expectAppLog, getAppLogs } from '../../../test-utils/crash-tripwire';

const benignView = (): AiSettingsView => ({
  providerId: 'rules',
  model: '',
  hasKey: false,
  keyHint: '',
  storedInsecurely: false,
  encryptionAvailable: true,
  connected: false,
});

describe('activeConnectionOf', () => {
  it('returns null for a null view', () => {
    expect(activeConnectionOf(null)).toBeNull();
  });

  it('returns the explicit active connection when the view carries one', () => {
    const view: AiSettingsView = { ...benignView(), activeConnection: { providerId: 'openai', model: 'gpt-4o', at: 7 } };
    expect(activeConnectionOf(view)).toEqual({ providerId: 'openai', model: 'gpt-4o', at: 7 });
  });

  it('rebuilds the connection from legacy flat fields, including the model', () => {
    const view: AiSettingsView = { ...benignView(), connected: true, connectedAt: 5, connectedModel: 'gpt-4o' };
    expect(activeConnectionOf(view)).toEqual({ providerId: 'rules', model: 'gpt-4o', at: 5 });
  });

  it('rebuilds the connection without a model when the legacy field is absent', () => {
    const view: AiSettingsView = { ...benignView(), connected: true, connectedAt: 5 };
    const connection = activeConnectionOf(view);
    expect(connection).toEqual({ providerId: 'rules', at: 5 });
    expect(connection).not.toHaveProperty('model');
  });

  it('returns null unless the legacy fields record a connection', () => {
    expect(activeConnectionOf(benignView())).toBeNull();
    expect(activeConnectionOf({ ...benignView(), connected: true })).toBeNull();
    expect(activeConnectionOf({ ...benignView(), connectedAt: 5 })).toBeNull();
  });
});

describe('useAiConnectionStore', () => {
  beforeEach(async () => {
    await vi.waitFor(() => expect(useAiConnectionStore.getState().view).not.toBeNull());
    useAiConnectionStore.getState().reset();
  });

  it('patch adopts a freshly loaded view', () => {
    const view = benignView();
    useAiConnectionStore.getState().patch(view);
    expect(useAiConnectionStore.getState().view).toBe(view);
  });

  it('reset clears the mirror', () => {
    useAiConnectionStore.getState().patch(benignView());
    useAiConnectionStore.getState().reset();
    expect(useAiConnectionStore.getState().view).toBeNull();
  });
});

describe('module-load hydration', () => {
  const originalBridge = window.electronAPI;

  afterEach(() => {
    Object.defineProperty(globalThis, 'electronAPI', { value: originalBridge, writable: true });
  });

  const importFreshStore = async (aiGetSettings: unknown): Promise<typeof useAiConnectionStore> => {
    vi.resetModules();
    Object.defineProperty(globalThis, 'electronAPI', {
      value: { ...originalBridge, aiGetSettings },
      writable: true,
    });
    const mod = await import('../aiConnectionStore');
    return mod.useAiConnectionStore;
  };

  it('adopts a valid settings view from the bridge at module load', async () => {
    const view = { ...benignView(), providerId: 'openai' as const, model: 'gpt-4o', hasKey: true, keyHint: '••••••••' };
    const store = await importFreshStore(vi.fn().mockResolvedValue(view));
    await vi.waitFor(() => expect(store.getState().view).toEqual(view));
  });

  it('ignores a view whose provider id is unknown', async () => {
    const store = await importFreshStore(vi.fn().mockResolvedValue({ ...benignView(), providerId: 'bogus' }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.getState().view).toBeNull();
  });

  it('ignores a non-object payload from the bridge', async () => {
    const fromNull = await importFreshStore(vi.fn().mockResolvedValue(null));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fromNull.getState().view).toBeNull();

    const fromString = await importFreshStore(vi.fn().mockResolvedValue('not-a-view'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fromString.getState().view).toBeNull();
  });

  it('logs a warning and leaves the mirror empty when hydration rejects', async () => {
    expectAppLog('warn', 'renderer/stores/aiConnectionStore');

    const store = await importFreshStore(vi.fn().mockRejectedValue(new Error('ipc down')));
    await vi.waitFor(() => expect(getAppLogs().some((entry) => entry.context === 'renderer/stores/aiConnectionStore')).toBe(true));
    expect(store.getState().view).toBeNull();
  });

  it('leaves the mirror empty when the bridge method is missing', async () => {
    const store = await importFreshStore(undefined);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.getState().view).toBeNull();
  });
});
