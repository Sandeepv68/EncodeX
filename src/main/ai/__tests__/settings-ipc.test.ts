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

const { appMock, handlers, settingsMock, connectorsMock } = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  return {
    appMock: { getPath: vi.fn(() => '/userData') },
    handlers,
    settingsMock: {
      applyAiSettingsUpdate: vi.fn(),
      decryptApiKey: vi.fn(),
      isEncryptionAvailable: vi.fn(() => true),
      readAiSettings: vi.fn(),
      sanitizeAiSettings: vi.fn((value: unknown) => value),
      toAiSettingsView: vi.fn((settings: unknown) => settings),
    },
    connectorsMock: { createConnectorFromSettings: vi.fn(), isRemoteProvider: vi.fn() },
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
    connectorsMock.isRemoteProvider.mockReturnValue(true);
    registerAiSettingsIpc();
  });

  it('registers the three AI settings channels', () => {
    expect(handlers[IPC.AI_SETTINGS_GET]).toBeTypeOf('function');
    expect(handlers[IPC.AI_SETTINGS_SET]).toBeTypeOf('function');
    expect(handlers[IPC.AI_CONNECT_TEST]).toBeTypeOf('function');
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
    await expect(invoke(IPC.AI_CONNECT_TEST, { providerId: 'rules' })).resolves.toMatchObject({ ok: false });
    expect(connectorsMock.createConnectorFromSettings).not.toHaveBeenCalled();
  });

  it('CONNECT_TEST refuses when no API key is available', async () => {
    settingsMock.decryptApiKey.mockReturnValue(null);
    await expect(invoke(IPC.AI_CONNECT_TEST, { providerId: 'openai' })).resolves.toEqual({
      ok: false,
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
  });

  it('CONNECT_TEST surfaces a connector failure as a message', async () => {
    expectAppLog('warn', 'main/ai/settings-ipc');
    settingsMock.decryptApiKey.mockReturnValue('sk-1');
    connectorsMock.createConnectorFromSettings.mockReturnValue({
      complete: vi.fn().mockRejectedValue(new Error('HTTP 401')),
    });
    const result = (await invoke(IPC.AI_CONNECT_TEST, { providerId: 'openai' })) as { ok: boolean; message: string };
    expect(result.ok).toBe(false);
    expect(result.message.length).toBeGreaterThan(0);
  });
});
