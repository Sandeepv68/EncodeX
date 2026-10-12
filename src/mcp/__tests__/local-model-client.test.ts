/**
 * @fileoverview Tests for the local model HTTP client adapter
 * ({@link createHttpLocalModelClient}).
 *
 * The client is a pure HTTP wrapper over a local runtime's `/api/generate`
 * endpoint, so every test injects a `fetchImpl` (a test seam) and no process
 * or network call ever happens.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHttpLocalModelClient, isLocalModelConfigured, LOCAL_MODEL_DEFAULT_BASE_URL } from '../local-model-client';
import type { LocalModelClient } from '../../shared/ai/provider';

const ENV_KEYS = ['ENCODEX_LOCAL_MODEL_URL', 'ENCODEX_LOCAL_MODEL_MODEL'] as const;

/** Saves and clears the env knobs the client reads. */
beforeEach(() => {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** A JSON response stub shaped like the Fetch `Response` the client needs. */
function jsonResponse(body: unknown, ok = true, status = 200): { ok: boolean; status: number; json: () => Promise<unknown> } {
  return { ok, status, json: async () => body };
}

describe('createHttpLocalModelClient', () => {
  it('returns undefined when no base URL is configured', () => {
    expect(createHttpLocalModelClient()).toBeUndefined();
    expect(createHttpLocalModelClient({ baseUrl: '   ' })).toBeUndefined();
  });

  it('POSTs the prompt to /api/generate and returns the response string', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ response: 'Hola mundo' }));
    const client = createHttpLocalModelClient({ baseUrl: 'http://127.0.0.1:11434/', model: 'llama2', fetchImpl });
    expect(client).toBeDefined();
    const text = await client!.generate('hola');
    expect(text).toBe('Hola mundo');
    const [url, init] = fetchImpl.mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string>; body: string; signal: AbortSignal },
    ];
    expect(url).toBe(`${LOCAL_MODEL_DEFAULT_BASE_URL}/api/generate`);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ model: 'llama2', prompt: 'hola', stream: false });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('reads baseUrl and model defaults from the environment', async () => {
    process.env.ENCODEX_LOCAL_MODEL_URL = 'http://localhost:1234/';
    process.env.ENCODEX_LOCAL_MODEL_MODEL = 'mistral';
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ response: 'ok' }));
    const client = createHttpLocalModelClient({ fetchImpl });
    await client!.generate('x');
    const [url, init] = fetchImpl.mock.calls[0] as [string, { body: string }];
    expect(url).toBe('http://localhost:1234/api/generate');
    expect(JSON.parse(init.body).model).toBe('mistral');
  });

  it('falls back to the default model name when neither option nor env sets it', async () => {
    process.env.ENCODEX_LOCAL_MODEL_URL = 'http://localhost:1234';
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ response: 'ok' }));
    const client = createHttpLocalModelClient({ fetchImpl });
    await client!.generate('x');
    const [, init] = fetchImpl.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(init.body).model).toBe('llama3');
  });

  it('uses the global fetch when no fetchImpl is supplied', async () => {
    process.env.ENCODEX_LOCAL_MODEL_URL = 'http://localhost:1234';
    const globalFetch = vi.fn().mockResolvedValue(jsonResponse({ response: 'hello' }));
    vi.stubGlobal('fetch', globalFetch);
    const client = createHttpLocalModelClient();
    await expect(client!.generate('hi')).resolves.toBe('hello');
    expect(globalFetch).toHaveBeenCalledOnce();
  });

  it('throws with the HTTP status when the runtime responds non-ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 503));
    const client = createHttpLocalModelClient({ baseUrl: 'http://127.0.0.1:11434', fetchImpl });
    await expect(client!.generate('x')).rejects.toThrow(/HTTP 503/);
  });

  it('returns an empty string when the payload has no string response field', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ detail: 'generating' }));
    const client = createHttpLocalModelClient({ baseUrl: 'http://127.0.0.1:11434', fetchImpl });
    await expect(client!.generate('x')).resolves.toBe('');
  });

  it('aborts the in-flight request when the timeout elapses', async () => {
    const fetchImpl = vi.fn().mockImplementation(() => new Promise(() => {}));
    const client = createHttpLocalModelClient({ baseUrl: 'http://127.0.0.1:11434', timeoutMs: 1000, fetchImpl });
    vi.useFakeTimers();
    const pending = client!.generate('x');
    const [, init] = fetchImpl.mock.calls[0] as [string, { signal: AbortSignal }];
    expect(init.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1001);
    expect(init.signal.aborted).toBe(true);
    // The runtime never responds; the promise stays pending after the abort fires.
    void pending;
  });
});

describe('isLocalModelConfigured', () => {
  it('reports whether ENCODEX_LOCAL_MODEL_URL is set', () => {
    expect(isLocalModelConfigured()).toBe(false);
    process.env.ENCODEX_LOCAL_MODEL_URL = 'http://127.0.0.1:11434';
    expect(isLocalModelConfigured()).toBe(true);
    process.env.ENCODEX_LOCAL_MODEL_URL = '';
    expect(isLocalModelConfigured()).toBe(false);
  });
});

describe('client type contract', () => {
  it('produces a LocalModelClient instance', () => {
    const client = createHttpLocalModelClient({ baseUrl: 'http://127.0.0.1:11434', fetchImpl: vi.fn() }) as LocalModelClient;
    expect(typeof client.generate).toBe('function');
  });
});
