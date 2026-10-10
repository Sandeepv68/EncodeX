/**
 * @fileoverview W2 MCP session helpers shared by every surface spec.
 *
 * Thin wrappers around the MCP SDK that encode the repo's established call
 * conventions (`ok:false` JSON bodies, `toolText` text-block folding, retry
 * loops for the HTTP transport, and a rolling stderr buffer for stdio), so the
 * specs read as plain behaviour. Heavier assertion logic that the stdio and
 * HTTP specs repeat (handshake, tool list, the whole core tool suite) lives in
 * {@link runCoreSuite} / {@link assertToolSurface} below.
 */

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { sleep } from './harness';

/** @interface McpHandle */
export interface McpHandle {
  client: Client;
  transport: StdioClientTransport | StreamableHTTPClientTransport;
  /** Snapshots the rolling stderr buffer (stdio servers only). */
  stderrText(): string;
  close(): Promise<void>;
}

const STDERR_LIMIT = 8192;

/**
 * The MCP Apps (SEP-1865) extension id advertised on every surface.
 * @const {string}
 */
export const UI_EXTENSION_ID = 'io.modelcontextprotocol/ui';

/**
 * The MIME type a host requires to render a `ui://` view in its sandboxed iframe.
 * @const {string}
 */
export const UI_RESOURCE_MIME = 'text/html;profile=mcp-app';

/** Renderable MCP App view resources served by every surface. @const {string[]} */
export const UI_VIEW_URIS = ['ui://encodex/queue', 'ui://encodex/job', 'ui://encodex/media-info', 'ui://encodex/convert'];

/** Every resource URI served by every surface, sorted for exact comparison. @const {string[]} */
export const ALL_RESOURCE_URIS = ['encodex://capabilities', 'encodex://codecs', 'encodex://profiles', ...UI_VIEW_URIS].sort();

/**
 * Spawns a local stdio MCP server and starts a session, mirroring the SDK
 * setup of `scripts/mcp-full-test.mjs`. Generations of the server are piped to
 * a rolling buffer so a failing spec can print the server's own last words.
 * @param {{ command: string; args: string[] }} target - Executable + argv.
 * @param {{ name?: string }} [opts] - Client display name.
 * @returns {Promise<McpHandle>}
 */
export async function connectStdio(target: { command: string; args: string[] }, opts: { name?: string } = {}): Promise<McpHandle> {
  const transport = new StdioClientTransport({
    command: target.command,
    args: target.args,
    stderr: 'pipe',
    env: { ...process.env } as Record<string, string>,
  });
  if (!transport.stderr) throw new Error('StdioClientTransport did not expose a stderr stream despite stderr: "pipe"');
  let stderr = '';
  transport.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString('utf8');
    if (stderr.length > STDERR_LIMIT) stderr = stderr.slice(-STDERR_LIMIT);
  });
  const client = new Client({ name: opts.name ?? 'encodex-e2e-stdio', version: '1.0.0' });
  await client.connect(transport);
  const close = async () => {
    await client.close().catch(() => undefined);
    await transport.close().catch(() => undefined);
  };
  return { client, transport, stderrText: () => stderr, close };
}

/**
 * Opens a Streamable-HTTP session against a loopback `/mcp` endpoint, retrying
 * like `scripts/mcp-full-test.mjs` does so a freshly-spawned server that is
 * still accepting sockets but not yet initializing an RPC still connects.
 * @param {string} url - The `/mcp` endpoint URL.
 * @param {{ token?: string; retries?: number; timeoutMs?: number; name?: string }} [opts] - Auth + bounds.
 * @returns {Promise<McpHandle>}
 */
export async function connectHttp(
  url: string,
  opts: { token?: string; retries?: number; timeoutMs?: number; name?: string } = {},
): Promise<McpHandle> {
  const { token, retries = 1, timeoutMs = 15000, name = 'encodex-e2e-http' } = opts;
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const transport = new StreamableHTTPClientTransport(new URL(url), {
      ...(token ? { requestInit: { headers: { Authorization: `Bearer ${token}` } } } : {}),
    });
    const client = new Client({ name, version: '1.0.0' });
    try {
      await client.connect(transport);
      const handle: McpHandle = {
        client,
        transport,
        stderrText: () => '',
        close: async () => {
          await client.close().catch(() => undefined);
          await transport.close().catch(() => undefined);
        },
      };
      return handle;
    } catch (error) {
      lastError = error;
      await client.close().catch(() => undefined);
      if (Date.now() >= deadline) break;
      await sleep(1000);
    }
  }
  throw lastError ?? new Error(`HTTP connect to ${url} failed`);
}

