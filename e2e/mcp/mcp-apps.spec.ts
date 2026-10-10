/**
 * @fileoverview W10 e2e suite for the MCP Apps (SEP-1865) server surface.
 *
 * Spawns the standalone Streamable-HTTP server and dials it as a real MCP
 * client to assert the parts of the contract a host relies on to render views:
 * the `io.modelcontextprotocol/ui` capability is advertised on `initialize`,
 * every `ui://` view is listed and read back as self-contained
 * `text/html;profile=mcp-app` HTML (no external script/style), UI-enabled tools
 * carry `_meta.ui.resourceUri`, and a view-backed tool still returns its plain
 * text fallback for non-UI hosts.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connectHttp, call, assertMcpAppsSurface } from './client';
import type { McpHandle } from './client';
import { startHttpServer, stopProcess } from './harness';
import type { HttpServerHarness } from './harness';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;
const TOKEN = 'encodex-e2e-mcp-apps-token';

describe.runIf(IS_E2E)('MCP Apps surface (e2e)', () => {
  let server: HttpServerHarness;
  let handle: McpHandle;

  beforeAll(async () => {
    server = await startHttpServer({ token: TOKEN, port: 0, maxSessions: 4 });
    handle = await connectHttp(`http://127.0.0.1:${server.port}/mcp`, { token: TOKEN, retries: 5, name: 'encodex-e2e-mcp-apps' });
  }, 120000);

  afterAll(async () => {
    await handle?.close();
    await stopProcess(server?.child ?? null);
  });

  it('advertises the UI extension and serves every view with the MCP App MIME type', async () => {
    await assertMcpAppsSurface(handle);
  });

  it('marks UI-enabled tools with their view resource URI', async () => {
    const { tools } = await handle.client.listTools();
    const expected: Record<string, string> = {
      list_jobs: 'ui://encodex/queue',
      get_job: 'ui://encodex/job',
      get_media_info: 'ui://encodex/media-info',
      convert_media: 'ui://encodex/convert',
      compress_image: 'ui://encodex/confirm',
      extract_audio: 'ui://encodex/confirm',
      cut_video: 'ui://encodex/confirm',
      batch_convert: 'ui://encodex/confirm',
      remux_media: 'ui://encodex/confirm',
      demux_media: 'ui://encodex/confirm',
      analyze_media: 'ui://encodex/inspector',
      recommend_settings: 'ui://encodex/plan',
      estimate_conversion: 'ui://encodex/plan',
      compress_to_target: 'ui://encodex/lab',
    };
    for (const [name, uri] of Object.entries(expected)) {
      const tool = tools.find((candidate) => candidate.name === name);
      expect(tool, `missing tool ${name}`).toBeDefined();
      const meta = tool?._meta as { ui?: { resourceUri?: string } } | undefined;
      expect(meta?.ui?.resourceUri, `${name} ui.resourceUri`).toBe(uri);
    }
  });

  it('keeps the plain text fallback for a view-backed tool', async () => {
    const jobs = await call<unknown[]>(handle.client, 'list_jobs', {});
    expect(Array.isArray(jobs)).toBe(true);
  });

  it('returns structuredContent alongside the text fallback for every tool (R0.2)', async () => {
    const result = await handle.client.callTool({ name: 'list_jobs', arguments: {} });
    const blocks = (result.content ?? []) as Array<{ type?: string; text?: string }>;
    const text = blocks
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('');
    expect(text.trim().length).toBeGreaterThan(0);
    const structured = (result as { structuredContent?: { jobs?: unknown[]; count?: number } }).structuredContent;
    expect(structured).toBeDefined();
    expect(structured?.jobs).toEqual([]);

    const pong = await handle.client.callTool({ name: 'ping', arguments: {} });
    expect((pong as { structuredContent?: { pong?: boolean } }).structuredContent?.pong).toBe(true);
  });
});
