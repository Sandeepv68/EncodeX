/**
 * @fileoverview Tests for the AI provider connectors (fetch-injectable).
 *
 * Every connector maps the neutral request onto a provider wire format and reads
 * the assistant text back out. The injected fetch keeps these tests offline.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  ProviderHttpError,
  createAnthropicConnector,
  createConnectorFromSettings,
  createGeminiConnector,
  createOpenAICompatibleConnector,
  isRemoteProvider,
} from '../connectors';
import type { FetchLike } from '../connectors';
import type { AiServerSettings } from '../settings';

/** A fake Response with a JSON body. */
function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

/** A fake non-2xx Response carrying a raw text body. */
function errorResponse(status: number, textBody: string): Response {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => textBody,
  } as unknown as Response;
}

/** A fetch spy typed so calls expose their arguments. */
type SpyFetch = FetchLike & { mock: { calls: Array<[string, RequestInit]> } };

/** A fetch that always returns the given body. */
function fetchReturning(body: unknown, status = 200): SpyFetch {
  return vi.fn(async () => jsonResponse(body, status)) as unknown as SpyFetch;
}

/** Reads the header bag off a captured RequestInit. */
function headersOf(init: RequestInit): Record<string, string> {
  return init.headers as Record<string, string>;
}

/** The neutral request used by every test. */
const request = {
  messages: [
    { role: 'system' as const, content: 'be terse' },
    { role: 'user' as const, content: 'pick an operation' },
  ],
  jsonMode: true,
  temperature: 0,
};

describe('createOpenAICompatibleConnector', () => {
  it('posts to /chat/completions and reads the assistant text', async () => {
    const fetchImpl = fetchReturning({ choices: [{ message: { content: 'hello' } }] });
    const connector = createOpenAICompatibleConnector({ apiKey: 'k', fetchImpl });
    const response = await connector.complete(request);
    expect(response.text).toBe('hello');
    expect(connector.id).toBe('openai');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(headersOf(init).authorization).toBe('Bearer k');
    expect(JSON.parse(String(init.body)).response_format).toEqual({ type: 'json_object' });
  });

  it('uses the openai-compatible id when a baseUrl override is set', async () => {
    const fetchImpl = fetchReturning({ choices: [{ message: { content: 'ok' } }] });
    const connector = createOpenAICompatibleConnector({ apiKey: 'k', baseUrl: 'https://openrouter.ai/api/v1/', fetchImpl });
    expect(connector.id).toBe('openai-compatible');
    await connector.complete(request);
    const [url] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
  });

  it('throws on a non-2xx response with the status in the message', async () => {
    const fetchImpl = fetchReturning({ error: 'nope' }, 401);
    const connector = createOpenAICompatibleConnector({ apiKey: 'k', fetchImpl });
    await expect(connector.complete(request)).rejects.toThrow(/HTTP 401/);
  });

  it('throws when the completion is empty', async () => {
    const fetchImpl = fetchReturning({ choices: [] });
    const connector = createOpenAICompatibleConnector({ apiKey: 'k', fetchImpl });
    await expect(connector.complete(request)).rejects.toThrow(/empty completion/);
  });

  it('omits response_format when json mode is off', async () => {
    const fetchImpl = fetchReturning({ choices: [{ message: { content: 'plain' } }] });
    const connector = createOpenAICompatibleConnector({ apiKey: 'k', fetchImpl });
    await connector.complete({ ...request, jsonMode: false });
    const [, init] = fetchImpl.mock.calls[0];
    expect(JSON.parse(String(init.body)).response_format).toBeUndefined();
  });

  it('keeps only the first 4000 characters of a provider error body', async () => {
    const fetchImpl = vi.fn(async () => errorResponse(400, 'y'.repeat(10_000))) as unknown as SpyFetch;
    const connector = createOpenAICompatibleConnector({ apiKey: 'k', fetchImpl });
    let caught: unknown;
    try {
      await connector.complete(request);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ProviderHttpError);
    expect((caught as ProviderHttpError).body).toHaveLength(4000);
  });

  it('swallows a throwing response.text() and still classifies the failure', async () => {
    const failing = {
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => {
        throw new Error('stream broken');
      },
    } as unknown as Response;
    const fetchImpl = vi.fn(async () => failing) as unknown as SpyFetch;
    const connector = createOpenAICompatibleConnector({ apiKey: 'k', fetchImpl });
    let caught: unknown;
    try {
      await connector.complete(request);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ProviderHttpError);
    expect((caught as ProviderHttpError).status).toBe(500);
    expect((caught as ProviderHttpError).body).toBe('');
  });
});

