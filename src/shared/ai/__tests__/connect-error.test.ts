/**
 * @fileoverview Tests for the AI connect-error classifier. The cases mirror the
 * documented error shapes of OpenAI (and OpenAI-compatible hosts), Anthropic and
 * Google Gemini, plus the transport failures that never reach an HTTP status.
 */

import { describe, it, expect } from 'vitest';
import { classifyAiConnectError } from '../connect-error';
import { createError, ErrorCode } from '../../errors';

/** Builds a provider HTTP error the way connectors.ts throws it. */
function httpError(status: number, body: unknown): Error {
  return Object.assign(new Error(`Provider responded with HTTP ${status}`), {
    status,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('classifyAiConnectError', () => {
  describe('OpenAI / OpenAI-compatible', () => {
    it('maps invalid_api_key to invalidKey', () => {
      const err = httpError(401, {
        error: { code: 'invalid_api_key', message: 'Incorrect API key provided', type: 'invalid_request_error' },
      });
      expect(classifyAiConnectError(err, 'openai')).toEqual({ reason: 'invalidKey', status: 401 });
    });

    it('maps insufficient_quota to quota', () => {
      const err = httpError(429, { error: { code: 'insufficient_quota', message: 'You exceeded your current quota' } });
      expect(classifyAiConnectError(err, 'openai')).toEqual({ reason: 'quota', status: 429 });
    });

    it('maps model_not_found to modelNotFound', () => {
      const err = httpError(404, {
        error: { code: 'model_not_found', message: 'The model does not exist', type: 'invalid_request_error' },
      });
      expect(classifyAiConnectError(err, 'openai')).toEqual({ reason: 'modelNotFound', status: 404 });
    });

    it('maps rate_limit_exceeded to rateLimit', () => {
      const err = httpError(429, { error: { code: 'rate_limit_exceeded', message: 'Rate limit reached' } });
      expect(classifyAiConnectError(err, 'openai')).toEqual({ reason: 'rateLimit', status: 429 });
    });

    it('maps a bare invalid_request_error to badRequest', () => {
      const err = httpError(400, { error: { type: 'invalid_request_error', message: 'Invalid value' } });
      expect(classifyAiConnectError(err, 'openai')).toEqual({ reason: 'badRequest', status: 400 });
    });

    it('maps server_error to serverError', () => {
      const err = httpError(500, { error: { type: 'server_error', message: 'Internal error' } });
      expect(classifyAiConnectError(err, 'openai')).toEqual({ reason: 'serverError', status: 500 });
    });
  });

  describe('Anthropic', () => {
    it.each([
      ['authentication_error', 401, 'invalidKey'],
      ['permission_error', 403, 'forbidden'],
      ['not_found_error', 404, 'modelNotFound'],
      ['rate_limit_error', 429, 'rateLimit'],
      ['overloaded_error', 529, 'serverError'],
      ['api_error', 500, 'serverError'],
      ['invalid_request_error', 400, 'badRequest'],
    ])('maps %s to %s', (type, status, reason) => {
      const err = httpError(status, { type: 'error', error: { type, message: 'nope' } });
      expect(classifyAiConnectError(err, 'anthropic')).toEqual({ reason, status });
    });
  });

  describe('Google Gemini', () => {
    it('maps INVALID_ARGUMENT with an API key message to invalidKey', () => {
      const err = httpError(400, {
        error: { code: 400, status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.' },
      });
      expect(classifyAiConnectError(err, 'gemini')).toEqual({ reason: 'invalidKey', status: 400 });
    });

    it('maps PERMISSION_DENIED to forbidden', () => {
      const err = httpError(403, { error: { code: 403, status: 'PERMISSION_DENIED', message: 'Caller does not have permission' } });
      expect(classifyAiConnectError(err, 'gemini')).toEqual({ reason: 'forbidden', status: 403 });
    });

    it('maps UNAUTHENTICATED to invalidKey', () => {
      const err = httpError(401, {
        error: { code: 401, status: 'UNAUTHENTICATED', message: 'Request had invalid authentication credentials' },
      });
      expect(classifyAiConnectError(err, 'gemini')).toEqual({ reason: 'invalidKey', status: 401 });
    });

    it('maps NOT_FOUND to modelNotFound', () => {
      const err = httpError(404, { error: { code: 404, status: 'NOT_FOUND', message: 'models/gemini-9 is not found' } });
      expect(classifyAiConnectError(err, 'gemini')).toEqual({ reason: 'modelNotFound', status: 404 });
    });

    it('maps RESOURCE_EXHAUSTED mentioning quota to quota', () => {
      const err = httpError(429, { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded for quota metric' } });
      expect(classifyAiConnectError(err, 'gemini')).toEqual({ reason: 'quota', status: 429 });
    });

    it('maps a plain RESOURCE_EXHAUSTED to rateLimit', () => {
      const err = httpError(429, { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Resource exhausted' } });
      expect(classifyAiConnectError(err, 'gemini')).toEqual({ reason: 'rateLimit', status: 429 });
    });

    it('maps INTERNAL to serverError', () => {
      const err = httpError(500, { error: { code: 500, status: 'INTERNAL', message: 'Internal error' } });
      expect(classifyAiConnectError(err, 'gemini')).toEqual({ reason: 'serverError', status: 500 });
    });
  });

  describe('HTTP status fallback when the body is unusable', () => {
    it.each([
      [401, 'invalidKey'],
      [403, 'forbidden'],
      [429, 'rateLimit'],
      [400, 'badRequest'],
      [422, 'badRequest'],
      [500, 'serverError'],
      [503, 'serverError'],
    ])('maps HTTP %s to %s', (status, reason) => {
      expect(classifyAiConnectError(httpError(status, '<html>gateway</html>'), 'openai')).toEqual({ reason, status });
    });

    it('maps 404 mentioning a model to modelNotFound', () => {
      expect(classifyAiConnectError(httpError(404, { message: 'model not found' }), 'openai')).toEqual({
        reason: 'modelNotFound',
        status: 404,
      });
    });

    it('maps a generic 404 to notFound', () => {
      expect(classifyAiConnectError(httpError(404, ''), 'openai')).toEqual({ reason: 'notFound', status: 404 });
    });
  });

  describe('transport failures', () => {
    it('classifies an abort as timeout', () => {
      expect(classifyAiConnectError(new Error('The operation was aborted'), 'openai')).toEqual({ reason: 'timeout' });
    });

    it('classifies a timeout message as timeout', () => {
      expect(classifyAiConnectError(new Error('Request timed out after 30000ms'), 'openai')).toEqual({ reason: 'timeout' });
    });

    it('classifies a fetch failure as network', () => {
      expect(classifyAiConnectError(new TypeError('fetch failed'), 'openai')).toEqual({ reason: 'network' });
    });

    it('classifies an empty completion as emptyResponse', () => {
      expect(classifyAiConnectError(new Error('Provider returned an empty completion.'), 'openai')).toEqual({ reason: 'emptyResponse' });
    });

    it('classifies the AI_RESPONSE_INVALID app error as emptyResponse', () => {
      const err = createError(ErrorCode.AI_RESPONSE_INVALID, 'Provider returned an empty completion.');
      expect(classifyAiConnectError(err, 'openai')).toEqual({ reason: 'emptyResponse' });
    });

    it('falls back to unknown for an unrecognized transport error', () => {
      expect(classifyAiConnectError(new Error('something odd'), 'openai')).toEqual({ reason: 'unknown' });
    });
  });

  it('never throws on hostile input', () => {
    const hostile = {
      get status() {
        throw new Error('boom');
      },
      get body() {
        throw new Error('boom');
      },
      get message() {
        throw new Error('boom');
      },
    };
    expect(classifyAiConnectError(hostile, 'openai')).toEqual({ reason: 'unknown' });
    expect(classifyAiConnectError(null, 'anthropic')).toEqual({ reason: 'unknown' });
    expect(classifyAiConnectError('nope', 'gemini')).toEqual({ reason: 'unknown' });
  });

  describe('application error codes', () => {
    it('maps the AI_NOT_CONFIGURED app error to unknown', () => {
      const err = createError(ErrorCode.AI_NOT_CONFIGURED, 'No key stored.');
      expect(classifyAiConnectError(err, 'openai')).toEqual({ reason: 'unknown' });
    });
  });

  describe('Gemini gRPC status edge cases', () => {
    it.each([
      ['INVALID_ARGUMENT', 'Invalid value', 'badRequest'],
      ['UNAVAILABLE', 'Service temporarily unavailable', 'serverError'],
      ['DEADLINE_EXCEEDED', 'Deadline exceeded', 'serverError'],
      ['UNKNOWN', 'Unknown error', 'serverError'],
    ])('maps %s to %s', (status, message, reason) => {
      const err = httpError(500, { error: { code: 500, status, message } });
      expect(classifyAiConnectError(err, 'gemini')).toEqual({ reason, status: 500 });
    });

    it.each([['The model is not supported for this request'], ['The requested model does not exist']])(
      'maps the message %j to modelNotFound',
      (message) => {
        const err = httpError(400, { error: { code: 400, status: 'INVALID_ARGUMENT', message } });
        expect(classifyAiConnectError(err, 'gemini')).toEqual({ reason: 'modelNotFound', status: 400 });
      },
    );
  });

  describe('unclassified fallbacks', () => {
    it('falls back to unknown with the status when no rule matches an HTTP status', () => {
      const err = httpError(208, '<html>already reported</html>');
      expect(classifyAiConnectError(err, 'openai')).toEqual({ reason: 'unknown', status: 208 });
    });

    it('falls through to the HTTP fallback when the Gemini mapper does not recognise the status', () => {
      const err = httpError(418, { error: { code: 418, status: 'DATA_LOSS', message: 'Data loss detected' } });
      expect(classifyAiConnectError(err, 'gemini')).toEqual({ reason: 'unknown', status: 418 });
    });
  });

  describe('OpenAI-specific codes', () => {
    it('maps billing_hard_limit_reached to quota', () => {
      const err = httpError(429, { error: { code: 'billing_hard_limit_reached', message: 'Billing hard limit reached' } });
      expect(classifyAiConnectError(err, 'openai')).toEqual({ reason: 'quota', status: 429 });
    });

    it('maps model_not_available to modelNotFound', () => {
      const err = httpError(404, { error: { code: 'model_not_available', message: 'Model is not available' } });
      expect(classifyAiConnectError(err, 'openai')).toEqual({ reason: 'modelNotFound', status: 404 });
    });

    it('maps the api_error type to serverError', () => {
      const err = httpError(500, { error: { type: 'api_error', message: 'The server had an error' } });
      expect(classifyAiConnectError(err, 'openai')).toEqual({ reason: 'serverError', status: 500 });
    });
  });

  describe('hostile structures never throw', () => {
    it('tolerates an array, a throwing Proxy and a cyclic object', () => {
      expect(classifyAiConnectError([1, 2, 3] as unknown, 'openai')).toEqual({ reason: 'unknown' });

      const proxy = new Proxy(
        {},
        {
          get() {
            throw new Error('nope');
          },
        },
      );
      expect(classifyAiConnectError(proxy, 'gemini')).toEqual({ reason: 'unknown' });

      const cyclic: Record<string, unknown> = { status: 500 };
      cyclic.self = cyclic;
      expect(classifyAiConnectError(cyclic, 'anthropic')).toEqual({ reason: 'serverError', status: 500 });
    });
  });
});
