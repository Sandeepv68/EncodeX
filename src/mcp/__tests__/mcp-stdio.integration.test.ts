/**
 * @fileoverview Spawn-level integration test for the standalone EncodeX MCP
 * server (`node dist/mcp/index.js`). Builds real fixtures with FFmpeg and
 * exercises each Phase-1 operation against the running stdio server, asserting
 * jobs transition to `done` and real output files exist.
 *
 * Run via `npm run test:integration` (it builds `dist` first). If you invoke
 * vitest directly, run `npm run build:main` first. This file is excluded from
 * the default unit suite.
 */

import { describe, it, beforeAll, afterAll, expect, vi } from 'vitest';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { getFfmpegPath } from '../../main/transcoders/ffmpeg-utils';

const DIST_MCP = fileURLToPath(new URL('../../../dist/mcp/index.js', import.meta.url));

interface TestContext {
  client: Client;
  transport: StdioClientTransport;
  stderr: string;
  dir: string;
  video: string;
  video2: string;
  image: string;
}

async function ensureBuild(): Promise<void> {
  if (!fs.existsSync(DIST_MCP)) {
    throw new Error(`Missing ${DIST_MCP}. Run \`npm run build:main\` before the integration test.`);
  }
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(getFfmpegPath(), ['-y', '-hide_banner', '-loglevel', 'error', ...args], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let err = '';
    proc.stderr.on('data', (d: Buffer) => (err += d.toString()));
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-400)}`))));
    proc.on('error', reject);
  });
}

async function generateFixtures(dir: string): Promise<void> {
  const clip = (name: string, duration: number): Promise<void> =>
    runFfmpeg([
      '-f',
      'lavfi',
      '-i',
      `testsrc=duration=${duration}:size=160x90:rate=10`,
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=' + duration,
      '-shortest',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '96k',
      path.join(dir, name),
    ]);

  await clip('a.mp4', 1);
  await clip('b.mp4', 2);
  await runFfmpeg(['-f', 'lavfi', '-i', 'testsrc=duration=0.4:size=96x54:rate=5', '-frames:v', '1', path.join(dir, 'pic.jpg')]);
}

async function startServer(): Promise<{ client: Client; transport: StdioClientTransport; stderr: string }> {
  const transport = new StdioClientTransport({ command: process.execPath, args: [DIST_MCP], stderr: 'pipe' });
  let stderr = '';
  transport.stderr.on('data', (d: Buffer) => {
    stderr += d.toString();
    if (stderr.length > 4096) stderr = stderr.slice(-4096);
  });
  const client = new Client({ name: 'mcp-integration-test', version: '1.0.0' });
  await client.connect(transport);
  return { client, transport, stderr };
}

async function callTool(client: Client, name: string, args: Record<string, unknown>): Promise<any> {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content ?? [])
    .filter((c: { type?: string }) => c.type === 'text')
    .map((c: { text: string }) => c.text)
    .join('');
  const parsed = JSON.parse(text);
  if (parsed.ok === false) {
    throw new Error(`${name} failed: ${parsed.code}: ${parsed.message}`);
  }
  return parsed;
}

async function waitDone(client: Client, jobId: string, timeoutMs = 25000): Promise<Record<string, unknown>> {
  let last: Record<string, unknown> = {};
  await vi.waitFor(
    async () => {
      last = await callTool(client, 'get_job', { jobId });
      expect(last.status).toBe('done');
    },
    { timeout: timeoutMs, interval: 200 },
  );
  return last;
}

describe('EncodeX MCP stdio server (integration)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    await ensureBuild();
    const base = await startServer();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-it-'));
    await generateFixtures(dir);
    ctx = {
      ...base,
      dir,
      video: path.join(dir, 'a.mp4'),
      video2: path.join(dir, 'b.mp4'),
      image: path.join(dir, 'pic.jpg'),
    };
  }, 120000);

  afterAll(async () => {
    await ctx?.client.close();
    if (ctx) fs.rmSync(ctx.dir, { recursive: true, force: true });
  });

  it('probes the generated video and reports video+audio streams', async () => {
    const info = await callTool(ctx.client, 'get_media_info', { input: ctx.video });
    expect(info.file).toBe(ctx.video);
    expect(info.streams.length).toBeGreaterThanOrEqual(2);
  });

  it('convert_media runs a real conversion to `done` and writes the output file', async () => {
    const started = await callTool(ctx.client, 'convert_media', {
      input: ctx.video,
      videoCodec: 'libx264',
      qscale: 26,
      audioCodec: 'aac',
      transcoder: 'FFMPEG',
    });
    const done = await waitDone(ctx.client, started.jobId);
    expect(done.status).toBe('done');
    expect(fs.existsSync(started.output)).toBe(true);
    expect(fs.statSync(started.output).size).toBeGreaterThan(0);
  });

  it('extract_audio drops the video and produces a real audio file', async () => {
    const started = await callTool(ctx.client, 'extract_audio', { input: ctx.video2 });
    await waitDone(ctx.client, started.jobId);
    expect(started.output.toLowerCase()).toContain('b.mp3');
    expect(fs.existsSync(started.output)).toBe(true);
    expect(fs.statSync(started.output).size).toBeGreaterThan(0);
  });

  it('compress_image re-encodes the image and writes the output', async () => {
    const started = await callTool(ctx.client, 'compress_image', {
      input: ctx.image,
      format: 'webp',
      quality: 28,
    });
    await waitDone(ctx.client, started.jobId);
    expect(started.output.toLowerCase()).toContain('pic_compressed.webp');
    expect(fs.existsSync(started.output)).toBe(true);
  });

  it('cut_video trims the clip via stream copy', async () => {
    const started = await callTool(ctx.client, 'cut_video', {
      input: ctx.video,
      duration: '0.4',
    });
    await waitDone(ctx.client, started.jobId);
    expect(started.output.toLowerCase()).toContain('a_cut.mp4');
    expect(fs.existsSync(started.output)).toBe(true);
  });

  it('batch_convert queues both files and both jobs finish', async () => {
    const started = await callTool(ctx.client, 'batch_convert', {
      inputs: [ctx.video, ctx.video2],
      videoCodec: 'libvpx-vp9',
      concurrency: 2,
    });
    expect(started.total).toBe(2);
    const ids: string[] = started.jobs.map((j: { jobId: string }) => j.jobId);
    const outPaths = started.jobs.map((j: { output: string }) => j.output) as string[];
    await vi.waitFor(
      async () => {
        const jobs = await callTool(ctx.client, 'list_jobs', {});
        for (const id of ids) {
          const mine = (jobs as Array<{ id: string; status: string }>).find((j) => j.id === id);
          expect(mine?.status).toBe('done');
        }
      },
      { timeout: 25000, interval: 200 },
    );
    for (const out of outPaths) {
      expect(fs.existsSync(out)).toBe(true);
    }
  });
});
