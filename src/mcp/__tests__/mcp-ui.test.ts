/**
 * @fileoverview Tests for the MCP Apps (SEP-1865) server surface.
 *
 * Verifies the three things a compliant host relies on: the `io.modelcontextprotocol/ui`
 * capability is advertised on `initialize`, the view resources are listed with the
 * `text/html;profile=mcp-app` MIME type, and `resources/read` returns a
 * self-contained HTML document (no external script/style dependencies, so it
 * renders under the host's restrictive default CSP).
 */

import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../server';
import { FakeTranscoder } from './test-helpers';
import { MCP_UI_EXTENSION_ID, MCP_UI_RESOURCE_MIME_TYPE, MCP_UI_VIEW_URIS } from '../../shared/mcp-ui';

/**
 * Connected in-memory MCP session for UI tests.
 * @interface UiSession
 * @property {Client} client - Client bound to a freshly built server.
 * @property {() => Promise<void>} close - Closes the client.
 */
interface UiSession {
  client: Client;
  close: () => Promise<void>;
}

/**
 * Builds a server with fake transcoders and connects a client over a linked
 * in-memory transport pair.
 * @returns {Promise<UiSession>} The connected session.
 */
async function connect(): Promise<UiSession> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer({ transcoderFactory: () => new FakeTranscoder() });
  await server.connect(serverTransport);
  const client = new Client({ name: 'mcp-ui-test-client', version: '1.0.0' });
  await client.connect(clientTransport);
  return { client, close: () => client.close() };
}

describe('MCP Apps server surface', () => {
  it('advertises the UI extension on initialize', async () => {
    const session = await connect();
    try {
      const capabilities = session.client.getServerCapabilities();
      expect(capabilities?.extensions).toHaveProperty(MCP_UI_EXTENSION_ID);
    } finally {
      await session.close();
    }
  });

  it('lists every view with the MCP App MIME type', async () => {
    const session = await connect();
    try {
      const { resources } = await session.client.listResources();
      for (const uri of [MCP_UI_VIEW_URIS.queue, MCP_UI_VIEW_URIS.job, MCP_UI_VIEW_URIS.mediaInfo, MCP_UI_VIEW_URIS.convert]) {
        const view = resources.find((resource) => resource.uri === uri);
        expect(view, `missing view ${uri}`).toBeDefined();
        expect(view?.mimeType).toBe(MCP_UI_RESOURCE_MIME_TYPE);
      }
    } finally {
      await session.close();
    }
  });

  it('serves the queue view as self-contained HTML', async () => {
    const session = await connect();
    try {
      const result = await session.client.readResource({ uri: MCP_UI_VIEW_URIS.queue });
      const first = result.contents[0] as { mimeType?: string; text?: string };
      expect(first.mimeType).toBe(MCP_UI_RESOURCE_MIME_TYPE);
      const html = first.text ?? '';
      expect(html).toContain('<!doctype html>');
      expect(html).toContain('EncodeX queue');
      expect(html).toContain('ui/initialize');
      expect(html).not.toMatch(/<script\b[^>]*\bsrc=/i);
      expect(html).not.toMatch(/<link\b[^>]*\bstylesheet/i);
    } finally {
      await session.close();
    }
  });

  it('serves every view self-contained and within the size budget', async () => {
    const session = await connect();
    try {
      for (const uri of [MCP_UI_VIEW_URIS.queue, MCP_UI_VIEW_URIS.job, MCP_UI_VIEW_URIS.mediaInfo, MCP_UI_VIEW_URIS.convert]) {
        const result = await session.client.readResource({ uri });
        const html = (result.contents[0] as { text?: string }).text ?? '';
        expect(html.length, `${uri} size budget`).toBeLessThan(100_000);
        expect(html).toContain('ui/initialize');
        expect(html).not.toMatch(/<script\b[^>]*\bsrc=/i);
        expect(html).not.toMatch(/<link\b[^>]*\bstylesheet/i);
      }
    } finally {
      await session.close();
    }
  });

  it('marks list_jobs with the queue view and returns structuredContent', async () => {
    const session = await connect();
    try {
      const { tools } = await session.client.listTools();
      const listJobs = tools.find((tool) => tool.name === 'list_jobs');
      expect(listJobs).toBeDefined();
      const meta = listJobs?._meta as { ui?: { resourceUri?: string } } | undefined;
      expect(meta?.ui?.resourceUri).toBe(MCP_UI_VIEW_URIS.queue);

      const result = await session.client.callTool({ name: 'list_jobs', arguments: {} });
      const structured = (result as { structuredContent?: { jobs?: unknown[]; count?: number } }).structuredContent;
      expect(structured?.jobs).toEqual([]);
      expect(structured?.count).toBe(0);

      const content = result.content as Array<{ type: string; text?: string }>;
      expect(content[0]?.type).toBe('text');
      expect(JSON.parse(content[0]?.text ?? 'null')).toEqual([]);
    } finally {
      await session.close();
    }
  });

  it('marks get_job, convert_media and get_media_info with their views', async () => {
    const session = await connect();
    try {
      const { tools } = await session.client.listTools();
      const expected: Record<string, string> = {
        get_job: MCP_UI_VIEW_URIS.job,
        convert_media: MCP_UI_VIEW_URIS.convert,
        get_media_info: MCP_UI_VIEW_URIS.mediaInfo,
      };
      for (const [name, uri] of Object.entries(expected)) {
        const tool = tools.find((candidate) => candidate.name === name);
        expect(tool, `missing tool ${name}`).toBeDefined();
        const meta = tool?._meta as { ui?: { resourceUri?: string } } | undefined;
        expect(meta?.ui?.resourceUri, `${name} ui.resourceUri`).toBe(uri);
      }
    } finally {
      await session.close();
    }
  });

  it('keeps standard resources working alongside views', async () => {
    const session = await connect();
    try {
      const { resources } = await session.client.listResources();
      const profiles = resources.find((resource) => resource.uri === 'encodex://profiles');
      expect(profiles).toBeDefined();
    } finally {
      await session.close();
    }
  });
});
