/**
 * @fileoverview Tests for the AI provider connectors (fetch-injectable).
 *
 * Every connector maps the neutral request onto a provider wire format and reads
 * the assistant text back out. The injected fetch keeps these tests offline.
 */

import { describe, it, expect, vi } from 'vitest';
import {
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
    expect(JSON.parse(String(init.body)).system).toBe('be terse');
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
