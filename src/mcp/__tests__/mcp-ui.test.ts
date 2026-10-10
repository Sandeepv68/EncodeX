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
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../server';
import { FakeTranscoder } from './test-helpers';
import { MCP_UI_EXTENSION_ID, MCP_UI_RESOURCE_MIME_TYPE, MCP_UI_VIEW_URIS, supportsMcpUi } from '../../shared/mcp-ui';
import { findUiView, MCP_UI_VIEWS } from '../ui/registry';

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
 * Creates a throwaway media file so mutating tools pass their existence guard.
 * @returns {string} Absolute path to a temporary file.
 */
function tempMediaFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-ui-'));
  const file = path.join(dir, 'clip.mp4');
  fs.writeFileSync(file, 'not-a-real-video');
  return file;
}

/**
 * Builds a server with fake transcoders and connects a client over a linked
 * in-memory transport pair.
 * @param {{ uiCapable?: boolean }} [options] - Whether the client advertises MCP Apps.
 * @returns {Promise<UiSession>} The connected session.
 */
async function connect(options: { uiCapable?: boolean } = {}): Promise<UiSession> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer({ transcoderFactory: () => new FakeTranscoder() });
  await server.connect(serverTransport);
  const client = new Client(
    { name: 'mcp-ui-test-client', version: '1.0.0' },
    options.uiCapable ? { capabilities: { extensions: { [MCP_UI_EXTENSION_ID]: { mimeTypes: [MCP_UI_RESOURCE_MIME_TYPE] } } } } : undefined,
  );
  await client.connect(clientTransport);
  return { client, close: () => client.close() };
}

