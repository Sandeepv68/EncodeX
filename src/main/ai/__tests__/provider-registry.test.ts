/**
 * @fileoverview Tests for the Copilot operation-router resolver (AI connector
 * plan §7).
 *
 * The resolver is the seam that turns stored AI settings into an LLM router and
 * falls back to `null` (offline planning) for every best-effort failure. The
 * settings reader, the model resolver, the connector factory and the router
 * builder are all mocked so the tests stay offline.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { OperationRouter } from '../provider-registry';

const { appMock, settingsMock, modelMock, connectorsMock, llmMock } = vi.hoisted(() => ({
  appMock: { getPath: vi.fn(() => '/userData') },
  settingsMock: {
    readAiSettings: vi.fn(),
    decryptApiKey: vi.fn(),
    effectiveModel: vi.fn((settings: { model?: string }) => (settings.model ?? '').trim()),
    persistProviderModel: vi.fn(),
  },
  modelMock: { resolveProviderModel: vi.fn() },
  connectorsMock: { isRemoteProvider: vi.fn(), createConnectorFromSettings: vi.fn() },
  llmMock: { createLLMOperationRouter: vi.fn() },
}));

vi.mock('electron', () => ({ app: appMock }));
vi.mock('../settings', () => settingsMock);
vi.mock('../model-resolution', () => modelMock);
vi.mock('../connectors', () => connectorsMock);
vi.mock('../../../shared/ai/llm', () => llmMock);

const { resolveLLMOperationRouter } = await import('../provider-registry');

describe('resolveLLMOperationRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appMock.getPath.mockReturnValue('/userData');
    settingsMock.readAiSettings.mockReturnValue({ providerId: 'openai', model: '', key: 'enc', keySetAt: 1 });
    settingsMock.decryptApiKey.mockReturnValue('sk-1');
    modelMock.resolveProviderModel.mockResolvedValue('resolved-model');
    connectorsMock.isRemoteProvider.mockReturnValue(true);
    connectorsMock.createConnectorFromSettings.mockReturnValue({ id: 'openai' });
    llmMock.createLLMOperationRouter.mockReturnValue(vi.fn());
  });

  it('builds a router for a configured remote provider', async () => {
    const router = await resolveLLMOperationRouter();
    expect(settingsMock.readAiSettings).toHaveBeenCalledWith('/userData');
    expect(connectorsMock.createConnectorFromSettings).toHaveBeenCalledWith(expect.objectContaining({ providerId: 'openai' }), 'sk-1');
    expect(llmMock.createLLMOperationRouter).toHaveBeenCalledWith({ id: 'openai' }, 'openai');
    expect(router).toBeTypeOf('function');
    expect(router as OperationRouter).toBeDefined();
  });

  it('resolves a model from the provider when the user never chose one', async () => {
    await resolveLLMOperationRouter();
    expect(modelMock.resolveProviderModel).toHaveBeenCalledWith(expect.objectContaining({ providerId: 'openai' }), 'sk-1');
    expect(settingsMock.persistProviderModel).toHaveBeenCalledWith('/userData', 'openai', 'resolved-model');
    expect(connectorsMock.createConnectorFromSettings).toHaveBeenCalledWith(expect.objectContaining({ model: 'resolved-model' }), 'sk-1');
  });

  it('uses the configured model without consulting the provider', async () => {
    settingsMock.readAiSettings.mockReturnValue({ providerId: 'openai', model: 'my-model', key: 'enc' });
    await resolveLLMOperationRouter();
    expect(modelMock.resolveProviderModel).not.toHaveBeenCalled();
    expect(settingsMock.persistProviderModel).not.toHaveBeenCalled();
    expect(connectorsMock.createConnectorFromSettings).toHaveBeenCalledWith(expect.objectContaining({ model: 'my-model' }), 'sk-1');
  });

  it('falls back to offline planning when no model can be resolved', async () => {
    modelMock.resolveProviderModel.mockRejectedValue(new Error('No model is configured and the provider reported no usable model'));
    await expect(resolveLLMOperationRouter()).resolves.toBeNull();
    expect(connectorsMock.createConnectorFromSettings).not.toHaveBeenCalled();
  });

  it('returns null for an offline provider', async () => {
    connectorsMock.isRemoteProvider.mockReturnValue(false);
    await expect(resolveLLMOperationRouter()).resolves.toBeNull();
  });

  it('returns null when no API key is stored', async () => {
    settingsMock.decryptApiKey.mockReturnValue(null);
    await expect(resolveLLMOperationRouter()).resolves.toBeNull();
  });

  it('returns null when the settings read throws', async () => {
    appMock.getPath.mockImplementation(() => {
      throw new Error('no userData');
    });
    await expect(resolveLLMOperationRouter()).resolves.toBeNull();
  });

  it('returns null when the key decryption throws', async () => {
    settingsMock.decryptApiKey.mockImplementation(() => {
      throw new Error('cannot decrypt');
    });
    await expect(resolveLLMOperationRouter()).resolves.toBeNull();
  });

  it('returns null when the connector factory throws', async () => {
    connectorsMock.createConnectorFromSettings.mockImplementation(() => {
      throw new Error('bad provider');
    });
    await expect(resolveLLMOperationRouter()).resolves.toBeNull();
  });

  it('returns null when the router builder throws', async () => {
    llmMock.createLLMOperationRouter.mockImplementation(() => {
      throw new Error('bad router');
    });
    await expect(resolveLLMOperationRouter()).resolves.toBeNull();
  });
});
