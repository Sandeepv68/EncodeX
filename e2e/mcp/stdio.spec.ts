/**
 * @fileoverview W3 e2e suite for the standalone stdio MCP server
 * (`node dist/mcp/index.js`).
 *
 * Spawns the real server as a child process, opens a session through the MCP
 * SDK, and exercises every one of the 15 core tools with real ffmpeg fixtures.
 * Assertions mirror the unit-visible behaviour in `scripts/mcp-full-test.mjs`
 * but are split into individual `it` blocks so a regression names the exact
 * tool. Heavy conversions carry an explicit per-test timeout (the default
 * spec timeout is 60s; these are re-encoded with the real ffmpeg).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  connectStdio,
  waitForJob,
  call,
  callRaw,
  probeCodec,
  toolErrorCode,
  assertToolSurface,
  assertMcpAppsSurface,
  fileSizeBytes,
  ALL_RESOURCE_URIS,
} from './client';
import type { McpHandle } from './client';
import { nodeStdioTarget, createMediaFixtures, CORE_TOOLS } from './harness';
import type { MediaFixtures } from './harness';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;
const HAS_MEDIA = process.env.E2E_SKIP_MEDIA !== 'true';

describe.runIf(IS_E2E && HAS_MEDIA)('MCP stdio server (e2e)', () => {
  let handle: McpHandle;
  let fx: MediaFixtures;

  beforeAll(async () => {
    fx = createMediaFixtures(fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-mcp-stdio-')));
    handle = await connectStdio(nodeStdioTarget(), { name: 'encodex-e2e-stdio' });
  }, 120000);

  afterAll(async () => {
    await handle?.close();
    try {
      if (fx?.dir) fs.rmSync(fx.dir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  });

  it('handshake advertises tools, resources and prompts', async () => {
    await assertToolSurface(handle, CORE_TOOLS);
  });

  it('ping returns pong', async () => {
    const pong = await call<{ pong: boolean }>(handle.client, 'ping', {});
    expect(pong.pong).toBe(true);
  });

  it('list_capabilities reports ffmpeg encoders', async () => {
    const caps = await call<{ videoEncoders: unknown[]; audioEncoders: unknown[] }>(handle.client, 'list_capabilities', {});
    expect(Array.isArray(caps.videoEncoders)).toBe(true);
    expect(caps.videoEncoders.length).toBeGreaterThan(0);
    expect(caps.audioEncoders.length).toBeGreaterThan(0);
  });

  it('list_profiles / get_profile round-trip', async () => {
    const profiles = await call<Array<{ id: string; name: string }>>(handle.client, 'list_profiles', {});
    expect(profiles.length).toBeGreaterThan(0);
    for (const profile of profiles.slice(0, 5)) {
      expect(profile.id).toBeTruthy();
      expect(profile.name).toBeTruthy();
    }
    const full = await call<{ id: string }>(handle.client, 'get_profile', { profileId: profiles[0].id });
    expect(full.id).toBe(profiles[0].id);
    const missing = await callRaw(handle.client, 'get_profile', { profileId: 'no-such-profile' });
    expect(missing.parsed).toMatchObject({ ok: false });
  });

  it('get_media_info probes the generated clip', async () => {
    const info = await call<{ file: string; streams: unknown[] }>(handle.client, 'get_media_info', { input: fx.video });
    expect(info.file).toBe(fx.video);
    expect(info.streams.length).toBeGreaterThanOrEqual(2);
    const ghost = await callRaw(handle.client, 'get_media_info', { input: path.join(fx.dir, 'ghost.mp4') });
    expect(ghost.parsed).toMatchObject({ ok: false });
  });

  it('convert_media runs a real h264/aac conversion to done', { timeout: 90000 }, async () => {
    const started = await call<{ jobId: string; output: string }>(handle.client, 'convert_media', {
      input: fx.video,
      output: path.join(fx.outStdio, 'converted.mp4'),
      videoCodec: 'libx264',
      qscale: 26,
      audioCodec: 'aac',
      transcoder: 'FFMPEG',
    });
    const done = await waitForJob(handle.client, started.jobId, { timeout: 90000 });
    expect(done.status).toBe('done');
    expect(fileSizeBytes(started.output)).toBeGreaterThan(0);
    expect(probeCodec(started.output, 'video')).toBe('h264');
    expect(probeCodec(started.output, 'audio')).toBe('aac');
  });

  it('list_jobs and get_job expose the finished job', async () => {
    const convert = await call<{ jobId: string }>(handle.client, 'convert_media', {
      input: fx.video,
      output: path.join(fx.outStdio, 'listed.mp4'),
      videoCodec: 'libx264',
      qscale: 26,
      audioCodec: 'aac',
      transcoder: 'FFMPEG',
    });
    await waitForJob(handle.client, convert.jobId);
    const jobs = await call<Array<{ id: string; status: string }>>(handle.client, 'list_jobs', {});
    expect(jobs.some((job) => job.id === convert.jobId)).toBe(true);
    const detail = await call<{ status: string }>(handle.client, 'get_job', { jobId: convert.jobId });
    expect(detail.status).toBe('done');
    const ghost = await callRaw(handle.client, 'get_job', { jobId: 'no-such-job' });
    expect(ghost.parsed).toMatchObject({ ok: false });
  });

  it('extract_audio drops the video stream', { timeout: 90000 }, async () => {
    const started = await call<{ jobId: string; output: string }>(handle.client, 'extract_audio', {
      input: fx.video,
      output: path.join(fx.outStdio, 'audio.mp3'),
    });
    await waitForJob(handle.client, started.jobId, { timeout: 90000 });
    expect(fileSizeBytes(started.output)).toBeGreaterThan(0);
    expect(probeCodec(started.output, 'audio')).toBe('mp3');
  });

  it('compress_image writes a webp', { timeout: 90000 }, async () => {
    const started = await call<{ jobId: string; output: string }>(handle.client, 'compress_image', {
      input: fx.image,
      output: path.join(fx.outStdio, 'image.webp'),
      format: 'webp',
      quality: 28,
    });
    await waitForJob(handle.client, started.jobId, { timeout: 90000 });
    expect(fileSizeBytes(started.output)).toBeGreaterThan(0);
  });

  it('cut_video trims via stream copy', { timeout: 90000 }, async () => {
    const started = await call<{ jobId: string; output: string }>(handle.client, 'cut_video', {
      input: fx.video,
      output: path.join(fx.outStdio, 'cut.mp4'),
      duration: '0.4',
    });
    await waitForJob(handle.client, started.jobId, { timeout: 90000 });
    expect(fileSizeBytes(started.output)).toBeGreaterThan(0);
  });

  it('batch_convert queues both files and both jobs finish', { timeout: 120000 }, async () => {
    const started = await call<{ total: number; jobs: Array<{ jobId: string; output: string }> }>(handle.client, 'batch_convert', {
      inputs: [fx.video, fx.video2],
      outputDir: path.join(fx.outStdio, 'batch'),
      videoCodec: 'libvpx-vp9',
      concurrency: 2,
    });
    expect(started.total).toBe(2);
    const ids = started.jobs.map((job) => job.jobId);
    await expect
      .poll(
        async () => {
          const jobs = await call<Array<{ id: string; status: string }>>(handle.client, 'list_jobs', {});
          return ids.map((id) => (jobs.find((job) => job.id === id)?.status ?? 'missing').toLowerCase());
        },
        { timeout: 120000, interval: 200 },
      )
      .toEqual(['done', 'done']);
    for (const job of started.jobs) expect(fileSizeBytes(job.output)).toBeGreaterThan(0);
  });

  it('remux_media stream-copies into mkv', { timeout: 90000 }, async () => {
    const started = await call<{ jobId: string; output: string; container: string; map: string[] }>(handle.client, 'remux_media', {
      input: fx.video,
      container: 'mkv',
      output: path.join(fx.outStdio, 'remuxed.mkv'),
    });
    expect(started.container).toBe('mkv');
    expect(started.map).toEqual(['0:v:0', '0:a:0']);
    await waitForJob(handle.client, started.jobId, { timeout: 90000 });
    expect(fileSizeBytes(started.output)).toBeGreaterThan(0);
  });

  it('remux_media muxes subtitle, cover art and chapters', { timeout: 90000 }, async () => {
    const started = await call<{ jobId: string; output: string }>(handle.client, 'remux_media', {
      input: fx.video,
      container: 'mkv',
      output: path.join(fx.outStdio, 'remuxed-full.mkv'),
      addSubtitle: [{ file: fx.subtitle, codec: 'srt' }],
      thumbnail: { file: fx.image },
      chapters: { file: fx.chapters },
    });
    await waitForJob(handle.client, started.jobId, { timeout: 90000 });
    const info = await call<{ streams: Array<{ type: string }> }>(handle.client, 'get_media_info', { input: started.output });
    expect(info.streams.some((stream) => stream.type === 'subtitle')).toBe(true);
    expect(info.streams.some((stream) => stream.type === 'video')).toBe(true);
  });

  it('demux_media extracts one job per stream', { timeout: 90000 }, async () => {
    const started = await call<{ total: number; jobs: Array<{ jobId: string; output: string }> }>(handle.client, 'demux_media', {
      input: fx.video,
      outputDir: path.join(fx.outStdio, 'demuxed'),
    });
    expect(started.total).toBe(2);
    for (const job of started.jobs) {
      await waitForJob(handle.client, job.jobId, { timeout: 90000 });
      expect(fileSizeBytes(job.output)).toBeGreaterThan(0);
    }
  });

  it('remux/demux failures map to readable codes', async () => {
    await expect(
      toolErrorCode(handle.client, 'remux_media', {
        input: fx.video,
        container: 'mkv',
        addSubtitle: [{ file: path.join(fx.dir, 'ghost.srt') }],
      }),
    ).resolves.toBe('AUXILIARY_INPUT_NOT_FOUND');
    await expect(
      toolErrorCode(handle.client, 'remux_media', { input: fx.video, container: 'ts', chapters: { file: fx.chapters } }),
    ).resolves.toBe('INCOMPATIBLE_CONTAINER');
    await expect(toolErrorCode(handle.client, 'demux_media', { input: fx.video, subtitles: true })).resolves.toBe('STREAM_NOT_FOUND');
  });

  it('cancel_job removes queued jobs and rejects unknown ids', { timeout: 120000 }, async () => {
    const first = await call<{ jobId: string }>(handle.client, 'convert_media', {
      input: fx.long,
      output: path.join(fx.outStdio, 'cancel-1.mp4'),
      videoCodec: 'libx264',
      concurrency: 1,
      transcoder: 'FFMPEG',
    });
    const queued = await call<{ jobId: string }>(handle.client, 'convert_media', {
      input: fx.long,
      output: path.join(fx.outStdio, 'cancel-2.mp4'),
      videoCodec: 'libx264',
      concurrency: 1,
      transcoder: 'FFMPEG',
    });
    const cancelled = await call<{ cancelled: boolean }>(handle.client, 'cancel_job', { jobId: queued.jobId });
    expect(cancelled.cancelled).toBe(true);

    const ghost = await callRaw(handle.client, 'get_job', { jobId: queued.jobId });
    expect(ghost.parsed).toMatchObject({ ok: false });

    const unknown = await callRaw(handle.client, 'cancel_job', { jobId: 'no-such-job' });
    expect(unknown.parsed).toMatchObject({ ok: false });

    const running = await call<{ cancelled: boolean }>(handle.client, 'cancel_job', { jobId: first.jobId });
    expect(running.cancelled).toBe(true);

    await expect
      .poll(
        async () => {
          const jobs = await call<Array<{ id: string }>>(handle.client, 'list_jobs', {});
          return jobs.some((job) => job.id === first.jobId || job.id === queued.jobId);
        },
        { timeout: 30000, interval: 200 },
      )
      .toBe(false);
  });

  it('resources list/read serve the encodex:// documents and MCP App views', async () => {
    const { resources } = await handle.client.listResources();
    expect(resources.map((resource) => resource.uri).sort()).toEqual(ALL_RESOURCE_URIS);
    for (const resource of resources.filter((candidate) => candidate.uri.startsWith('encodex://'))) {
      const { contents } = await handle.client.readResource({ uri: resource.uri });
      expect(contents.length).toBeGreaterThan(0);
      expect(() => JSON.parse((contents[0] as { text: string }).text)).not.toThrow();
    }
    await assertMcpAppsSurface(handle);
  });

  it('prompts list/get render all four prompts', async () => {
    const { prompts } = await handle.client.listPrompts();
    expect(prompts.map((prompt) => prompt.name).sort()).toEqual(['batch-convert', 'compress-image', 'convert-video', 'extract-audio']);
    for (const prompt of prompts) expect(String(prompt.description ?? '').length).toBeGreaterThan(10);
    const got = await handle.client.getPrompt({ name: 'convert-video', arguments: { input: fx.video, videoCodec: 'libx264' } });
    expect(got.messages.length).toBeGreaterThan(0);
  });
});
