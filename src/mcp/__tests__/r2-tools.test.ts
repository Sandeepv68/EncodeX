/**
 * @fileoverview Tests for the R2 MCP additions: explain_error, advise_encoding,
 * quality_report, the audit sink, and the batch envelope re-approval guard.
 */

import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { MediaStreamInfo } from '../../shared/types';
import type { AuditEntry } from '../../shared/audit';
import { MCP_UI_EXTENSION_ID, MCP_UI_RESOURCE_MIME_TYPE } from '../../shared/mcp-ui';
import { createMcpServer } from '../server';
import { FakeTranscoder, type FakeTranscoderOptions } from './test-helpers';

/** Streams describing a 720p H.264 + AAC file for the fake probe. */
const STREAMS: MediaStreamInfo[] = [
  { index: 0, type: 'video', codec: 'h264', width: 1280, height: 720 },
  { index: 1, type: 'audio', codec: 'aac', channels: 2 },
];

/** Temp directory holding dummy media files. */
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-r2-'));

/**
 * Creates a dummy file on disk.
 * @param {string} name - File name.
 * @returns {string} Absolute path.
 */
function makeFile(name: string): string {
  const file = path.join(tempDir, name);
  fs.writeFileSync(file, 'stub');
  return file;
}

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

/**
 * Connects an in-memory client to a server backed by fake transcoders.
 * @param {{ uiCapable?: boolean; streams?: MediaStreamInfo[]; audit?: AuditEntry[] }} [options] -
 *   Client/server behavior.
 * @returns {Promise<{ client: Client; close: () => Promise<void> }>} The session.
 */
async function setup(
  options: { uiCapable?: boolean; streams?: MediaStreamInfo[]; audit?: AuditEntry[] } = {},
): Promise<{ client: Client; close: () => Promise<void> }> {
  const fakeOptions: FakeTranscoderOptions = { streams: options.streams ?? [] };
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer({
    transcoderFactory: () => new FakeTranscoder(fakeOptions),
    onAudit: options.audit ? (entry) => options.audit!.push(entry) : undefined,
  });
  await server.connect(serverTransport);
  const client = new Client(
    { name: 'mcp-r2-test', version: '1.0.0' },
    options.uiCapable ? { capabilities: { extensions: { [MCP_UI_EXTENSION_ID]: { mimeTypes: [MCP_UI_RESOURCE_MIME_TYPE] } } } } : undefined,
  );
  await client.connect(clientTransport);
  return { client, close: () => client.close() };
}

/**
 * Parses the structuredContent of a tool result.
 * @param {any} result - A CallToolResult.
 * @returns {any} The structured content.
 */
function structured(result: any): any {
  return result.structuredContent;
}

describe('explain_error', () => {
  it('explains a conversion failure with a hardware retry fix', async () => {
    const { client, close } = await setup();
    try {
      const result = await client.callTool({
        name: 'explain_error',
        arguments: {
          code: 'CONVERSION_FAILED',
          tool: 'convert_media',
          args: { input: makeFile('a.mp4'), hardwareAcceleration: true },
        },
      });
      const explanation = structured(result).error;
      expect(explanation.code).toBe('CONVERSION_FAILED');
      expect(explanation.causes.length).toBeGreaterThan(0);
      expect(explanation.fixes).toContainEqual(
        expect.objectContaining({ kind: 'switch', args: expect.objectContaining({ hardwareAcceleration: false }) }),
      );
      expect(explanation.retry).toBeDefined();
    } finally {
      await close();
    }
  });

  it('infers a code from a raw message', async () => {
    const { client, close } = await setup();
    try {
      const result = await client.callTool({ name: 'explain_error', arguments: { message: 'Input file not found: C:/x.mp4' } });
      expect(structured(result).error.code).toBe('FILE_NOT_FOUND');
    } finally {
      await close();
    }
  });
});

