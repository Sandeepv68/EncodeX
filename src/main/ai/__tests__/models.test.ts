import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listProviderModels } from '../models';
import { ProviderHttpError } from '../connectors';
import type { FetchLike } from '../connectors';
import type { AiServerSettings } from '../settings';

const baseSettings: AiServerSettings = {
  providerId: 'rules',
  model: 'rule-based',
  baseUrl: '',
} as unknown as AiServerSettings;

describe('listProviderModels', () => {
  let fetchImpl: ReturnType<typeof vi.fn>;

  const run = (settings: AiServerSettings, key: string) => listProviderModels(settings, key, fetchImpl as unknown as FetchLike);

  beforeEach(() => {
    fetchImpl = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('returns empty list for rules provider', async () => {
    const res = await run({ ...baseSettings, providerId: 'rules' } as AiServerSettings, 'key');
    expect(res).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns empty list for unknown provider', async () => {
    const res = await run({ ...baseSettings, providerId: 'local' as never } as AiServerSettings, 'key');
    expect(res).toEqual([]);
  });

  it('fetches OpenAI models and filters non-text models', async () => {
    fetchImpl.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: 'gpt-4o-mini' },
          { id: 'gpt-3.5-turbo' },
          { id: 'dall-e-3' },
          { id: 'gpt-image-1' },
          { id: 'sora-2' },
          { id: 'text-embedding-ada-002' },
        ],
      }),
    });
    const res = await run({ ...baseSettings, providerId: 'openai' } as AiServerSettings, 'key');
    expect(fetchImpl).toHaveBeenCalled();
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(new URL(url).pathname).toBe('/v1/models');
    expect(opts?.headers).toMatchObject({ authorization: 'Bearer key' });
    expect(res).toContain('gpt-4o-mini');
    for (const nonText of ['dall-e-3', 'gpt-image-1', 'sora-2', 'text-embedding-ada-002']) {
      expect(res).not.toContain(nonText);
    }
  });

  it('uses custom baseUrl for OpenAI', async () => {
    fetchImpl.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: 'gpt-4o' }] }),
    });
    await run({ ...baseSettings, providerId: 'openai', baseUrl: 'http://localhost:1234/v1' } as AiServerSettings, 'k');
    const [url] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://localhost:1234/v1/models');
  });

  it('fetches Anthropic models', async () => {
    fetchImpl.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: 'claude-3-5-haiku-latest' }, { id: 'claude-3-5-sonnet-latest' }],
      }),
    });
    const res = await run({ ...baseSettings, providerId: 'anthropic' } as AiServerSettings, 'sk');
    const [, opts] = fetchImpl.mock.calls[0];
    expect(opts?.headers).toMatchObject({
      'x-api-key': 'sk',
      'anthropic-version': '2023-06-01',
    });
    expect(res).toContain('claude-3-5-haiku-latest');
  });

  it('fetches Gemini models and filters non-text generateContent models', async () => {
    fetchImpl.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [
          { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-2.5-flash-preview-image', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-nano-banana-2.1', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-2.5-flash-preview-tts', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-2.5-flash-native-audio', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-3.5-transcribe', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-2.0-flash-live-001', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/veo-3.1', supportedGenerationMethods: ['predictLongRunning'] },
          { name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent'] },
        ],
      }),
    });
    const res = await run({ ...baseSettings, providerId: 'gemini' } as AiServerSettings, 'key');
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(new URL(url).hostname).toBe('generativelanguage.googleapis.com');
    expect(opts?.headers).toMatchObject({ 'x-goog-api-key': 'key' });
    expect(res).toContain('gemini-3.8-flash');
    for (const nonText of ['preview-image', 'nano-banana', 'preview-tts', 'native-audio', 'transcribe', 'flash-live', 'veo', 'embedding']) {
      expect(res.join(',')).not.toContain(nonText);
    }
  });

  it('throws ProviderHttpError on non-2xx', async () => {
    fetchImpl.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'invalid key',
    });
    await expect(run({ ...baseSettings, providerId: 'openai' } as AiServerSettings, 'bad')).rejects.toThrow(ProviderHttpError);
  });

  it('propagates network errors', async () => {
    fetchImpl.mockRejectedValueOnce(new Error('network down'));
    await expect(run({ ...baseSettings, providerId: 'openai' } as AiServerSettings, 'key')).rejects.toThrow('network down');
  });

  it('retries a transient provider failure before giving up', async () => {
    fetchImpl
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'overloaded' })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'gpt-4o' }] }) });
    const res = await run({ ...baseSettings, providerId: 'openai' } as AiServerSettings, 'key');
    expect(res).toEqual(['gpt-4o']);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('leads with the configured model when the provider reports it', async () => {
    fetchImpl.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: 'alpha-model' }, { id: 'gpt-4o-mini' }, { id: 'zulu-model' }],
      }),
    });
    const res = await run({ ...baseSettings, providerId: 'openai', model: 'gpt-4o-mini' } as AiServerSettings, 'key');
    expect(res).toEqual(['gpt-4o-mini', 'alpha-model', 'zulu-model']);
  });
});
