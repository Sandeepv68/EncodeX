/**
 * @fileoverview Tests for the R6 planning tools: find_highlights (F16),
 * plan_social_pack (F17), plan_edit (F18), and plan_agent (F20). The transcoder
 * and frame sampler are faked so nothing touches FFmpeg.
 */

import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/client';
import { createMcpServer } from '../server';
import { FakeTranscoder } from './test-helpers';

/** Temp directory holding dummy media files. */
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-r6-'));

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

/** Creates a dummy file on disk. */
function makeFile(name: string): string {
  const file = path.join(tempDir, name);
  fs.writeFileSync(file, 'stub');
  return file;
}

/** A frame sampler returning one hash before 30s and another after. */
async function frameSampler(_file: string, atSeconds: number): Promise<string | undefined> {
  return atSeconds < 30 ? '0000000000000000' : 'ffffffffffffffff';
}

/**
 * Connects an in-memory client to a server with a fake transcoder/sampler.
 * @returns {Promise<{ client: Client; close: () => Promise<void> }>} The session.
 */
async function setup(): Promise<{ client: Client; close: () => Promise<void> }> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer({ transcoderFactory: () => new FakeTranscoder(), frameSampler });
  await server.connect(serverTransport);
  const client = new Client({ name: 'mcp-r6-test', version: '1.0.0' });
  await client.connect(clientTransport);
  return { client, close: () => client.close() };
}

describe('find_highlights', () => {
  it('detects a scene boundary and thumbnail candidates from sampled frames', async () => {
    const { client, close } = await setup();
    try {
      const result = await client.callTool({
        name: 'find_highlights',
        arguments: { input: makeFile('movie.mp4'), durationSeconds: 60, samples: 24 },
      });
      const report = (result as { structuredContent?: { report?: any } }).structuredContent?.report;
      expect(result.isError).toBeFalsy();
      expect(report.method).toBe('hash');
      expect(report.scenes.length).toBeGreaterThanOrEqual(1);
      expect(report.highlights.length).toBeGreaterThanOrEqual(1);
      expect(report.thumbnails.length).toBeGreaterThan(0);
    } finally {
      await close();
    }
  });
});

describe('plan_social_pack', () => {
  it('returns per-platform clips and a valid workflow', async () => {
    const { client, close } = await setup();
    try {
      const result = await client.callTool({
        name: 'plan_social_pack',
        arguments: { input: makeFile('source.mp4'), platforms: ['youtube-shorts', 'tiktok'] },
      });
      const pack = (result as { structuredContent?: { pack?: any } }).structuredContent?.pack;
      expect(result.isError).toBeFalsy();
      expect(pack.clips).toHaveLength(2);
      expect(pack.plan.valid).toBe(true);
      expect(pack.workflow.steps[0].args.videoFilters[0]).toContain('scale=1080:1920');
    } finally {
      await close();
    }
  });

  it('fails clearly when the source is missing', async () => {
    const { client, close } = await setup();
    try {
      const result = await client.callTool({
        name: 'plan_social_pack',
        arguments: { input: path.join(tempDir, 'missing.mp4'), platforms: ['youtube'] },
      });
      expect(result.isError).toBe(true);
    } finally {
      await close();
    }
  });
});

describe('plan_edit', () => {
  it('resolves a keep-first intent to cut_video arguments', async () => {
    const { client, close } = await setup();
    try {
      const result = await client.callTool({
        name: 'plan_edit',
        arguments: {
          segments: [{ start: 0, end: 50, text: 'all of it' }],
          durationSeconds: 50,
          intent: { kind: 'keep-first', seconds: 10 },
        },
      });
      const edit = (result as { structuredContent?: { edit?: any } }).structuredContent?.edit;
      expect(result.isError).toBeFalsy();
      expect(edit.valid).toBe(true);
      expect(edit.args).toMatchObject({ startTime: '0.000', endTime: '10.000' });
    } finally {
      await close();
    }
  });

  it('trims an intro at the first speech from supplied segments', async () => {
    const { client, close } = await setup();
    try {
      const result = await client.callTool({
        name: 'plan_edit',
        arguments: {
          segments: [
            { start: 7, end: 20, text: 'welcome' },
            { start: 20, end: 40, text: 'main topic' },
          ],
          durationSeconds: 40,
          intent: { kind: 'remove-intro' },
        },
      });
      const edit = (result as { structuredContent?: { edit?: any } }).structuredContent?.edit;
      expect(edit.valid).toBe(true);
      expect(edit.start).toBe(7);
    } finally {
      await close();
    }
  });
});

describe('plan_agent', () => {
  it('plans actions across a folder and returns a runnable workflow', async () => {
    const dir = fs.mkdtempSync(path.join(tempDir, 'library-'));
    fs.writeFileSync(path.join(dir, 'one.mp4'), 'stub');
    fs.writeFileSync(path.join(dir, 'two.mkv'), 'stub');
    const { client, close } = await setup();
    try {
      const result = await client.callTool({
        name: 'plan_agent',
        arguments: { inputs: [dir], intent: 'compress for web', outputDir: dir },
      });
      const plan = (result as { structuredContent?: { plan?: any } }).structuredContent?.plan;
      expect(result.isError).toBeFalsy();
      expect(plan.actions.length).toBeGreaterThan(0);
      expect(plan.workflow.steps.length).toBe(plan.actions.length);
      expect(plan.plan.valid).toBe(true);
    } finally {
      await close();
    }
  });

  it('fails clearly when nothing matches', async () => {
    const { client, close } = await setup();
    try {
      const result = await client.callTool({
        name: 'plan_agent',
        arguments: { inputs: [path.join(tempDir, 'nope')], intent: 'compress' },
      });
      expect(result.isError).toBe(true);
    } finally {
      await close();
    }
  });
});
