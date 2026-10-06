/**
 * @fileoverview Spawn-level hostile suite against the standalone stdio MCP
 * server (`node dist/mcp/index.js`). Unlike the unit suite (which drives the
 * zod boundary through a Client over InMemoryTransport), this sends raw,
 * attacker-shaped bytes to a real child process and asserts that the server
 * *fails closed and survives*: every malformed frame is dropped, stdout stays
 * a pristine JSON-RPC-only stream, and a well-formed request still gets a
 * response afterwards. It closes the Phase-6.2 "stdio frame hostility" row of
 * `plans/ADVERSARIAL_TEST_HARDENING_PLAN.md`.
 *
 * Framing note: the SDK's `StdioServerTransport` uses newline-delimited JSON --
 * `ReadBuffer` splits on `\n` and `JSON.parse`es each line, with a hard
 * `maxBufferSize` of 10 MB. It does not use the legacy `Content-Length:`
 * header framing, so the plan's "wrong Content-Length" row is expressed here
 * two ways: a line that *is* legacy header framing (the wrong framing for this
 * transport), and an over-cap line (> 10 MB without a newline), which the SDK
 * refuses by clearing its buffer and closing the transport.
 *
 * Run via `npm run test:integration` (builds `dist` first). If you invoke
 * vitest directly, run `npm run build:main` first. Excluded from the default
 * unit suite.
 */

import { describe, it, beforeAll, afterEach, expect, vi } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const DIST_MCP = fileURLToPath(new URL('../../../dist/mcp/index.js', import.meta.url));
const TYPICAL_RESPONSE_TIMEOUT_MS = 7000;

interface StdioHarness {
  child: ChildProcessWithoutNullStreams;
  /** Every JSON-RPC-ish message parsed off stdout, in arrival order. */
  messages: Array<Record<string, unknown>>;
  /**
   * Any stdout line that is not valid JSON. The protocol stream must carry
   * nothing else, so the presence of the first one is an assertion failure.
   */
  protocolViolations: string[];
  buffer: string;
}

async function ensureBuild(): Promise<void> {
  if (!fs.existsSync(DIST_MCP)) {
    throw new Error(`Missing ${DIST_MCP}. Run \`npm run build:main\` before the integration test.`);
  }
}

/**
 * Spawns a fresh server child with fully piped stdio. Each test owns its child
 * so hostile frames can never poison a sibling test's transport.
 */
function spawnServer(): StdioHarness {
  const child = spawn(process.execPath, [DIST_MCP], { stdio: ['pipe', 'pipe', 'pipe'] });
  const harness: StdioHarness = { child, messages: [], protocolViolations: [], buffer: '' };
  child.stdout.on('data', (chunk: Buffer) => {
    harness.buffer += chunk.toString('utf8');
    let nl = harness.buffer.indexOf('\n');
    while (nl !== -1) {
      const line = harness.buffer.slice(0, nl).replace(/\r$/, '');
      harness.buffer = harness.buffer.slice(nl + 1);
      if (line.trim() !== '') {
        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          parsed = undefined;
        }
        if (parsed !== undefined && typeof parsed === 'object' && parsed !== null) {
          harness.messages.push(parsed as Record<string, unknown>);
        } else {
          harness.protocolViolations.push(line);
        }
      }
      nl = harness.buffer.indexOf('\n');
    }
  });
  child.stderr.on('data', () => {
    // Log lines are routed to stderr by design; tolerated, not asserted on.
  });
  // A child that dies mid-stream emits EPIPE/"write EOF" on its stdio without
  // crashing the parent; that is a normal (and expected) partner failure, not
  // an unhandled fault the crash tripwire should attribute to us.
  child.stdin.on('error', () => {});
  child.stdout.on('error', () => {});
  child.stderr.on('error', () => {});
  return harness;
}

/** Writes a raw frame plus a trailing newline to the child's stdin. */
function writeLine(harness: StdioHarness, raw: string | Buffer): void {
  harness.child.stdin.write(Buffer.isBuffer(raw) ? Buffer.concat([raw, Buffer.from('\n')]) : `${raw}\n`);
}

/** Writes raw bytes to the child's stdin verbatim (no framing added). */
function writeRaw(harness: StdioHarness, raw: Buffer | string): void {
  harness.child.stdin.write(Buffer.isBuffer(raw) ? raw : Buffer.from(raw));
}

/** Writes a well-formed JSON-RPC request frame. */
function writeRequest(harness: StdioHarness, id: number, method: string, params: Record<string, unknown> = {}): void {
  writeLine(harness, JSON.stringify({ jsonrpc: '2.0', id, method, params }));
}

function messageWithId(harness: StdioHarness, id: number): Record<string, unknown> | undefined {
  return harness.messages.find((m) => m.id === id);
}

async function waitForResponse(
  harness: StdioHarness,
  id: number,
  timeoutMs = TYPICAL_RESPONSE_TIMEOUT_MS,
): Promise<Record<string, unknown>> {
  let found: Record<string, unknown> | undefined;
  await vi.waitFor(
    () => {
      found = messageWithId(harness, id);
      expect(found, `server never answered id ${id}`).toBeDefined();
    },
    { timeout: timeoutMs, interval: 25 },
  );
  return found!;
}

