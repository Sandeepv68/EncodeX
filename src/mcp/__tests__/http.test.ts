/**
 * @fileoverview Phase 6.2 - MCP Streamable-HTTP transport behaviour and hostile
 * input tests (in-process).
 *
 * Every assertion drives the production `src/mcp/http.ts` handler mounted on a
 * real `http.Server`, and real JSON-RPC request/response traffic over HTTP, so
 * the socket layer, the SDK's `StreamableHTTPServerTransport` (via its Node
 * wrapper), the per-session `McpServer` and the shared `MCPJobManager` all run
 * exactly as they would for a hostile MCP host.
 *
 * The server is configured with `enableJsonResponse` (the only response-mode
 * toggle the SDK exposes), so POST requests answer with JSON instead of SSE;
 * the SSE GET path itself is SDK-owned and not re-pinned here. What this file
 * pins is the boundary the plan closes: authentication, loopback `Host`/`Origin`
 * enforcement, query-string token refusal, the session cap, the body cap, and
 * deterministic status codes for hostile methods/content/JSON.
 */

import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { describe, it, expect } from 'vitest';
import { APP_NAME } from '../../shared/app-constants';
import { createMcpHttpServer } from '../http';
import type { McpHttpServerOptions } from '../http';
import { FakeTranscoder } from './test-helpers';

/** Accept header the MCP Streamable HTTP client contract requires on POSTs. */
const OPEN_ACCEPT = 'application/json, text/event-stream';

/** Request/response over the test server. */
interface HttpResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  text: string;
}

/**
 * Post request builder arguments.
 * @interface PostSpec
 * @property {string} sid - Session id sent as the mcp-session-id header ('' omits it).
 * @property {unknown} body - JSON body to serialize.
 * @property {Record<string,string>} [headers] - Extra/overriding headers.
 * @property {string} [path] - Request path (default '/mcp').
 */
interface PostSpec {
  sid?: string;
  body?: unknown;
  headers?: Record<string, string>;
  path?: string;
}

/**
 * Runs `fn` against a live server bound to an ephemeral loopback port and
 * guarantees the server is closed (and all client sockets finished) afterwards.
 * @param {McpHttpServerOptions} options - Handler options under test.
 * @param {function(number): Promise<T>} fn - Test body, receives the port.
 * @returns {Promise<T>} The test body's result.
 */
async function withServer<T>(options: McpHttpServerOptions, fn: (port: number) => Promise<T>): Promise<T> {
  const server = createMcpHttpServer(options);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address() as { port: number };
  const port = address.port;
  try {
    return await fn(port);
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections?.();
    });
  }
}

/**
 * Issues one HTTP request and resolves with status/headers/body bytes.
 * @param {number} port - Server port.
 * @param {object} spec - Method, path, headers and (stringified) body.
 * @returns {Promise<HttpResponse>} The parsed response envelope.
 */
function request(
  port: number,
  spec: { method?: string; path?: string; headers?: Record<string, string>; body?: string },
): Promise<HttpResponse> {
  const method = spec.method ?? 'POST';
  const headers: Record<string, string> = { Connection: 'close', ...(spec.headers ?? {}) };
  if (spec.body !== undefined && !('Content-Type' in headers)) headers['Content-Type'] = 'application/json';
  if (!('Accept' in headers)) headers.Accept = OPEN_ACCEPT;
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: spec.path ?? '/mcp', headers, agent: false }, (res) => {
      const chunks: Buffer[] = [];
      const finish = (): void =>
        resolve({ status: res.statusCode ?? 0, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') });
      res.on('data', (c) => chunks.push(c as Buffer));
      res.on('error', finish);
      res.on('end', finish);
    });
    req.on('error', reject);
    if (spec.body !== undefined) req.write(spec.body);
    req.end();
  });
}

/**
 * Posts a JSON body, defaulting the headers to the MCP client contract.
 * @param {number} port - Server port.
 * @param {PostSpec} spec - Session id, body, extra headers, path.
 * @returns {Promise<HttpResponse>} The response.
 */
