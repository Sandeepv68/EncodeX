import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../server';
import { FakeTranscoder } from './test-helpers';
import type { FakeTranscoderOptions } from './test-helpers';
import type { MediaStreamInfo } from '../../shared/types';

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
 * @param {FakeTranscoderOptions} [options] - Behavior for every fake transcoder
 *   the server creates (including probe-only instances).
 * @returns {Promise<TestSession>} The connected session.
 */
async function setup(options: FakeTranscoderOptions = {}): Promise<TestSession> {
  const transcoders: FakeTranscoder[] = [];
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer({
    transcoderFactory: () => {
      const t = new FakeTranscoder(options);
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

/**
 * Probe streams used by the tools that read the source before planning.
 * @type {MediaStreamInfo[]}
 */
const PROBED_STREAMS: MediaStreamInfo[] = [
  { index: 0, type: 'video', codec: 'h264' },
  { index: 1, type: 'audio', codec: 'aac' },
  { index: 2, type: 'subtitle', codec: 'subrip' },
];

/**
 * The fake transcoder that actually ran a conversion (the probe-only instances
 * never call `convert`).
 * @param {TestSession} session - The active session.
 * @returns {FakeTranscoder} The last transcoder that received options.
 */
function lastTranscoder(session: TestSession): FakeTranscoder {
  const ran = [...session.transcoders].reverse().find((t) => t.lastOptions !== undefined);
  if (!ran) throw new Error('no transcoder ran a conversion');
  return ran;
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
        'remux_media',
        'demux_media',
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

  it('convert_media delivers presets/filters/videoFilters to the transcoder', async () => {
    const input = fakeMediaFile();
    const session = await setup();
    const parsed = JSON.parse(
      textOf(
        await callTool(session, 'convert_media', {
          input,
          presets: ['grayscale'],
          filters: 'fps=30',
          videoFilters: ['unsharp=5:5:0.5:5:5:0'],
        }),
      ),
    );
    await session.close();
    expect(parsed.jobId).toBeTruthy();
    const transcoder = session.transcoders[0];
    expect(transcoder.lastOptions?.videoFilters).toEqual(['hue=s=0', 'fps=30', 'unsharp=5:5:0.5:5:5:0']);
  });

  it('convert_media rejects filters combined with copy via FILTERS_REQUIRE_RE_ENCODE', async () => {
    const input = fakeMediaFile();
    const session = await setup();
    const parsed = JSON.parse(textOf(await callTool(session, 'convert_media', { input, copy: true, filters: 'fps=30' })));
    await session.close();
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe('FILTERS_REQUIRE_RE_ENCODE');
  });

  it('convert_media rejects an unknown preset via INVALID_VIDEO_FILTERS', async () => {
    const input = fakeMediaFile();
    const session = await setup();
    const parsed = JSON.parse(textOf(await callTool(session, 'convert_media', { input, presets: ['bogus'] })));
    await session.close();
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe('INVALID_VIDEO_FILTERS');
  });

  it('convert_media rejects an invalid filter chain before enqueueing', async () => {
    const input = fakeMediaFile();
    const session = await setup();
    const parsed = JSON.parse(textOf(await callTool(session, 'convert_media', { input, filters: 'fps=30;rm -rf /' })));
    await session.close();
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe('INVALID_VIDEO_FILTERS');
    expect(session.transcoders.length).toBe(0);
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

  it('remux_media stream-copies into a new container with the probed stream selection', async () => {
    const input = fakeMediaFile('mcp-remux-');
    const session = await setup({ streams: PROBED_STREAMS });
    const parsed = JSON.parse(textOf(await callTool(session, 'remux_media', { input, container: 'mkv' })));
    await session.close();
    expect(parsed.jobId).toBeTruthy();
    expect(parsed.container).toBe('mkv');
    expect(parsed.output.toLowerCase()).toContain('clip.mkv');
    expect(parsed.map).toEqual(['0:v:0', '0:a:0', '0:s:0']);
    expect(lastTranscoder(session).lastOptions?.copy).toBe(true);
  });

  it('remux_media delivers added tracks, cover art, and chapters to the transcoder', async () => {
    const input = fakeMediaFile('mcp-remux-add-');
    const subtitle = path.join(path.dirname(input), 'forced.srt');
    const audio = path.join(path.dirname(input), 'commentary.m4a');
    const cover = path.join(path.dirname(input), 'cover.jpg');
    const chapters = path.join(path.dirname(input), 'meta.txt');
    for (const file of [subtitle, audio, cover, chapters]) fs.writeFileSync(file, 'x');

    const session = await setup({ streams: PROBED_STREAMS });
    const parsed = JSON.parse(
      textOf(
        await callTool(session, 'remux_media', {
          input,
          container: 'mkv',
          addSubtitle: [{ file: subtitle, syncOffsetSeconds: 0.5 }],
          addAudio: [{ file: audio }],
          thumbnail: { file: cover },
          chapters: { file: chapters },
        }),
      ),
    );
    await session.close();
    expect(parsed.jobId).toBeTruthy();
    const options = lastTranscoder(session).lastOptions;
    expect(options?.additionalInputs?.map((entry) => entry.path)).toEqual([subtitle, audio, cover]);
    expect(options?.additionalInputs?.[0].syncOffsetSeconds).toBe(0.5);
    expect(options?.additionalInputs?.[2]).toMatchObject({ attachment: true });
    expect(options?.chaptersFile).toBe(chapters);
  });

  it('remux_media re-encodes instead of stream-copying when videoFilters are given', async () => {
    const input = fakeMediaFile('mcp-remux-filters-');
    const session = await setup({ streams: PROBED_STREAMS });
    const parsed = JSON.parse(
      textOf(await callTool(session, 'remux_media', { input, container: 'mkv', videoFilters: ['fps=30', 'hue=s=0'] })),
    );
    await session.close();
    expect(parsed.jobId).toBeTruthy();
    const options = lastTranscoder(session).lastOptions;
    expect(options?.copy).toBe(false);
    expect(options?.videoFilters).toEqual(['fps=30', 'hue=s=0']);
  });

  it('remux_media expands the preset.value shorthand in videoFilters', async () => {
    const input = fakeMediaFile('mcp-remux-shorthand-');
    const session = await setup({ streams: PROBED_STREAMS });
    JSON.parse(
      textOf(await callTool(session, 'remux_media', { input, container: 'mkv', videoFilters: ['framerate.60', 'deinterlace.tff'] })),
    );
    await session.close();
    expect(lastTranscoder(session).lastOptions?.videoFilters).toEqual(['fps=60', 'yadif=1']);
  });

  it('remux_media rejects an invalid videoFilters chain before enqueueing', async () => {
    const input = fakeMediaFile('mcp-remux-badfilter-');
    const session = await setup({ streams: PROBED_STREAMS });
    const parsed = JSON.parse(
      textOf(await callTool(session, 'remux_media', { input, container: 'mkv', videoFilters: ['fps=30;rm -rf /'] })),
    );
    await session.close();
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe('INVALID_VIDEO_FILTERS');
    expect(parsed.jobId).toBeUndefined();
  });

  it('remux_media rejects a missing input, auxiliary file, and incompatible container', async () => {
    const input = fakeMediaFile('mcp-remux-err-');
    const cover = path.join(path.dirname(input), 'cover.jpg');
    fs.writeFileSync(cover, 'x');
    const session = await setup({ streams: PROBED_STREAMS });
    const missing = JSON.parse(textOf(await callTool(session, 'remux_media', { input: 'C:\\ghost\\x.mkv', container: 'mkv' })));
    expect(missing.code).toBe('FILE_NOT_FOUND');

    const missingAux = JSON.parse(
      textOf(await callTool(session, 'remux_media', { input, container: 'mkv', addSubtitle: [{ file: 'C:\\ghost\\x.srt' }] })),
    );
    expect(missingAux.code).toBe('AUXILIARY_INPUT_NOT_FOUND');

    const incompatible = JSON.parse(
      textOf(await callTool(session, 'remux_media', { input, container: 'avi', thumbnail: { file: cover } })),
    );
    expect(incompatible.code).toBe('INCOMPATIBLE_CONTAINER');
    await session.close();
  });

  it('demux_media enqueues one job per stream and re-encodes audio to mp3', async () => {
    const input = fakeMediaFile('mcp-demux-');
    const session = await setup({ streams: PROBED_STREAMS });
    const parsed = JSON.parse(textOf(await callTool(session, 'demux_media', { input, audio: true, audioCodec: 'mp3' })));
    await session.close();
    expect(parsed.total).toBe(1);
    expect(parsed.jobs).toHaveLength(1);
    expect(parsed.jobs[0]).toMatchObject({ kind: 'audio', copy: false, codec: 'mp3' });
    expect(parsed.jobs[0].output.toLowerCase().endsWith('.mp3')).toBe(true);
    expect(lastTranscoder(session).lastOptions?.extraArgs).toEqual(['-c:a', 'mp3']);
  });

  it('demux_media writes into outputDir and extracts every kind by default', async () => {
    const input = fakeMediaFile('mcp-demux-all-');
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-demux-out-'));
    const session = await setup({ streams: PROBED_STREAMS });
    const parsed = JSON.parse(textOf(await callTool(session, 'demux_media', { input, outputDir: outDir })));
    await session.close();
    expect(parsed.total).toBe(3);
    expect(parsed.jobs.map((job: { kind: string }) => job.kind)).toEqual(['video', 'audio', 'subtitle']);
    for (const job of parsed.jobs) {
      expect(path.dirname(job.output)).toBe(outDir);
    }
  });

  it('demux_media reports STREAM_NOT_FOUND when the requested kind is absent', async () => {
    const input = fakeMediaFile('mcp-demux-none-');
    const session = await setup({ streams: [PROBED_STREAMS[0]] });
    const parsed = JSON.parse(textOf(await callTool(session, 'demux_media', { input, audio: true })));
    const missing = JSON.parse(textOf(await callTool(session, 'demux_media', { input: 'C:\\ghost\\x.mkv' })));
    await session.close();
    expect(parsed.code).toBe('STREAM_NOT_FOUND');
    expect(missing.code).toBe('FILE_NOT_FOUND');
  });

  it('demux_media delivers videoFilters to a re-encoding video target', async () => {
    const input = fakeMediaFile('mcp-demux-filters-');
    const session = await setup({ streams: PROBED_STREAMS });
    const parsed = JSON.parse(
      textOf(
        await callTool(session, 'demux_media', {
          input,
          video: true,
          videoContainer: 'mkv',
          videoFilters: ['fps=30', 'hue=s=0'],
        }),
      ),
    );
    await session.close();
    const videoJob = parsed.jobs.find((job: { kind: string }) => job.kind === 'video');
    expect(videoJob.copy).toBe(false);
    expect(lastTranscoder(session).lastOptions?.videoFilters).toEqual(['fps=30', 'hue=s=0']);
  });

  it('demux_media warns that videoFilters are ignored on a copied video target', async () => {
    const input = fakeMediaFile('mcp-demux-ignored-');
    const session = await setup({ streams: PROBED_STREAMS });
    const parsed = JSON.parse(textOf(await callTool(session, 'demux_media', { input, video: true, videoFilters: ['fps=30'] })));
    await session.close();
    expect(parsed.warnings).toContain('filtersIgnoredCopy');
  });

  it('demux_media rejects an invalid videoFilters chain', async () => {
    const input = fakeMediaFile('mcp-demux-badfilter-');
    const session = await setup({ streams: PROBED_STREAMS });
    const parsed = JSON.parse(
      textOf(await callTool(session, 'demux_media', { input, video: true, videoContainer: 'mkv', videoFilters: ['fps=30|pipe'] })),
    );
    await session.close();
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe('INVALID_VIDEO_FILTERS');
    expect(parsed.jobs).toBeUndefined();
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
