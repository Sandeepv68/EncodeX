/**
 * @fileoverview Tests for the R5 workflow DAG tools: plan_workflow (dry-run) and
 * execute_workflow (dependency-ordered execution with {{step.output}} references).
 * The transcoder is faked so jobs complete without touching FFmpeg, but real
 * dummy input files are created so the per-step existence guard passes.
 */

import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../server';
import { MCP_UI_EXTENSION_ID, MCP_UI_RESOURCE_MIME_TYPE } from '../../shared/mcp-ui';
import { FakeTranscoder } from './test-helpers';

/** Temp directory holding dummy media files. */
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-r5-'));

/**
 * A {@link FakeTranscoder} that writes its output path, so a later workflow step
 * that consumes `{{<step>.output}}` sees the file the earlier step produced.
 */
class WritingTranscoder extends FakeTranscoder {
  /**
   * Writes the output file then delegates to the fake's synchronous completion.
   * @param {string} input - Input path (ignored).
   * @param {string} output - Output path to materialize.
   * @param {import('../../shared/types').ConversionOptions} options - Conversion options.
   * @returns {import('events').EventEmitter} The fake's emitter.
   */
  convert(input: string, output: string, options: import('../../shared/types').ConversionOptions): import('events').EventEmitter {
    fs.writeFileSync(output, 'output');
    return super.convert(input, output, options);
  }
}

/**
 * Creates a dummy file on disk so workflow step input guards pass.
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
 * Connects an in-memory client to a server with a fake transcoder.
 * @param {{ uiCapable?: boolean }} [options] - Whether the client advertises MCP Apps.
 * @returns {Promise<{ client: Client; close: () => Promise<void> }>} The session.
 */
async function setup(options: { uiCapable?: boolean } = {}): Promise<{ client: Client; close: () => Promise<void> }> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer({ transcoderFactory: () => new WritingTranscoder() });
  await server.connect(serverTransport);
  const client = new Client(
    { name: 'mcp-r5-test', version: '1.0.0' },
    options.uiCapable ? { capabilities: { extensions: { [MCP_UI_EXTENSION_ID]: { mimeTypes: [MCP_UI_RESOURCE_MIME_TYPE] } } } } : undefined,
  );
  await client.connect(clientTransport);
  return { client, close: () => client.close() };
}

describe('plan_workflow', () => {
  it('returns a valid dry-run with steps in dependency order', async () => {
    const { client, close } = await setup();
    try {
      const input = makeFile('plan.mp4');
      const result = await client.callTool({
        name: 'plan_workflow',
        arguments: {
          steps: [
            { id: 'b', tool: 'convert_media', args: { input: '{{a.output}}' } },
            { id: 'a', tool: 'convert_media', args: { input } },
          ],
        },
      });
      const plan = (result as { structuredContent?: { plan?: any } }).structuredContent?.plan;
      expect(result.isError).toBeFalsy();
      expect(plan.valid).toBe(true);
      expect(plan.issues).toEqual([]);
      expect(plan.steps.map((step: any) => step.id)).toEqual(['a', 'b']);
      expect(plan.steps[1].dependsOn).toContain('a');
      expect(typeof plan.summary).toBe('string');
    } finally {
      await close();
    }
  });

  it('reports validation issues for an invalid DAG instead of running', async () => {
    const { client, close } = await setup();
    try {
      const result = await client.callTool({
        name: 'plan_workflow',
        arguments: { steps: [{ id: 'a', tool: 'cut_video', args: { input: '{{missing.output}}' } }] },
      });
      const plan = (result as { structuredContent?: { plan?: any } }).structuredContent?.plan;
      expect(result.isError).toBeFalsy();
      expect(plan.valid).toBe(false);
      expect(plan.order).toEqual([]);
      expect(plan.issues.map((issue: any) => issue.code)).toContain('unknown_dependency');
    } finally {
      await close();
    }
  });
});

describe('execute_workflow', () => {
  it('runs steps in dependency order and resolves references for plain clients', async () => {
    const { client, close } = await setup();
    try {
      const inputA = makeFile('a.mp4');
      const result = await client.callTool({
        name: 'execute_workflow',
        arguments: {
          steps: [
            { id: 'b', tool: 'convert_media', args: { input: '{{a.output}}' } },
            { id: 'a', tool: 'convert_media', args: { input: inputA } },
          ],
        },
      });
      const report = (result as { structuredContent?: { result?: any } }).structuredContent?.result;
      expect(report.completed).toBe(true);
      expect(report.failed).toBeUndefined();
      expect(report.steps.map((step: any) => step.id)).toEqual(['a', 'b']);

      const jobs = await client.callTool({ name: 'list_jobs', arguments: {} });
      const listed = (jobs as { structuredContent?: { jobs?: any[] } }).structuredContent?.jobs ?? [];
      const byId = new Map(listed.map((job: any) => [job.id, job]));
      const stepA = byId.get(report.steps[0].jobId);
      const stepB = byId.get(report.steps[1].jobId);
      expect(stepA?.input).toBe(inputA);
      expect(stepB?.input).toBe(report.steps[0].output);
    } finally {
      await close();
    }
  });

  it('proposes the workflow instead of running it for MCP Apps clients', async () => {
    const { client, close } = await setup({ uiCapable: true });
    try {
      const input = makeFile('propose.mp4');
      const result = await client.callTool({
        name: 'execute_workflow',
        arguments: { steps: [{ id: 'a', tool: 'convert_media', args: { input } }] },
      });
      const structured = (result as { structuredContent?: { confirmation?: { operation?: string } } }).structuredContent;
      expect(structured?.confirmation?.operation).toBe('execute_workflow');
      const jobs = await client.callTool({ name: 'list_jobs', arguments: {} });
      expect((jobs as { structuredContent?: { count?: number } }).structuredContent?.count).toBe(0);
    } finally {
      await close();
    }
  });

  it('stops at the first failing step and reports what completed', async () => {
    const { client, close } = await setup();
    try {
      const missing = path.join(tempDir, 'does-not-exist.mp4');
      const result = await client.callTool({
        name: 'execute_workflow',
        arguments: {
          steps: [
            { id: 'a', tool: 'convert_media', args: { input: missing } },
            { id: 'b', tool: 'convert_media', args: { input: '{{a.output}}' } },
          ],
        },
      });
      const report = (result as { structuredContent?: { result?: any } }).structuredContent?.result;
      expect(report.completed).toBe(false);
      expect(report.failed?.id).toBe('a');
      expect(report.steps).toHaveLength(1);
      expect(report.steps[0].status).toBe('error');
    } finally {
      await close();
    }
  });
});