function post(port: number, spec: PostSpec = {}): Promise<HttpResponse> {
  return request(port, {
    ...spec,
    body: spec.body === undefined ? undefined : JSON.stringify(spec.body),
    headers: {
      Accept: OPEN_ACCEPT,
      'Content-Type': 'application/json',
      ...(spec.sid !== undefined && spec.sid !== '' ? { 'mcp-session-id': spec.sid } : {}),
      ...(spec.headers ?? {}),
    },
  });
}

/**
 * Nails a POST to the ready checks: status 200 plus a session-id header, and
 * returns the session id.
 * @param {number} port - Server port.
 * @param {Record<string,unknown>} body - JSON-RPC message to POST.
 * @param {string} [sid] - Session id to send.
 * @param {Record<string,string>} [headers] - Extra/overriding headers.
 * @returns {Promise<string>} The session id from the response headers.
 */
async function postExpectSid(
  port: number,
  body: Record<string, unknown>,
  sid?: string,
  headers: Record<string, string> = {},
): Promise<string> {
  const res = await post(port, { sid, body, headers });
  expect(res.status, `expected 200, got ${res.status}: ${res.text}`).toBe(200);
  expect(typeof res.headers['mcp-session-id'], 'initialize response must carry mcp-session-id').toBe('string');
  return res.headers['mcp-session-id'] as string;
}

/**
 * JSON-RPC `initialize` message.
 * @param {unknown} [id] - Request id.
 * @returns {Record<string,unknown>} A fresh initialize request.
 */
function initializeMessage(id: unknown = 1): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    id,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'http-test-client', version: '1.0.0' },
    },
  };
}

/** JSON-RPC `notifications/initialized` message. @returns {Record<string,unknown>} */
function initializedNotification(): Record<string, unknown> {
  return { jsonrpc: '2.0', method: 'notifications/initialized' };
}

/** JSON-RPC `tools/list` message. @returns {Record<string,unknown>} */
function toolsListMessage(): Record<string, unknown> {
  return { jsonrpc: '2.0', id: 2, method: 'tools/list' };
}

/** JSON-RPC `ping` message. @returns {Record<string,unknown>} */
function pingMessage(): Record<string, unknown> {
  return { jsonrpc: '2.0', id: 3, method: 'ping', params: {} };
}

/**
 * Parses the JSON-RPC `result` field out of a 200 JSON-mode response.
 * @param {HttpResponse} res - POST response.
 * @returns {Record<string,unknown>} The result object.
 */
function jrpcResult(res: HttpResponse): Record<string, unknown> {
  const parsed = JSON.parse(res.text) as { result?: Record<string, unknown>; error?: { code?: number; message?: string } };
  expect(parsed.error, `expected a result, got ${res.text.slice(0, 200)}`).toBeUndefined();
  return (parsed.result ?? {}) as Record<string, unknown>;
}

/**
 * Creates a real file so conversion tools pass their `fs.existsSync` guard.
 * @returns {string} Absolute path to a throwaway media file.
 */
function tempMediaFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-http-'));
  const file = path.join(dir, 'clip.mp4');
  fs.writeFileSync(file, 'not really a video');
  return file;
}

/** A token generator that returns cryptographically fresh uuids. @returns {string} */
function uuid(): string {
  return crypto.randomUUID();
}

