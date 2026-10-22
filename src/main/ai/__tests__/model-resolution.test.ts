import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '../../../shared/errors';
import type { FetchLike } from '../connectors';
import { listProviderModels } from '../models';
import { resolveProviderModel } from '../model-resolution';
import type { AiServerSettings } from '../settings';

vi.mock('../models', () => ({ listProviderModels: vi.fn() }));

const listMock = vi.mocked(listProviderModels);

const baseSettings: AiServerSettings = { providerId: 'openai', model: '', key: null };

describe('resolveProviderModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the configured model without listing provider models', async () => {
    const settings = { ...baseSettings, model: 'custom-model' };
    await expect(resolveProviderModel(settings, 'sk-1')).resolves.toBe('custom-model');
    expect(listMock).not.toHaveBeenCalled();
  });

  it('falls back to the first model reported by the provider', async () => {
    const fetchImpl = vi.fn() as unknown as FetchLike;
    listMock.mockResolvedValue(['newest-model', 'older-model']);
    await expect(resolveProviderModel(baseSettings, 'sk-1', fetchImpl)).resolves.toBe('newest-model');
    expect(listMock).toHaveBeenCalledWith(baseSettings, 'sk-1', fetchImpl);
  });

  it('fails with AI_NOT_CONFIGURED when the provider reports no model', async () => {
    listMock.mockResolvedValue([]);
    await expect(resolveProviderModel(baseSettings, 'sk-1')).rejects.toMatchObject({ code: ErrorCode.AI_NOT_CONFIGURED });
  });
});
