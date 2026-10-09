import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { expectAppLog } from '../../../test-utils/crash-tripwire';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createMcpServer } from '../../../mcp/server';
import { registerGuiTools } from '../gui-tools';
import { startMcpHttpServer } from '../http-server';
import type { McpHttpHandle } from '../http-server';
import { MCPJobManager } from '../../../mcp/jobs/manager';
import { FakeTranscoder } from '../../../mcp/__tests__/test-helpers';
import type { Client as ClientType } from '@modelcontextprotocol/sdk/client/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

const TOKEN = 'test-bearer-token';

/** Server handle started once for the whole file. @type {McpHttpHandle | null} */
let handle: McpHttpHandle | null = null;
/** Base URL once the handle is up. @type {string} */
let baseUrl = '';

/**
 * Builds a client wired to the running server with the given authorization.
 * @param {string} [token] - Bearer token; omit for an unauthenticated client.
 * @returns {Promise<{client: ClientType, transport: Transport}>} Connected client + transport.
 */
async function connectClient(token?: string): Promise<{ client: ClientType; transport: StreamableHTTPClientTransport }> {
  const transport = new StreamableHTTPClientTransport(new URL(baseUrl), {
    ...(token ? { requestInit: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });
  const client = new Client({ name: 'mcp-http-integration-client', version: '1.0.0' });
  await client.connect(transport as Transport);
  return { client, transport };
}

beforeAll(async () => {
  const jobManager = new MCPJobManager({ transcoderFactory: () => new FakeTranscoder() });
  const sessionServerFactory = () => {
    const server = createMcpServer({ jobManager });
    registerGuiTools(server, {
      jobManager,
      appVersion: '1.0.0-beta.5',
      transcoderFactory: () => new FakeTranscoder(),
      getPreviewFrame: async () => null,
      checkForUpdate: async () => null,
    });
    return server;
  };
  handle = await startMcpHttpServer(sessionServerFactory, { enabled: true, port: 0, token: TOKEN });
  baseUrl = `http://127.0.0.1:${handle.port()}/mcp`;
}, 20000);

afterAll(async () => {
  await handle?.close();
  handle = null;
}, 20000);

describe('embedded MCP HTTP server', () => {
  it('serves a full initialize + listTools + callTool round trip over HTTP', async () => {
    const { client, transport } = await connectClient(TOKEN);
    const tools = await client.listTools();
    const pong = await client.callTool({ name: 'ping', arguments: {} });
    await client.close();
    await transport.close();
    const names = tools.tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['ping', 'convert_media', 'get_queue_state', 'get_system_info', 'cancel_all_jobs']));
    // Narrowed for the same reason as the stdio integration test: the SDK's
    // `content` union does not survive `?? []` as anything but `{}`.
    const blocks = (pong.content ?? []) as Array<{ type?: string; text?: string }>;
    const text = blocks
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');
    expect(JSON.parse(text)).toEqual({ pong: true });
  }, 20000);

  it('rejects clients without the bearer token (401)', async () => {
    expectAppLog('warn', 'main/mcp/http-server');
    await expect(connectClient()).rejects.toThrow();
  });

  it('rejects clients with the wrong bearer token (401)', async () => {
    expectAppLog('warn', 'main/mcp/http-server');
    await expect(connectClient('wrong-token')).rejects.toThrow();
  });

  it('rejects browser origins not matching loopback (403)', async () => {
    expectAppLog('warn', 'main/mcp/http-server');
    const res = await fetch(baseUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: 'http://evil.example.com' },
    });
    expect(res.status).toBe(403);
  });

  it('permits the loopback origin (past auth/origin, honors protocol rules)', async () => {
    const res = await fetch(baseUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'text/event-stream', Origin: `http://127.0.0.1:${handle?.port()}` },
    });
    // The request passes the origin + token gate and is served statelessly: a
    // session-less GET opens an SSE stream (200) instead of being rejected.
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
    await res.body?.cancel();
  });

  it('serves a session-less client statelessly (no Mcp-Session-Id)', async () => {
    // A client that ignores the session id keeps sending every request without
    // `Mcp-Session-Id`; each must still be answered rather than rejected with
    // "Server not initialized".
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${TOKEN}` };

    const initRes = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'stateless-client', version: '1.0.0' } },
      }),
    });
    expect(initRes.status).toBe(200);
    await initRes.text();

    const listRes = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    });
    expect(listRes.status).toBe(200);
    const listBody = await listRes.text();
    expect(listBody).toContain('"tools"');
    expect(listBody).toContain('"name":"ping"');
  });

  it('serves a request whose MCP-Protocol-Version is newer than the SDK supports', async () => {
    // The bundled SDK rejects any unrecognized `MCP-Protocol-Version` with a
    // 400; the server drops it so the transport falls back to its negotiated
    // version instead of failing every follow-up call from a newer client.
    expectAppLog('warn', 'main/mcp/http-server');
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${TOKEN}`,
        'MCP-Protocol-Version': '2026-07-28',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} }),
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('"tools"');
    expect(body).toContain('"name":"ping"');
  });

  it('returns 405 for unsupported methods', async () => {
    expectAppLog('warn', 'main/mcp/http-server');
    const res = await fetch(baseUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${TOKEN}` },
      body: '{}',
    });
    expect(res.status).toBe(405);
  });

  it('returns 404 for non-MCP paths', async () => {
    expectAppLog('warn', 'main/mcp/http-server');
    const res = await fetch(`http://127.0.0.1:${handle?.port()}/nope`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(404);
  });

  it('terminates sessions via DELETE', async () => {
    const { client, transport } = await connectClient(TOKEN);
    await transport.terminateSession();
    await client.close();
    await transport.close();
  }, 20000);
});
