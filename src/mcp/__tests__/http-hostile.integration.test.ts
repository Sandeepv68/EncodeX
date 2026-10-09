/**
 * @fileoverview Spawn-level hostile suite against the standalone MCP HTTP
 * server (`node dist/mcp/http-server.js`). Where `http.test.ts` drives the
 * handler in-process, this closes the Phase-6.2 process rows of
 * `plans/ADVERSARIAL_TEST_HARDENING_PLAN.md` against a real child process:
 * missing/incorrect bearer tokens, tokens smuggled through the query string,
 * non-loopback Host/Origin headers, an oversized request body, 100 concurrent
 * connections against a bounded session table, a bind to a port already in
 * use, and prompt termination while a session hangs open.
 *
 * Run via `npm run test:integration` (builds `dist` first). If you invoke
 * vitest directly, run `npm run build:main` first. Excluded from the default
 * unit suite.
 */

import { describe, it, beforeAll, afterEach, expect, vi } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as http from 'http';

const DIST_MCP_HTTP = fileURLToPath(new URL('../../../dist/mcp/http-server.js', import.meta.url));
// Startup-detection budget for a freshly spawned child. Generous on purpose:
// under CI the shared runner cold-loads `dist/mcp/http-server.js` (a hefty
// module graph) while vitest is also collecting v8 coverage, and that has been
// observed to exceed a 7s budget without any real defect. This is not a
// per-request timeout; the standalone servers answer in tens of milliseconds.
const TYPICAL_RESPONSE_TIMEOUT_MS = 15000;

/** Accept header the MCP Streamable HTTP client contract requires on POSTs. */
const OPEN_ACCEPT = 'application/json, text/event-stream';

/** Live server child plus the readiness facts parsed off its stdout. */
interface HttpHarness {
  child: ChildProcessWithoutNullStreams;
  lines: string[];
  buffer: string;
  ready: { port: number } | undefined;
  token: string | undefined;
  stderr: string;
}

/** A finished HTTP exchange. */
interface HttpResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  text: string;
}

async function ensureBuild(): Promise<void> {
  if (!fs.existsSync(DIST_MCP_HTTP)) {
    throw new Error(`Missing ${DIST_MCP_HTTP}. Run \`npm run build:main\` before the integration test.`);
  }
}

/**
 * Spawns a fresh HTTP server child. The entry prints `MCP_HTTP_TOKEN=...`
 * followed by a `MCP_HTTP_READY http://127.0.0.1:PORT/mcp` log line on stdout;
 * both are parsed here.
 * @param {string[]} args - CLI flags for the entry.
 * @returns {HttpHarness} The harness reflecting the child's output so far.
 */
function spawnHttpServer(args: string[]): HttpHarness {
  const child = spawn(process.execPath, [DIST_MCP_HTTP, ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
  const harness: HttpHarness = { child, lines: [], buffer: '', ready: undefined, token: undefined, stderr: '' };
  child.stdout.on('data', (chunk: Buffer) => {
    harness.buffer += chunk.toString('utf8');
    let nl = harness.buffer.indexOf('\n');
    while (nl !== -1) {
      const line = harness.buffer.slice(0, nl).replace(/\r$/, '');
      harness.buffer = harness.buffer.slice(nl + 1);
      if (line.trim() !== '') harness.lines.push(line);
      const tokenMatch = /^MCP_HTTP_TOKEN=(.+)$/.exec(line);
      if (tokenMatch) harness.token = tokenMatch[1];
      const readyMatch = /MCP_HTTP_READY http:\/\/127\.0\.0\.1:(\d+)/.exec(line);
      if (readyMatch) harness.ready = { port: Number(readyMatch[1]) };
      nl = harness.buffer.indexOf('\n');
    }
  });
  child.stderr.on('data', (chunk: Buffer) => {
    harness.stderr += chunk.toString('utf8');
  });
  // A child that dies mid-request emits an EPIPE/etc. on its pipes without
  // crashing the parent; that is a normal partner failure, not an unhandled
  // fault to attribute to the test suite.
  child.stdin.on('error', () => {});
  child.stdout.on('error', () => {});
  child.stderr.on('error', () => {});
  return harness;
}

/** Resolves with the port once the READY line arrives. */
async function waitForReady(harness: HttpHarness, timeoutMs = TYPICAL_RESPONSE_TIMEOUT_MS): Promise<number> {
  await vi.waitFor(
    () => {
      expect(harness.ready, `server never reported ready. stderr: ${harness.stderr}`).toBeDefined();
    },
    { timeout: timeoutMs, interval: 25 },
  );
  return harness.ready!.port;
}

/** Resolves with the printed bearer token once its line arrives. */
async function waitForToken(harness: HttpHarness, timeoutMs = TYPICAL_RESPONSE_TIMEOUT_MS): Promise<string> {
  await vi.waitFor(
    () => {
      expect(harness.token, `server never printed MCP_HTTP_TOKEN. stderr: ${harness.stderr}`).toBeDefined();
    },
    { timeout: timeoutMs, interval: 25 },
  );
  return harness.token!;
}

/**
 * Issues one HTTP request and resolves with status/headers/body bytes.
 * @param {number} port - Server port.
 * @param {object} spec - Method, path, headers and body.
 * @returns {Promise<HttpResponse>} The parsed response envelope.
 */
function httpRequest(
  port: number,
  spec: { method?: string; path?: string; headers?: Record<string, string>; body?: string },
): Promise<HttpResponse> {
  const headers: Record<string, string> = { Connection: 'close', ...(spec.headers ?? {}) };
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, method: spec.method ?? 'POST', path: spec.path ?? '/mcp', headers, agent: false },
      (res) => {
        const chunks: Buffer[] = [];
        const finish = (): void =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') });
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('error', finish);
        res.on('end', finish);
      },
    );
    req.on('error', reject);
    if (spec.body !== undefined) req.write(spec.body);
    req.end();
  });
}

