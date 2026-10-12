/**
 * @fileoverview W5 e2e suite for the embedded MCP server living inside the
 * Electron GUI.
 *
 * Launches the built app with a throwaway `--user-data-dir` whose
 * `mcp-settings.json` enables the server on a free port, then drives that one
 * endpoint as an MCP client. This is a Tier B spec (real preload, real main
 * process, real Job Manager): it sits in `e2e/vitest.e2e.real.config.ts`
 * because it must not run under the mock-preload config. It never touches the
 * renderer, so the terms gate can stay up.
 *
 * Two plan deviations are intentional and documented:
 *  - The GUI renderer queue (`JobQueue` in `src/main/ipc/queue.ts`) is a
 *    separate manager from the MCP one, so "the MCP conversion shows up in the
 *    GUI queue page" is asserted through `get_queue_state` instead of the UI.
 *  - Port sanitisation falls back to the canonical default (8765) for anything
 *    outside 1024-65535, so the seeded port is a valid in-range pick.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { connectHttp, call, callRaw, assertToolSurface, runCoreSuite } from './client';
import type { McpHandle } from './client';
import { launchEmbeddedApp, closeEmbeddedApp, pickFreePort, createMediaFixtures, ALL_TOOLS } from './harness';
import type { EmbeddedServerSession, MediaFixtures } from './harness';

const IS_REAL = process.env.E2E_REAL === '1';
const HAS_MEDIA = process.env.E2E_SKIP_MEDIA !== 'true';

describe.runIf(IS_REAL && HAS_MEDIA)('MCP embedded GUI server (e2e, real tier)', () => {
  let session: EmbeddedServerSession;
  let handle: McpHandle;
  let fx: MediaFixtures;

  beforeAll(async () => {
    const port = await pickFreePort();
    session = await launchEmbeddedApp({ enabled: true, port, token: '' }, { mock: false });
    handle = await connectHttp(session.url, { retries: 5, name: 'encodex-e2e-embedded' });
    fx = createMediaFixtures(fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-mcp-gui-')));
  }, 150000);

  afterAll(async () => {
    await handle?.close();
    await closeEmbeddedApp(session);
    try {
      if (fx?.dir) fs.rmSync(fx.dir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  });

  it('handshake advertises tools, resources, prompts and all 22 tools', async () => {
    await assertToolSurface(handle, ALL_TOOLS);
  });

  it('drives the shared core suite (light) over the embedded endpoint', { timeout: 180000 }, async () => {
    await runCoreSuite(handle, fx, { mode: 'light', outDir: fx.outGui });
  });

  it('get_queue_state reports the shared MCP queue', { timeout: 120000 }, async () => {
    const started = await call<{ jobId: string }>(handle.client, 'convert_media', {
      input: fx.video,
      output: path.join(fx.outGui, 'queued.mp4'),
      videoCodec: 'libx264',
      qscale: 26,
      audioCodec: 'aac',
      transcoder: 'FFMPEG',
    });
    await expect
      .poll(
        async () => {
          const state = await call<{ jobs?: Array<{ id?: string; status?: string }>; pending?: number }>(
            handle.client,
            'get_queue_state',
            {},
          );
          return (state.pending ?? -1) === 0 && (state.jobs ?? []).some((job) => job.id === started.jobId);
        },
        { timeout: 90000, interval: 250 },
      )
      .toBe(true);
    const final = await call<{ jobs?: Array<{ status?: string }> }>(handle.client, 'get_queue_state', {});
    expect(final.jobs?.some((job) => job.status === 'done')).toBe(true);
  });

  it('get_system_info reports platform and app version', async () => {
    const sys = await call<{ appVersion: string; platform: string; os: { cpuCount: number } }>(handle.client, 'get_system_info', {});
    expect(sys.appVersion.length).toBeGreaterThan(0);
    expect(sys.platform).toBe(process.platform);
    expect(sys.os.cpuCount).toBeGreaterThanOrEqual(1);
  });

  it('get_timeline probes the generated clip', async () => {
    const timeline = await call<{ file: string; duration: number; width: number; height: number; codec: string }>(
      handle.client,
      'get_timeline',
      { input: fx.video },
    );
    expect(timeline.file).toBe(fx.video);
    expect(timeline.duration).toBeGreaterThan(0);
    expect(timeline.width).toBeGreaterThan(0);
    expect(timeline.height).toBeGreaterThan(0);
    expect(timeline.codec).toBeTruthy();
  });

  it('extract_preview returns a base64 data URL', async () => {
    const preview = await call<{ dataUrl: string }>(handle.client, 'extract_preview', { input: fx.video });
    expect(preview.dataUrl).toMatch(/^data:image\//);
  });

  it('check_for_updates answers the releases feed', async () => {
    const { parsed } = await callRaw(handle.client, 'check_for_updates', {});
    if (parsed === undefined || (parsed as { ok?: boolean }).ok === false) {
      console.warn('check_for_updates unavailable (offline?); skipping assertion');
      expect(true).toBe(true);
      return;
    }
    expect(parsed).toHaveProperty('available');
    expect(typeof (parsed as { available: unknown }).available).toBe('boolean');
  });

  it('cancel_all_jobs drains the queue', { timeout: 150000 }, async () => {
    const first = await call<{ jobId: string }>(handle.client, 'convert_media', {
      input: fx.long,
      output: path.join(fx.outGui, 'drain-1.mp4'),
      videoCodec: 'libx264',
      concurrency: 1,
      transcoder: 'FFMPEG',
    });
    const second = await call<{ jobId: string }>(handle.client, 'convert_media', {
      input: fx.long,
      output: path.join(fx.outGui, 'drain-2.mp4'),
      videoCodec: 'libx264',
      concurrency: 1,
      transcoder: 'FFMPEG',
    });
    const res = await call<{ cancelled: boolean }>(handle.client, 'cancel_all_jobs', {});
    expect(res.cancelled).toBe(true);
    await expect
      .poll(
        async () => {
          const state = await call<{ pending?: number; jobs?: Array<{ id?: string }> }>(handle.client, 'get_queue_state', {});
          return (state.pending ?? -1) === 0 && !(state.jobs ?? []).some((job) => job.id === first.jobId || job.id === second.jobId);
        },
        { timeout: 60000, interval: 250 },
      )
      .toBe(true);
  });
});
