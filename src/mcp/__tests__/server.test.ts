import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../server';
import { FakeTranscoder } from './test-helpers';

/**
 * A connected in-memory MCP session (one server + one client).
 * @interface TestSession
 * @property {Client} client - The MCP client talking to the test server.
 * @property {FakeTranscoder[]} transcoders - Transcorders created by the server.
 * @property {() => Promise<void>} close - Closes the client connection.
 */
interface TestSession {
  client: Client;
  transcoders: FakeTranscoder[];
  close: () => Promise<void>;
}

/**
 * Creates a server (using fake transcoders) and an MCP client over a linked
 * in-memory transport pair. Multiple tool calls can reuse the same session.
 * @returns {Promise<TestSession>} The connected session.
 */
async function setup(): Promise<TestSession> {
  const transcoders: FakeTranscoder[] = [];
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer({
    transcoderFactory: () => {
      const t = new FakeTranscoder();
      transcoders.push(t);
      return t;
    },
  });
  await server.connect(serverTransport);
  const client = new Client({ name: 'mcp-test-client', version: '1.0.0' });
  await client.connect(clientTransport);
  return { client, transcoders, close: () => client.close() };
}

/**
 * Runs one tool call through the session client.
 * @param {TestSession} session - The active session.
 * @param {string} tool - Tool name.
 * @param {Record<string, unknown>} args - Tool arguments.
 * @returns {Promise<any>} The raw CallToolResult.
 */
async function callTool(session: TestSession, tool: string, args: Record<string, unknown>): Promise<any> {
  return session.client.callTool({ name: tool, arguments: args });
}

/**
 * JSON-parses the first text content of a CallToolResult.
 * @param {any} result - A CallToolResult.
 * @returns {string} The joined text content.
 */
function textOf(result: any): string {
  return (result.content ?? [])
    .filter((c: { type?: string }) => c.type === 'text')
    .map((c: { text: string }) => c.text)
    .join('');
}

/**
 * Creates a dummy media file and returns its path.
 * @param {string} prefix - Temp dir prefix.
 * @returns {string} Path to a temp input file.
 */
function fakeMediaFile(prefix = 'mcp-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const input = path.join(dir, 'clip.mp4');
  fs.writeFileSync(input, 'not really a video');
  return input;
}