/**
 * Posts a JSON body with the MCP client-contract headers.
 * @param {number} port - Server port.
 * @param {object} spec - Extra headers, path, JSON body.
 * @returns {Promise<HttpResponse>} The response.
 */
function post(
  port: number,
  spec: { sid?: string; headers?: Record<string, string>; path?: string; body?: unknown } = {},
): Promise<HttpResponse> {
  return httpRequest(port, {
    ...spec,
    body: spec.body === undefined ? undefined : JSON.stringify(spec.body),
    headers: {
      Accept: OPEN_ACCEPT,
      'Content-Type': 'application/json',
      ...(spec.sid !== undefined ? { 'mcp-session-id': spec.sid } : {}),
      ...(spec.headers ?? {}),
    },
  });
}

/** A fresh JSON-RPC initialize message. @returns {Record<string,unknown>} */
function initializeMessage(): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'http-integration-client', version: '1.0.0' } },
  };
}

/** A tools/list message. @returns {Record<string,unknown>} */
function toolsListMessage(): Record<string, unknown> {
  return { jsonrpc: '2.0', id: 2, method: 'tools/list' };
}

function waitForExit(child: ChildProcessWithoutNullStreams, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: boolean): void => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    if (child.exitCode !== null) {
      settle(true);
      return;
    }
    child.once('exit', () => settle(true));
    setTimeout(() => settle(false), timeoutMs).unref();
  });
}