/** Asserts the server did NOT answer id `id` within the window. */
async function expectNoResponseFor(harness: StdioHarness, id: number, windowMs = 1500): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, windowMs));
  expect(messageWithId(harness, id), `unexpected response for id ${id}`).toBeUndefined();
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

describe('EncodeX MCP stdio server (hostile frames)', () => {
  let lastSpawned: StdioHarness | undefined;

  beforeAll(async () => {
    await ensureBuild();
  });

  afterEach(() => {
    if (lastSpawned && !lastSpawned.child.killed && lastSpawned.child.exitCode === null) {
      lastSpawned.child.kill();
    }
  });

  function spawnFresh(): StdioHarness {
    const h = spawnServer();
    lastSpawned = h;
    return h;
  }

  it('drops a garbage JSON line and keeps serving; stdout stays JSON-RPC-only', async () => {
    const h = spawnFresh();
    writeLine(h, 'this is not json, just attacker bytes');
    writeRequest(h, 1001, 'tools/list');
    const response = await waitForResponse(h, 1001);
    expect(response.error).toBeUndefined();
    expect(Array.isArray((response as { result?: { tools?: unknown[] } }).result?.tools)).toBe(true);
    expect(h.protocolViolations).toEqual([]);
    await h.child.kill();
  });

  it('drops valid JSON that is not an MCP message shape', async () => {
    const h = spawnFresh();
    writeLine(h, '{"foo": 1, "not": "a message"}');
    writeLine(h, '{}');
    writeRequest(h, 1002, 'tools/list');
    const response = await waitForResponse(h, 1002);
    expect(Array.isArray((response as { result?: { tools?: unknown[] } }).result?.tools)).toBe(true);
    expect(h.messages.filter((m) => m.id === undefined || m.id === null).length).toBe(0);
    expect(h.protocolViolations).toEqual([]);
    await h.child.kill();
  });

  it('drops primitive and blank JSON lines without desyncing the parser', async () => {
    const h = spawnFresh();
    writeLine(h, '42');
    writeLine(h, 'null');
    writeLine(h, '"a bare string"');
    writeLine(h, 'true');
    writeLine(h, '');
    writeRequest(h, 1003, 'tools/list');
    await waitForResponse(h, 1003);
    expect(h.messages.map((m) => m.id)).toEqual([1003]);
    expect(h.protocolViolations).toEqual([]);
    await h.child.kill();
  });

  it('a truncated frame swallows an inlined good request but a clean line is served after', async () => {
    const h = spawnFresh();
    // First frame is truncated (no terminating newline), so the next frame's
    // bytes join it on the same line; JSON.parse fails and BOTH are dropped.
    writeRaw(h, '{"jsonrpc":"2.0","id":1004,"method":"tools/list"');
    writeRequest(h, 1005, 'tools/list');
    await expectNoResponseFor(h, 1004);
    await expectNoResponseFor(h, 1005);
    writeRequest(h, 1006, 'tools/list');
    const response = await waitForResponse(h, 1006);
    expect(Array.isArray((response as { result?: { tools?: unknown[] } }).result?.tools)).toBe(true);
    expect(h.messages.map((m) => m.id)).toEqual([1006]);
    expect(h.protocolViolations).toEqual([]);
    await h.child.kill();
  });

  it('refuses legacy Content-Length header framing (wrong framing for this transport)', async () => {
    const h = spawnFresh();
    writeLine(h, 'Content-Length: 22\r\n\r\n{"jsonrpc":"2.0","id":7}');
    writeRequest(h, 1007, 'tools/list');
    await waitForResponse(h, 1007);
    expect(h.protocolViolations).toEqual([]);
    await h.child.kill();
  });

  it('drops an invalid-UTF-8 line and keeps serving', async () => {
    const h = spawnFresh();
    writeLine(h, Buffer.from([0xff, 0x00, 0xfe, 0x80, 0xc3, 0x28]));
    writeRequest(h, 1008, 'tools/list');
    await waitForResponse(h, 1008);
    expect(h.protocolViolations).toEqual([]);
    await h.child.kill();
  });

  it('answers an unknown method with -32601 and the echoed id, and stays alive', async () => {
    const h = spawnFresh();
    writeRequest(h, 1009, 'tools/definitely-not-registered');
    const response = await waitForResponse(h, 1009);
    expect(response.error).toMatchObject({ code: -32601 });
    expect((response as { error?: { message?: string } }).error?.message).toBe('Method not found');
    writeRequest(h, 1010, 'tools/list');
    await waitForResponse(h, 1010);
    expect(h.protocolViolations).toEqual([]);
    await h.child.kill();
  });

  it('an over-cap line (>10 MB) makes the transport fail closed instead of buffering unboundedly', async () => {
    const h = spawnFresh();
    // One unterminated "line" of 11 MB. The SDK's ReadBuffer refuses anything
    // over its 10 MB cap, clears, and closes the transport; the server must
    // not grow memory without bound, must not answer anything after, and
    // should exit on its own (close -> runMcpServer resolves -> process ends).
    writeLine(h, Buffer.alloc(11 * 1024 * 1024, 0x61));
    writeRequest(h, 1011, 'tools/list');
    await expectNoResponseFor(h, 1011, 2000);
    const exited = await waitForExit(h.child, 15000);
    expect(exited, 'server should exit after the transport fails closed').toBe(true);
    expect(h.protocolViolations).toEqual([]);
  });
});
