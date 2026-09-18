import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
      appVersion: '1.0.0-beta.3',
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
    const text = (pong.content ?? [])
      .filter((c: { type?: string }) => c.type === 'text')
      .map((c: { text: string }) => c.text)
      .join('');
    expect(JSON.parse(text)).toEqual({ pong: true });
  }, 20000);

  it('rejects clients without the bearer token (401)', async () => {
    await expect(connectClient()).rejects.toThrow();
  });

  it('rejects clients with the wrong bearer token (401)', async () => {
    await expect(connectClient('wrong-token')).rejects.toThrow();
  });

  it('rejects browser origins not matching loopback (403)', async () => {
    const res = await fetch(baseUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: 'http://evil.example.com' },
    });
    expect(res.status).toBe(403);
  });

  it('permits the loopback origin (past auth/origin, honors protocol rules)', async () => {
    const res = await fetch(baseUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: `http://127.0.0.1:${handle?.port()}` },
    });
    // The request passes the origin + token gate; the exact status is decided by
    // the MCP protocol transport (a bare GET without a session can be 406/404).
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('returns 405 for unsupported methods', async () => {
    const res = await fetch(baseUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${TOKEN}` },
      body: '{}',
    });
    expect(res.status).toBe(405);
  });

  it('returns 404 for non-MCP paths', async () => {
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