describe('EncodeX MCP HTTP server (hostile peers)', () => {
  let lastSpawned: HttpHarness[] = [];

  beforeAll(async () => {
    await ensureBuild();
  });

  afterEach(() => {
    for (const harness of lastSpawned) {
      if (harness.child.exitCode === null) harness.child.kill();
    }
    lastSpawned = [];
  });

  function fresh(args: string[]): HttpHarness {
    const harness = spawnHttpServer(args);
    lastSpawned.push(harness);
    return harness;
  }

  it('requires the bearer token with 401 and serves tools once presented', async () => {
    const h = fresh([]);
    const token = await waitForToken(h);
    const port = await waitForReady(h);

    const anonymous = await post(port, { body: initializeMessage() });
    expect(anonymous.status).toBe(401);
    expect(anonymous.headers['www-authenticate']).toBe('Bearer');

    const wrong = await post(port, { body: initializeMessage(), headers: { Authorization: 'Bearer wrong-token' } });
    expect(wrong.status).toBe(401);

    const ok = await post(port, { body: initializeMessage(), headers: { Authorization: `Bearer ${token}` } });
    expect(ok.status).toBe(200);
    const sid = ok.headers['mcp-session-id'];
    expect(typeof sid).toBe('string');

    const tools = await post(port, {
      sid: sid as string,
      body: toolsListMessage(),
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(tools.status).toBe(200);
    const result = JSON.parse(tools.text) as { result?: { tools?: Array<{ name: string }> } };
    expect(result.result?.tools?.some((t) => t.name === 'convert_media')).toBe(true);
  });

  it('--no-auth opens the surface without a token line', async () => {
    const h = fresh(['--no-auth']);
    const port = await waitForReady(h);
    expect(h.token, 'no-auth run must not print a token').toBeUndefined();
    const ok = await post(port, { body: initializeMessage() });
    expect(ok.status).toBe(200);
  });

  it('refuses a token smuggled through the query string even with valid auth', async () => {
    const h = fresh(['--token', 'fixedtoken']);
    const port = await waitForReady(h);
    const auth = { Authorization: 'Bearer fixedtoken' };
    for (const query of ['token=fixedtoken', 'access_token=fixedtoken', 'auth=fixedtoken', 'authorization=fixedtoken']) {
      const res = await post(port, { body: initializeMessage(), headers: auth, path: `/mcp?${query}` });
      expect(res.status, `query ${query} must be refused`).toBe(400);
    }
  });

  it('rejects non-loopback Host and Origin and stays reachable on loopback', async () => {
    const h = fresh(['--no-auth']);
    const port = await waitForReady(h);

    const evilHost = await post(port, { body: initializeMessage(), headers: { Host: 'evil.example' } });
    expect(evilHost.status).toBe(403);
    const evilHostPort = await post(port, { body: initializeMessage(), headers: { Host: 'evil.example:8080' } });
    expect(evilHostPort.status).toBe(403);
    const evilOrigin = await post(port, { body: initializeMessage(), headers: { Origin: 'http://evil.example' } });
    expect(evilOrigin.status).toBe(403);

    const ok = await post(port, { body: initializeMessage() });
    expect(ok.status).toBe(200);
  });

  it('refuses a declared body over the 10 MB cap with 413 and keeps serving', async () => {
    const h = fresh(['--no-auth']);
    const port = await waitForReady(h);

    const oversized = await httpRequest(port, {
      headers: {
        Accept: OPEN_ACCEPT,
        'Content-Type': 'application/json',
        'Content-Length': String(11 * 1024 * 1024),
      },
      body: '{}',
    });
    expect(oversized.status).toBe(413);
    expect(oversized.text).toContain('Request body too large');

    const ok = await post(port, { body: initializeMessage() });
    expect(ok.status).toBe(200);
  });

  it('never lets 100 concurrent connection attempts overflow the session cap', async () => {
    const h = fresh(['--no-auth', '--max-sessions', '8']);
    const port = await waitForReady(h);

    const attempts = Array.from({ length: 100 }, () => post(port, { body: initializeMessage() }));
    const responses = await Promise.all(attempts);
    const statuses = responses.map((r) => r.status);
    expect(
      statuses.every((s) => s === 200 || s === 503),
      `unexpected statuses: ${statuses.join(', ')}`,
    ).toBe(true);
    expect(statuses.filter((s) => s === 200)).toHaveLength(8);
    expect(statuses.filter((s) => s === 503)).toHaveLength(92);

    const opened = responses.filter((r) => r.status === 200);
    for (const res of opened) {
      const sid = res.headers['mcp-session-id'];
      expect(typeof sid).toBe('string');
      const del = await httpRequest(port, { method: 'DELETE', path: '/mcp', headers: { 'mcp-session-id': sid as string } });
      expect(del.status).toBe(200);
    }

    const fine = await post(port, { body: initializeMessage() });
    expect(fine.status).toBe(200);
  });

  it('exits with code 1 when the requested port is already in use', async () => {
    const first = fresh(['--no-auth']);
    const port = await waitForReady(first);

    const second = spawnHttpServer(['--no-auth', '--port', String(port)]);
    const exited = await waitForExit(second.child, 15000);
    expect(exited, 'second server must exit on EADDRINUSE').toBe(true);
    expect(second.child.exitCode).toBe(1);
    expect(second.stderr).toContain('failed to start');

    const stillFine = await post(port, { body: initializeMessage() });
    expect(stillFine.status).toBe(200);
  });

  it('terminates promptly on SIGTERM while a session hangs open', async () => {
    const h = fresh(['--no-auth']);
    const port = await waitForReady(h);
    const ok = await post(port, { body: initializeMessage() });
    expect(ok.status).toBe(200);
    expect(typeof ok.headers['mcp-session-id']).toBe('string');

    h.child.kill('SIGTERM');
    const exited = await waitForExit(h.child, 5000);
    expect(exited, 'server must not hang while a session is open').toBe(true);
  });
});
