/**
 * @fileoverview W6 e2e spec for the `.vscode/mcp.json` client contract.
 *
 * Parses the canonical VS Code MCP config (tracked as the
 * `e2e/mcp/fixtures/vscode-mcp.json` fixture, since `.vscode/` is gitignored),
 * asserts it describes a loopback `/mcp` HTTP server on a 1024-65535 port, then
 * dials `http://127.0.0.1:8765/mcp` the way VS Code would: no bearer-token
 * header (the config has none), a plain Streamable-HTTP session. To stay
 * deterministic on CI, where no EncodeX GUI is running, a preferred live
 * endpoint is used when one already answers and a standalone server (started
 * with `--no-auth` so the config's no-header client is honoured verbatim) is
 * spawned otherwise.
 *
 * This is the tier-A (node) half of the VS Code story; the visible VS Code UI
 * drive is W9 (`e2e/mcp/vscode-ui.spec.ts`, real tier).
 *
 * Beyond the session handshake, this spec also runs the *entire* real-ffmpeg
 * core tool suite — `convert_media`, `extract_audio`, `compress_image`,
 * `cut_video`, `batch_convert`, `remux_media` (plain + subtitle/thumbnail/
 * chapters), `demux_media`, and the error-code contracts — over the exact
 * loopback endpoint `.vscode/mcp.json` declares. That is the same wire VS Code
 * uses: VS Code 1.141 surfaces MCP tools only through Copilot Chat (no
 * deterministic GUI "run tool" path), so the full feature matrix is exercised
 * at the client-contract level while W9 proves the live session reachable from
 * the VS Code server picker.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { connectHttp, call, runCoreSuite, assertMcpAppsSurface, ALL_RESOURCE_URIS } from './client';
import type { McpHandle } from './client';
import { rawHttp, startHttpServer, stopProcess, createMediaFixtures, CORE_TOOLS, VSCODE_MCP_FIXTURE_PATH } from './harness';
import type { HttpServerHarness, MediaFixtures } from './harness';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;
const MCP_JSON_PATH = VSCODE_MCP_FIXTURE_PATH;

interface VscodeEndpoint {
  url: string;
  port: number;
  token: string;
}

function parseVscodeEndpoint(): VscodeEndpoint {
  const raw = JSON.parse(fs.readFileSync(MCP_JSON_PATH, 'utf8')) as {
    servers?: { encodex?: { type?: string; url?: string; headers?: { Authorization?: string } } };
  };
  const server = raw.servers?.encodex;
  if (!server) throw new Error('.vscode/mcp.json does not define servers.encodex');
  if (server.type !== 'http') throw new Error(`servers.encodex.type is "${server.type}", expected "http"`);
  if (typeof server.url !== 'string') throw new Error('servers.encodex.url is missing');
  const url = new URL(server.url);
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) throw new Error(`hostname ${url.hostname} is not loopback`);
  if (url.pathname !== '/mcp') throw new Error(`path ${url.pathname} does not match the server route /mcp`);
  const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`port ${url.port} is outside 1024-65535`);
  const auth = server.headers?.Authorization;
  let token = '';
  if (auth !== undefined) {
    if (!/^Bearer\s+\S+$/i.test(auth)) throw new Error(`malformed Authorization header: ${auth}`);
    token = String(auth).replace(/^Bearer\s+/i, '');
  }
  return { url: url.href, port, token };
}

describe.runIf(IS_E2E)('VS Code MCP client contract (.vscode/mcp.json)', () => {
  let endpoint: VscodeEndpoint;
  let ownServer: HttpServerHarness | null = null;
  let handle: McpHandle | null = null;
  let fx: MediaFixtures;
  let isOwnedInstance = false;

  beforeAll(async () => {
    endpoint = parseVscodeEndpoint();
    // If anything already answers on the port (a running EncodeX GUI), dial it
    // directly; otherwise spawn our own so the contract is exercised with the
    // config's no-header client literally. A refused connection is "not up".
    const reachable = await rawHttp(endpoint.port, { method: 'GET', urlPath: '/mcp' })
      .then((res) => res.status >= 400)
      .catch(() => false);
    if (!reachable) {
      ownServer = await startHttpServer({ token: '', port: endpoint.port, maxSessions: 8 });
      isOwnedInstance = true;
    }
    handle = await connectHttp(endpoint.url, { retries: 5, timeoutMs: 20000, name: 'encodex-e2e-vscode-client' });
    fx = createMediaFixtures(fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-mcp-vscode-')));
  }, 30000);

  afterAll(async () => {
    await handle?.close();
    if (ownServer) await stopProcess(ownServer.child);
    try {
      if (fx.dir) fs.rmSync(fx.dir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  });

  it('records a valid loopback /mcp server on a 1024-65535 port', () => {
    const parsed = parseVscodeEndpoint();
    expect(parsed.url).toBe(endpoint.url);
    expect(parsed.port).toBe(8765);
    expect(parsed.token).toBe('');
    expect(new URL(parsed.url).hostname).toBe('127.0.0.1');
    expect(new URL(parsed.url).pathname).toBe('/mcp');
  });

  it('advertises the encodex MCP server with type "http"', () => {
    const raw = JSON.parse(fs.readFileSync(MCP_JSON_PATH, 'utf8')) as {
      servers?: { encodex?: { type?: string; url?: string } };
    };
    expect(raw.servers?.encodex).toBeTruthy();
    expect(raw.servers?.encodex?.type).toBe('http');
    expect(typeof raw.servers?.encodex?.url).toBe('string');
  });

  it('serves the MCP surface the VS Code client dials (no auth header)', async () => {
    const caps = handle!.client.getServerCapabilities();
    expect(caps?.tools).toBeTruthy();
    const { tools } = await handle!.client.listTools();
    const names = tools.map((tool) => tool.name);
    for (const expected of CORE_TOOLS) expect(names).toContain(expected);
    for (const tool of tools) expect(String(tool.description ?? '').length).toBeGreaterThan(10);
    const { resources } = await handle!.client.listResources();
    expect(resources.map((resource) => resource.uri).sort()).toEqual(ALL_RESOURCE_URIS);
    await assertMcpAppsSurface(handle!);
    const { prompts } = await handle!.client.listPrompts();
    expect(prompts.length).toBe(4);
    if (isOwnedInstance) expect(names.sort()).toEqual([...CORE_TOOLS].sort());
  });

  it('answers a minimal initialize round-trip like a VS Code MCP session', async () => {
    const pong = await call<{ pong: boolean }>(handle!.client, 'ping', {});
    expect(pong.pong).toBe(true);
  });

  it('runs the full ffmpeg core suite (convert, cut, remux, demux, ...) over the VS Code endpoint', { timeout: 300000 }, async () => {
    await runCoreSuite(handle!, fx, { mode: 'full', outDir: fx.outHttp });
  });
});
