/**
 * @fileoverview Tests for the Copilot operation-router resolver (AI connector
 * plan §7).
 *
 * The resolver is the seam that turns stored AI settings into an LLM router and
 * falls back to `null` (offline planning) for every best-effort failure. The
 * settings reader, the connector factory and the router builder are all mocked
 * so the tests stay offline.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { OperationRouter } from '../provider-registry';

const { appMock, settingsMock, connectorsMock, llmMock } = vi.hoisted(() => ({
  appMock: { getPath: vi.fn(() => '/userData') },
  settingsMock: { readAiSettings: vi.fn(), decryptApiKey: vi.fn() },
  connectorsMock: { isRemoteProvider: vi.fn(), createConnectorFromSettings: vi.fn() },
  llmMock: { createLLMOperationRouter: vi.fn() },
}));

vi.mock('electron', () => ({ app: appMock }));
vi.mock('../settings', () => settingsMock);
vi.mock('../connectors', () => connectorsMock);
vi.mock('../../../shared/ai/llm', () => llmMock);

const { resolveLLMOperationRouter } = await import('../provider-registry');

describe('resolveLLMOperationRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appMock.getPath.mockReturnValue('/userData');
    settingsMock.readAiSettings.mockReturnValue({ providerId: 'openai', model: '', key: 'enc', keySetAt: 1 });
    settingsMock.decryptApiKey.mockReturnValue('sk-1');
    connectorsMock.isRemoteProvider.mockReturnValue(true);
    connectorsMock.createConnectorFromSettings.mockReturnValue({ id: 'openai' });
    llmMock.createLLMOperationRouter.mockReturnValue(vi.fn());
  });

  it('builds a router for a configured remote provider', () => {
    const router = resolveLLMOperationRouter();
    expect(settingsMock.readAiSettings).toHaveBeenCalledWith('/userData');
    expect(connectorsMock.createConnectorFromSettings).toHaveBeenCalledWith(expect.objectContaining({ providerId: 'openai' }), 'sk-1');
    expect(llmMock.createLLMOperationRouter).toHaveBeenCalledWith({ id: 'openai' }, 'openai');
    expect(router).toBeTypeOf('function');
    expect(router as OperationRouter).toBeDefined();
  });

  it('returns null for an offline provider', () => {
    connectorsMock.isRemoteProvider.mockReturnValue(false);
    expect(resolveLLMOperationRouter()).toBeNull();
  });

  it('returns null when no API key is stored', () => {
    settingsMock.decryptApiKey.mockReturnValue(null);
    expect(resolveLLMOperationRouter()).toBeNull();
  });

  it('returns null when the settings read throws', () => {
    appMock.getPath.mockImplementation(() => {
      throw new Error('no userData');
    });
    expect(resolveLLMOperationRouter()).toBeNull();
  });

  it('returns null when the key decryption throws', () => {
    settingsMock.decryptApiKey.mockImplementation(() => {
      throw new Error('cannot decrypt');
    });
    expect(resolveLLMOperationRouter()).toBeNull();
  });

  it('returns null when the connector factory throws', () => {
    connectorsMock.createConnectorFromSettings.mockImplementation(() => {
      throw new Error('bad provider');
    });
    expect(resolveLLMOperationRouter()).toBeNull();
  });

  it('returns null when the router builder throws', () => {
    llmMock.createLLMOperationRouter.mockImplementation(() => {
      throw new Error('bad router');
    });
    expect(resolveLLMOperationRouter()).toBeNull();
  });
});
