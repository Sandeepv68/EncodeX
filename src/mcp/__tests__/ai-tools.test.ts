/**
 * @fileoverview Tests for the AI-backed MCP tools (analyze_media,
 * recommend_settings, estimate_conversion, validate_output).
 */

import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { MediaStreamInfo } from '../../shared/types';
import { createMcpServer } from '../server';
import { FakeTranscoder, type FakeTranscoderOptions } from './test-helpers';

/** Streams describing a 1080p H.264 + AAC file for the fake probe. */
const STREAMS: MediaStreamInfo[] = [
  { index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 },
  { index: 1, type: 'audio', codec: 'aac', channels: 2, channelLayout: 'stereo' },
];

/** Temp directory holding dummy media files. */
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-ai-'));

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
 * @param {FakeTranscoderOptions} [options] - Fake transcoder behavior.
 * @returns {Promise<{ client: Client; close: () => Promise<void> }>} The session.
 */
async function setup(options: FakeTranscoderOptions = {}): Promise<{ client: Client; close: () => Promise<void> }> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer({ transcoderFactory: () => new FakeTranscoder(options) });
  await server.connect(serverTransport);
  const client = new Client({ name: 'mcp-ai-test', version: '1.0.0' });
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

describe('analyze_media', () => {
  it('returns a structured diagnosis of the probed file', async () => {
    const { client, close } = await setup({ streams: STREAMS });
    try {
      const result = await client.callTool({ name: 'analyze_media', arguments: { input: makeFile('a.mkv') } });
      const analysis = structured(result).analysis;
      expect(analysis.summary).toContain('H264');
      expect(analysis.facts.hasVideo).toBe(true);
      expect(Array.isArray(analysis.findings)).toBe(true);
    } finally {
      await close();
    }
  });

  it('frames the diagnosis when a focus is given', async () => {
    const { client, close } = await setup({ streams: STREAMS });
    try {
      const result = await client.callTool({ name: 'analyze_media', arguments: { input: makeFile('a.mkv'), focus: 'size' } });
      const codes = structured(result).analysis.findings.map((finding: { code: string }) => finding.code);
      expect(codes).toContain('SIZE_REPORT');
    } finally {
      await close();
    }
  });

  it('fails clearly when the input is missing', async () => {
    const { client, close } = await setup();
    try {
      const result = await client.callTool({ name: 'analyze_media', arguments: { input: path.join(tempDir, 'nope.mkv') } });
      expect(result.isError).toBe(true);
      expect(structured(result).code).toBe('FILE_NOT_FOUND');
    } finally {
      await close();
    }
  });
});

describe('recommend_settings', () => {
  it('maps an intent to a typed plan', async () => {
    const { client, close } = await setup({ streams: STREAMS });
    try {
      const result = await client.callTool({
        name: 'recommend_settings',
        arguments: { input: makeFile('b.mkv'), intent: 'make this work on my iPhone' },
      });
      const plan = structured(result).plan;
      expect(plan.profileId).toBe('iphone-1080p');
      expect(plan.providerId).toBe('rules');
      expect(plan.isEstimated).toBe(true);
      expect(plan.args.input).toBe(makeFile('b.mkv'));
    } finally {
      await close();
    }
  });
});

describe('estimate_conversion', () => {
  it('returns a labelled size estimate', async () => {
    const { client, close } = await setup({ streams: STREAMS });
    try {
      const result = await client.callTool({
        name: 'estimate_conversion',
        arguments: { input: makeFile('c.mkv'), args: { videoBitrate: '1200k', audioBitrate: '128k' } },
      });
      const estimate = structured(result).estimate;
      expect(estimate.isEstimated).toBe(true);
      expect(estimate.method).toBe('bitrate');
      expect(estimate.estimatedSizeBytes).toBeGreaterThan(0);
    } finally {
      await close();
    }
  });
});

describe('validate_output', () => {
  it('passes when the output satisfies the expectations', async () => {
    const { client, close } = await setup({ streams: STREAMS });
    try {
      const result = await client.callTool({
        name: 'validate_output',
        arguments: { output: makeFile('d.mp4'), expect: { hasVideo: true, hasAudio: true, codec: 'h264' } },
      });
      const validation = structured(result).validation;
      expect(validation.passed).toBe(true);
      expect(validation.checks.every((check: { passed: boolean }) => check.passed)).toBe(true);
    } finally {
      await close();
    }
  });

  it('fails a constraint the output does not meet', async () => {
    const { client, close } = await setup({ streams: STREAMS });
    try {
      const result = await client.callTool({
        name: 'validate_output',
        arguments: { output: makeFile('e.mp4'), expect: { maxBytes: 1 } },
      });
      const validation = structured(result).validation;
      expect(validation.passed).toBe(false);
    } finally {
      await close();
    }
  });
});