/**
 * Folds a tool result's text blocks, exactly like `scripts/mcp-full-test.mjs`.
 * SDK 1.30 types `content` as a heterogeneous block union, so it is widened
 * here before being read.
 * @param {CallToolResult} result - The MCP tool response.
 * @returns {string} Concatenated text content.
 */
export function toolText(result: CallToolResult): string {
  const blocks = (result.content ?? []) as Array<{ type?: string; text?: string }>;
  return blocks
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('');
}

/** @interface ToolOutcome */
export interface ToolOutcome<T = Record<string, unknown>> {
  parsed: T;
  isError: boolean;
}

/**
 * Calls a tool and parses its `text` payload without asserting success, so
 * error responses (`ok:false` + a stable code) can be inspected.
 */
export async function callRaw<T = Record<string, unknown>>(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolOutcome<T>> {
  const result = await client.callTool({ name, arguments: args });
  const text = toolText(result as CallToolResult);
  let parsed: T;
  let isError = false;
  try {
    parsed = JSON.parse(text) as T;
  } catch {
    parsed = { raw: text } as unknown as T;
    isError = true;
  }
  return { parsed, isError };
}

/**
 * Calls a tool and throws on `ok:false`, mirroring `callTool` in
 * `scripts/mcp-full-test.mjs`. The request body is deliberately loose
 * `Record<string, unknown>` (MCP tool arguments are JSON; most specs pass a
 * `convert_media`-plus-per-tool-fields literal), so only the response generic
 * is worth spelling out.
 */
export async function call<Result = Record<string, unknown>>(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<Result> {
  const { parsed, isError } = await callRaw<{ ok?: boolean; code?: string; message?: string } & Record<string, unknown>>(
    client,
    name,
    args,
  );
  if (isError || parsed.ok === false) {
    const detail = 'raw' in parsed ? String((parsed as { raw: string }).raw) : `${parsed.code ?? 'unknown'}: ${parsed.message ?? ''}`;
    throw new Error(`${name} failed: ${detail}`);
  }
  return parsed as unknown as Result;
}

/**
 * Polls `get_job` until the job reaches `done`, returning the final job object
 * for status/codec assertions.
 * @param {import('@modelcontextprotocol/sdk/client/index.js').Client} client - Connected client.
 * @param {string} jobId - Job to poll.
 * @param {{ timeout?: number; interval?: number }} [opts] - Bounds.
 */
export async function waitForJob(
  client: Client,
  jobId: string,
  opts: { timeout?: number; interval?: number } = {},
): Promise<Record<string, unknown>> {
  const { timeout = 45000, interval = 200 } = opts;
  const deadline = Date.now() + timeout;
  let last: Record<string, unknown> = {};
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const detail = await call<{ status?: string }>(client, 'get_job', { jobId });
      last = detail;
      if (detail.status === 'done') return detail;
      lastError = new Error(`job ${jobId} status ${detail.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(interval);
  }
  throw new Error(
    `job ${jobId} never reached done: ${lastError instanceof Error ? lastError.message : String(lastError)} (last status: ${last.status ?? 'none'})`,
  );
}

/**
 * Asserts the MCP surface a server advertises - capabilities, exactly the
 * documented tool list, the three `encodex://` resources, and the four prompts
 * - using thrown errors so failures point at the exact shape that regressed.
 * This is the W2 handshake contract applied to every surface.
 */
export async function assertToolSurface(handle: McpHandle, expectedTools: string[]): Promise<void> {
  const { client } = handle;
  const caps = client.getServerCapabilities();
  if (!caps) throw new Error('server capabilities missing');
  if (!caps.tools) throw new Error('tools capability not advertised');

  const { tools } = await client.listTools();
  const names = tools.map((tool) => tool.name).sort();
  const expected = [...expectedTools].sort();
  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(`tools/list mismatch. expected [${expected.join(', ')}], got [${names.join(', ')}]`);
  }
  for (const tool of tools) {
    if (!tool.description || tool.description.length <= 10) throw new Error(`${tool.name} has no description`);
    if (!tool.inputSchema) throw new Error(`${tool.name} has no inputSchema`);
  }

  const { resources } = await client.listResources();
  const uris = resources.map((resource) => resource.uri).sort();
  if (JSON.stringify(uris) !== JSON.stringify(ALL_RESOURCE_URIS)) {
    throw new Error(`resources/list mismatch: [${uris.join(', ')}]`);
  }

  const { prompts } = await client.listPrompts();
  const promptNames = prompts.map((prompt) => prompt.name).sort();
  if (JSON.stringify(promptNames) !== JSON.stringify(['batch-convert', 'compress-image', 'convert-video', 'extract-audio'])) {
    throw new Error(`prompts/list mismatch: [${promptNames.join(', ')}]`);
  }
}

/**
 * Probes a finished conversion's codec with ffprobe, the same way
 * `e2e/cli.spec.ts` asserts real transcodes.
 * @param {string} mediaPath - The produced file.
 * @param {'video'|'audio'|'subtitle'} kind - Stream kind to probe.
 * @returns {string} The codec name (e.g. `h264`, `aac`, `mp3`).
 */
export function probeCodec(mediaPath: string, kind: 'video' | 'audio' | 'subtitle'): string {
  const ffprobeBin = (require('ffprobe-static') as { path: string }).path;
  const result = spawnSync(
    ffprobeBin,
    ['-v', 'error', '-select_streams', kind[0], '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', mediaPath],
    {
      encoding: 'utf8',
      timeout: 30000,
    },
  );
  if (result.status !== 0) throw new Error(`ffprobe failed (${result.status}): ${result.stderr || result.stdout}`);
  const codec = result.stdout.trim().split('\n')[0] ?? '';
  if (!codec) throw new Error(`no ${kind} stream in ${mediaPath}`);
  return codec;
}

/**
 * Returns a `convert_media` invocation's `ok:false` error code when the
 * operation responds with a stable error (used for remux/demux code mapping).
 */
export async function toolErrorCode(client: Client, name: string, args: Record<string, unknown>): Promise<string> {
  const { parsed } = await callRaw(client, name, args);
  const code = (parsed as { code?: string }).code;
  if (!code) throw new Error(`expected ${name} to fail with a code, got ${JSON.stringify(parsed)}`);
  return code;
}

/** @param {string} file - Absolute path. @returns {number} File size in bytes. */
export function fileSizeBytes(file: string): number {
  if (!fs.existsSync(file)) throw new Error(`output file missing: ${file}`);
  return fs.statSync(file).size;
}

/**
 * Runs the shared core tool suite (W2) against any connected surface. `full`
 * exercises every conversion tool and the cancel flow (the stdio spec); `light`
 * only converts one real file and then checks resources/prompts (the embedded
 * GUI spec, where running the whole suite against the same queue would take too
 * long). Assertions throw - Vitest wraps each call site in an `it` block.
 */
export async function runCoreSuite(
  handle: McpHandle,
  fx: {
    video: string;
    video2: string;
    long: string;
    image: string;
    subtitle: string;
    chapters: string;
    dir: string;
    demuxSource: string;
  },
  opts: { mode: 'full' | 'light'; outDir: string },
): Promise<void> {
  const { client } = handle;
  const { mode, outDir } = opts;

  const pong = await call<{ pong: boolean }>(client, 'ping', {});
  if (pong.pong !== true) throw new Error(`ping returned ${JSON.stringify(pong)}`);

  const caps = await call<Record<string, unknown>>(client, 'list_capabilities', {});
  if (
    !Array.isArray((caps as { videoEncoders?: unknown[] }).videoEncoders) ||
    (caps as { videoEncoders: unknown[] }).videoEncoders.length === 0
  ) {
    throw new Error('no video encoders reported');
  }

  const profiles = await call<Array<{ id: string; name: string }>>(client, 'list_profiles', {});
  if (profiles.length === 0) throw new Error('no profiles returned');
  const full = await call<{ id: string }>(client, 'get_profile', { profileId: profiles[0].id });
  if (full.id !== profiles[0].id) throw new Error(`get_profile returned ${full.id}`);

  const info = await call<{ file: string; streams: unknown[] }>(client, 'get_media_info', { input: fx.video });
  if (info.file !== fx.video) throw new Error(`get_media_info file ${info.file}`);
  if (!Array.isArray(info.streams) || info.streams.length < 2) throw new Error(`get_media_info streams ${info.streams?.length}`);

  const started = await call<{ jobId: string; output: string }>(client, 'convert_media', {
    input: fx.video,
    output: `${outDir}/converted.mp4`,
    videoCodec: 'libx264',
    qscale: 26,
    audioCodec: 'aac',
    transcoder: 'FFMPEG',
  });
  const done = await waitForJob(client, started.jobId, { timeout: 90000 });
  if (done.status !== 'done') throw new Error(`convert_media status ${done.status}`);
  if (!fs.existsSync(started.output) || fs.statSync(started.output).size === 0) throw new Error(`missing output ${started.output}`);
  if (mode === 'light') {
    await assertResourcesAndPrompts(handle);
    return;
  }

  const jobs = await call<Array<{ id: string; status: string }>>(client, 'list_jobs', {});
  if (!jobs.find((job) => job.id === started.jobId)) throw new Error(`job ${started.jobId} not listed`);

  const extract = await call<{ jobId: string; output: string }>(client, 'extract_audio', {
    input: fx.video2,
    output: `${outDir}/audio.mp3`,
  });
  await waitForJob(client, extract.jobId, { timeout: 90000 });
  if (probeCodec(extract.output, 'audio') !== 'mp3') throw new Error(`extract_audio codec on ${extract.output}`);

  const compressed = await call<{ jobId: string; output: string }>(client, 'compress_image', {
    input: fx.image,
    output: `${outDir}/image.webp`,
    format: 'webp',
    quality: 28,
  });
  await waitForJob(client, compressed.jobId, { timeout: 90000 });
  if (!fs.existsSync(compressed.output)) throw new Error(`missing compressed output ${compressed.output}`);

  const cut = await call<{ jobId: string; output: string }>(client, 'cut_video', {
    input: fx.video,
    output: `${outDir}/cut.mp4`,
    duration: '0.4',
  });
  await waitForJob(client, cut.jobId, { timeout: 90000 });
  if (!fs.existsSync(cut.output)) throw new Error(`missing cut output ${cut.output}`);

  const batchDir = `${outDir}/batch`;
  const batch = await call<{ total: number; jobs: Array<{ jobId: string; output: string }> }>(client, 'batch_convert', {
    inputs: [fx.video, fx.video2],
    outputDir: batchDir,
    videoCodec: 'libvpx-vp9',
    concurrency: 2,
  });
  if (batch.total !== 2) throw new Error(`batch total ${batch.total}`);
  const batchIds = batch.jobs.map((job) => job.jobId);
  const deadline = Date.now() + 120000;
  let allDone = false;
  while (Date.now() < deadline) {
    const list = await call<Array<{ id: string; status: string }>>(client, 'list_jobs', {});
    allDone = batchIds.every((id) => list.some((job) => job.id === id && job.status === 'done'));
    if (allDone) break;
    await sleep(200);
  }
  if (!allDone) throw new Error('batch_convert never finished every job');
  for (const job of batch.jobs) if (!fs.existsSync(job.output)) throw new Error(`missing batch output ${job.output}`);

  const remuxed = await call<{ jobId: string; output: string; container: string; map: string[] }>(client, 'remux_media', {
    input: fx.video,
    container: 'mkv',
    output: `${outDir}/remuxed.mkv`,
  });
  if (remuxed.map.join(',') !== '0:v:0,0:a:0') throw new Error(`remux map ${remuxed.map.join(',')}`);
  await waitForJob(client, remuxed.jobId, { timeout: 90000 });

  const muxed = await call<{ jobId: string; output: string }>(client, 'remux_media', {
    input: fx.video,
    container: 'mkv',
    output: `${outDir}/remuxed-full.mkv`,
    addSubtitle: [{ file: fx.subtitle, codec: 'srt' }],
    thumbnail: { file: fx.image },
    chapters: { file: fx.chapters },
  });
  await waitForJob(client, muxed.jobId, { timeout: 90000 });
  const muxedInfo = await call<{ streams: Array<{ type: string }> }>(client, 'get_media_info', { input: muxed.output });
  const kinds = muxedInfo.streams.map((stream) => stream.type);
  if (!kinds.includes('subtitle') || !kinds.includes('video')) throw new Error(`muxed kinds ${kinds.join(', ')}`);

  const demuxed = await call<{ total: number; jobs: Array<{ jobId: string; output: string }> }>(client, 'demux_media', {
    input: fx.video2,
    outputDir: `${outDir}/demuxed`,
  });
  if (demuxed.total !== 2) throw new Error(`demux total ${demuxed.total}`);
  for (const job of demuxed.jobs) {
    await waitForJob(client, job.jobId, { timeout: 90000 });
    if (!fs.existsSync(job.output)) throw new Error(`missing demux output ${job.output}`);
  }

  if (
    (await toolErrorCode(client, 'remux_media', { input: fx.video, container: 'mkv', addSubtitle: [{ file: `${fx.dir}/ghost.srt` }] })) !==
    'AUXILIARY_INPUT_NOT_FOUND'
  ) {
    throw new Error('remux missing subtitle should be AUXILIARY_INPUT_NOT_FOUND');
  }

  if (
    (await toolErrorCode(client, 'remux_media', { input: fx.video, container: 'ts', chapters: { file: fx.chapters } })) !==
    'INCOMPATIBLE_CONTAINER'
  ) {
    throw new Error('remux ts+chapters should be INCOMPATIBLE_CONTAINER');
  }

  if ((await toolErrorCode(client, 'demux_media', { input: fx.video, subtitles: true })) !== 'STREAM_NOT_FOUND') {
    throw new Error('demux subtitles of no-subtitle file should be STREAM_NOT_FOUND');
  }

  await assertResourcesAndPrompts(handle);
}

/**
 * Asserts the MCP Apps (SEP-1865) surface: the `io.modelcontextprotocol/ui`
 * capability and every `ui://` view served as self-contained
 * `text/html;profile=mcp-app` HTML (no external script/style, so it renders
 * under a host's restrictive default CSP).
 * @param {McpHandle} handle - The connected session.
 * @returns {Promise<void>}
 */
export async function assertMcpAppsSurface(handle: McpHandle): Promise<void> {
  const { client } = handle;
  const capabilities = client.getServerCapabilities();
  if (!capabilities?.extensions || !(UI_EXTENSION_ID in capabilities.extensions)) {
    throw new Error(`missing MCP Apps capability: ${UI_EXTENSION_ID}`);
  }

  const { resources } = await client.listResources();
  for (const uri of UI_VIEW_URIS) {
    const view = resources.find((resource) => resource.uri === uri);
    if (!view) throw new Error(`missing view resource: ${uri}`);
    if (view.mimeType !== UI_RESOURCE_MIME) throw new Error(`${uri} has mime ${view.mimeType}, expected ${UI_RESOURCE_MIME}`);
  }

  for (const uri of UI_VIEW_URIS) {
    const { contents } = await client.readResource({ uri });
    const html = ((contents[0] as { text?: string }).text ?? '').toString();
    if (!html.includes('<!doctype html>') || !html.includes('ui/initialize')) {
      throw new Error(`${uri} is not a self-contained MCP App document`);
    }
    if (/<script\b[^>]*\bsrc=/i.test(html) || /<link\b[^>]*\bstylesheet/i.test(html)) {
      throw new Error(`${uri} references an external script or stylesheet`);
    }
  }
}

/** Asserts the three `encodex://` resources and the four prompts. */
export async function assertResourcesAndPrompts(handle: McpHandle): Promise<void> {
  const { client } = handle;
  const uris = ['encodex://profiles', 'encodex://capabilities', 'encodex://codecs'];
  for (const uri of uris) {
    const { contents } = await client.readResource({ uri });
    if (!Array.isArray(contents) || contents.length === 0) throw new Error(`${uri} returned no contents`);
    const parsed = JSON.parse((contents[0] as { text: string }).text);
    if (uri === 'encodex://profiles') {
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('profiles resource is empty');
    } else if (uri === 'encodex://capabilities') {
      if (
        !Array.isArray((parsed as { videoEncoders?: unknown[] }).videoEncoders) ||
        (parsed as { videoEncoders: unknown[] }).videoEncoders.length === 0
      ) {
        throw new Error('capabilities resource has no encoders');
      }
    } else {
      const codecs = parsed as { videoCodecs?: unknown[]; audioCodecs?: unknown[] };
      if (
        !Array.isArray(codecs.videoCodecs) ||
        codecs.videoCodecs.length === 0 ||
        !Array.isArray(codecs.audioCodecs) ||
        codecs.audioCodecs.length === 0
      ) {
        throw new Error('codecs resource is missing entries');
      }
    }
  }

  const { prompts } = await client.listPrompts();
  for (const prompt of prompts) {
    if (!prompt.description || prompt.description.length <= 10) throw new Error(`${prompt.name} has no description`);
  }
  const samples: Record<string, Record<string, unknown>> = {
    'convert-video': { input: '/tmp/sample.mp4', videoCodec: 'libx264' },
    'extract-audio': { input: '/tmp/sample.mp4', audioCodec: 'libmp3lame' },
    'compress-image': { input: '/tmp/sample.jpg', format: 'webp' },
    'batch-convert': { inputs: '/tmp/a.mp4, /tmp/b.mp4' },
  };
  for (const [name, args] of Object.entries(samples)) {
    const got = await client.getPrompt({ name, arguments: args as Record<string, string> });
    if (!Array.isArray(got.messages) || got.messages.length === 0) throw new Error(`${name} returned no messages`);
  }
}
