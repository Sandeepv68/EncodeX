/**
 * @fileoverview HTTP adapter that connects the AI layer's {@link LocalModelClient}
 * to a local model runtime (decision D3, shipped in R4). Targets the Ollama
 * `/api/generate` endpoint by default, so nothing leaves the machine.
 *
 * The client is only constructed when a runtime URL is configured; otherwise
 * {@link createHttpLocalModelClient} returns `undefined` and the local provider
 * reports itself unavailable rather than silently calling nothing.
 */

import type { LocalModelClient } from '../shared/ai/provider';

/**
 * Default local runtime base URL (Ollama's default port).
 * @const {string}
 */
const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';

/**
 * Default model name when none is configured.
 * @const {string}
 */
const DEFAULT_MODEL = 'llama3';

/**
 * Options for {@link createHttpLocalModelClient}.
 * @interface HttpLocalModelClientOptions
 * @property {string} [baseUrl] - Runtime base URL (defaults to `ENCODEX_LOCAL_MODEL_URL`).
 * @property {string} [model] - Model name (defaults to `ENCODEX_LOCAL_MODEL_MODEL`).
 * @property {number} [timeoutMs] - Request timeout (default 120000).
 * @property {typeof fetch} [fetchImpl] - Fetch implementation (test seam).
 */
export interface HttpLocalModelClientOptions {
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Builds a {@link LocalModelClient} backed by a local runtime, or `undefined`
 * when no base URL is configured.
 * @param {HttpLocalModelClientOptions} [options] - Overrides for env defaults.
 * @returns {LocalModelClient | undefined} The client, or `undefined` when unconfigured.
 */
export function createHttpLocalModelClient(options: HttpLocalModelClientOptions = {}): LocalModelClient | undefined {
  const baseUrl = (options.baseUrl ?? process.env.ENCODEX_LOCAL_MODEL_URL ?? '').trim();
  if (!baseUrl) return undefined;
  const model = options.model ?? process.env.ENCODEX_LOCAL_MODEL_MODEL ?? DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs ?? 120000;
  const doFetch = options.fetchImpl ?? fetch;
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/api/generate`;
  return {
    generate: async (prompt: string): Promise<string> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await doFetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt, stream: false }),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`local model runtime returned HTTP ${response.status}`);
        }
        const payload = (await response.json()) as Record<string, unknown>;
        return typeof payload.response === 'string' ? payload.response : '';
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/**
 * Checks whether a local model runtime is configured for this process.
 * @returns {boolean} True when `ENCODEX_LOCAL_MODEL_URL` is set.
 */
export function isLocalModelConfigured(): boolean {
  return Boolean((process.env.ENCODEX_LOCAL_MODEL_URL ?? '').trim());
}

/**
 * The default base URL, exported for documentation/tests.
 * @const {string}
 */
export { DEFAULT_BASE_URL as LOCAL_MODEL_DEFAULT_BASE_URL };