describe('MCP HTTP transport (in-process)', () => {
  describe('the session lifecycle', () => {
    it('initializes a session over POST and hands out a session id', async () => {
      await withServer({ transcoderFactory: () => new FakeTranscoder() }, async (port) => {
        const sid = await postExpectSid(port, initializeMessage());
        expect(sid).toMatch(/^[0-9a-f-]{36}$/);
        const result = jrpcResult(await post(port, { sid, body: toolsListMessage() }));
        const tools = result.tools as Array<{ name: string }>;
        expect(tools.some((t) => t.name === 'convert_media')).toBe(true);
      });
    });

    it('answers a notification with 202 and a ping with an empty result', async () => {
      await withServer({ transcoderFactory: () => new FakeTranscoder() }, async (port) => {
        const sid = await postExpectSid(port, initializeMessage());
        const notified = await post(port, { sid, body: initializedNotification() });
        expect(notified.status).toBe(202);
        const pong = await post(port, { sid, body: pingMessage() });
        expect(pong.status).toBe(200);
        expect(jrpcResult(pong)).toEqual({});
      });
    });

    it('routes a full conversion tool call through HTTP and back', async () => {
      const input = tempMediaFile();
      await withServer({ transcoderFactory: () => new FakeTranscoder() }, async (port) => {
        const sid = await postExpectSid(port, initializeMessage());
        const converted = await post(port, {
          sid,
          body: { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'convert_media', arguments: { input } } },
        });
        const envelope = jrpcResult(converted) as { content?: Array<{ type?: string; text?: string }>; isError?: boolean };
        expect(envelope.isError).not.toBe(true);
        const text = (envelope.content ?? [])
          .filter((c) => c.type === 'text')
          .map((c) => c.text ?? '')
          .join('');
        const payload = JSON.parse(text) as { jobId?: string };
        expect(payload.jobId).toBeTypeOf('string');

        const found = await post(port, {
          sid,
          body: { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'get_job', arguments: { jobId: payload.jobId } } },
        });
        const foundEnvelope = jrpcResult(found) as { content?: Array<{ type?: string; text?: string }> };
        const foundText = (foundEnvelope.content ?? [])
          .filter((c) => c.type === 'text')
          .map((c) => c.text ?? '')
          .join('');
        expect((JSON.parse(foundText) as { id?: string }).id).toBe(payload.jobId);
      });
    });

    it('shares job state across two independent sessions', async () => {
      const input = tempMediaFile();
      await withServer({ transcoderFactory: () => new FakeTranscoder() }, async (port) => {
        const sidA = await postExpectSid(port, initializeMessage());
        const converted = await post(port, {
          sid: sidA,
          body: { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'convert_media', arguments: { input } } },
        });
        const text = jrpcResult(converted).content as Array<{ type?: string; text?: string }>;
        const payload = JSON.parse(text.filter((c) => c.type === 'text')[0]!.text!) as { jobId?: string };

        const sidB = await postExpectSid(port, initializeMessage());
        expect(sidB).not.toBe(sidA);
        const found = await post(port, {
          sid: sidB,
          body: { jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'get_job', arguments: { jobId: payload.jobId } } },
        });
        const foundText = jrpcResult(found).content as Array<{ type?: string; text?: string }>;
        expect((JSON.parse(foundText.filter((c) => c.type === 'text')[0]!.text!) as { id?: string }).id).toBe(payload.jobId);
      });
    });

    it('DELETE closes a session and subsequent traffic with that id gets 404', async () => {
      await withServer({ transcoderFactory: () => new FakeTranscoder() }, async (port) => {
        const sid = await postExpectSid(port, initializeMessage());
        const del = await request(port, { method: 'DELETE', path: '/mcp', headers: { 'mcp-session-id': sid } });
        expect(del.status).toBe(200);
        expect((JSON.parse(del.text) as { ok?: boolean }).ok).toBe(true);

        const stale = await post(port, { sid, body: toolsListMessage() });
        expect(stale.status).toBe(404);

        const gone = await request(port, { method: 'DELETE', path: '/mcp', headers: { 'mcp-session-id': sid } });
        expect(gone.status).toBe(404);
      });
    });
  });

  describe('the routing guards', () => {
    it('returns 404 for anything outside the base path', async () => {
      await withServer({}, async (port) => {
        const root = await request(port, { path: '/' });
        expect(root.status).toBe(404);
        const extra = await request(port, { path: '/mcp/extra' });
        expect(extra.status).toBe(404);
        const doublePath = await request(port, { path: '/mcp/mcp' });
        expect(doublePath.status).toBe(404);
      });
    });

    it('returns 405 with an Allow header for unsupported methods', async () => {
      await withServer({}, async (port) => {
        const res = await request(port, { method: 'PATCH' });
        expect(res.status).toBe(405);
        expect(res.headers.allow).toBe('GET, POST, DELETE');
      });
    });

    it('refuses GET without a session (400) and with an unknown session (404)', async () => {
      await withServer({}, async (port) => {
        const noSession = await request(port, { method: 'GET' });
        expect(noSession.status).toBe(400);
        const unknown = await request(port, { method: 'GET', path: '/mcp', headers: { 'mcp-session-id': 'nope' } });
        expect(unknown.status).toBe(404);
      });
    });

    it('returns 415 for a non-JSON content type', async () => {
      await withServer({}, async (port) => {
        const res = await request(port, { body: 'plain', headers: { 'Content-Type': 'text/plain' } });
        expect(res.status).toBe(415);
        expect(res.text).toContain('application/json');
      });
    });

    it('returns 406 for a POST whose Accept misses the client contract', async () => {
      await withServer({}, async (port) => {
        const res = await post(port, { body: initializeMessage(), headers: { Accept: 'application/json' } });
        expect(res.status).toBe(406);
      });
    });

    it('returns 400 for invalid JSON and leaves no orphan session behind', async () => {
      await withServer({ maxSessions: 1 }, async (port) => {
        const bad = await request(port, { body: '{not json' });
        expect(bad.status).toBe(400);
        expect(bad.text).toContain('JSON');
        const sid = await postExpectSid(port, initializeMessage());
        expect(sid).toBeTypeOf('string');
      });
    });

    it('rejects a sessionless non-initialize POST and reserves no session slot', async () => {
      await withServer({ maxSessions: 1 }, async (port) => {
        const orphan = await post(port, { body: toolsListMessage() });
        expect(orphan.status).toBe(400);
        const sid = await postExpectSid(port, initializeMessage());
        expect(sid).toBeTypeOf('string');
      });
    });

    it('refuses an unknown session id on an existing-session POST', async () => {
      await withServer({}, async (port) => {
        const res = await post(port, { sid: uuid(), body: toolsListMessage() });
        expect(res.status).toBe(404);
      });
    });
  });

  describe('the hostile transport bounds', () => {
    it('refuses new sessions with 503 once the cap is reached and frees the slot on DELETE', async () => {
      await withServer({ transcoderFactory: () => new FakeTranscoder(), maxSessions: 1 }, async (port) => {
        const sid = await postExpectSid(port, initializeMessage());
        const refused = await post(port, { body: initializeMessage() });
        expect(refused.status).toBe(503);
        expect(refused.text).toContain('Too many open sessions');

        const del = await request(port, { method: 'DELETE', path: '/mcp', headers: { 'mcp-session-id': sid } });
        expect(del.status).toBe(200);
        const sid2 = await postExpectSid(port, initializeMessage());
        expect(sid2).not.toBe(sid);
      });
    });

    it('refuses a POST whose declared Content-Length exceeds the body cap', async () => {
      await withServer({ maxBodyBytes: 64 }, async (port) => {
        const oversized = JSON.stringify(initializeMessage()) + JSON.stringify(initializeMessage(9));
        const res = await request(port, { headers: { 'Content-Length': String(oversized.length) }, body: oversized });
        expect(res.status).toBe(413);
        expect(res.text).toContain('Request body too large');
      });
    });

    it('survives a chunked upload that overflows the body cap', async () => {
      await withServer({ maxBodyBytes: 400 }, async (port) => {
        const oversized = JSON.stringify(initializeMessage(8)) + 'x'.repeat(500) + JSON.stringify(initializeMessage(9));
        const blocked = await new Promise<number | null>((resolve) => {
          const req = http.request({
            host: '127.0.0.1',
            port,
            method: 'POST',
            path: '/mcp',
            headers: { Accept: OPEN_ACCEPT, 'Content-Type': 'application/json' },
            agent: false,
          });
          req.on('response', (res) => {
            res.resume();
            resolve(res.statusCode ?? null);
          });
          req.on('error', () => resolve(null));
          req.write(oversized.slice(0, 40));
          setTimeout(() => {
            req.write(oversized.slice(40));
            req.end();
          }, 20);
        });
        expect(blocked === 413 || blocked === null, 'overflowing chunked upload must be closed or refused').toBe(true);
        const sid = await postExpectSid(port, initializeMessage());
        expect(sid).toBeTypeOf('string');
      });
    });
  });

  describe('the Host and Origin topology guards', () => {
    it('refuses a non-loopback Host header', async () => {
      await withServer({}, async (port) => {
        const res = await post(port, { body: initializeMessage(), headers: { Host: 'evil.example' } });
        expect(res.status).toBe(403);
        const prefix = await post(port, { body: initializeMessage(), headers: { Host: 'evil.example:80' } });
        expect(prefix.status).toBe(403);
      });
    });

    it('refuses a non-loopback Origin header', async () => {
      await withServer({}, async (port) => {
        const res = await post(port, { body: initializeMessage(), headers: { Origin: 'http://evil.example' } });
        expect(res.status).toBe(403);
      });
    });

    it('accepts loopback-only Host and Origin spellings', async () => {
      await withServer({}, async (port) => {
        const hostLocalhost = await post(port, { body: initializeMessage(), headers: { Host: 'localhost:1234' } });
        expect(hostLocalhost.status).toBe(200);
        const originLoopback = await post(port, { body: initializeMessage(), headers: { Origin: 'http://127.0.0.1:8080' } });
        expect(originLoopback.status).toBe(200);
      });
    });
  });

  describe('the bearer token authentication', () => {
    it('refuses no token, a wrong token, and a non-Bearer scheme with 401', async () => {
      await withServer({ bearerToken: 's3cret' }, async (port) => {
        const anonymous = await post(port, { body: initializeMessage() });
        expect(anonymous.status).toBe(401);
        expect(anonymous.headers['www-authenticate']).toBe('Bearer');

        const wrong = await post(port, { body: initializeMessage(), headers: { Authorization: 'Bearer wrong' } });
        expect(wrong.status).toBe(401);

        const basic = await post(port, { body: initializeMessage(), headers: { Authorization: 'Basic dXNlcjpwYXNz' } });
        expect(basic.status).toBe(401);
      });
    });

    it('accepts a case-insensitive Bearer token across the full session', async () => {
      await withServer({ bearerToken: 's3cret' }, async (port) => {
        const auth = { Authorization: 'bearer s3cret' };
        const sid = await postExpectSid(port, initializeMessage(), undefined, auth);
        expect(sid).toBeTypeOf('string');
        const tools = await post(port, { sid, body: toolsListMessage(), headers: auth });
        expect(tools.status).toBe(200);
        const jrpc = jrpcResult(tools);
        expect((jrpc.tools as Array<{ name: string }>).some((t) => t.name === 'convert_media')).toBe(true);
      });
    });

    it('refuses a token passed via the query string even with valid auth', async () => {
      await withServer({ bearerToken: 's3cret' }, async (port) => {
        const auth = { Authorization: 'Bearer s3cret' };
        for (const query of ['token=s3cret', 'access_token=s3cret', 'auth=s3cret', 'authorization=s3cret']) {
          const res = await post(port, { body: initializeMessage(), headers: auth, path: `/mcp?${query}` });
          expect(res.status, `query ${query} must be refused`).toBe(400);
        }
      });
    });
  });

  describe('the advertised server identity', () => {
    it('announces the EncodeX server name to clients', async () => {
      await withServer({}, async (port) => {
        const res = await post(port, { body: initializeMessage() });
        expect(res.status).toBe(200);
        const jrpc = jrpcResult(res);
        expect((jrpc.serverInfo as Record<string, unknown>).name).toBe(APP_NAME);
      });
    });
  });
});
