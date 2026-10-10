/**
 * @fileoverview R0.4 — text-fallback audit for every UI-enabled MCP tool.
 *
 * SEP-2133 requires a UI-enabled tool to still return meaningful `content` text
 * for hosts that do not render MCP Apps (Claude Code, Gemini CLI, Zed, Codex).
 * This spec is deliberately a *drift detector*: it reads the live `tools/list`,
 * derives the set of tools that advertise `_meta.ui.resourceUri`, and asserts it
 * is exactly the audited set below. Adding a view-backed tool without adding it
 * here fails the suite, so the fallback can never silently regress.
 *
 * Every audited tool is called on a plain (non-UI) client, which is what a
 * fallback host is. Each result — success or error — must carry at least one
 * non-empty text block and a `structuredContent` payload.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createMcpServer } from '../server';
import { FakeTranscoder } from './test-helpers';
import { MCP_UI_VIEW_URIS } from '../../shared/mcp-ui';
import type { MediaStreamInfo } from '../../shared/types';

/**
 * A video + audio stream pair so remux/demux produce successful results rather
 * than error responses (the fallback is still asserted in either case).
 * @const {MediaStreamInfo[]}
 */
const PROBE_STREAMS: MediaStreamInfo[] = [
  { index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 },
  { index: 1, type: 'audio', codec: 'aac', channels: 2 },
];

/**
 * Minimal valid arguments per UI-enabled tool. The keys must equal the set of
 * tools advertising `_meta.ui.resourceUri` (enforced below).
 * @const {Record<string, Record<string, unknown>>}
 */
const UI_TOOL_ARGS: Record<string, Record<string, unknown>> = {
  convert_media: { input: '' },
  compress_image: { input: '' },
  extract_audio: { input: '' },
  cut_video: { input: '' },
  batch_convert: { inputs: [''] },
  remux_media: { input: '' },
  demux_media: { input: '' },
  get_job: { jobId: 'does-not-exist' },
  get_media_info: { input: '' },
  analyze_media: { input: '' },
  recommend_settings: { input: '', intent: 'make this work on my iPhone' },
  estimate_conversion: { input: '' },
  compress_to_target: { input: '', maxBytes: 50 * 1024 * 1024 },
  list_jobs: {},
};

/**
 * Creates a throwaway media file so mutating tools pass their existence guard.
 * @returns {string} Absolute path to a temporary file.
 */
function tempMediaFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-text-fallback-'));
  const file = path.join(dir, 'clip.mp4');
  fs.writeFileSync(file, 'not-a-real-video');
  return file;
}

/**
 * Replaces the empty-string placeholders in {@link UI_TOOL_ARGS} with a real
 * temp file path, so path-taking tools resolve to an existing file.
 * @param {Record<string, unknown>} template - The per-tool argument template.
 * @param {string} input - The temp media path to substitute.
 * @returns {Record<string, unknown>} Arguments with paths filled in.
 */
function materializeArgs(template: Record<string, unknown>, input: string): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(template).map(([key, value]) => {
      if (value === '') return [key, input];
      if (Array.isArray(value)) return [key, value.map(() => input)];
      return [key, value];
    }),
  );
}

/**
 * Asserts a tool result carries a non-empty text fallback and a structured
 * payload. Throws (rather than using `expect`) so the failure names the tool.
 * @param {string} name - The tool name, for messages.
 * @param {CallToolResult} result - The raw tool result.
 * @returns {void}
 */
function assertFallback(name: string, result: CallToolResult): void {
  const blocks = (result.content ?? []) as Array<{ type?: string; text?: string }>;
  const text = blocks
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('');
  if (text.trim().length === 0) {
    throw new Error(`${name} returned no text fallback`);
  }
  if (result.structuredContent === undefined) {
    throw new Error(`${name} returned no structuredContent`);
  }
}

describe('MCP tool text fallback (R0.4)', () => {
  it('audits every UI-enabled tool for a text + structured fallback', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer({
      transcoderFactory: () => new FakeTranscoder({ streams: PROBE_STREAMS }),
    });
    await server.connect(serverTransport);
    const client = new Client({ name: 'text-fallback-client', version: '1.0.0' });
    await client.connect(clientTransport);
    try {
      const { tools } = await client.listTools();
      const uiTools = tools
        .filter((tool) => {
          const meta = tool._meta as { ui?: { resourceUri?: string } } | undefined;
          return typeof meta?.ui?.resourceUri === 'string';
        })
        .map((tool) => tool.name)
        .sort();

      expect(uiTools).toEqual(Object.keys(UI_TOOL_ARGS).sort());

      const input = tempMediaFile();
      for (const name of uiTools) {
        const args = materializeArgs(UI_TOOL_ARGS[name], input);
        const result = (await client.callTool({ name, arguments: args })) as CallToolResult;
        assertFallback(name, result);
      }
    } finally {
      await client.close();
    }
  });

  it('returns a text fallback and a stable code for a failing UI tool', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer({ transcoderFactory: () => new FakeTranscoder() });
    await server.connect(serverTransport);
    const client = new Client({ name: 'text-fallback-error-client', version: '1.0.0' });
    await client.connect(clientTransport);
    try {
      const result = (await client.callTool({
        name: 'get_media_info',
        arguments: { input: path.join(os.tmpdir(), 'definitely-missing-encodex.mp4') },
      })) as CallToolResult;
      assertFallback('get_media_info', result);
      expect(result.isError).toBe(true);
      const structured = result.structuredContent as { ok?: boolean; code?: string };
      expect(structured?.ok).toBe(false);
      expect(structured?.code).toBe('FILE_NOT_FOUND');
      const text = (result.content as Array<{ text?: string }>)[0]?.text ?? '';
      expect(JSON.parse(text).code).toBe('FILE_NOT_FOUND');
    } finally {
      await client.close();
    }
  });

  it('attaches the queue view to list_jobs while keeping the plain text fallback', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer({ transcoderFactory: () => new FakeTranscoder() });
    await server.connect(serverTransport);
    const client = new Client({ name: 'text-fallback-view-client', version: '1.0.0' });
    await client.connect(clientTransport);
    try {
      const { tools } = await client.listTools();
      const listJobs = tools.find((tool) => tool.name === 'list_jobs');
      const meta = listJobs?._meta as { ui?: { resourceUri?: string } } | undefined;
      expect(meta?.ui?.resourceUri).toBe(MCP_UI_VIEW_URIS.queue);
      const result = (await client.callTool({ name: 'list_jobs', arguments: {} })) as CallToolResult;
      assertFallback('list_jobs', result);
    } finally {
      await client.close();
    }
  });
});
