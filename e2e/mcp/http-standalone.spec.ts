/**
 * @fileoverview W4 e2e suite for the standalone Streamable-HTTP MCP server
 * (`node dist/mcp/http-server.js`).
 *
 * Spawns the server with a fixed token, verifies it echoes that token on its
 * ready banner, then runs the hostile-request probes (loopback/bearer/boundary
 * guards from `src/mcp/http.ts`) as raw HTTP calls the SDK client cannot make.
 * A separate phase dials the server as an MCP client and drives the full
 * 15-tool core suite over HTTP, plus the cross-session queue visibility that
 * proves the MCP job manager is process-global rather than per-session.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { connectHttp, call, callRaw, waitForJob, assertToolSurface, runCoreSuite } from './client';
import type { McpHandle } from './client';
import { startHttpServer, rawHttp, createMediaFixtures, CORE_TOOLS } from './harness';
import type { HttpServerHarness, MediaFixtures } from './harness';

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;
const HAS_MEDIA = process.env.E2E_SKIP_MEDIA !== 'true';
const TOKEN = 'encodex-e2e-http-token';
const AUTH = { Authorization: `Bearer ${TOKEN}` };
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const INITIALIZE = JSON.stringify({
  jsonrpc: '2.0',
  method: 'initialize',
  id: 1,
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'e2e-delete-probe', version: '1.0.0' } },
});

describe.runIf(IS_E2E && HAS_MEDIA)('MCP standalone HTTP server (e2e)', () => {
  let server: HttpServerHarness;
  let port: number;
  let fx: MediaFixtures;

  beforeAll(async () => {
    server = await startHttpServer({ token: TOKEN, port: 0, maxSessions: 16 });
    port = server.port;
    fx = createMediaFixtures(fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-mcp-http-')));
  }, 120000);

  afterAll(async () => {
    try {
      if (fx?.dir) fs.rmSync(fx.dir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
    await import('./harness').then(({ stopProcess }) => stopProcess(server?.child ?? null));
  });

  it('server echoes the requested bearer token on its ready banner', () => {
    expect(server.printedToken).toBe(TOKEN);
  });

  it('rejects requests without a bearer token (401)', async () => {
    const res = await rawHttp(port, {});
    expect(res.status).toBe(401);
  });

  it('rejects a wrong bearer token (401)', async () => {
    const res = await rawHttp(port, { headers: { Authorization: 'Bearer wrong-token' } });
    expect(res.status).toBe(401);
  });

  it('refuses tokens smuggled through the query string (400)', async () => {
    const res = await rawHttp(port, { urlPath: `/mcp?token=${TOKEN}`, headers: { ...AUTH, ...JSON_HEADERS }, body: '{}' });
    expect(res.status).toBe(400);
  });

  it('rejects a non-loopback Origin (403)', async () => {
    const res = await rawHttp(port, { headers: { ...AUTH, Origin: 'http://evil.example.com' } });
    expect(res.status).toBe(403);
  });

  it('rejects a non-loopback Host (403)', async () => {
    const res = await rawHttp(port, { headers: { ...AUTH, Host: 'evil.example.com' } });
    expect(res.status).toBe(403);
  });

  it('rejects non-MCP paths (404)', async () => {
    const res = await rawHttp(port, { urlPath: '/nope', headers: { ...AUTH, ...JSON_HEADERS }, body: '{}' });
    expect(res.status).toBe(404);
  });

  it('rejects unsupported methods (405)', async () => {
    const res = await rawHttp(port, { method: 'PUT', headers: { ...AUTH, ...JSON_HEADERS }, body: '{}' });
    expect(res.status).toBe(405);
  });

  it('rejects wrong content types (415)', async () => {
    const res = await rawHttp(port, { headers: { ...AUTH, 'Content-Type': 'text/plain' }, body: '{}' });
    expect(res.status).toBe(415);
  });

  it('refuses oversized request bodies (413)', async () => {
    const res = await rawHttp(port, { headers: { ...AUTH, ...JSON_HEADERS, 'Content-Length': String(20 * 1024 * 1024) }, body: 'x' });
    expect(res.status).toBe(413);
  });

  it('refuses session-less GET requests (400)', async () => {
    const res = await rawHttp(port, { method: 'GET', headers: { ...AUTH } });
    expect(res.status).toBe(400);
  });

  it('drives the full 15-tool core suite over authenticated HTTP', { timeout: 300000 }, async () => {
    const handle = await connectHttp(`http://127.0.0.1:${port}/mcp`, { token: TOKEN, retries: 5, name: 'encodex-e2e-http' });
    await assertToolSurface(handle, CORE_TOOLS);
    await runCoreSuite(handle, fx, { mode: 'full', outDir: fx.outHttp });
    await handle.close();
  });

  it('shares the MCP job queue across sessions', { timeout: 120000 }, async () => {
    const sessionA = await connectHttp(`http://127.0.0.1:${port}/mcp`, { token: TOKEN, retries: 5, name: 'encodex-e2e-http-a' });
    const sessionB = await connectHttp(`http://127.0.0.1:${port}/mcp`, { token: TOKEN, retries: 5, name: 'encodex-e2e-http-b' });
    try {
      const started = await call<{ jobId: string; output: string }>(sessionA.client, 'convert_media', {
        input: fx.video2,
        output: path.join(fx.outHttp, 'cross-session.mp4'),
        videoCodec: 'libx264',
        qscale: 26,
        audioCodec: 'aac',
        transcoder: 'FFMPEG',
      });
      const done = await waitForJob(sessionA.client, started.jobId, { timeout: 90000 });
      expect(done.status).toBe('done');

      const jobs = await call<Array<{ id: string; status: string }>>(sessionB.client, 'list_jobs', {});
      expect(jobs.some((job) => job.id === started.jobId)).toBe(true);
      const viaB = await call<{ status: string }>(sessionB.client, 'get_job', { jobId: started.jobId });
      expect(viaB.status).toBe('done');
    } finally {
      await sessionA.close();
      await sessionB.close();
    }
  });

  it('closes a session on DELETE and 404s later traffic for that id', async () => {
    const created = await rawHttp(port, {
      headers: { ...AUTH, ...JSON_HEADERS, Accept: 'application/json, text/event-stream' },
      body: INITIALIZE,
    });
    expect(created.status).toBe(200);
    const sessionId = typeof created.headers['mcp-session-id'] === 'string' ? created.headers['mcp-session-id'] : undefined;
    expect(sessionId).toBeTruthy();

    const deleted = await rawHttp(port, { method: 'DELETE', headers: { ...AUTH, 'mcp-session-id': sessionId as string } });
    expect(deleted.status).toBe(200);

    const after = await rawHttp(port, {
      headers: { ...AUTH, ...JSON_HEADERS, Accept: 'application/json, text/event-stream', 'mcp-session-id': sessionId as string },
      body: INITIALIZE,
    });
    expect(after.status).toBe(404);
  });
});