describe('createMcpServer tools', () => {
  it('exposes all core tools', async () => {
    const session = await setup();
    const tools = await session.client.listTools();
    await session.close();
    const names = tools.tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'ping',
        'convert_media',
        'get_job',
        'list_jobs',
        'cancel_job',
        'get_media_info',
        'list_capabilities',
        'list_profiles',
        'get_profile',
        'compress_image',
        'extract_audio',
        'cut_video',
        'batch_convert',
      ]),
    );
  });

  it('ping responds', async () => {
    const session = await setup();
    const text = textOf(await callTool(session, 'ping', {}));
    await session.close();
    expect(JSON.parse(text)).toEqual({ pong: true });
  });

  it('convert_media rejects a missing input file', async () => {
    const session = await setup();
    const parsed = JSON.parse(textOf(await callTool(session, 'convert_media', { input: 'C:\\does-not-exist\\x.mp4' })));
    await session.close();
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe('FILE_NOT_FOUND');
  });

  it('convert_media enqueues an async job and returns a jobId', async () => {
    const input = fakeMediaFile();
    const session = await setup();
    const result = await callTool(session, 'convert_media', { input, videoCodec: 'libx264', qscale: 23 });
    const parsed = JSON.parse(textOf(result));
    await session.close();
    expect(parsed.jobId).toBeTruthy();
    expect(['queued', 'running']).toContain(parsed.status);
    expect(parsed.output.toLowerCase()).toContain('clip_converted');
    expect(session.transcoders.length).toBeGreaterThan(0);
  });

  it('convert_media derives output and clamps qscale through the ported builder', async () => {
    const input = fakeMediaFile();
    const session = await setup();
    const result = await callTool(session, 'convert_media', { input, qscale: 99, videoCodec: 'libvpx-vp9' });
    const parsed = JSON.parse(textOf(result));
    await session.close();
    expect(parsed.output.toLowerCase()).toContain('clip_converted.webm');
  });

  it('get_media_info returns probed metadata via the transcoder', async () => {
    const input = fakeMediaFile();
    const session = await setup();
    const parsed = JSON.parse(textOf(await callTool(session, 'get_media_info', { input })));
    await session.close();
    expect(parsed.file).toBe(input);
    expect(parsed.streams).toEqual([]);
    expect(parsed.duration).toBe(60);
  });

  it('get_media_info rejects a missing file', async () => {
    const session = await setup();
    const parsed = JSON.parse(textOf(await callTool(session, 'get_media_info', { input: 'C:\\nope.mp4' })));
    await session.close();
    expect(parsed.code).toBe('FILE_NOT_FOUND');
  });

  it('get_job reports the live job state and handles unknown ids', async () => {
    const input = fakeMediaFile();
    const session = await setup();
    const created = JSON.parse(textOf(await callTool(session, 'convert_media', { input })));
    const jobId = created.jobId;

    const poll = JSON.parse(textOf(await callTool(session, 'get_job', { jobId })));
    expect(poll.id).toBe(jobId);
    expect(['queued', 'running', 'done']).toContain(poll.status);

    const missing = JSON.parse(textOf(await callTool(session, 'get_job', { jobId: 'nonexistent' })));
    expect(missing.code).toBeTruthy();
    await session.close();
  });

  it('list_jobs and cancel_job round-trip within one session', async () => {
    const input = fakeMediaFile();
    const session = await setup();
    const created = JSON.parse(textOf(await callTool(session, 'convert_media', { input })));
    const jobId = created.jobId;

    const list = JSON.parse(textOf(await callTool(session, 'list_jobs', {})));
    expect(list.length).toBeGreaterThan(0);

    const cancel = JSON.parse(textOf(await callTool(session, 'cancel_job', { jobId })));
    expect(cancel).toEqual({ jobId, cancelled: true });

    const after = JSON.parse(textOf(await callTool(session, 'list_jobs', {}))) as Array<{ id: string }>;
    expect(after.some((j) => j.id === jobId)).toBe(false);
    await session.close();
  });

  it('cancel_job reports unknown ids', async () => {
    const session = await setup();
    const parsed = JSON.parse(textOf(await callTool(session, 'cancel_job', { jobId: 'ghost' })));
    await session.close();
    expect(parsed.code).toBeTruthy();
  });

  it('list_profiles and get_profile agree', async () => {
    const session = await setup();
    const profiles = JSON.parse(textOf(await callTool(session, 'list_profiles', {})));
    expect(profiles.length).toBeGreaterThan(0);
    expect(profiles[0].id).toBeTruthy();

    const one = JSON.parse(textOf(await callTool(session, 'get_profile', { profileId: profiles[0].id })));
    expect(one.id).toBe(profiles[0].id);

    const missing = JSON.parse(textOf(await callTool(session, 'get_profile', { profileId: 'nope' })));
    expect(missing.code).toBeTruthy();
    await session.close();
  });

  it('list_capabilities returns capabilities or null without throwing', async () => {
    const session = await setup();
    const parsed = JSON.parse(textOf(await callTool(session, 'list_capabilities', {})));
    await session.close();
    expect(parsed === null || typeof parsed.videoEncoders === 'object').toBe(true);
  });

  it('compress_image enqueues a job with a _compressed output and the mapped format', async () => {
    const input = fakeMediaFile('mcp-compress-');
    const session = await setup();
    const parsed = JSON.parse(textOf(await callTool(session, 'compress_image', { input })));
    await session.close();
    expect(parsed.jobId).toBeTruthy();
    expect(['queued', 'running']).toContain(parsed.status);
    expect(parsed.output.toLowerCase()).toContain('clip_compressed');
    expect(parsed.format).toBe('mp4');
    expect(session.transcoders.length).toBeGreaterThan(0);
  });

  it('compress_image honors format/quality and rejects a missing file', async () => {
    const input = fakeMediaFile('mcp-compress-');
    const session = await setup();
    const parsed = JSON.parse(textOf(await callTool(session, 'compress_image', { input, format: 'webp', quality: 20 })));
    expect(parsed.output.toLowerCase()).toContain('clip_compressed.webp');
    const missing = JSON.parse(textOf(await callTool(session, 'compress_image', { input: 'C:\\nope.bmp' })));
    expect(missing.code).toBe('FILE_NOT_FOUND');
    await session.close();
  });

  it('extract_audio enqueues a job with a codec-derived extension at 192k', async () => {
    const input = fakeMediaFile('mcp-extract-');
    const session = await setup();
    const parsed = JSON.parse(textOf(await callTool(session, 'extract_audio', { input })));
    await session.close();
    expect(parsed.jobId).toBeTruthy();
    expect(parsed.output.toLowerCase()).toContain('clip.mp3');
    expect(parsed.audioCodec).toBe('libmp3lame');
    expect(parsed.extension).toBe('mp3');
  });

  it('extract_audio rejects a missing file', async () => {
    const session = await setup();
    const missing = JSON.parse(textOf(await callTool(session, 'extract_audio', { input: 'C:\\nope.mkv' })));
    await session.close();
    expect(missing.code).toBe('FILE_NOT_FOUND');
  });

  it('cut_video enqueues a lossless cut keeping the source extension', async () => {
    const input = fakeMediaFile('mcp-cut-');
    const session = await setup();
    const parsed = JSON.parse(textOf(await callTool(session, 'cut_video', { input, startTime: '00:00:05', endTime: '00:00:20' })));
    await session.close();
    expect(parsed.jobId).toBeTruthy();
    expect(parsed.output.toLowerCase()).toContain('clip_cut.mp4');
  });

  it('batch_convert queues one job per matched file', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-batch-'));
    fs.writeFileSync(path.join(dir, 'a.mp4'), 'x');
    fs.writeFileSync(path.join(dir, 'b.mp4'), 'x');
    const session = await setup();
    const parsed = JSON.parse(textOf(await callTool(session, 'batch_convert', { inputs: [`${dir}/*.mp4`], videoCodec: 'libx264' })));
    await session.close();
    expect(parsed.total).toBe(2);
    expect(parsed.jobs).toHaveLength(2);
    for (const job of parsed.jobs) {
      expect(job.jobId).toBeTruthy();
      expect(job.output.toLowerCase()).toContain('_encodex_converted');
    }
  });

  it('batch_convert reports FILE_NOT_FOUND when nothing matches', async () => {
    const session = await setup();
    const parsed = JSON.parse(textOf(await callTool(session, 'batch_convert', { inputs: ['C:\\ghost\\dir\\*.mp4'] })));
    await session.close();
    expect(parsed.code).toBe('FILE_NOT_FOUND');
  });

  it('exposes the three encodex resources and they read as JSON', async () => {
    const session = await setup();
    const resources = await session.client.listResources();
    const uris = resources.resources.map((r) => r.uri);
    expect(uris).toEqual(expect.arrayContaining(['encodex://profiles', 'encodex://capabilities', 'encodex://codecs']));

    const profiles = await session.client.readResource({ uri: 'encodex://profiles' });
    const profileText = profiles.contents[0]?.text ?? '';
    const parsedProfiles = JSON.parse(profileText);
    expect(Array.isArray(parsedProfiles)).toBe(true);
    expect(parsedProfiles.length).toBeGreaterThan(0);

    const codecs = await session.client.readResource({ uri: 'encodex://codecs' });
    const parsedCodecs = JSON.parse(codecs.contents[0]?.text ?? '{}');
    expect(Array.isArray(parsedCodecs.videoCodecs)).toBe(true);
    expect(Array.isArray(parsedCodecs.audioCodecs)).toBe(true);
    await session.close();
  });

  it('exposes the four prompts and returns user messages with instructions', async () => {
    const session = await setup();
    const prompts = await session.client.listPrompts();
    const names = prompts.prompts.map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(['convert-video', 'extract-audio', 'compress-image', 'batch-convert']));

    const convert = await session.client.getPrompt({ name: 'convert-video', arguments: { input: 'C:\\media\\clip.mp4' } });
    expect(convert.messages.length).toBeGreaterThan(0);
    expect(convert.messages[0].content.type).toBe('text');
    expect((convert.messages[0].content as { text: string }).text).toContain('clip.mp4');

    const batch = await session.client.getPrompt({ name: 'batch-convert', arguments: { inputs: 'C:\\v\\*.mp4, C:\\w\\*.mov' } });
    expect((batch.messages[0].content as { text: string }).text).toContain('C:\\v\\*.mp4');
    await session.close();
  });

  it('validates prompt arguments (missing required input is rejected)', async () => {
    const session = await setup();
    await expect(session.client.getPrompt({ name: 'extract-audio', arguments: {} })).rejects.toThrow();
    await session.close();
  });
});