describe('advise_encoding', () => {
  it('advises an encoder for a probed source', async () => {
    const { client, close } = await setup({ streams: STREAMS });
    try {
      const result = await client.callTool({ name: 'advise_encoding', arguments: { input: makeFile('b.mp4') } });
      const advice = structured(result).advice;
      expect(advice.sourceCodecFamily).toBe('h264');
      expect(typeof advice.recommendedVideoCodec).toBe('string');
      expect(advice.recommendedVideoCodec.length).toBeGreaterThan(0);
      expect(Array.isArray(advice.rationale)).toBe(true);
    } finally {
      await close();
    }
  });

  it('fails clearly when the input is missing', async () => {
    const { client, close } = await setup();
    try {
      const result = await client.callTool({
        name: 'advise_encoding',
        arguments: { input: path.join(tempDir, 'nope.mp4') },
      });
      expect(result.isError).toBe(true);
      expect(structured(result).code).toBe('FILE_NOT_FOUND');
    } finally {
      await close();
    }
  });
});

describe('quality_report', () => {
  it('passes when the output matches the source', async () => {
    const { client, close } = await setup({ streams: STREAMS });
    try {
      const result = await client.callTool({
        name: 'quality_report',
        arguments: { source: makeFile('src.mp4'), output: makeFile('out.mp4') },
      });
      const report = structured(result).report;
      expect(report.passed).toBe(true);
      expect(report.checks.every((check: { passed: boolean }) => check.passed)).toBe(true);
    } finally {
      await close();
    }
  });
});

describe('onAudit audit sink', () => {
  it('emits an ok entry for a headless mutating operation', async () => {
    const audit: AuditEntry[] = [];
    const { client, close } = await setup({ audit });
    try {
      await client.callTool({ name: 'convert_media', arguments: { input: makeFile('c.mp4'), copy: true } });
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({ tool: 'convert_media', tier: 2, result: 'ok' });
      expect(audit[0].argsDigest).toMatch(/^[0-9a-f]{8}$/);
    } finally {
      await close();
    }
  });

  it('emits an error entry when the operation fails', async () => {
    const audit: AuditEntry[] = [];
    const { client, close } = await setup({ audit });
    try {
      await client.callTool({ name: 'convert_media', arguments: { input: path.join(tempDir, 'missing.mp4') } });
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({ tool: 'convert_media', result: 'error' });
      expect(audit[0].detail).toBeTruthy();
    } finally {
      await close();
    }
  });

  it('emits an entry after batch approval is committed', async () => {
    const audit: AuditEntry[] = [];
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-r2-batch-'));
    fs.writeFileSync(path.join(dir, 'one.mp4'), 'stub');
    const { client, close } = await setup({ uiCapable: true, audit });
    try {
      const proposed = await client.callTool({ name: 'batch_convert', arguments: { inputs: [dir] } });
      const confirmation = structured(proposed).confirmation;
      expect(confirmation.operation).toBe('batch_convert');
      expect(confirmation.args.__envelope).toMatchObject({ fileCount: 1 });

      await client.callTool({ name: 'commit_operation', arguments: { tool: 'batch_convert', args: confirmation.args } });
      expect(audit.filter((entry) => entry.tool === 'batch_convert' && entry.result === 'ok')).toHaveLength(1);
    } finally {
      await close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('batch envelope re-approval', () => {
  it('re-confirms when the matched set grows after approval', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-r2-grow-'));
    fs.writeFileSync(path.join(dir, 'one.mp4'), 'stub');
    const { client, close } = await setup({ uiCapable: true });
    try {
      const proposed = await client.callTool({ name: 'batch_convert', arguments: { inputs: [dir] } });
      const confirmation = structured(proposed).confirmation;
      expect(confirmation.args.__envelope.fileCount).toBe(1);

      fs.writeFileSync(path.join(dir, 'two.mp4'), 'stub');
      const committed = await client.callTool({
        name: 'commit_operation',
        arguments: { tool: 'batch_convert', args: confirmation.args },
      });
      const regrown = structured(committed).confirmation;
      expect(regrown?.operation).toBe('batch_convert');
      expect(regrown?.title).toContain('grew');
      expect(regrown?.warnings?.[0]).toContain('grew');
    } finally {
      await close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