describe('createAnthropicConnector', () => {
  it('concatenates text blocks and sends the system prompt', async () => {
    const fetchImpl = fetchReturning({
      content: [
        { type: 'text', text: 'a' },
        { type: 'text', text: 'b' },
      ],
    });
    const connector = createAnthropicConnector({ apiKey: 'k', fetchImpl });
    const response = await connector.complete(request);
    expect(response.text).toBe('ab');
    expect(connector.id).toBe('anthropic');
    const [, init] = fetchImpl.mock.calls[0];
    expect(headersOf(init)['x-api-key']).toBe('k');
    expect(headersOf(init)['anthropic-version']).toBe('2023-06-01');
    expect(JSON.parse(String(init.body)).system).toBe('be terse');
  });

  it('throws when the completion is empty', async () => {
    const fetchImpl = fetchReturning({ content: [] });
    const connector = createAnthropicConnector({ apiKey: 'k', fetchImpl });
    await expect(connector.complete(request)).rejects.toThrow(/empty completion/);
  });
});

describe('createGeminiConnector', () => {
  it('reads candidate parts and sets responseMimeType in json mode', async () => {
    const fetchImpl = fetchReturning({ candidates: [{ content: { parts: [{ text: 'hi' }, { text: '!' }] } }] });
    const connector = createGeminiConnector({ apiKey: 'k', fetchImpl });
    const response = await connector.complete(request);
    expect(response.text).toBe('hi!');
    const [, init] = fetchImpl.mock.calls[0];
    expect(headersOf(init)['x-goog-api-key']).toBe('k');
    expect(JSON.parse(String(init.body)).generationConfig.responseMimeType).toBe('application/json');
  });

  it('throws when the completion is empty', async () => {
    const fetchImpl = fetchReturning({ candidates: [] });
    const connector = createGeminiConnector({ apiKey: 'k', fetchImpl });
    await expect(connector.complete(request)).rejects.toThrow(/empty completion/);
  });

  it('URL-encodes the model id into the request URL', async () => {
    const fetchImpl = fetchReturning({ candidates: [{ content: { parts: [{ text: 'hi' }] } }] });
    const model = 'models/gemini 2.0 flash';
    const connector = createGeminiConnector({ apiKey: 'k', model, fetchImpl });
    await connector.complete(request);
    const [url] = fetchImpl.mock.calls[0];
    expect(url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`);
  });
});

describe('createConnectorFromSettings', () => {
  const base: AiServerSettings = { providerId: 'openai', model: '', key: 'k', baseUrl: 'https://x/v1' };

  it('builds an openai-compatible connector when a baseUrl is present', () => {
    expect(createConnectorFromSettings(base, 'k', fetchReturning({})).id).toBe('openai-compatible');
  });

  it('builds anthropic and gemini connectors by provider id', () => {
    expect(createConnectorFromSettings({ providerId: 'anthropic', model: '', key: 'k' }, 'k').id).toBe('anthropic');
    expect(createConnectorFromSettings({ providerId: 'gemini', model: '', key: 'k' }, 'k').id).toBe('gemini');
  });

  it('throws for a provider that has no network connector', () => {
    expect(() => createConnectorFromSettings({ providerId: 'rules', model: '', key: 'k' }, 'k')).toThrow(
      /does not use a network connector/,
    );
    expect(() => createConnectorFromSettings({ providerId: 'local', model: '', key: null }, 'k')).toThrow(
      /does not use a network connector/,
    );
  });
});

describe('isRemoteProvider', () => {
  it('is true only for network providers', () => {
    expect(isRemoteProvider('openai')).toBe(true);
    expect(isRemoteProvider('anthropic')).toBe(true);
    expect(isRemoteProvider('gemini')).toBe(true);
    expect(isRemoteProvider('rules')).toBe(false);
    expect(isRemoteProvider('local')).toBe(false);
  });
});
