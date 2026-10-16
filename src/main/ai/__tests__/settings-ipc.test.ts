/**
 * @fileoverview Tests for the AI settings IPC bridge (AI connector plan §6).
 *
 * The handlers are thin: they sanitize the renderer payload, delegate to the
 * settings policy and the connector factory, and shape the result. Electron's
 * `ipcMain` is captured so each channel can be driven directly, and the settings
 * policy + connectors are mocked so the tests stay offline.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { expectAppLog } from '../../../test-utils/crash-tripwire';

const { appMock, handlers, settingsMock, connectorsMock, modelsMock } = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  return {
    appMock: { getPath: vi.fn(() => '/userData') },
    handlers,
    settingsMock: {
      applyAiSettingsUpdate: vi.fn(),
      decryptApiKey: vi.fn(),
      isEncryptionAvailable: vi.fn(() => true),
      readAiSettings: vi.fn(),
      recordAiConnection: vi.fn(),
      sanitizeAiSettings: vi.fn((value: unknown) => value),
      toAiSettingsView: vi.fn((settings: unknown) => settings),
    },
    connectorsMock: { createConnectorFromSettings: vi.fn(), isRemoteProvider: vi.fn() },
    modelsMock: { listProviderModels: vi.fn() },
  };
});

vi.mock('electron', () => ({
  app: appMock,
  ipcMain: {
    handle: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers[channel] = fn;
    }),
  },
}));
vi.mock('../settings', () => settingsMock);
vi.mock('../connectors', () => connectorsMock);
vi.mock('../models', () => modelsMock);

const { registerAiSettingsIpc } = await import('../settings-ipc');
const { IPC } = await import('../../../shared/ipc-channels');

const invoke = (channel: string, payload?: unknown): Promise<unknown> => handlers[channel]({}, payload) as Promise<unknown>;

describe('registerAiSettingsIpc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsMock.isEncryptionAvailable.mockReturnValue(true);
    settingsMock.readAiSettings.mockReturnValue({ providerId: 'rules', model: '', key: null });
    settingsMock.toAiSettingsView.mockImplementation((settings: unknown) => settings);
    settingsMock.sanitizeAiSettings.mockImplementation((value: unknown) => value);
    settingsMock.recordAiConnection.mockImplementation((_dir: string, info: { providerId: string; model: string }) => ({
      providerId: info.providerId,
      connected: true,
      connectedModel: info.model,
    }));
    connectorsMock.isRemoteProvider.mockReturnValue(true);
    registerAiSettingsIpc();
  });

  it('registers the four AI settings channels', () => {
    expect(handlers[IPC.AI_SETTINGS_GET]).toBeTypeOf('function');
    expect(handlers[IPC.AI_SETTINGS_SET]).toBeTypeOf('function');
    expect(handlers[IPC.AI_CONNECT_TEST]).toBeTypeOf('function');
    expect(handlers[IPC.AI_MODELS_LIST]).toBeTypeOf('function');
  });

  it('GET projects the stored settings into the renderer view', () => {
    const stored = { providerId: 'openai', model: 'gpt-4o', key: 'enc' };
    settingsMock.readAiSettings.mockReturnValue(stored);
    expect(handlers[IPC.AI_SETTINGS_GET]({})).toBe(stored);
    expect(settingsMock.toAiSettingsView).toHaveBeenCalledWith(stored, true);
  });

  it('SET sanitizes the payload before applying it', async () => {
    settingsMock.applyAiSettingsUpdate.mockReturnValue({ providerId: 'anthropic' });
    await invoke(IPC.AI_SETTINGS_SET, {
      providerId: 'anthropic',
      model: 'claude',
      baseUrl: 'https://x/v1',
      apiKey: 'sk-1',
      clearKey: true,
    });
    expect(settingsMock.applyAiSettingsUpdate).toHaveBeenCalledWith('/userData', {
      providerId: 'anthropic',
      model: 'claude',
      baseUrl: 'https://x/v1',
      apiKey: 'sk-1',
      clearKey: true,
    });
  });

  it('SET coerces an unknown provider and ignores malformed fields', async () => {
    settingsMock.applyAiSettingsUpdate.mockReturnValue({ providerId: 'rules' });
    await invoke(IPC.AI_SETTINGS_SET, { providerId: 'bogus', model: 42, baseUrl: null, apiKey: 7, clearKey: 'yes' });
    expect(settingsMock.applyAiSettingsUpdate).toHaveBeenCalledWith('/userData', { providerId: 'rules' });
  });

  it('SET tolerates a non-object payload', async () => {
    settingsMock.applyAiSettingsUpdate.mockReturnValue({ providerId: 'rules' });
    await invoke(IPC.AI_SETTINGS_SET, 'nope');
    expect(settingsMock.applyAiSettingsUpdate).toHaveBeenCalledWith('/userData', { providerId: 'rules' });
  });

  it('CONNECT_TEST refuses an offline provider', async () => {
    connectorsMock.isRemoteProvider.mockReturnValue(false);
    await expect(invoke(IPC.AI_CONNECT_TEST, { providerId: 'rules' })).resolves.toMatchObject({ ok: false, reason: 'offline' });
    expect(connectorsMock.createConnectorFromSettings).not.toHaveBeenCalled();
  });

  it('CONNECT_TEST refuses when no API key is available', async () => {
    settingsMock.decryptApiKey.mockReturnValue(null);
    await expect(invoke(IPC.AI_CONNECT_TEST, { providerId: 'openai' })).resolves.toMatchObject({
      ok: false,
      reason: 'noKey',
      message: 'No API key is available to test.',
    });
  });

  it('CONNECT_TEST pings the connector and reports model + latency on success', async () => {
    const complete = vi.fn().mockResolvedValue({ model: 'gpt-4o-mini', text: 'OK' });
    connectorsMock.createConnectorFromSettings.mockReturnValue({ complete });
    const result = await invoke(IPC.AI_CONNECT_TEST, { providerId: 'openai', apiKey: 'sk-live', model: 'gpt-4o-mini' });
    expect(connectorsMock.createConnectorFromSettings).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'openai', model: 'gpt-4o-mini' }),
      'sk-live',
    );
    expect(result).toMatchObject({ ok: true, model: 'gpt-4o-mini' });
    expect((result as { latencyMs: number }).latencyMs).toBeGreaterThanOrEqual(0);
    // A successful test records the verified connection and returns the refreshed view.
    expect(settingsMock.recordAiConnection).toHaveBeenCalledWith('/userData', { providerId: 'openai', model: 'gpt-4o-mini' });
    expect((result as { view: unknown }).view).toMatchObject({ providerId: 'openai', connected: true });
  });

  it('CONNECT_TEST does not record a connection when the test fails', async () => {
    expectAppLog('warn', 'main/ai/settings-ipc');
    settingsMock.decryptApiKey.mockReturnValue('sk-1');
    connectorsMock.createConnectorFromSettings.mockReturnValue({ complete: vi.fn().mockRejectedValue(new Error('boom')) });
    const result = await invoke(IPC.AI_CONNECT_TEST, { providerId: 'openai' });
    expect((result as { ok: boolean }).ok).toBe(false);
    expect(settingsMock.recordAiConnection).not.toHaveBeenCalled();
  });

  it('CONNECT_TEST surfaces a classified connector failure', async () => {
    expectAppLog('warn', 'main/ai/settings-ipc');
    settingsMock.decryptApiKey.mockReturnValue('sk-1');
    const providerError = Object.assign(new Error('Provider responded with HTTP 401'), {
      status: 401,
      body: JSON.stringify({ error: { code: 'invalid_api_key', message: 'Incorrect API key provided' } }),
    });
    connectorsMock.createConnectorFromSettings.mockReturnValue({
      complete: vi.fn().mockRejectedValue(providerError),
    });
    const result = (await invoke(IPC.AI_CONNECT_TEST, { providerId: 'openai' })) as {
      ok: boolean;
      message: string;
      reason: string;
      status: number;
    };
    expect(result.ok).toBe(false);
    expect(result.message.length).toBeGreaterThan(0);
    expect(result.reason).toBe('invalidKey');
    expect(result.status).toBe(401);
  });

  it('CONNECT_TEST falls back to the stored provider for an invalid candidate id', async () => {
    settingsMock.readAiSettings.mockReturnValue({ providerId: 'anthropic', model: 'claude-3', key: 'enc' });
    settingsMock.decryptApiKey.mockReturnValue('sk-1');
    connectorsMock.createConnectorFromSettings.mockReturnValue({ complete: vi.fn().mockResolvedValue({ model: 'm', text: 'OK' }) });
    await invoke(IPC.AI_CONNECT_TEST, { providerId: 'bogus' });
    expect(connectorsMock.createConnectorFromSettings).toHaveBeenCalledWith(expect.objectContaining({ providerId: 'anthropic' }), 'sk-1');
  });

  it('CONNECT_TEST prefers the candidate key/model/baseUrl over the stored values', async () => {
    settingsMock.readAiSettings.mockReturnValue({ providerId: 'openai', model: 'stored-model', baseUrl: 'https://stored/v1', key: 'enc' });
    settingsMock.decryptApiKey.mockReturnValue('stored-key');
    connectorsMock.createConnectorFromSettings.mockReturnValue({ complete: vi.fn().mockResolvedValue({ model: 'm', text: 'OK' }) });
    await invoke(IPC.AI_CONNECT_TEST, { providerId: 'openai', apiKey: 'live-key', model: 'live-model', baseUrl: 'https://live/v1' });
    expect(settingsMock.decryptApiKey).not.toHaveBeenCalled();
    expect(connectorsMock.createConnectorFromSettings).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'openai', model: 'live-model', baseUrl: 'https://live/v1' }),
      'live-key',
    );
  });

  it('CONNECT_TEST keeps the stored model/baseUrl when the candidate omits them', async () => {
    settingsMock.readAiSettings.mockReturnValue({ providerId: 'openai', model: 'stored-model', baseUrl: 'https://stored/v1', key: 'enc' });
    settingsMock.decryptApiKey.mockReturnValue('stored-key');
    connectorsMock.createConnectorFromSettings.mockReturnValue({ complete: vi.fn().mockResolvedValue({ model: 'm', text: 'OK' }) });
    await invoke(IPC.AI_CONNECT_TEST, { providerId: 'openai' });
    expect(connectorsMock.createConnectorFromSettings).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'stored-model', baseUrl: 'https://stored/v1' }),
      'stored-key',
    );
  });

  it('CONNECT_TEST falls back to the decrypted key when the candidate key is empty', async () => {
    settingsMock.readAiSettings.mockReturnValue({ providerId: 'openai', model: '', key: 'enc' });
    settingsMock.decryptApiKey.mockReturnValue('stored-key');
    connectorsMock.createConnectorFromSettings.mockReturnValue({ complete: vi.fn().mockResolvedValue({ model: 'm', text: 'OK' }) });
    await invoke(IPC.AI_CONNECT_TEST, { providerId: 'openai', apiKey: '' });
    expect(connectorsMock.createConnectorFromSettings).toHaveBeenCalledWith(expect.anything(), 'stored-key');
  });

  it('CONNECT_TEST never echoes the API key in its result', async () => {
    settingsMock.decryptApiKey.mockReturnValue('sk-super-secret');
    connectorsMock.createConnectorFromSettings.mockReturnValue({ complete: vi.fn().mockResolvedValue({ model: 'm', text: 'OK' }) });
    const result = await invoke(IPC.AI_CONNECT_TEST, { providerId: 'openai' });
    expect((result as { ok: boolean }).ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain('sk-super-secret');
  });

  it('SET tolerates cyclic and oversized payloads', async () => {
    settingsMock.applyAiSettingsUpdate.mockReturnValue({ providerId: 'openai' });
    const cyclic: Record<string, unknown> = {
      providerId: 'openai',
      model: 'm'.repeat(100_000),
      baseUrl: `https://x/${'h'.repeat(100_000)}`,
    };
    cyclic.self = cyclic;
    expect(() => invoke(IPC.AI_SETTINGS_SET, cyclic)).not.toThrow();
    expect(settingsMock.applyAiSettingsUpdate).toHaveBeenCalled();
  });

  it('MODELS_LIST refuses an offline provider without listing', async () => {
    connectorsMock.isRemoteProvider.mockReturnValue(false);
    await expect(invoke(IPC.AI_MODELS_LIST, { providerId: 'rules' })).resolves.toEqual({
      ok: false,
      models: [],
      reason: 'offline',
    });
    expect(modelsMock.listProviderModels).not.toHaveBeenCalled();
  });

  it('MODELS_LIST refuses when no API key is available', async () => {
    settingsMock.decryptApiKey.mockReturnValue(null);
    await expect(invoke(IPC.AI_MODELS_LIST, { providerId: 'openai' })).resolves.toMatchObject({
      ok: false,
      models: [],
      reason: 'noKey',
    });
    expect(modelsMock.listProviderModels).not.toHaveBeenCalled();
  });

  it('MODELS_LIST returns the provider models on success', async () => {
    modelsMock.listProviderModels.mockResolvedValue(['gpt-4o-mini', 'gpt-4o']);
    const result = await invoke(IPC.AI_MODELS_LIST, { providerId: 'openai', apiKey: 'sk-live' });
    expect(modelsMock.listProviderModels).toHaveBeenCalledWith(expect.objectContaining({ providerId: 'openai' }), 'sk-live');
    expect(result).toEqual({ ok: true, models: ['gpt-4o-mini', 'gpt-4o'] });
  });

  it('MODELS_LIST prefers the candidate key/baseUrl and falls back to the decrypted key', async () => {
    modelsMock.listProviderModels.mockResolvedValue([]);
    await invoke(IPC.AI_MODELS_LIST, { providerId: 'openai', apiKey: 'live-key', baseUrl: 'https://live/v1' });
    expect(settingsMock.decryptApiKey).not.toHaveBeenCalled();
    expect(modelsMock.listProviderModels).toHaveBeenCalledWith(expect.objectContaining({ baseUrl: 'https://live/v1' }), 'live-key');

    settingsMock.decryptApiKey.mockReturnValue('stored-key');
    await invoke(IPC.AI_MODELS_LIST, { providerId: 'openai' });
    expect(modelsMock.listProviderModels).toHaveBeenCalledWith(expect.anything(), 'stored-key');
  });

  it('MODELS_LIST falls back to the stored provider for an invalid candidate id', async () => {
    settingsMock.readAiSettings.mockReturnValue({ providerId: 'anthropic', model: 'claude-3', key: 'enc' });
    settingsMock.decryptApiKey.mockReturnValue('sk-1');
    modelsMock.listProviderModels.mockResolvedValue([]);
    await invoke(IPC.AI_MODELS_LIST, { providerId: 'bogus' });
    expect(modelsMock.listProviderModels).toHaveBeenCalledWith(expect.objectContaining({ providerId: 'anthropic' }), 'sk-1');
  });

  it('MODELS_LIST surfaces a classified listing failure', async () => {
    expectAppLog('warn', 'main/ai/settings-ipc');
    settingsMock.decryptApiKey.mockReturnValue('sk-1');
    const providerError = Object.assign(new Error('Provider responded with HTTP 401'), {
      status: 401,
      body: JSON.stringify({ error: { code: 'invalid_api_key', message: 'Incorrect API key provided' } }),
    });
    modelsMock.listProviderModels.mockRejectedValue(providerError);
    const result = (await invoke(IPC.AI_MODELS_LIST, { providerId: 'openai' })) as {
      ok: boolean;
      models: unknown[];
      reason: string;
      status: number;
    };
    expect(result.ok).toBe(false);
    expect(result.models).toEqual([]);
    expect(result.reason).toBe('invalidKey');
    expect(result.status).toBe(401);
  });

  it('MODELS_LIST tolerates a non-object payload', async () => {
    settingsMock.readAiSettings.mockReturnValue({ providerId: 'openai', model: '', key: 'enc' });
    settingsMock.decryptApiKey.mockReturnValue('sk-1');
    modelsMock.listProviderModels.mockResolvedValue([]);
    await invoke(IPC.AI_MODELS_LIST, 'nope');
    expect(modelsMock.listProviderModels).toHaveBeenCalledWith(expect.objectContaining({ providerId: 'openai' }), 'sk-1');
  });
});