describe('MCP Apps server surface', () => {
  it('advertises the UI extension on initialize', async () => {
    const session = await connect();
    try {
      const capabilities = session.client.getServerCapabilities();
      const uiCapability = capabilities?.extensions?.[MCP_UI_EXTENSION_ID] as { mimeTypes?: string[] } | undefined;
      expect(uiCapability).toBeDefined();
      expect(uiCapability?.mimeTypes).toContain(MCP_UI_RESOURCE_MIME_TYPE);
    } finally {
      await session.close();
    }
  });

  it('lists every view with the MCP App MIME type', async () => {
    const session = await connect();
    try {
      const { resources } = await session.client.listResources();
      for (const uri of [
        MCP_UI_VIEW_URIS.queue,
        MCP_UI_VIEW_URIS.job,
        MCP_UI_VIEW_URIS.mediaInfo,
        MCP_UI_VIEW_URIS.convert,
        MCP_UI_VIEW_URIS.confirm,
        MCP_UI_VIEW_URIS.inspector,
        MCP_UI_VIEW_URIS.plan,
      ]) {
        const view = resources.find((resource) => resource.uri === uri);
        expect(view, `missing view ${uri}`).toBeDefined();
        expect(view?.mimeType).toBe(MCP_UI_RESOURCE_MIME_TYPE);
      }
    } finally {
      await session.close();
    }
  });

  it('declares restrictive CSP metadata on every view resource (listing)', async () => {
    const session = await connect();
    try {
      const { resources } = await session.client.listResources();
      for (const uri of MCP_UI_VIEWS.map((view) => view.uri)) {
        const view = resources.find((resource) => resource.uri === uri);
        const meta = view?._meta as { ui?: { csp?: Record<string, unknown> } } | undefined;
        expect(meta?.ui?.csp, `${uri} ui.csp`).toBeDefined();
        for (const directive of ['connectDomains', 'resourceDomains', 'frameDomains', 'baseUriDomains']) {
          expect(meta?.ui?.csp?.[directive], `${uri} csp.${directive}`).toEqual([]);
        }
      }
    } finally {
      await session.close();
    }
  });

  it('declares restrictive CSP metadata on every read view content item', async () => {
    const session = await connect();
    try {
      for (const uri of MCP_UI_VIEWS.map((view) => view.uri)) {
        const result = await session.client.readResource({ uri });
        const first = result.contents[0] as { _meta?: { ui?: { csp?: Record<string, unknown> } } };
        const csp = first._meta?.ui?.csp;
        expect(csp, `${uri} content ui.csp`).toBeDefined();
        expect(csp?.connectDomains).toEqual([]);
        expect(csp?.resourceDomains).toEqual([]);
        expect(csp?.frameDomains).toEqual([]);
        expect(csp?.baseUriDomains).toEqual([]);
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
      for (const uri of [
        MCP_UI_VIEW_URIS.queue,
        MCP_UI_VIEW_URIS.job,
        MCP_UI_VIEW_URIS.mediaInfo,
        MCP_UI_VIEW_URIS.convert,
        MCP_UI_VIEW_URIS.confirm,
        MCP_UI_VIEW_URIS.inspector,
        MCP_UI_VIEW_URIS.plan,
      ]) {
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

  it('proposes mutating operations instead of running them for MCP Apps clients', async () => {
    const input = tempMediaFile();
    const session = await connect({ uiCapable: true });
    try {
      const { tools } = await session.client.listTools();
      const commit = tools.find((tool) => tool.name === 'commit_operation');
      expect(commit).toBeDefined();
      const meta = commit?._meta as { ui?: { visibility?: string[] } } | undefined;
      expect(meta?.ui?.visibility).toEqual(['app']);

      const result = await session.client.callTool({ name: 'convert_media', arguments: { input } });
      const structured = (result as { structuredContent?: { confirmation?: { operation?: string; args?: Record<string, unknown> } } })
        .structuredContent;
      expect(structured?.confirmation?.operation).toBe('convert_media');
      expect(structured?.confirmation?.args?.input).toBe(input);

      const jobs = await session.client.callTool({ name: 'list_jobs', arguments: {} });
      expect((jobs as { structuredContent?: { count?: number } }).structuredContent?.count).toBe(0);
    } finally {
      await session.close();
    }
  });

  it('runs mutating operations immediately for plain clients (headless fallback)', async () => {
    const input = tempMediaFile();
    const session = await connect();
    try {
      const result = await session.client.callTool({ name: 'convert_media', arguments: { input } });
      const structured = (result as { structuredContent?: { job?: { id?: string }; confirmation?: unknown } }).structuredContent;
      expect(structured?.confirmation).toBeUndefined();
      expect(structured?.job?.id).toBeTruthy();
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
        analyze_media: MCP_UI_VIEW_URIS.inspector,
        recommend_settings: MCP_UI_VIEW_URIS.plan,
        estimate_conversion: MCP_UI_VIEW_URIS.plan,
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

describe('MCP Apps view registry', () => {
  it('resolves a registered view by URI and returns undefined for an unknown URI', () => {
    const view = findUiView(MCP_UI_VIEW_URIS.queue);
    expect(view?.uri).toBe(MCP_UI_VIEW_URIS.queue);
    expect(findUiView('ui://encodex/does-not-exist')).toBeUndefined();
  });

  it('serves a self-contained HTML document for every registered view', () => {
    for (const view of MCP_UI_VIEWS) {
      expect(view.html(), `${view.uri} html`).toContain('<!doctype html>');
    }
  });
});

describe('supportsMcpUi', () => {
  it('detects the MCP App MIME type in client capabilities', () => {
    expect(supportsMcpUi({ mimeTypes: [MCP_UI_RESOURCE_MIME_TYPE] })).toBe(true);
  });

  it('treats a bare extension object as support (matches the reference helper)', () => {
    expect(supportsMcpUi({})).toBe(true);
  });

  it('rejects capabilities whose mimeTypes omit the MCP App MIME type', () => {
    expect(supportsMcpUi({ mimeTypes: ['text/html'] })).toBe(false);
  });

  it('rejects non-object capabilities', () => {
    expect(supportsMcpUi(null)).toBe(false);
    expect(supportsMcpUi(undefined)).toBe(false);
    expect(supportsMcpUi('io.modelcontextprotocol/ui')).toBe(false);
  });
});
